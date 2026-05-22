// Edge Function: dispatch-webhook
//
// Intermediário entre os triggers do banco e os sistemas externos.
// Chamado pelo pg_net (via dispatch_webhook() SQL) quando:
//   - uma task SF é atualizada → event 'task.updated'
//   - um comment/reply em task SF é criado/editado → 'comment.*' / 'reply.*'
//
// Payload INTERNO de entrada (v2 · 2026-05-22): identificadores no top-level,
// external_ids e record completo dentro de `data` (trigger manda tudo).
//
//   task.updated:
//     { event, sent_at, task_id, data: { task_external_id, external_source,
//                                        record (todas colunas), old_record } }
//   comment.* / reply.*:
//     { event, sent_at, task_id, comment_id, is_reply,
//       data: { task_external_id, comment_external_id, parent_id,
//               parent_external_id, external_source,
//               record (todas colunas), old_record } }
//
// Payload EXTERNO enviado pra URL destino (slim, v2.1 · 2026-05-22):
//
//   task → WEBHOOK_URL_TASK:
//     { sent_at, task_id,
//       data: { task_external_id,
//               record: { titulo, descricao, responsavel,
//                         prioridade, prazo, subetapa } } }
//
//   comment/reply → WEBHOOK_URL_COMMENT:
//     { sent_at, comment_id, is_reply,
//       data: { task_external_id, comment_external_id, parent_external_id,
//               record: { body } } }
//
// `responsavel` vai como nome textual (lookup em pessoas pela pessoa_id).
// `comment_external_id` é null no create, valor no update.
// `is_reply` distingue comment vs reply; create vs update se diferencia
// olhando comment_external_id (null = create).
//
// Fluxo:
//   1. Valida Bearer token (DISPATCH_WEBHOOK_SECRET env).
//   2. Constrói payload slim a partir do payload interno.
//   3. Roteia pra WEBHOOK_URL_TASK ou WEBHOOK_URL_COMMENT.
//   4. Fetch síncrono com timeout de 10s.
//   5. Lê { external_id } do body de resposta.
//   6. Atualiza o registro no banco com external_id + webhook_sync_status.
//
// Auth de entrada: Authorization: Bearer <DISPATCH_WEBHOOK_SECRET>
// Env vars (Edge Functions > Settings > Secrets):
//   DISPATCH_WEBHOOK_SECRET  — obrigatório; rejeita request se ausente ou não-bater
//   WEBHOOK_URL_TASK         — endpoint externo para task.updated
//   WEBHOOK_URL_COMMENT      — endpoint externo para comment.*/reply.*

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DISPATCH_SECRET = Deno.env.get('DISPATCH_WEBHOOK_SECRET') ?? '';
const URL_TASK        = Deno.env.get('WEBHOOK_URL_TASK') ?? '';
const URL_COMMENT     = Deno.env.get('WEBHOOK_URL_COMMENT') ?? '';

const FETCH_TIMEOUT_MS = 10_000;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
const err = (status: number, code: string, message: string) =>
  json(status, { error: { code, message } });

async function setTaskSyncStatus(
  taskId: string,
  status: 'synced' | 'error',
  errorMsg: string | null,
  externalId?: string,
) {
  const patch: Record<string, unknown> = {
    webhook_sync_status: status,
    webhook_sync_error:  errorMsg,
  };
  if (externalId) patch.external_id = externalId;
  const { error } = await sb.from('tasks').update(patch).eq('id', taskId);
  if (error) console.error('[dispatch-webhook] setTaskSyncStatus failed:', error.message);
}

