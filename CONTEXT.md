# CONTEXT.md — tasks 360 (Kliente 360)

> Documento de handoff para continuidade no Claude Code. Lê isto **inteiro** antes de tocar em qualquer arquivo.

## 1. O que é este projeto

Aplicativo de gestão de backlog interno para a **Kliente 360** (consultoria oficial Salesforce — kliente360.com). Foco em: backlog por cliente / projeto / pessoa / prioridade / esforço / prazo. Uso interno **com Portal do cliente já em produção** — clientes logam pra acompanhar próprio backlog e comentar.

**Tagline / posicionamento da empresa**: "conhecimento como serviço".

## 2. Estado atual

**v1.01.207 · em uso real, com cliente externo logando.** Multi-file (não mais single-file) — `index.html` reduzido pra HTML puro + 1 entry point Alpine modular. Stack: Alpine.js + Tailwind CDN + Chart.js + marked.js, conectado a backend Supabase de verdade — Postgres com **RLS fechada role-aware**, Auth (magic link), Realtime, Edge Functions, Storage e pg_cron.

A **modularização foi concluída em mai/2026** (21 PRs, #191-#212): `index.html` saiu de 10.807 → 3.492 linhas; o script Alpine que vivia inline foi extraído pra `lib/app.js` (542 linhas, agora só state + INIT/PERSISTÊNCIA) e fatiado em **13 views** sob `lib/views/*` (portal, briefing, calendar-foco, utilities, anexos, notifications-checklist, cadastros, task-modal, adoption, charts, backlog-kanban, core-data, telemetria-export). CSS extraído pra `lib/styles.css` (1.587 linhas). Adapters e cliente Supabase em arquivos próprios. Padrão técnico de composição: `Object.defineProperties(base, getOwnPropertyDescriptors(makeXxxView()))` em `app()` — preserva getters reativos do Alpine que `Object.assign` achataria.

**A RLS deixou de ser "aberta consciente" em mai/2026** — tenant isolation real via policies por role (`admin`/`interno`/`cliente`), com helpers `app_pessoa_role()`, `app_pessoa_cliente_id()`, `app_is_staff()` e RPC `app_link_current_user_to_pessoa()` pra first-login. A migração pra Next + Drizzle é a Onda 0, ainda parked — a modularização ganhou tempo significativo antes desse passo ser inevitável.

**Convenção de versão**: `APP_VERSION` em `lib/helpers.js` segue o **número do PR que entrega a mudança**. Ex: PR #167 → `v1.01.167`. Bump em todo PR que muda comportamento (docs-only podem pular). Exposto no header como subtítulo do logo.

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
  - **Edge Functions** (`ingest-task`, `ingest-comment`, `delete-task`, `cleanup-attachments`)
  - **Storage** bucket privado `task-attachments` (anexos de imagem, signed URLs 1h) com policy tenant-aware
  - **pg_cron + pg_net** rodando cleanup diário de anexos de tasks concluídas há mais de 30d
- **Deploy**: Netlify (auto deploy no push em `main`)
- **Sem build step**: editar arquivos em `lib/` e refrescar; ordem de carregamento controlada por `<script src>` em sequência no `<head>` do `index.html`

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

- **Onda 0 — Rebuild Next/Drizzle**: **ainda não iniciada**. Próximo grande passo quando o single-file pesar concretamente (ver Seção 14).
- **Onda 1 — MVP backlog interno**: **entregue.** Tasks, comments, checklist, anexos, histórico, auditoria, kanban, calendário, dashboard.
- **Onda 2 — Portal cliente**: **entregue + repaginada v2 (PR #182).** Login restrito, RLS tenant isolation real, visão narrativa (header + alertas + KPIs com delta + sparkline 6m + distribuição + lead time + listas), HOWTO_CLIENTE.md dedicado.
- **Onda 3 — Analytics**: **entregue.** 8 visões fixas dentro do Dashboard.
- **Onda 4 — Integração Salesforce**: **entregue.** Edge functions ingest-task, ingest-comment, delete-task.
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

Atualizado em mai/2026 · v1.01.187. Esta seção captura uma leitura honesta do estado atual contra benchmarks de mercado e propõe priorização. **Não é roadmap operacional** (esse vive em `ROADMAP.md`) — é leitura de produto e estratégia.

### 14.1 Onde isso se encaixa no mercado

| Categoria | Players | Posição relativa |
|---|---|---|
| Task manager genérico (Asana, Linear, ClickUp, Monday) | $7–24/seat | Mais opinado e enxuto. **Não tenta competir em features** — sem sprints, story points, automation builder, custom fields. Isso é virtude consciente (Seção 3). |
| PSA · agency operating system (Productive, Scoro, Mavenlink/Kantata) | $9–63/seat | **Espaço-alvo natural**. ~70% das features que importam (capacity, projetos contratados, briefing executivo, portal cliente) com fração do peso visual. Falta: time tracking real, faturamento. |
| Capacity planning standalone (Float, Runn, Resource Guru) | $7–12/seat, silo isolado | **Onda D** colocou o app à frente: capacity combinada com tarefa real, sem viver em ferramenta separada. |
| Portal cliente embedded (Basecamp, Productive client portal, Notion guest) | Acoplado à ferramenta | Portal v2 é **o diferencial mais subestimado**. Basecamp tem versão estática; Productive cobra caro; Notion guest é cru. Storytelling + heurísticas + lead time é design product, não engenharia. |
| Documentação executiva (Linear Insights, Notion docs+DB, Hex) | — | Briefing + PDF é único nessa combinação. Linear Insights é dashboard frio; aqui há **narrativa**. |
| IA-first (Linear AI, Asana Intelligence, Notion AI, Glean) | Embutidos | **Lacuna real.** Zero IA em produção em 2026. ROADMAP tem Onda 5+ planejada mas não executada. |

**Posicionamento sugerido pra fora**: "sistema operacional enxuto pra agências brasileiras de serviços profissionais. Capacity planning, gestão executiva narrada, e portal cliente de verdade — em um único produto, em português, sem o peso enterprise."

### 14.2 Os 3 fossos defensáveis hoje

Recursos que **não existem combinados em nenhum competidor brasileiro** acessível:

1. **Briefing executivo narrado + 15 heurísticas pré-IA**. Linear Insights tem números; aqui há história em português. Heurísticas determinísticas calibradas (severidade por janela) agregadas em narrativa semanal. Defensável porque é hard work de modelagem, não feature checkbox.
2. **Capacity weekly bucketing (Onda D)**. Bucketing por prazo em 4 semanas, atrasadas puxam pra W0, defaults só pra análise (não toca dado real). Combinado com sugestões de redistribuição correlacionando pessoa × projeto. Float/Runn fazem capacity, mas em silo.
3. **Portal cliente embedded com storytelling**. Header narrativo, alertas amigáveis, KPIs com delta, sparkline 6m, distribuição por projeto, lead time 90d. RLS tenant isolation real (Onda E). Não é "view filtrada" — é produto público.

### 14.3 Pontos cegos honestos (estado em mai/2026 pós-Onda F)

1. ~~**`index.html` ~10.800 linhas**~~ → ✅ **resolvido na Onda F** (PRs #191-#212). 90% reduzido pra 3.5k linhas de HTML puro; 13 views modulares + adapters + supabase-client extraídos. Adia significativamente a necessidade da Onda 0 (Next/Drizzle).
2. **Testes automatizados** — parcial. Helpers puros cobertos (`weekStartMonday`, `taskWeekIndex`, `bucketTasksByWeek`, `projetoCapacidadeSemana`, `triageFailures`, etc.) via PRs #192-#195. **Falta cobrir getters complexos extraídos** (`portalMetrics`, `weeklyCapacityAnalysis`, `weeklyRedistSuggestions`, `briefingTendencia`, `reportClientesExec`) — agora muito mais fácil porque vivem em arquivos isolados. ~4h.
3. **Ausência de IA visível**. Continua o maior gap competitivo. Linear/Notion já comoditizam IA. Primeira feature low-risk/high-value: "resumir conversa da task" — Anthropic Sonnet 4.6 + prompt caching, fallback gracioso. ~1 dia.
4. **Migrations rodadas no Dashboard manualmente**. CLAUDE.md formaliza, mas é frágil. Incidente do `recipient_pessoa_id` em PR #186 mostrou. Útil ter ao menos um lint local que valida sintaxe antes de colar.
5. **Telemetria caseira (`usage_events`)**. Ok pra MVP. PostHog free tier quando precisar funil real.
6. **Anon key embedded + JWT exp 2036**. Risco aceito. Encurtar exp pra 1h com refresh é ~2h.
7. **Aba Foco sub-utilizada**. Não recebeu atenção recente. Pode virar a tela mais usada se receber: agenda do dia + 3 alertas top + 3 tasks priorizadas pela IA.

### 14.4 Visão escalonada de futuro (atualizada mai/2026)

#### P0 · agora
- **Smoke test do app modularizado em produção** — após 17 refactors mergeados em sequência, validar tab por tab: foco, backlog, kanban, calendar, dashboard, briefing, portal, cadastros, triagem, modal task, comments, anexos. Granularidade dos PRs facilita isolar regressão.

#### P1 · próximas 2-4 semanas (alto retorno, baixo-médio risco)
- **Primeira feature IA · "resumir thread da task"**: Anthropic Sonnet 4.6 + prompt caching + fallback gracioso. ~1 dia. **Fecha a maior lacuna competitiva.**
- **Email digest semanal**: Briefing executivo enviado domingo 18h via Edge Function + pg_cron. ~4h. Lock-in real.
- **JWT exp curto** (1h + refresh automático): defesa em profundidade. ~2h.
- **Testes em getters extraídos**: Vitest ou seguir runner caseiro `tests/index.html` pra `portalMetrics`, `weeklyCapacityAnalysis`, `weeklyRedistSuggestions`, `portalAlerts`, `reportClientesExec`. ~4h.

#### P2 · próximo trimestre
- **Capacidade prevista** com snapshot histórico semanal — heurística "estoura em N semanas". 1-2 dias.
- **WhatsApp digest** — promover do parking lot pra implementação se email digest validar a tese de push. Plano completo em `ROADMAP.md`.
- **Aba Foco repensada** — resumo IA do dia + 3 alertas top + 3 tasks priorizadas.
- **Heurísticas pendentes** (skill mismatch, senioridade malalocada) do parking lot do ROADMAP. ~30-60min cada.

#### P3 · 3-6 meses
- **Onda 0 modesta**: Next 15 + Drizzle só pro Portal cliente (escopo limitado, aprender padrão).
- **Slack/Teams integration** — em paralelo ao WhatsApp.
- **Time tracking real** — start/stop, habilita faturamento.
- **Webhooks externos** (incoming + outgoing).

#### P4 · 6-12 meses
- **Multi-workspace boundary** quando >2 agências usarem.
- **API pública** (REST + webhooks documentada).
- **PWA bem-feita** primeiro, nativo só se métrica indicar.
- **Faturamento integrado** (horas × hourly_rate × cliente, NF-e via gateway BR).

### 14.5 Riscos ranqueados (atualizado mai/2026 pós-Onda F)

1. ~~**Single-file vira parede**~~ → ✅ **mitigado pela Onda F**. Modularização entregue, 13 views isoladas. Onda 0 pode ser planejada com calma.
2. **IA gap**. **Subiu pra #1 ranking**. Médio-alto, 6 meses. Linear/Notion comoditizam IA. Próxima feature de impacto.
3. **Anon key embedded + JWT 2036**. Baixo agora (RLS fechada), crônico. JWT curto + auth proxy resolve em ~2h.
4. **Brand confusion · "Kliente 360" CRM vs tasks 360**. Nome do produto não está claro pra quem chega de fora. Decisão de naming antes de virar comercial.
5. **CDN do Tailwind**. Anunciado fim do CDN. Trocar por instalação local em ~1h, anotado.
6. **Testes parciais**. Helpers cobertos; getters extraídos ainda não. Risco de regressão silenciosa em heurística complexa.

### 14.6 Em uma frase

**É um produto técnico-criativo bem pensado, com 3 diferenciais reais (Briefing narrado, Capacity semanal, Portal cliente embedded). Modularização concluída (mai/2026) reduziu o `index.html` em 90% e adia significativamente a necessidade da Onda 0 (Next/Drizzle). Próximo movimento decisivo: primeira feature de IA — única lacuna competitiva crítica restante.**
