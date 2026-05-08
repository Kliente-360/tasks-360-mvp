// Edge Function: ingest-task
// Ingestão de tarefas vindas de sistemas externos (Salesforce etc.)
//
// Auth: header X-API-Key (validado contra env INGEST_API_KEYS, lista
// separada por vírgula). Cada cliente externo recebe seu token.
//
// Body JSON (PT-BR, resolução de cliente/projeto/responsavel por nome
// case-insensitive). Único campo obrigatório: external_id e titulo.
//
//   {
//     "external_id":  "a0X5g000000XYZ",     // id do registro no SF
//     "titulo":       "Customizar layout",
//     "descricao":    "...",                // opcional
//     "cliente":      "Bodytech",           // opcional, by name
//     "projeto":      "Sustentação BT",     // opcional, by name
//     "responsavel":  "Jéssica",            // opcional, by name
//     "prioridade":   "P1",                 // opcional: P0|P1|P2|P3
//     "esforco":      4,                    // opcional, horas
//     "prazo":        "2026-06-15",         // opcional, YYYY-MM-DD
//     "status":       "andamento"           // opcional: backlog|andamento|bloqueado|concluido
//   }
//
// Retorna 201 { id, action: "created" } ou 200 { id, action: "updated" }.
// Erros 4xx retornam { error: { code, message } }.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const API_KEYS      = (Deno.env.get('INGEST_API_KEYS') || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const SOURCE        = 'salesforce';

const STATUS_VALID = ['backlog', 'andamento', 'bloqueado', 'concluido'];
const PRI_VALID    = ['P0', 'P1', 'P2', 'P3'];

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const err = (status: number, code: string, message: string) =>
  json(status, { error: { code, message } });

async function findByName(table: string, nome: string) {
  const { data, error } = await sb
    .from(table)
    .select(table === 'projetos' ? 'id, cliente_id' : 'id')
    .ilike('nome', nome.trim())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

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

  const titulo = String(body.titulo ?? '').trim();
  if (!titulo) return err(422, 'missing_titulo', 'titulo is required');

  // Resoluções por nome
  let clienteId: string | null = null;
  if (body.cliente) {
    try {
      const r = await findByName('clientes', String(body.cliente));
      if (!r) return err(422, 'cliente_not_found', `cliente '${body.cliente}' não cadastrado`);
      clienteId = r.id as string;
    } catch (e) { return err(500, 'db_error', String((e as Error).message)); }
  }

  let projetoId: string | null = null;
  if (body.projeto) {
    try {
      const r = await findByName('projetos', String(body.projeto));
      if (!r) return err(422, 'projeto_not_found', `projeto '${body.projeto}' não cadastrado`);
      if (clienteId && r.cliente_id !== clienteId) {
        return err(422, 'projeto_cliente_mismatch',
          `projeto '${body.projeto}' não pertence ao cliente '${body.cliente}'`);
      }
      projetoId = r.id as string;
    } catch (e) { return err(500, 'db_error', String((e as Error).message)); }
  }

  let pessoaId: string | null = null;
  if (body.responsavel) {
    try {
      const r = await findByName('pessoas', String(body.responsavel));
      if (!r) return err(422, 'responsavel_not_found', `responsavel '${body.responsavel}' não cadastrado`);
      pessoaId = r.id as string;
    } catch (e) { return err(500, 'db_error', String((e as Error).message)); }
  }

  // Validações de campos opcionais
  let prioridade: string | null = null;
  if (body.prioridade != null) {
    prioridade = String(body.prioridade).toUpperCase();
    if (!PRI_VALID.includes(prioridade)) return err(422, 'invalid_prioridade', 'prioridade deve ser P0|P1|P2|P3');
  }
  let status: string | null = null;
  if (body.status != null) {
    status = String(body.status).toLowerCase();
    if (!STATUS_VALID.includes(status)) return err(422, 'invalid_status', 'status deve ser backlog|andamento|bloqueado|concluido');
  }
  let prazo: string | null = null;
  if (body.prazo) {
    const p = String(body.prazo).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p)) return err(422, 'invalid_prazo', 'prazo deve ser YYYY-MM-DD');
    prazo = p;
  }
  let esforco: number | null = null;
  if (body.esforco != null) {
    const e = Number(body.esforco);
    if (Number.isNaN(e) || e < 0) return err(422, 'invalid_esforco', 'esforco deve ser número não-negativo');
    esforco = e;
  }
  let tags: string[] | null = null;
  if (body.tags != null) {
    if (!Array.isArray(body.tags)) return err(422, 'invalid_tags', 'tags deve ser array de strings');
    tags = body.tags
      .map((x: unknown) => String(x || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24))
      .filter((x: string) => x.length > 0);
  }

  // Existe? Procura por (source, external_id)
  const { data: existing, error: lookupErr } = await sb
    .from('tasks')
    .select('id, status')
    .eq('external_source', SOURCE)
    .eq('external_id', externalId)
    .maybeSingle();
  if (lookupErr) return err(500, 'db_error', lookupErr.message);

  // Monta payload — só inclui campos enviados (update não-destrutivo)
  const payload: Record<string, unknown> = { titulo };
  if (body.descricao !== undefined) payload.descricao = String(body.descricao ?? '');
  if (clienteId)       payload.cliente_id = clienteId;
  if (projetoId)       payload.projeto_id = projetoId;
  if (pessoaId)        payload.pessoa_id  = pessoaId;
  if (prioridade)      payload.prioridade = prioridade;
  if (esforco != null) payload.esforco    = esforco;
  if (prazo)           payload.prazo      = prazo;
  if (tags)            payload.tags       = tags;
  if (status) {
    payload.status = status;
    if (!existing || existing.status !== status) payload.status_em = new Date().toISOString();
  }

  if (existing) {
    const { error } = await sb.from('tasks').update(payload).eq('id', existing.id);
    if (error) return err(500, 'db_error', error.message);
    if (status && existing.status !== status) {
      await sb.from('task_status_history').insert({
        task_id: existing.id,
        from_status: existing.status,
        to_status: status,
        actor_source: SOURCE,
      });
    }
    return json(200, { id: existing.id, action: 'updated' });
  } else {
    payload.external_source = SOURCE;
    payload.external_id     = externalId;
    payload.status          = (payload.status as string) || 'backlog';
    payload.status_em       = new Date().toISOString();
    const { data, error } = await sb.from('tasks').insert(payload).select('id, status').single();
    if (error) return err(500, 'db_error', error.message);
    await sb.from('task_status_history').insert({
      task_id: data.id,
      from_status: null,
      to_status: data.status,
      actor_source: SOURCE,
    });
    return json(201, { id: data.id, action: 'created' });
  }
});