async function setCommentExternalId(commentId: string, externalId: string) {
  const { error } = await sb
    .from('task_comments')
    .update({ external_id: externalId, external_source: 'salesforce', last_ingest_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) console.error('[dispatch-webhook] setCommentExternalId failed:', error.message);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return err(405, 'method_not_allowed', 'POST only');

  // Auth opcional: se DISPATCH_WEBHOOK_SECRET estiver setado, valida o Bearer.
  // Sem env var, aceita qualquer request (função só é chamada pelo pg_net interno).
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (DISPATCH_SECRET && token !== DISPATCH_SECRET) {
    return err(401, 'unauthorized', 'invalid or missing Authorization');
  }

  let payload: {
    event:       string;
    sent_at:     string;
    task_id?:    string;
    comment_id?: string;
    is_reply?:   boolean;
    data:        Record<string, unknown>;
  };
  try { payload = await req.json(); }
  catch { return err(400, 'invalid_json', 'body must be valid JSON'); }

  const { event, data } = payload;
  if (!event || !data) return err(422, 'missing_fields', 'event and data are required');

  const isTaskEvent    = event === 'task.updated';
  const isCommentEvent = ['comment.created', 'comment.updated',
                          'reply.created',   'reply.updated'].includes(event);

  if (!isTaskEvent && !isCommentEvent) {
    return json(200, { skipped: true, reason: 'unknown event type' });
  }

  const targetUrl = isTaskEvent ? URL_TASK : URL_COMMENT;
  if (!targetUrl) {
    return json(200, { skipped: true, reason: `env var for ${isTaskEvent ? 'task' : 'comment'} URL not set` });
  }

  // Identificadores agora vivem no top-level (payload v2).
  const taskId    = payload.task_id;
  const commentId = payload.comment_id;

  // Constrói o payload SLIM enviado pra URL externa. Mantém estrutura
  // simétrica (sent_at/ids top-level + data{external_ids, record}), mas
  // só com os campos que o sistema externo realmente usa.
  let outboundBody: Record<string, unknown>;

  if (isTaskEvent) {
    const fullRecord = (data.record ?? {}) as Record<string, unknown>;
    // Lookup do nome do responsável (pessoa_id é UUID interno; SF/n8n
    // não tem como interpretar). Best-effort: se falhar, manda null.
    let responsavel: string | null = null;
    const pessoaId = fullRecord.pessoa_id as string | null | undefined;
    if (pessoaId) {
      const { data: p } = await sb
        .from('pessoas')
        .select('nome')
        .eq('id', pessoaId)
        .maybeSingle();
      responsavel = (p as { nome: string } | null)?.nome ?? null;
    }
    outboundBody = {
      sent_at: payload.sent_at,
      task_id: taskId,
      data: {
        task_external_id: data.task_external_id,
        record: {
          titulo:      fullRecord.titulo ?? null,
          descricao:   fullRecord.descricao ?? null,
          responsavel,
          prioridade:  fullRecord.prioridade ?? null,
          prazo:       fullRecord.prazo ?? null,
          subetapa:    fullRecord.subetapa ?? null,
        },
      },
    };
  } else {
    // comment / reply
    const fullRecord = (data.record ?? {}) as Record<string, unknown>;
    outboundBody = {
      sent_at:    payload.sent_at,
      comment_id: commentId,
      is_reply:   payload.is_reply ?? false,
      data: {
        task_external_id:    data.task_external_id,
        comment_external_id: data.comment_external_id ?? null,
        parent_external_id:  data.parent_external_id ?? null,
        record: {
          body: fullRecord.body ?? null,
        },
      },
    };
  }

  // Fetch síncrono com timeout de 10s.
  // AbortController cancela a conexão se o sistema externo não responder.
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let externalResp: Response;
  try {
    externalResp = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(outboundBody),
      signal: controller.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = e instanceof Error && e.name === 'AbortError';
    const errMsg = isTimeout ? 'upstream timeout (10s)' : `fetch failed: ${msg}`;
    if (taskId) await setTaskSyncStatus(taskId, 'error', errMsg);
    return err(502, isTimeout ? 'upstream_timeout' : 'upstream_unreachable', errMsg);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!externalResp.ok) {
    const body = await externalResp.text().catch(() => '');
    const errMsg = `upstream ${externalResp.status}: ${body.slice(0, 200)}`;
    if (taskId) await setTaskSyncStatus(taskId, 'error', errMsg);
    return err(502, 'upstream_error', errMsg);
  }

  let respBody: Record<string, unknown>;
  try { respBody = await externalResp.json(); }
  catch {
    if (taskId) await setTaskSyncStatus(taskId, 'synced', null);
    return json(200, { action: 'sent', external_id: null, note: 'response was not JSON' });
  }

  const externalId = respBody.external_id != null
    ? String(respBody.external_id).trim() : null;

  if (isTaskEvent) {
    if (!taskId) return json(200, { action: 'sent', note: 'no task_id in data' });

    const { data: current } = await sb
      .from('tasks')
      .select('external_id')
      .eq('id', taskId)
      .maybeSingle();

    const alreadySet = (current as { external_id: string | null } | null)?.external_id === externalId;

    await setTaskSyncStatus(
      taskId,
      'synced',
      null,
      externalId && !alreadySet ? externalId : undefined,
    );

    return json(200, {
      action: alreadySet ? 'no_change' : 'updated',
      table: 'tasks',
      id: taskId,
      external_id: externalId,
    });
  }

  // Comment / reply — commentId chega no top-level (payload v2).
  if (taskId) await setTaskSyncStatus(taskId, 'synced', null);

  if (!commentId || !externalId) {
    return json(200, { action: 'sent', external_id: externalId });
  }

  const { data: current } = await sb
    .from('task_comments')
    .select('external_id')
    .eq('id', commentId)
    .maybeSingle();

  if ((current as { external_id: string | null } | null)?.external_id === externalId) {
    return json(200, { action: 'no_change', external_id: externalId });
  }

  // Seta last_ingest_at pra o trigger de comment não disparar webhook de saída.
  await setCommentExternalId(commentId, externalId);

  return json(200, { action: 'updated', table: 'task_comments', id: commentId, external_id: externalId });
});
