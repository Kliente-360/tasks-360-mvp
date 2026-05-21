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

- `APP_VERSION` em `lib/helpers.js` segue `v1.<MINOR>.<BUILD>`. **Bumpa BUILD +1 antes de cada commit em main.**
- BUILD é sequencial independente do número do PR no GitHub — os dois divergiram ao longo do trabalho de design e **não tentar realinhar**.
- Versão atual: `v1.02.050`.
- Em mudança grande de UX/dados, bumpa MINOR e zera BUILD (decisão manual). Último bump: 01→02 fechando o ciclo de design (PRs #253-#270).
- Após commit em main, arquivos de migration vão pra `supabase/migrations/applied/` (mover manualmente — não tem automação).

## Git workflow

- Branch temporária `feat/*`/`fix/*`/`refactor/*`/`chore/*` → push → PR via `mcp__github__create_pull_request` → squash-merge via `mcp__github__merge_pull_request`. GitHub deleta a head branch automaticamente ("Automatically delete head branches" ativo). Resultado: 1 commit em `main`, zero branches sobreviventes.
- Nada de manter branches paralelas. Cada PR é uma sessão de trabalho fechada.
- Branches `claude/*` criadas pelo harness são ignoradas — não usar, não deletar.
- Antes de commitar: bumpar `APP_VERSION` em `lib/helpers.js` (BUILD += 1).
- **Sempre `git pull origin main` antes de criar branch nova**, pra evitar divergência local.

## Migração de stack (Onda 0)

Ver **`web/ONDA0.md`** para o plano completo com todas as decisões arquiteturais.

Resumo executivo:
- Arquitetura **híbrida**: Server Components apenas pra telas read-heavy (Cadastros, auth). Telas interativas (Backlog, Kanban, Modal, Triagem, Foco, Calendário) são **Client Components com Supabase JS** — mesmo padrão de dados do app Alpine (boot + estado em memória + realtime).
- Objetivo da onda: **UX 100% idêntica ao app atual**, zero features novas.
- Não usar Server Actions em telas com >1 interação/segundo — latência inaceitável.
- Helpers de `lib/helpers.js` já portados para `web/src/lib/task-utils.ts`.
