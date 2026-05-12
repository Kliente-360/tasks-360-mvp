# CLAUDE.md

Convenções do projeto que valem pra qualquer sessão.

## Supabase

- **Nunca instruir Supabase CLI.** O usuário não usa CLI — tudo é feito pelo Dashboard (SQL Editor, Edge Functions UI, Database > Extensions, Database > Cron).
- Migrations: cola o SQL no **SQL Editor** e roda.
- Edge functions: cria/edita no **Edge Functions** do dashboard (copy-paste do `supabase/functions/<nome>/index.ts`) e clica em Deploy.
- Secrets (envs de function): **Edge Functions > Settings > Secrets** no dashboard.
- Cron: **Database > Extensions** (habilitar `pg_cron` e `pg_net` pelo toggle) + SQL Editor pra rodar `cron.schedule(...)`.
- Storage bucket: dá pra criar pelo SQL ou pela UI **Storage > New bucket**, ambos servem.
- Testar edge function: curl manual com a URL `https://<project-ref>.supabase.co/functions/v1/<nome>` e `x-api-key` apropriado.

## Versionamento

- `APP_VERSION` em `lib/helpers.js` segue `v1.01.<PR_number>`. Bumpa **toda** vez que abre PR.
- Após merge em main, arquivos de migration vão pra `supabase/migrations/applied/` (mover manualmente — não tem automação).

## Git workflow

- Develop em branches `feat/...`, `fix/...`, `polish/...`. PR squash-merge em `main`.
- Branch `claude/tasks-360-mvp-dev-tsyrg` mencionada nas instruções do harness é overridada por este fluxo de PR.
