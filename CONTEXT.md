# CONTEXT.md — tasks 360 (Kliente 360)

> Documento de handoff para continuidade no Claude Code. Lê isto **inteiro** antes de tocar em qualquer arquivo.

## 1. O que é este projeto

Aplicativo de gestão de backlog interno para a **Kliente 360** (consultoria oficial Salesforce — kliente360.com). Foco em: backlog por cliente / projeto / pessoa / prioridade / esforço / prazo. Uso interno **com Portal do cliente já em produção** — clientes logam pra acompanhar próprio backlog e comentar.

**Tagline / posicionamento da empresa**: "conhecimento como serviço".

## 2. Estado atual

**v1.01.171 · em uso real.** Single-file `index.html` (Alpine.js + Tailwind CDN + Chart.js + marked.js) conectado a backend Supabase de verdade — Postgres com RLS aberta (consciente, é protótipo), Auth (magic link), Realtime, Edge Functions, Storage e pg_cron.

A fase "single-file" continua sendo deliberada: foco em descobrir requisitos com uso real antes de pagar custo de framework + design system + RLS apertada. A migração pra Next + Drizzle + RLS apertada é a Onda 0.

**Convenção de versão**: `APP_VERSION` em `lib/helpers.js` segue o **número do PR que entrega a mudança**. Ex: PR #167 → `v1.01.167`. Bump em todo PR que muda comportamento (docs-only podem pular). Exposto no header como subtítulo do logo.

**Convenção de fluxo git**: develop em branches `feat/...`, `fix/...`, `polish/...`, `docs/...`. PR squash-merge em `main`. Não pushar direto em main.

**Convenção Supabase**: tudo via Dashboard (SQL Editor, Edge Functions UI, Database > Extensions). **Nunca CLI** — detalhes em [`CLAUDE.md`](./CLAUDE.md).

## 3. Princípios de produto (NÃO violar)

- **Opinativo, não configurável.** Sem campos customizados, workflows configuráveis, sub-tarefas aninhadas, sprints, story points.
- **Esforço sempre em horas.** Prioridade sempre P0–P3.
- **Cliente externo nunca vê jargão de PM.** Portal mostra "o que está sendo feito pra mim e quando fica pronto" — não sprint, epic, story. Toggle `visivel_cliente` na task controla o que entra no Portal; toggle na comment controla o que dele aparece pro cliente.
- **Analytics interno, executivo, pragmático.** Sem Metabase, sem BI externo. Visões fixas dentro do app.
- **Tudo enxuto.** Adicionou um campo, escondeu se ninguém usa — `HABILITAR_DEPOIS.md` rastreia feature toggles preservados.

## 4. Identidade visual Kliente 360

- **Cor primária (marca)**: `#009900` (verde puro, extraído do logo oficial)
- **Verde escuro (hover)**: `#007A00`
- **Verde tinta (backgrounds suaves)**: `#E6F5E6` e `#F2FAF2`
- **Charcoal (header modal task)**: `#1f2937` — slate neutro, não compete com o verde da marca
- **Tipografia branding/títulos**: Quicksand (Google Fonts)
- **Tipografia corpo**: Manrope
- **Tipografia dados/mono**: JetBrains Mono
- **Símbolo do logo**: 4 círculos verdes em padrão losango (top, esquerda, direita, baixo). Reproduzido em CSS no header (`.k360-mark` no `index.html`).
- **Status colors** (intencionalmente afastados do verde da marca):
  - P0 / urgente / atrasado: vermelho `#C8392B`
  - P1 / alta: âmbar `#C77A1A`
  - P2 / normal: azul `#2D7AA8`
  - P3 / baixa: cinza `#6E7A72`
- **Cyan (info/visível ao cliente)**: `#0084E1` + soft pra badges externos no comment

Logos oficiais (PNG) em `/assets/`.

## 5. Stack atual (single-file em uso real)

