# CONTEXT.md — tasks 360 (Kliente 360)

> Documento de handoff para continuidade no Claude Code. Lê isto **inteiro** antes de tocar em qualquer arquivo.

## 1. O que é este projeto

Aplicativo de gestão de backlog interno para a **Kliente 360** (consultoria oficial Salesforce — kliente360.com). Foco em: backlog por cliente / projeto / pessoa / prioridade / esforço / prazo. Uso interno **com Portal do cliente já em produção** — clientes logam pra acompanhar próprio backlog e comentar.

**Tagline / posicionamento da empresa**: "conhecimento como serviço".

## 2. Estado atual

**v1.02.161 · pré-cutover · Onda 0 (rebuild Next) feature-complete em preview Vercel.**

Dois apps coexistem hoje:

1. **App Alpine em prod** (raiz do repo, `index.html` + `lib/`): atende usuários reais (time interno + cliente externo). Está em **modo manutenção** — sem novas features desde v1.02.050. Continua recebendo BUILD bumps coincidentes com o Next até cutover.
2. **App Next no preview Vercel** (branch `feat/onda-0`, subpasta `web/`): paridade UX 100% com Alpine + PWA (manifest + ícone + splash + service worker Serwist). 44 unit tests (vitest) + 3 e2e (Playwright) + CI completo no GitHub Actions (`.github/workflows/ci.yml`).

**Próximo passo é o cutover** (Bloco 5): trocar o domínio principal Vercel pro projeto Next, arquivar o Alpine. Pós-cutover, todo o roadmap pós-Onda 0 ataca **só o Next** (ver §14.4 e `ROADMAP.md` §9.3).

