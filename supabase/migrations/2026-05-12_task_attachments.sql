-- 2026-05-12 · task_attachments
-- Anexos de imagem em tasks, paste-only (max 2MB, max 1600px).
-- Cascade: tasks → task_attachments. Rows somem com a task.
-- Storage objects: cleanup feito via JS no deleteTask + edge function cleanup-attachments.

create table if not exists task_attachments (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references tasks(id) on delete cascade,
  storage_path      text not null unique,            -- ex: <task_id>/<uuid>.jpg (no bucket task-attachments)
  mime              text not null,                   -- image/jpeg, image/png, image/webp
  size_bytes        integer not null,
  width             integer,
  height            integer,
  author_pessoa_id  uuid references pessoas(id) on delete set null,
  criado_em         timestamptz not null default now()
);

create index if not exists task_attachments_task_idx on task_attachments(task_id);
create index if not exists task_attachments_created_idx on task_attachments(criado_em);

alter table task_attachments enable row level security;
drop policy if exists prototipo_all on task_attachments;
create policy prototipo_all on task_attachments for all using (true) with check (true);

-- ============ Storage bucket ============
-- Privado: leitura via signed URL gerada pelo cliente (sb.storage.from(...).createSignedUrl).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  2 * 1024 * 1024,                                  -- 2MB hard cap server-side
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS aberta (mesma postura do resto do MVP).
-- Trocar por políticas reais quando entrar Onda 0 com auth restritiva.
drop policy if exists prototipo_task_attachments_all on storage.objects;
create policy prototipo_task_attachments_all on storage.objects
  for all
  using  (bucket_id = 'task-attachments')
  with check (bucket_id = 'task-attachments');

-- ============ Cron de limpeza ============
-- Apaga anexos de tasks concluídas há mais de 30 dias.
-- Depende de: pg_cron + pg_net (Supabase já tem ambos disponíveis).
-- Edge function `cleanup-attachments` apaga storage + rows.
--
-- ⚠️ Antes de habilitar, criar 2 GUCs no banco com as credenciais
--    (Supabase Dashboard > Database > Custom config OU via SQL Editor):
--      alter database postgres set app.cleanup_attachments_url = '<edge-function-url>';
--      alter database postgres set app.cleanup_attachments_key = '<INGEST_API_KEY>';
--
-- Depois rodar este bloco pra agendar:

-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'cleanup-task-attachments-daily',
--   '17 3 * * *',                                  -- 03:17 UTC todo dia
--   $$
--   select net.http_post(
--     url     := current_setting('app.cleanup_attachments_url'),
--     headers := jsonb_build_object(
--                  'content-type', 'application/json',
--                  'x-api-key',    current_setting('app.cleanup_attachments_key')
--                ),
--     body    := jsonb_build_object('older_than_days', 30)
--   );
--   $$
-- );