- **HTML único** `index.html` (~9k linhas, single-source)
- **`lib/helpers.js`**: constantes do domínio (STATUS, ROLE, PRIORIDADE, …) e funções puras (`atrasada`, `effEsforco`, `triageFailures`, `cargaNivelFromPctCap`, `effTamanho`). Carregado **antes** do script inline pra mesmas funções serem testáveis e usáveis no Alpine.
- **Tailwind via CDN** (`cdn.tailwindcss.com`)
- **Alpine.js 3.x via CDN**
- **Chart.js 4.x via CDN**
- **marked.js via CDN** (parser de markdown para body de comment)
- **Google Fonts**: Quicksand, Manrope, JetBrains Mono
- **Backend**: [Supabase](https://supabase.com)
  - **Postgres** com 20+ migrations aplicadas (em `supabase/migrations/applied/`)
  - **RLS aberta** com policy `prototipo_all` em toda tabela — decisão consciente; trocada por policies reais na Onda 0
  - **Auth** com magic link (lista fechada de pessoas pré-cadastradas; sem signup público)
  - **Realtime** em `tasks`, `clientes`, `projetos`, `pessoas`, `task_comments`, `task_status_history`, `task_field_history`, `task_attachments`
  - **Edge Functions** (`ingest-task`, `ingest-comment`, `delete-task`, `cleanup-attachments`)
  - **Storage** bucket privado `task-attachments` (anexos de imagem, signed URLs 1h)
  - **pg_cron + pg_net** rodando cleanup diário de anexos de tasks concluídas há mais de 30d
- **Deploy**: Netlify (auto deploy no push em `main`)
- **Sem build step**: editar `index.html` e refrescar

## 6. Stack do app "de verdade" (Onda 0, ainda não iniciada)

Decidida para quando sair do single-file:

- **Next.js 15** + TypeScript + App Router (monolito)
- **Postgres via Supabase** (banco + auth + RLS apertada)
- **Drizzle ORM** (preferido sobre Prisma para Claude Code — sem generate step)
- **Tailwind + shadcn/ui**
- **Recharts** para dashboards
- **Resend** para email transacional
- **Vercel** deploy
- **Sentry + PostHog** desde o dia 1

Estrutura de rotas planejada: route groups `(internal)` e `(client)` com middleware de auth distintos. RLS em toda tabela com `client_id` ou `organization_id` desde a primeira migration.

## 7. Modelo de dados (atual em Postgres)

```
clientes
  id, nome, tier (estrategico|potencial|descoberta), arquivado_em

projetos
  id, cliente_id, nome, tipo, sla_*, orcamento_horas, arquivado_em

pessoas
  id, nome, email, role (admin|interno|cliente), cliente_id, invited_at, arquivado_em

tasks
  id, titulo, descricao, cliente_id, projeto_id, pessoa_id,
  prioridade (P0..P3), esforco (h), complexidade (alta|media|baixa),
  prazo, status (macro), subetapa (sub), bloqueado_por,
  visivel_cliente, tags[], checklist (jsonb [{id, body, done}]),
  tempo_real_horas, reopen_count, ordem (float pra reorder manual),
  external_source (salesforce|null), external_id,
  arquivado_em, criado_em, status_em, subetapa_em

task_comments
  id, task_id, parent_id (nullable, 1 nível de reply), body,
  author, author_pessoa_id, author_external_id,
  visivel_cliente, from_cliente, edited_em,
  external_source (salesforce|null), external_id,
  posted_em, criado_em

task_status_history    -- timeline de mudanças de status macro
task_field_history     -- timeline de mudanças de campos (prazo, esforço, etc.)
task_dependencies      -- 1:N de dependência (UI atualmente escondida)

task_attachments
  id, task_id (FK ON DELETE CASCADE),
  storage_path, mime, size_bytes, width, height,
  author_pessoa_id, criado_em

notifications          -- sino do header (mentions, assignments, cliente respondeu)
usage_events           -- analytics interno (Adoption tab)
auth_history           -- log de magic link login
```

Detalhes críticos:
- `visivel_cliente` na task controla o que entra no Portal cliente. Em comment, controla o que dele aparece no Portal.
- `status_em` e `subetapa_em` movidos em trigger pra suportar aging granular por macro **e** sub.
- `reopen_count` tracked em trigger toda vez que task sai de `concluido` pra qualquer outro status.
- `checklist` é JSONB inline (poucos itens por task, sem realtime multi-user — cabe no autosave).
- `external_source='salesforce'` + `external_id` = task espelhada do SF (ingest-task escreve, delete-task remove). Comments do Chatter idem com `task_comments.external_source`.

## 8. Roadmap de ondas (status real)

- **Onda 0 — Rebuild Next/Drizzle**: **ainda não iniciada**. Próximo grande passo quando o uso real estabilizar.
- **Onda 1 — MVP backlog interno**: **entregue.** Tasks, comments, checklist, anexos, histórico, auditoria, kanban, calendário, dashboard.
- **Onda 2 — Portal cliente**: **entregue.** Login restrito, visão filtrada, comentários bidirecionais, replies aninhados com herança de visibilidade.
- **Onda 3 — Analytics**: **entregue.** 8 visões fixas dentro do Dashboard.
- **Onda 4 — Integração Salesforce**: **entregue.** Edge functions ingest-task, ingest-comment, delete-task.
- **Onda 5+ — Notificações**: sino in-app (mentions, assignment, cliente respondeu) entregue. Email/Slack ainda não.

## 9. As 8 visões de analytics (definitivas)

Para liderança:
1. Throughput semanal (8 semanas)
2. Lead time médio
3. Cycle time médio
4. Itens atrasados (lista priorizada)

Para gestão operacional:
5. Saúde por projeto (semáforo)
6. Volume por cliente (esforço aberto)
7. Carga por pessoa (% capacidade alocada com classificação sobrecarga/pressão/ok/folga)
8. Aging do backlog (atrasos por status)

## 10. Telas do app atual

`index.html` tem 7 abas principais:

- **Foco**: urgências do dia (filtrável por pessoa)
- **Backlog**: tabela ordenável + filtrável + bulk actions
- **Kanban**: 11 colunas operacionais OU 4 colunas executivas (toggle), drag-and-drop, quick-add inline por coluna
- **Calendário**: mensal, tasks com prazo agrupadas por dia
- **Dashboard**: 8 visões analytics
- **Cadastros**: 3 sub-abas (clientes, projetos, pessoas) com CRUD + tier de cliente + arquivamento
- **Adoption**: usage events agregados (Onda 5 — interno)

E o **Portal cliente**: tela separada acessada por `?cliente=<id>` (admin) ou auto por role `cliente`.

### Modal de task (5 abas no mobile / 4 abas no desktop)

Layout reorganizado em v1.01.168:
- **Esquerda** (mobile: aba "Detalhes"): Atribuição → Descrição → Checklist (colapsável) → Esforço → Metadata (sem título)
- **Direita** (mobile: 3 abas próprias): Conversa · Anexos · Histórico

ESC encadeado: picker @-mention → linha checklist vazia (remove) → linha checklist com conteúdo (blura) → reply → lightbox anexo → comment-edit → modal fecha.

## 11. Convenções de código

- CSS variables em `:root` para todos os tokens — **nunca cores hardcoded**.
- Estado em função `app()` retornando objeto Alpine; constantes do domínio em `lib/helpers.js`.
- **Adapter pattern** `TASK_FIELDS` + `makeFromDb` / `makeToDb` traduz entre snake_case do Postgres e camelCase do front. Adicionar campo novo na task: 1 linha em `TASK_FIELDS`.
- IDs no Postgres são `uuid` gerados via `gen_random_uuid()`.
- Datas em formato ISO no banco, formatadas para `DD/MM/YYYY` (longo) ou `DD/MM` (curto) na UI.
- Idioma: PT-BR em todo texto visível ao usuário.
- Optimistic UI em quase tudo: atualiza local antes do round-trip e rollback se Supabase errar.
- Realtime double-binding: insert/update/delete na DB dispara refetch ou patch local na sessão aberta.

## 12. O que NÃO fazer

- Não migrar para framework com build sem entrar oficialmente na Onda 0.
- Não usar Supabase CLI — Dashboard sempre. Migrations no SQL Editor, edge functions no painel de Edge Functions.
- Não introduzir nova dependência via CDN sem necessidade gritante. Hoje: Tailwind, Alpine, Chart.js, marked.js, Supabase JS, Google Fonts. Pare.
- Não pushar direto em main. Sempre PR squash-merge.
- Não criar arquivos de doc (`*.md`) novos sem necessidade. Atualizar os existentes.
- Não escrever comentário de código que só descreve o que o código faz. Só comente o **porquê não-óbvio** (constraint, workaround, invariante).

## 13. O que pode evoluir

Se for útil para validação de fluxo, OK adicionar:
- Campos novos em task (registra no `TASK_FIELDS` + migration)
- Novas visões no Dashboard
- Filtros extras
- Novos tipos de notificação no sino
- Atalhos de teclado

Cada evolução preserva: estética Kliente 360, princípios da seção 3, convenção de versão.