**Histórico recente do Alpine** (até v1.02.050, antes do freeze pra Onda 0): pós ciclo de design (PRs #253-#270) + features estratégicas (cliente interno bucket, notif por tipo, foco narrativa, adoption indicators de sucesso) + Resumo Executivo PDF + integração de automação IA (Cowork) + ciclo de performance/refactor. Multi-file modular. Stack: Alpine.js + Tailwind CDN + Chart.js + marked.js, conectado a backend Supabase — Postgres com **RLS fechada role-aware**, Auth (magic link), Realtime, Edge Functions, Storage e pg_cron.

**Automação IA / Cowork (mai/2026)**: tasks ganham flag `criado_por_ia` (chip 🤖 IA no Backlog/Kanban/Foco/Triagem/modal, filtro na Triagem e no menu ⋯ do Backlog). Clientes ganham `dominios[]` (domínios de email, pra automação resolver o cliente pelos participantes de reunião). Novas edge functions `get-clientes` e `get-pessoas` expõem o vocabulário pra automações externas; `ingest-task` aceita `criado_por_ia` e cliente vazio / sentinel `"Triagem"`.

**Performance + refactor (mai/2026)**: realtime aplica delta do payload em vez de refetch da tabela inteira; `_tasksSig` O(1); `tasksById` memoizado; toda mutação de `this.tasks` centralizada em 7 helpers (`_patchTask`, `_replaceTask`, `_upsertTask`, `_patchTasks`, `_removeTask`, `_removeTasks`, `_setAllTasks`) em `core-data.js`.

**Modularização (Onda F)** concluída em mai/2026 (21 PRs, #191-#212): `index.html` saiu de 10.807 → 3.492 linhas; Alpine extraído pra `lib/app.js` (~580 linhas, state + INIT/PERSISTÊNCIA) e fatiado em **13 views** sob `lib/views/*`. CSS em `lib/styles.css` (~1.700 linhas). Padrão de composição: `Object.defineProperties(base, getOwnPropertyDescriptors(makeXxxView()))` em `app()` — preserva getters reativos do Alpine que `Object.assign` achataria.

**Ciclo de design (mai/2026)** entregou page-bar consistente em 7 abas, modais cadastros refeitos, mobile harmonizado (toggle + new com altura 32px alinhada ao bloco logo+versão), deep linking URL, e portal mobile switcher. Saiu de "protótipo robusto" pra "produto comercializável".

**Features estratégicas pós-design**: bucket de cliente interno (`eh_interno` flag, admin-only, excluído de heurísticas), notificações por tipo (mention/assignment/status_change com chips de filtro), foco com narrativa heurística + abertura padrão pra admin/interno, e card de indicadores de sucesso da adoção interna no topo da aba Adoption.

**A RLS deixou de ser "aberta consciente"** — tenant isolation real via policies por role (`admin`/`interno`/`cliente`), com helpers `app_pessoa_role()`, `app_pessoa_cliente_id()`, `app_is_staff()` e RPC `app_link_current_user_to_pessoa()` pra first-login. A migração pra Next + Drizzle (Onda 0) segue parked — a modularização ganhou tempo significativo.

**Convenção de versão**: `APP_VERSION` em `lib/helpers.js` segue `v1.<MINOR>.<BUILD>`. BUILD é sequencial, +1 a cada commit em main, **independente do número do PR no GitHub**. Os dois divergiram ao longo do trabalho de design (PR # foi mais devagar que BUILD) e a convenção foi explicitamente desalinhada — ver `CLAUDE.md`. Último bump MINOR: 01→02 fechando ciclo de design.

**Convenção de fluxo git**: develop em branches `feat/...`, `fix/...`, `polish/...`, `docs/...`, `refactor/...`, `test/...`. PR squash-merge em `main`. Não pushar direto em main.

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

## 5. Stack atual (modular, sem build)

- **`index.html`** (3.5k linhas): só HTML + templates Alpine + sequência de `<script>` e `<link>` na ordem correta de carregamento.
- **`lib/styles.css`** (~1.6k linhas): todo o CSS, tokens em `:root`.
- **`lib/helpers.js`** (~225 linhas): constantes do domínio (STATUS, ROLE, PRIORIDADE, …) e funções puras (`atrasada`, `effEsforco`, `triageFailures`, `cargaNivelFromPctCap`, `effTamanho`, `weekStartMonday`, `taskWeekIndex`, `bucketTasksByWeek`, `projetoCapacidadeSemana`, …). IIFE expõe em `window`. Carregado primeiro. Testável em `tests/index.html`.
- **`lib/adapters.js`** (~140 linhas): mapeamento JS ↔ DB declarativo (`TASK_FIELDS`, `PROJETO_FIELDS`, `CLIENTE_FIELDS`, `makeFromDb`, `makeToDb`, `makeBlank`). Adicionar campo novo na task = 1 linha no array.
- **`lib/supabase-client.js`** (~25 linhas): `sb = window.supabase.createClient(URL, KEY)` + `AUTH_ENABLED` toggle.
- **`lib/views/*.js`** (13 arquivos, ~5.4k linhas): cada arquivo expõe uma factory `makeXxxView()` que retorna objeto com getters/métodos. Em `app()` (em `lib/app.js`), todos são merged via `Object.defineProperties(base, getOwnPropertyDescriptors(factory()))` — preserva getters Alpine.
  - `portal.js`, `briefing.js`, `calendar-foco.js`, `utilities.js`, `anexos.js`, `notifications-checklist.js`, `cadastros.js`, `task-modal.js`, `adoption.js`, `charts.js`, `backlog-kanban.js`, `core-data.js`, `telemetria-export.js`
- **`lib/app.js`** (~540 linhas): `function app()` que monta o objeto Alpine. Contém só state + `INIT/PERSISTÊNCIA` (auth, load, refresh) + loop de composição dos mixins.
- **Tailwind via CDN** (`cdn.tailwindcss.com`)
- **Alpine.js 3.x via CDN**
- **Chart.js 4.x via CDN**
- **marked.js via CDN** (parser de markdown para body de comment)
- **Google Fonts**: Quicksand, Manrope, JetBrains Mono
- **Backend**: [Supabase](https://supabase.com)
  - **Postgres** com 25+ migrations aplicadas (em `supabase/migrations/applied/`)
  - **RLS fechada role-aware** (admin/interno/cliente) via helpers stable security definer
  - **Auth** com magic link (lista fechada de pessoas pré-cadastradas; sem signup público)
  - **Realtime** em `tasks`, `clientes`, `projetos`, `pessoas`, `task_comments`, `task_status_history`, `task_field_history`, `task_attachments`
  - **Edge Functions** (`ingest-task`, `ingest-comment`, `delete-task`, `cleanup-attachments`, `get-clientes`, `get-pessoas`)
  - **Storage** bucket privado `task-attachments` (anexos de imagem, signed URLs 1h) com policy tenant-aware
  - **pg_cron + pg_net** rodando cleanup diário de anexos de tasks concluídas há mais de 30d
- **Deploy**: Netlify (auto deploy no push em `main`)
- **Sem build step**: editar arquivos em `lib/` e refrescar; ordem de carregamento controlada por `<script src>` em sequência no `<head>` do `index.html`

## 6. Stack do Next (Onda 0 · ✅ feature-complete em `feat/onda-0`)

Em uso no preview Vercel hoje, sobe pra prod no Bloco 5 · Cutover:

- **Next.js 15** + TypeScript + App Router (monolito) · subpasta `web/`
- **Postgres via Supabase** (mesmo banco do Alpine — sem dual-db) com **RLS role-aware mantida**
- **Drizzle ORM** (schema draft em `web/src/lib/db/schema.ts`; `db:pull` adiado por incompat com check constraints — Client Components não dependem dele)
- **Supabase JS direto nos Client Components** (boot + estado em memória + realtime channel — mesmo padrão do Alpine, sem Server Actions em telas interativas)
- **Tailwind v3** (sem shadcn — usamos os primitivos próprios `.btn` `.card` `.inp` `.chip` portados de `lib/styles.css`)
- **Recharts** **descartado** — gráficos quando vierem usam o mesmo Chart.js já em uso no Alpine ou refazem com SVG nativo
- **`marked`** para Markdown (Help, Onboarding)
- **`@serwist/next`** pro service worker (PWA · precache + runtime cache)
- **`@resvg/resvg-js`** + IBM Plex Mono TTF pra gerar splash screens iOS no build-time
- **Vercel** deploy
- **Sentry + PostHog** **ainda não plugados** — entra no roadmap pós-cutover (ver §14.4)

Estrutura de rotas: route groups `(app)` (interno autenticado), `(auth)` (login). Portal cliente pendente — ver §14.4.

**Decisões arquiteturais centrais** (em `web/ONDA0.md`):
- **Não usar Server Actions** em telas com >1 interação/segundo — latência inaceitável.
- **Estado em memória via `DataProvider`** Client Component que faz boot único, expõe `useData()`, mutadores otimistas com rollback (`patchTask`, `replaceTask`, `upsertCliente`, etc.) — espelho fiel dos 7 helpers de `core-data.js` do Alpine.
- **Auth via Supabase JS no browser**, middleware Next pra gating de rotas.
- **Vercel** deploy
- **Sentry + PostHog** desde o dia 1

Estrutura de rotas planejada: route groups `(internal)` e `(client)` com middleware de auth distintos. RLS em toda tabela com `client_id` ou `organization_id` desde a primeira migration.

## 7. Modelo de dados (atual em Postgres)

```
clientes
  id, nome, tier (estrategico|potencial|descoberta),
  eh_interno (bucket de gestão admin-only, sem tier/dominios),
  dominios[] (domínios de email pra automação resolver cliente),
  arquivado_em

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
  criado_por_ia (bool · task vinda de automação IA / Cowork),
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

- **Onda 0 — Rebuild Next/Drizzle**: **feature-complete em `feat/onda-0` · pré-cutover (v1.02.161)**. 100% paridade UX com Alpine. PWA (manifest + ícone + splash iOS + service worker). 44 unit tests + 3 e2e + CI GitHub Actions. Realtime dormente (publication Supabase precisa habilitar 4 tabelas — fica pra pós-cutover). Helpers de `lib/helpers.js` portados pra `web/src/lib/task-utils.ts`. **Bloco 5 (cutover Vercel)** é o último passo. Plano completo em `web/ONDA0.md`.
- **Onda 1 — MVP backlog interno**: **entregue.** Tasks, comments, checklist, anexos, histórico, auditoria, kanban, calendário, dashboard.
- **Onda 2 — Portal cliente**: **entregue + repaginada v2 (PR #182).** Login restrito, RLS tenant isolation real, visão narrativa (header + alertas + KPIs com delta + sparkline 6m + distribuição + lead time + listas), HOWTO_CLIENTE.md dedicado.
- **Onda 3 — Analytics**: **entregue.** 8 visões fixas dentro do Dashboard.
- **Onda 4 — Integração Salesforce + automações externas**: **entregue.** Edge functions `ingest-task` (aceita `criado_por_ia` + cliente vazio/sentinel `"Triagem"`), `ingest-comment`, `delete-task`, e leitura `get-clientes` / `get-pessoas` (expõem vocabulário pra automações IA descobrirem cliente/projeto/responsável antes de criar task).
- **Onda 5 — Notificações**: sino in-app (mentions, assignment, cliente respondeu) entregue. Email/Slack ainda não.
- **Onda A/B/C — Heurísticas pré-IA** (entregues entre PR #~130 e #170): 9 alertas determinísticos baseados em atributos da task/pessoa/projeto/cliente. Onda A = grande sem início, sobrecarga acumulada (depois aposentada), estratégico atrasado, bloqueio cliente, SLA iminente. Onda B = jr+complexidade, reaberturas. Onda C = bloqueio por dependência, estimativa furada.
- **Onda D — Capacidade semanal** (PRs #173–#175): bucketing semanal por prazo (4 semanas: atual + 3 próximas, atrasadas puxam pra W0). 5 heurísticas novas (H11 sustentação estourando, H12 sustentação ociosa, H13 projeto estouro, H14 projeto risco, H15 pessoa sobrecarga W), agregadas em **Briefing executivo** (heatmap pessoa × semana + listas sustentação/projeto), banner Dashboard e PDF executivo. Aposentou H2 antiga ("sobrecarga acumulada"), que mascarava sazonalidade. **15 heurísticas ativas hoje.**
- **Onda D+ — Sugestões de redistribuição** (PR #176): correlação pessoa × projeto na mesma semana ≥40% concentração → sugestão de realocar pra quem tem o cliente como principal/secundário e tem folga. Sem auto-apply. Top 5 ordenadas por semana e severidade.
- **Onda E — RLS role-aware** (PRs #185–#188): tenant isolation real. Drop de `prototipo_all` em todas as tabelas sensíveis + policies por role + helpers stable. Frontend `_loadPortal` separado. RPC `app_link_current_user_to_pessoa` resolve chicken-and-egg de first login. **Cliente externo seguro.**
- **Onda F — Modularização do single-file** (PRs #191–#212): 21 PRs sequenciais transformando `index.html` de single-file de 10.807 linhas em estrutura modular: `lib/styles.css` (CSS extraído), `lib/adapters.js` (mapeamento JS↔DB), `lib/supabase-client.js`, **13 views** em `lib/views/*` (portal, briefing, calendar-foco, utilities, anexos, notifications-checklist, cadastros, task-modal, adoption, charts, backlog-kanban, core-data, telemetria-export), `lib/app.js` reduzido a 542 linhas (state + INIT/PERSISTÊNCIA + composição de mixins). Padrão técnico: `Object.defineProperties(base, getOwnPropertyDescriptors(makeXxxView()))` preserva getters Alpine. **Adia significativamente a necessidade da Onda 0.**

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

`index.html` tem 9 abas principais (gating por role · cliente externo só vê Portal):

- **Foco**: urgências do dia (filtrável por pessoa). Sub-utilizada — candidato a virar a "tela mais importante" se receber resumo IA + agenda do dia.
- **Backlog**: tabela ordenável + filtrável (cliente · projeto · pessoa · prioridade · complexidade · status · tag, todos com opção sentinel `__empty__` "vazio") + bulk actions (etapa, pessoa, prioridade, prazo, esforço, arquivar, excluir).
- **Triagem**: cards de tarefas com critérios faltando (responsável/cliente/prazo/esforço), filtros chip "sem-X", multiselect + bulk (pessoa, prazo, esforço).
- **Kanban**: 11 colunas operacionais OU 4 colunas executivas (toggle), drag-and-drop, quick-add inline por coluna. Filtros: cliente · projeto · responsável.
- **Calendário**: mensal, tasks com prazo agrupadas por dia. Filtros: cliente · projeto · responsável.
- **Dashboard**: 8 visões analytics + banner de heurísticas (top 3) com CTA pro Briefing. Filtros: cliente · projeto · responsável.
- **Briefing executivo** (admin): narrativa semanal + heatmap pessoa × semana (Onda D) + sustentação contratada vs realizada + projeto fechado vs orçamento + sugestões de redistribuição. Exportável em PDF.
- **Cadastros**: 3 sub-abas (clientes, projetos, pessoas) com CRUD + tier de cliente + arquivamento.
- **Adoption**: usage events agregados (Onda 5 — interno).

E o **Portal cliente**: tela separada, gating automático por role `cliente` (UI esconde todas as outras tabs). Conteúdo v2: header navy com headline narrativo, alertas amber (heurísticas amigáveis), 4 KPIs com delta vs mês anterior, 3 cards de storytelling (ritmo 6m, distribuição por projeto, lead time 90d), 4 listas operacionais (aguardando você, em andamento, próximas, recentes). Sem ações de staff (export/nova-tarefa/onboarding escondidos). Ajuda dedicada em `HOWTO_CLIENTE.md`.

### Modal de task (5 abas no mobile / 4 abas no desktop)

Layout reorganizado em v1.01.168:
- **Esquerda** (mobile: aba "Detalhes"): Atribuição → Descrição → Checklist (colapsável) → Esforço → Metadata (sem título)
- **Direita** (mobile: 3 abas próprias): Conversa · Anexos · Histórico

ESC encadeado: picker @-mention → linha checklist vazia (remove) → linha checklist com conteúdo (blura) → reply → lightbox anexo → comment-edit → modal fecha.

## 11. Convenções de código

- CSS variables em `:root` para todos os tokens — **nunca cores hardcoded**. CSS vive em `lib/styles.css`.
- Estado em função `app()` (em `lib/app.js`) retornando objeto Alpine; constantes do domínio em `lib/helpers.js` (em `window`).
- **Mixin pattern** para views: cada `lib/views/xxx.js` expõe `window.makeXxxView()` que retorna objeto com getters/métodos. Em `app()`: `for (const factory of [makePortalView, ...]) Object.defineProperties(base, Object.getOwnPropertyDescriptors(factory()))`. Usar `Object.defineProperties` + `getOwnPropertyDescriptors` em vez de `Object.assign` é **obrigatório** — `Object.assign` resolve getters em valores estáticos no momento da composição, quebrando reatividade do Alpine.
- Métodos extraídos referenciam estado via `this.*` — Alpine binda `this` ao proxy do objeto Alpine, funciona em qualquer mixin.
- Adicionar **view nova**: criar `lib/views/xxx.js` seguindo padrão IIFE + `window.makeXxxView`, registrar `<script src>` em `index.html`, adicionar `window.makeXxxView` no array de factories em `app()`.
- **Adapter pattern** `TASK_FIELDS` + `makeFromDb` / `makeToDb` (em `lib/adapters.js`) traduz entre snake_case do Postgres e camelCase do front. Adicionar campo novo na task: 1 linha em `TASK_FIELDS`.
- IDs no Postgres são `uuid` gerados via `gen_random_uuid()`.
- Datas em formato ISO no banco, formatadas para `DD/MM/YYYY` (longo) ou `DD/MM` (curto) na UI.
- Idioma: PT-BR em todo texto visível ao usuário.
- Optimistic UI em quase tudo: atualiza local antes do round-trip e rollback se Supabase errar.
- Realtime double-binding: insert/update/delete na DB dispara refetch ou patch local na sessão aberta.
- Ordem de carregamento dos scripts no `index.html` importa: `helpers.js` → `adapters.js` → `supabase-client.js` (depende de `window.supabase` da CDN) → `lib/views/*.js` → `lib/app.js` (no fim do `<body>`).

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

## 14. Diagnóstico estratégico e visão de futuro

**Diagnóstico v2 · atualizado mai/2026 · v1.02.050.** Esta seção captura uma leitura honesta do estado atual contra benchmarks acessíveis ao mercado-alvo (agências BR de serviços profissionais 8-50 pessoas) e propõe priorização. **Não é roadmap operacional** (esse vive em `ROADMAP.md`) — é leitura de produto e estratégia.

### 14.1 Onde isso se encaixa no mercado · score atualizado

Escala 1-5. **Negrito** = vantagem real defensável.

| Dimensão | K360 | Productive | Scoro | Asana | Linear | Notion | Basecamp |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Capacity weekly bucketing** | **5** | 3 | 3 | 1 | 1 | 1 | 1 |
| **Briefing narrado pré-IA** | **5** | 2 | 2 | 1 | 2 | 1 | 1 |
| **Portal cliente embedded** | **5** | 3 | 3 | 2 | 1 | 2 | 4 |
| **Adoption analytics interno** | **5** | 2 | 1 | 2 | 2 | 2 | 1 |
| **Mobile experience polish** | 4 | 3 | 3 | 4 | 4 | 4 | 3 |
| **Onboarding (3 perspectivas)** | 4 | 2 | 2 | 3 | 4 | 3 | 3 |
| Sub-etapas pipeline custom | 4 | 4 | 4 | 5 | 4 | 5 | 2 |
| Auth + RLS multi-tenant | 4 | 5 | 5 | 5 | 5 | 4 | 4 |
| Integrações nativas | 1 | 5 | 5 | 5 | 4 | 4 | 3 |
| Time tracking real | 0 | 5 | 5 | 2 | 1 | 1 | 1 |
| Faturamento integrado | 0 | 5 | 5 | 0 | 0 | 0 | 0 |
| *Features de IA em produção* | *0* | *3* | *2* | *3* | *4* | *4* | *1* |
| Preço (USD/seat/mês) | 0 (interno) | 9-63 | 12-69 | 11-25 | 8-14 | 8-15 | 99 flat |

**Soma das vantagens reais: 6 fossos defensáveis** (vs 3 no diagnóstico anterior · ganhamos design polish, adoption v2 e mobile). **Gaps inalterados: IA (0), time tracking (0), faturamento (0), integrações (1).**

**Posicionamento sugerido pra fora**: "sistema operacional enxuto pra agências brasileiras de serviços profissionais. Capacity planning, gestão executiva narrada, e portal cliente de verdade — em um único produto, em português, sem o peso enterprise."

### 14.2 Os 4 fossos defensáveis hoje

Recursos que **não existem combinados em nenhum competidor brasileiro acessível**:

1. **Capacity weekly bucketing combinada com tarefa real.** Float/Runn fazem capacity em silo. Aqui é dentro da própria tarefa, com sugestões de redistribuição pessoa × projeto. **Defensável por 12+ meses.**
2. **Briefing executivo narrado + 14 heurísticas determinísticas.** Linear Insights tem números frios. Notion+templates depende do usuário escrever. Aqui há prosa executiva auto-gerada. **Defensável por 18+ meses.**
3. **Portal cliente embedded com storytelling.** Basecamp é estático, Productive cobra premium, Notion guest é cru. Header narrativo, alertas amigáveis, RLS tenant isolation real, deep linking URL. **Defensável por 24+ meses.**
4. **Adoption analytics interno v2 (5 camadas).** Productive/Scoro mostram contadores; aqui há overview, classificação pessoa/feature, heatmap 28d, alertas operacionais A1-A10, e **indicadores de sucesso com sinal + conclusão heurística no topo**. Singular no mercado-alvo. **Defensável por 18+ meses.**

### 14.3 Pontos cegos honestos (mai/2026 pós ciclo de design)

1. ~~**`index.html` ~10.800 linhas**~~ → ✅ resolvido (Onda F + Onda 0 Next).
2. ~~**Mobile UX inconsistente**~~ → ✅ resolvido (ciclo de design PRs #253-#270).
3. **Ausência de IA visível**. **Continua sendo o gap #1.** Linear/Notion comoditizam IA. Primeira feature low-risk/high-value: `ai-suggest` (Haiku 4.5 sugere complexidade+esforço, ~R$0,015/exec) — ⭐ começar aqui. Ver `ROADMAP.md` §9.2 frentes 1-5 IA + §9.3.
4. ~~**Captura rápida de task.**~~ → ✅ resolvido (atalho `n` + command palette no Next).
5. **Time tracking = 0.** Bloqueia faturamento e retro honesta. Caminho: tabela `time_entries` + cronômetro start/stop por task. **Promovido pra Next em §14.4.**
6. ~~**Testes parciais.**~~ → ✅ parcialmente resolvido (Onda 0 Next ganhou 44 unit tests vitest + 3 e2e Playwright + CI). Getters de heurística agregados ainda sem teste — endereçar quando atacar Dashboard.
7. **Migrations manuais via Dashboard.** Frágil; útil um lint local que valida sintaxe antes de colar. ~2h.
8. **Anon key embedded + JWT exp 2036.** RLS protege, mas defesa em profundidade pede JWT 1h + refresh. ~2h.
9. **Realtime dormente no Next.** Code-side pronto (channel listener montado), só falta habilitar publication das 4 tabelas no Supabase Dashboard (~5min). **Promessa #1 do produto web bloqueada por config trivial.**

### 14.4 Visão escalonada de futuro (atualizada · pós-Onda 0 · v1.02.161)

> Detalhamento completo + inventário de TUDO já discutido (HABILITAR_DEPOIS, IA Onda 5+, parking lots, heurísticas pendentes, schema pendente) em **`ROADMAP.md` §9.3 · Roadmap pós-Onda 0**.

#### Now · próximas 2-3 semanas · fechar Onda 0 + destravar promessas técnicas

- **Bloco 5 · Cutover Vercel** (~2h). Trocar domínio principal pro projeto Next. Avisar time. Monitorar 24-48h.
- **Habilitar realtime publication** Supabase (~30min). Adiciona `tasks`, `clientes`, `projetos`, `pessoas` ao publication. Resolve UX "clicar na logo pra refetch".
- **Sentry + PostHog** plugados no Next (~1-2h). Não voar cego em prod.
- **JWT exp 1h + refresh** (~2h). Defesa em profundidade crônica.

#### Next · 1-2 meses · Onda 1 do Next · visibilidade gerencial + 1ª IA

Em ordem de execução sugerida:
1. **Dashboard** (sai de parking) — view executiva. Heurísticas e bucketing semanal já portados.
2. **Briefing** (sai de parking) — possivelmente embutido no Dashboard como uma view, reduz custo.
3. **`ai-suggest`** — primeira IA. Custo trivial (~R$0,015/exec). Fecha o gap competitivo #1.
4. **`ai-weekly-summary`** — Sonnet + cron sáb 06h. Combina com Briefing → aba "Insights".
5. **Push notifications + Badging API** — iOS 16.4+ suportado. VAPID + Edge Function.
6. **Notif digest hourly** + **Email digest semanal** (Resend, dom 18h).

#### Later · 3-6 meses · Onda 2 · diferenciação + multi-tenancy

- **Portal cliente** (sai de parking) — versão v2 do Alpine portada com RLS apertada.
- **`ai-risk-scanner`** — detector de risco diário (Sonnet + cron).
- **`ai-chat` com tool use** — chat com o backlog via `⌘K`.
- **Cronômetro start/stop por task** ⏱️ — tabela `time_entries`. Caminho pra faturamento.
- **Templates de projeto** — quick win em projetos recorrentes.
- **Capacidade prevista** — requer `weekly_capacity_snapshots` + job semanal.
- **Saved views / filtros nomeados** — quick win UX.
- **Auto-triage com IA** — Haiku + heurísticas pra tasks com `criado_por_ia=true`.
- **Reativar features de HABILITAR_DEPOIS** (Tags, Tipo de trabalho, Dependências) no Next — schema pronto, só re-implementar UI.

#### Cold storage · ainda parqueado conscientemente

Adoção (interno analytics) · WhatsApp digest · Slack integration · iCal feed · Web Share Target / File handlers / Protocol handlers · Recurring tasks · Triage inbox Linear-style · Importação em massa CSV · Heurísticas pendentes (skill mismatch, senioridade malalocada, churn risk) · API pública REST+webhooks · Multi-workspace · Faturamento integrado NFe · Brand decision (Kliente 360 CRM vs tasks 360).

### 14.5 Indicadores de sucesso · adoção interna (precondição comercial)

Métricas que dirão se o app virou hábito interno. Materializadas como card no topo da aba Adoption no Alpine (v1.02.050) — **aba Adoção segue em parking no Next** (sai quando user base justificar).

| Métrica | Meta 30d | Meta 60d | Status |
|---|---|---|---|
| DAU/WAU | ≥70% | ≥85% | em medição |
| Sessões/dia/pessoa | ≥5 | ≥8 | em medição |
| Comments públicos / semana | ≥20 | ≥40 | em medição |
| % tasks triadas (pri+esf+resp+prazo) | ≥80% | ≥90% | em medição |

Se em 60 dias 4/4 baterem → **pronto pra piloto comercial controlado** (1-2 agências amigas).

### 14.6 Riscos ranqueados (atualizado · pós-Onda 0 · v1.02.161)

1. **IA gap continua #1.** Médio-alto, 6 meses. Linear/Notion já comoditizam. Plano: `ai-suggest` no Next como primeira frente (ver `ROADMAP.md` §9.2).
2. **Regressão UX no cutover.** Médio, primeiro dia. Mitigação: Playwright smoke + Sentry plugado antes do cutover.
3. **Realtime ficar dormente por esquecimento.** Médio. Habilitar publication das 4 tabelas no Supabase Dashboard na semana do cutover.
4. **Adoption v2 vira métrica de vaidade** se não acompanhada de ação semanal. Mitigar com Briefing executivo abrindo seção "ações da semana" quando sair do parking.
5. **Brand confusion** "Kliente 360 CRM" vs "tasks 360". Decisão de naming antes de qualquer movimento comercial. Médio.
6. **Anon key + JWT 2036** crônico. Baixo agora (RLS fechada). JWT curto + refresh planejado pro Now.
7. ~~**CDN do Tailwind anunciou fim.**~~ → ✅ resolvido (Next build local elimina dependência de CDN).
8. ~~**Onda 0 vira "rebuild infinito"**~~ → ✅ não materializado. Onda 0 feature-complete com paridade UX 100% em ~3 meses de sessão.

### 14.7 Em uma frase

**Saímos de "protótipo robusto monolítico" pra "produto comercializável em stack moderna" via Onda 0 (Next 15 + Drizzle + Supabase + PWA + CI). Caminho crítico agora: ~8h pra fechar Onda 0 (cutover + realtime + Sentry + JWT). Próximas 1-2 ondas destrancam as 3 promessas que justificam o web app: colaboração viva (realtime), visibilidade gerencial (Dashboard + Briefing) e diferenciação por IA (`ai-suggest` ⭐).**
