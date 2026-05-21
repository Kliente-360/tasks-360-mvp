// Edge Function: dispatch-webhook
//
// Intermediário entre os triggers do banco e os sistemas externos.
// Chamado pelo pg_net (via dispatch_webhook() SQL) quando:
//   - uma task SF é atualizada → event 'task.updated'
//   - um comment/reply em task SF é criado/editado → 'comment.*' / 'reply.*'
//
// Fluxo:
//   1. Valida Bearer token (DISPATCH_WEBHOOK_SECRET env).
//   2. Roteia pra WEBHOOK_URL_TASK (eventos de task) ou WEBHOOK_URL_COMMENT.
//   3. Lê { external_id } do body de resposta.
//   4. Atualiza o registro no banco com external_id + webhook_sync_status.
//      webhook_sync_status = 'synced' (sucesso) | 'error' (falha).
//      Esses campos têm guard no trigger — não disparam novo webhook.
//
// Auth de entrada: Authorization: Bearer <DISPATCH_WEBHOOK_SECRET>
// Env vars (Edge Functions > Settings > Secrets):
//   DISPATCH_WEBHOOK_SECRET  — token Bearer validado aqui
//   WEBHOOK_URL_TASK         — endpoint externo para task.updated
//   WEBHOOK_URL_COMMENT      — endpoint externo para comment.*/reply.*

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DISPATCH_SECRET = Deno.env.get('DISPATCH_WEBHOOK_SECRET') ?? '';
const URL_TASK        = Deno.env.get('WEBHOOK_URL_TASK') ?? '';
const URL_COMMENT     = Deno.env.get('WEBHOOK_URL_COMMENT') ?? '';

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
  await sb.from('tasks').update(patch).eq('id', taskId);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return err(405, 'method_not_allowed', 'POST only');

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (DISPATCH_SECRET && token !== DISPATCH_SECRET) {
    return err(401, 'unauthorized', 'invalid or missing Authorization');
  }

  let payload: {
    event: string;
    sent_at: string;
    data: Record<string, unknown>;
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

  const taskId = data.task_id as string | undefined;

  // Envia o evento pro sistema externo e aguarda resposta síncrona.
  let externalResp: Response;
  try {
    externalResp = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, sent_at: payload.sent_at, data }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (taskId) await setTaskSyncStatus(taskId, 'error', `fetch failed: ${msg}`);
    return err(502, 'upstream_unreachable', `fetch failed: ${msg}`);
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

  // Comment / reply — grava status na task pai e atualiza external_id no comment
  const record    = data.record as Record<string, unknown> | undefined;
  const commentId = record?.id as string | undefined;

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

  await sb.from('task_comments')
    .update({ external_id: externalId, external_source: 'salesforce' })
    .eq('id', commentId);

  return json(200, { action: 'updated', table: 'task_comments', id: commentId, external_id: externalId });
});
