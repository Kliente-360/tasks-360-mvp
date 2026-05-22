// Edge Function: archive-task
// Arquiva uma task pelo external_id do Salesforce.
// Define status como 'bloqueado' (subetapa 'bloqueado') e seta arquivado_em.
// Usa last_ingest_at pra não disparar o webhook de saída (anti-loop).
//
// Auth: X-API-Key (mesmo INGEST_API_KEYS das outras funções de ingestão).
//
// Body JSON:
//   { "external_id": "SF-ID-da-task" }
//
// Retorna:
//   200 { id, action: 'archived' }         — arquivou com sucesso
//   200 { id, action: 'already_archived' } — já estava arquivada (idempotente)
//   422 task_not_found                     — external_id não existe aqui

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const API_KEYS     = (Deno.env.get('INGEST_API_KEYS') || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const SOURCE       = 'salesforce';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
const err = (status: number, code: string, message: string) =>
  json(status, { error: { code, message } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return err(405, 'method_not_allowed', 'POST only');

  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || !API_KEYS.includes(apiKey)) {
    return err(401, 'unauthorized', 'invalid or missing X-API-Key');
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return err(400, 'invalid_json', 'body must be valid JSON'); }

  const externalId = String(body.external_id ?? '').trim();
  if (!externalId) return err(422, 'missing_external_id', 'external_id is required');

  const { data: task, error: lookupErr } = await sb
    .from('tasks')
    .select('id, arquivado_em')
    .eq('external_source', SOURCE)
    .eq('external_id', externalId)
    .maybeSingle();
  if (lookupErr) return err(500, 'db_error', lookupErr.message);
  if (!task) return err(422, 'task_not_found',
    `task com external_id '${externalId}' não encontrada`);

  // Idempotente: já arquivada → retorna sem erro
  if ((task as { arquivado_em: string | null }).arquivado_em) {
    return json(200, { id: task.id, action: 'already_archived' });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await sb
    .from('tasks')
    .update({
      subetapa:       'bloqueado',
      subetapa_em:    now,
      status_em:      now,
      arquivado_em:   now,
      last_ingest_at: now,  // evita disparar webhook de saída
    })
    .eq('id', task.id);
  if (upErr) return err(500, 'db_error', upErr.message);

  return json(200, { id: task.id, action: 'archived' });
});
