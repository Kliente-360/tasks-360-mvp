# CONTEXT.md — Backlog Kliente 360

> Documento de handoff para continuidade no Claude Code. Lê isto **inteiro** antes de tocar em qualquer arquivo.

## 1. O que é este projeto

Aplicativo de gestão de backlog interno para a **Kliente 360** (consultoria oficial Salesforce — kliente360.com). Foco em: backlog por cliente / projeto / pessoa / prioridade / esforço / prazo. Uso interno, com futura abertura de portal restrito para clientes acompanharem o próprio backlog.

**Tagline / posicionamento da empresa**: "conhecimento como serviço".

## 2. Estado atual

Estamos no **protótipo do protótipo** — um único `index.html` standalone (Alpine.js + Tailwind CDN + Chart.js, sem build). Objetivo é validar fluxos e descobrir requisitos antes de construir o app "de verdade".

**Bug atual conhecido**: nenhum botão funciona ao abrir no navegador. Suspeita: race condition na inicialização do Alpine — `editing: this ? this.blankTask() : null` foi escrito de forma defensiva mas pode estar causando o problema. Investigar console do browser primeiro.

**Convenção de versão**: `APP_VERSION` em `lib/helpers.js` segue o **número do PR que entrega a mudança**. Ex: PR #130 → `v1.01.130`. Bump no commit que inclui o feature; nem todo PR precisa bumpar (docs-only não exige). Exposto no header como subtítulo do logo pra time saber qual versão está rodando.

## 3. Princípios de produto (NÃO violar)

- **Opinativo, não configurável.** Sem campos customizados, workflows configuráveis, sub-tarefas aninhadas, sprints, story points.
- **Esforço sempre em horas.** Prioridade sempre P0–P3.
- **Cliente externo nunca vê jargão de PM.** Quando o portal do cliente vier, ele quer saber "o que está sendo feito pra mim e quando fica pronto" — não sprint, epic, ou story.
- **Analytics interno, executivo, pragmático.** Sem Metabase, sem BI externo. Visões fixas, ~8 no total, dentro do app.

## 4. Identidade visual Kliente 360

- **Cor primária**: `#009900` (verde puro, extraído do logo oficial)
- **Verde escuro (hover)**: `#007A00`
- **Verde tinta (backgrounds suaves)**: `#E6F5E6` e `#F2FAF2`
- **Tipografia branding/títulos**: Quicksand (Google Fonts) — alinhado ao logo
- **Tipografia corpo**: Manrope
- **Tipografia dados/mono**: JetBrains Mono
- **Símbolo do logo**: 4 círculos verdes em padrão losango (top, esquerda, direita, baixo). Reproduzido em CSS no header (`.k360-mark` no `index.html`).
- **Status colors** (intencionalmente afastados do verde da marca pra não conflitar):
  - P0 / urgente / atrasado: vermelho `#C8392B`
  - P1 / alta: âmbar `#C77A1A`
  - P2 / normal: azul `#2D7AA8`
  - P3 / baixa: cinza `#6E7A72`

Logos oficiais (PNG) podem ser adicionados em `/assets/` quando necessário.

## 5. Stack do protótipo (atual)

- HTML único standalone
- Tailwind via CDN (`cdn.tailwindcss.com`)
- Alpine.js 3.14.1 via CDN
- Chart.js 4.4.4 via CDN
- Google Fonts: Quicksand, Manrope, JetBrains Mono
- Persistência: `localStorage` (chave: `kliente360-backlog-v1`)
- Deploy: Netlify (drag-and-drop ou conectado ao GitHub, sem build command)

## 6. Stack do app "de verdade" (Onda 1+, ainda não iniciada)

Decidida em conversa anterior, para quando sair do protótipo:

- **Next.js 15** + TypeScript + App Router (monolito)
- **Postgres via Supabase** (banco + auth + RLS)
- **Drizzle ORM** (preferido sobre Prisma para Claude Code — sem generate step)
- **Tailwind + shadcn/ui**
- **Recharts** para dashboards
- **Resend** para email transacional
- **Vercel** deploy
- **Sentry + PostHog** desde o dia 1

Estrutura de rotas planejada: route groups `(internal)` e `(client)` com middleware de auth distintos. RLS habilitado em toda tabela com `client_id` ou `organization_id` desde a primeira migration.

