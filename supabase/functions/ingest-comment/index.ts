// Edge Function: ingest-comment
// Recebe comments (Chatter posts) do Salesforce e prende numa task aqui.
// Reutiliza o mesmo INGEST_API_KEYS da ingest-task.
//
// Body JSON:
//   {
//     "external_id":         "0D5...FeedItem.Id...",   // pra dedupe
//     "task_external_id":    "a0X...RecordId...",       // do custom object
//     "author":              "Maria Silva",             // CreatedBy.Name
//     "author_external_id":  "005...UserId...",         // CreatedById (opcional)
//     "body":                "texto do post",
//     "posted_em":           "2026-05-07T14:30:00Z"     // CreatedDate (opcional)
//   }

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

  const taskExternalId = String(body.task_external_id ?? '').trim();
  if (!taskExternalId) return err(422, 'missing_task_external_id', 'task_external_id is required');

  const text = String(body.body ?? '').trim();
  if (!text) return err(422, 'missing_body', 'body is required');

  // Resolve a task local pelo external_id da task
  const { data: task, error: tErr } = await sb
    .from('tasks')
    .select('id')
    .eq('external_source', SOURCE)
    .eq('external_id', taskExternalId)
    .maybeSingle();
  if (tErr) return err(500, 'db_error', tErr.message);
  if (!task) return err(422, 'task_not_found',
    `task com external_id '${taskExternalId}' não existe — sincronize a task antes do comment`);

  // postedEm opcional, ISO
  let postedEm: string | null = null;
  if (body.posted_em) {
    const p = String(body.posted_em);
    const d = new Date(p);
    if (Number.isNaN(d.getTime())) return err(422, 'invalid_posted_em', 'posted_em must be ISO datetime');
    postedEm = d.toISOString();
  }

  const author = body.author != null ? String(body.author).trim() || null : null;
  const authorExternalId = body.author_external_id != null
    ? String(body.author_external_id).trim() || null : null;

  // Existe?
  const { data: existing, error: eErr } = await sb
    .from('task_comments')
    .select('id')
    .eq('external_source', SOURCE)
    .eq('external_id', externalId)
    .maybeSingle();
  if (eErr) return err(500, 'db_error', eErr.message);

  const payload: Record<string, unknown> = {
    task_id: task.id,
    body: text,
    author, author_external_id: authorExternalId,
    posted_em: postedEm,
  };

  if (existing) {
    const { error } = await sb.from('task_comments').update(payload).eq('id', existing.id);
    if (error) return err(500, 'db_error', error.message);
    return json(200, { id: existing.id, action: 'updated' });
  } else {
    payload.external_source = SOURCE;
    payload.external_id = externalId;
    const { data, error } = await sb.from('task_comments').insert(payload).select('id').single();
    if (error) return err(500, 'db_error', error.message);
    return json(201, { id: data.id, action: 'created' });
  }
});
