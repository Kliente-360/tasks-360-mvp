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

- `APP_VERSION` em `lib/helpers.js` segue `v1.01.<N>`. **Bumpa +1 a cada commit em main.**
- Sequência herda do esquema antigo (último PR mergeado foi #221 → próximo build é 222).
- Em mudança grande de UX/dados, bumpa MINOR e zera/reseta BUILD (decisão manual).
- Após commit em main, arquivos de migration vão pra `supabase/migrations/applied/` (mover manualmente — não tem automação).

## Git workflow

- **Efetivamente push direto em `main`**, via PR descartável.
- Mecânica (limitação do harness): criar branch temporária `chore/*`/`feat/*`/`fix/*` → push → abrir PR via `mcp__github__create_pull_request` → squash-merge via `mcp__github__merge_pull_request` com `delete_branch=true`. Head branch é auto-deletada pelo GitHub (config do repo). Resultado: 1 commit em `main`, zero branches sobreviventes.
- Nada de manter branches paralelas. Cada PR é uma sessão de trabalho fechada.
- Branches `claude/*` do harness são ignoradas.
- Antes de commitar: bumpar `APP_VERSION` em `lib/helpers.js` (BUILD += 1).