## 7. Modelo de dados (esqueleto pensado)

```
Organization → Client → Project → BacklogItem
                                    ├─ priority (P0–P3)
                                    ├─ effort (horas)
                                    ├─ dueDate
                                    ├─ status (backlog, andamento, bloqueado, concluido)
                                    ├─ assigneeId (Person)
                                    └─ clientVisible (bool)

User (role: internal_admin | internal_member | client_viewer | client_approver)
ProjectMembership (User × Project + permissões)
StatusHistory (toda mudança de BacklogItem grava entrada)
```

Detalhes críticos:
- `clientVisible` no item é o que determina se aparece no portal do cliente (Onda 2). Modelar desde já.
- `StatusHistory` desde o dia 1 — é a base para analytics de lead time e throughput.
- RLS no Postgres desde a primeira migration.

## 8. Roadmap de ondas

- **Onda 0 — Fundação**: design system base, auth, RBAC, CRUD básico de Cliente/Projeto/Pessoa, RLS configurado, CLAUDE.md no repo.
- **Onda 1 — MVP backlog interno**: backlog item, lista + Kanban, filtros, comentários, anexos, auditoria.
- **Onda 2 — Portal do cliente**: login externo, visão restrita por `clientVisible`, comentários, aprovação, status do projeto.
- **Onda 3 — Analytics**: 8 visões fixas (throughput semanal, lead time, carga por pessoa, atrasados, saúde por projeto, distribuição de esforço, aging do backlog, **itens aguardando cliente**).
- **Onda 4+**: notificações (email + Slack), relatórios, calendário, templates, SLA, automações.

## 9. As 8 visões de analytics (definitivas)

Para liderança:
1. Throughput semanal (12 semanas)
2. Lead time médio por cliente
3. Carga por pessoa (semana atual + 2 próximas)
4. Itens atrasados

Para gestão operacional:
5. Saúde por projeto (semáforo)
6. Distribuição de esforço por cliente (mês)
7. Aging do backlog
8. Itens aguardando cliente (bloqueios externos — diferencial)

## 10. Telas e funcionalidades do protótipo atual

`index.html` tem 4 abas:

- **Backlog**: tabela com filtros (busca, cliente, projeto, pessoa, status, prioridade), ordenação por qualquer coluna, modal de edição
- **Kanban**: 4 colunas (Backlog → Em andamento → Bloqueado → Concluído), cards com botões `←` e `avançar →` para movimentar
- **Dashboard**: 4 KPIs, 2 gráficos de barras horizontais (Chart.js), lista de atrasadas e bloqueadas
- **Cadastros**: 3 sub-abas (clientes, projetos, pessoas), CRUD básico, proteção contra exclusão com vínculos

Funcionalidades transversais: export/import JSON, reset (volta ao seed), seed data temático (Bodytech, Sem Parar, projetos Sales/Service/Marketing Cloud).

## 11. Convenções de código (protótipo)

- CSS variables em `:root` para todos os tokens — **nunca cores hardcoded**.
- Estado em função `app()` retornando objeto Alpine.
- Persistência: `$watch` deep nos arrays principais → `save()` em `localStorage`.
- IDs gerados com `uid()` (random base36).
- Datas em formato ISO (`YYYY-MM-DD`) no storage, formatadas para `DD/MM/YYYY` na UI.
- Idioma: PT-BR em todo texto visível ao usuário.

## 12. O que NÃO fazer no protótipo

- Não migrar para framework com build (React, Vue, etc.). Continua single-file até decidirmos sair do protótipo.
- Não adicionar autenticação. É local, navegador único, dados em localStorage.
- Não criar portal do cliente neste arquivo — isso é Onda 2 do app real.
- Não adicionar dependências além de Tailwind / Alpine / Chart.js via CDN.

## 13. O que pode evoluir no protótipo

Se for útil para validação de fluxo, está OK adicionar ao `index.html`:
- Campos novos em tarefa (ex: tags, links externos)
- Novas visões no dashboard
- Filtros extras
- Exportação para CSV
- Tema escuro (opcional)
- Atalhos de teclado

Cada evolução deve preservar a estética Kliente 360 e os princípios de produto da seção 3.
