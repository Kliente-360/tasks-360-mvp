# ROADMAP — Backlog Kliente 360

> Documento canônico do projeto. Captura todas as decisões, princípios, stack, ondas de entrega e armadilhas conhecidas. Use como referência principal quando estiver construindo o app real (pós-protótipo).
>
> Última atualização: maio de 2026.

---

## Índice

1. [Sumário executivo](#1-sumário-executivo)
2. [Princípios de produto](#2-princípios-de-produto)
3. [Identidade visual](#3-identidade-visual)
4. [Stack técnica](#4-stack-técnica)
5. [Estrutura do repositório](#5-estrutura-do-repositório)
6. [Modelo de dados](#6-modelo-de-dados)
7. [Workflow Cloud Design → Claude Code](#7-workflow-cloud-design--claude-code)
8. [CLAUDE.md inicial](#8-claudemd-inicial)
9. [Roadmap de ondas](#9-roadmap-de-ondas)
10. [Analytics — as 8 visões](#10-analytics--as-8-visões)
11. [Armadilhas conhecidas](#11-armadilhas-conhecidas)
12. [Registro de decisões](#12-registro-de-decisões)
13. [Glossário](#13-glossário)

---

## 1. Sumário executivo

### O produto

App de gestão de backlog interno para a **Kliente 360** (consultoria oficial Salesforce). Cobre ciclo completo: cadastro de cliente, projeto, pessoa, prioridade, esforço e prazo da tarefa, com analytics executivo embutido e portal externo onde o cliente acompanha seu próprio backlog.

### Posicionamento

Não é um Jira, não é um Trello, não é um Asana. É **opinativo**, executivo e — diferencial central — tem um portal de cliente que fala a linguagem do cliente, não a linguagem de PM.

### Audiências

- **Sócios e liderança**: dashboard executivo, saúde por cliente e projeto, decisões de capacidade.
- **Time interno (consultores, PMs)**: backlog operacional, kanban, gestão de tarefas.
- **Clientes**: portal restrito com visão do próprio backlog, status de entregas e itens que aguardam aprovação deles.

### Estado atual

Protótipo single-file (`index.html`) com Alpine + Tailwind + Chart.js, hospedado no Netlify (`https://tasks-360-mvp.netlify.app`). Serve para validar fluxos, descobrir requisitos faltantes e materializar a UX antes da construção do app real.

**Maio/2026 — protótipo MVP completo.** Todas as ondas de polimento (H1/H2/H3) e fechamentos de ciclo entregues. Detalhe em [§9.0](#90-onda-protótipo-pós-h1h2h3--ganhos-de-fechamento-maio2026).

**Próximo passo recomendado**: 2-3 semanas de uso real do time + 1 cliente piloto antes de iniciar a Onda 0 (rebuild). Não codar mais aqui antes disso.

---

## 2. Princípios de produto

Estes princípios são **não-negociáveis**. Toda decisão de feature deve passar por eles.

### 2.1 Opinativo, não configurável

Sem campos customizados, sem workflows configuráveis, sem sub-tarefas aninhadas, sem sprints, sem story points. Cada campo opcional dobra o custo de manutenção e a confusão do usuário. Resista a transformar isto em "Jira leve".

### 2.2 Esforço em horas, prioridade P0–P3

Esforço sempre em **horas**, nunca em pontos. Razão: cliente entende horas, executivo consegue calcular custo, time não precisa de cerimônia de estimativa para pontuar. Prioridade fechada em **P0 (urgente)**, **P1 (alta)**, **P2 (normal)**, **P3 (baixa)** — sem variações.

### 2.3 Cliente nunca vê jargão de PM

No portal externo, o cliente quer saber "o que está sendo feito pra mim e quando fica pronto". Termos como sprint, epic, story, story point, velocity são **proibidos** em qualquer texto visível ao cliente. O portal é produto, não consequência do app interno.

### 2.4 Analytics interno, executivo, pragmático

Sem Metabase, sem BI externo. Visões fixas dentro do app, ~8 no total (ver seção 10). Cada gráfico deve responder a uma pergunta executiva específica. Se uma visão não muda nenhuma decisão, não existe.

### 2.5 Multi-tenancy desde a primeira migration

RLS (Row-Level Security) habilitado no Postgres em **toda tabela** que contenha `client_id` ou `organization_id`. Errar isso depois é refactor de semanas e risco real de vazamento de dados entre clientes.

### 2.6 Status como verdade única

Toda mudança de status de tarefa grava entrada em `StatusHistory`. É isso que alimenta lead time, throughput, aging do backlog e SLA depois. Sem essa disciplina, analytics não tem base.

---

## 3. Identidade visual

### 3.1 Cores

| Token | Valor | Uso |
|---|---|---|
| `--brand` | `#009900` | Cor primária (verde Kliente, extraído do logo oficial) |
| `--brand-dark` | `#007A00` | Hover, ênfase |
| `--brand-soft` | `#E6F5E6` | Backgrounds suaves, badges |
| `--brand-tint` | `#F2FAF2` | Hover de linha em tabelas |
| `--ink` | `#0F1A14` | Texto principal |
| `--ink-soft` | `#3A4A40` | Texto secundário |
| `--muted` | `#7C8A82` | Labels, hints |
| `--bg` | `#FAFAF8` | Fundo da página |
| `--bg-elev` | `#FFFFFF` | Cards, elevação |
| `--line` | `#E8ECE8` | Bordas suaves |
| `--line-strong` | `#D4DAD4` | Bordas com peso |

### 3.2 Cores de status (intencionalmente não-verde)

Verde é a cor da marca; usar verde para "concluído" ou "ok" criaria conflito visual. Optamos por uma paleta semântica afastada:

| Token | Valor | Uso |
|---|---|---|
| `--p0` | `#C8392B` | P0 / urgente / atrasado |
| `--p1` | `#C77A1A` | P1 / alta |
| `--p2` | `#2D7AA8` | P2 / normal |
| `--p3` | `#6E7A72` | P3 / baixa |

Cada cor tem variante `-soft` para backgrounds de badges (ex: `--p0-soft: #FBEAE7`).

### 3.3 Tipografia

- **Branding e títulos**: Quicksand (Google Fonts). Família geométrica arredondada, alinhada à tipografia do logo oficial.
- **Corpo, UI, formulários**: Manrope (Google Fonts). Sans-serif moderna, legível em densidade alta.
- **Dados, números, mono**: JetBrains Mono. Para timestamps, IDs, métricas em KPIs.

### 3.4 Logo

- **Símbolo**: 4 círculos verdes em padrão losango (topo, esquerda, direita, base). No protótipo é reproduzido em CSS puro (`.k360-mark`); no app real, manter como SVG component.
- **Logotipo completo** (`kliente 360`): usar versões oficiais em `/public/brand/` (PNG ou idealmente SVG). Versão monocolor (verde sobre branco) é a primária; versão branca para fundos escuros.

---

## 4. Stack técnica

### 4.1 Decisão consolidada

| Camada | Escolha | Justificativa |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript strict** | Monolito leve, Server Components, Server Actions resolvem 80% das mutações sem API REST separada |
| Banco | **PostgreSQL via Supabase** | Banco + Auth + RLS num pacote só, economiza semanas |
| ORM | **Drizzle** | SQL-first, sem `generate` step (Claude Code lida melhor que com Prisma) |
| Auth | **Supabase Auth** | Email/senha + magic link + OAuth, integração nativa com RLS |
| UI | **Tailwind + shadcn/ui** | Componentes copiados (não dependência), totalmente customizáveis |
| Charts | **Recharts** | Componentes React nativos, padrão de mercado, fácil de tematizar |
| Email | **Resend** | API moderna, domínio próprio, sem cerimônia |
| Deploy | **Vercel** | Próximo do Next.js, preview deploys por PR |
| Observabilidade | **Sentry + PostHog** | Erros + uso. **Desde o dia 1**, não depois |
| CI/CD | **GitHub Actions** | Lint + typecheck + testes em PR |

### 4.2 Por que NÃO essas tecnologias

- **Prisma**: tem `prisma generate` que confunde agentes de código. Drizzle é mais previsível para desenvolvimento com Claude Code.
- **Metabase**: o usuário decidiu manter analytics interno, executivo e pragmático. Metabase é poderoso mas vira complexidade desnecessária para 8 visões fixas.
- **Auth0/Clerk**: Supabase Auth resolve, e mantém infra concentrada em um provedor.
- **MUI/Chakra/Mantine**: shadcn/ui dá controle total do código, encaixa melhor com a identidade visual customizada.
- **Microservices, monorepo, gRPC, Kafka**: nada disso é necessário no horizonte de 12+ meses.

### 4.3 Alternativa Python (não escolhida)

Se um dia o caminho for migrar parte do analytics para algo pesado: FastAPI + Postgres + Next.js só no front. Mais flexível para processamento de dados, mas custa orquestração extra. **Não é o caminho atual.**

---

## 5. Estrutura do repositório

```
/
├── app/
│   ├── (internal)/                  # área interna — auth: internal_*
│   │   ├── backlog/
│   │   ├── kanban/
│   │   ├── dashboard/
│   │   ├── cadastros/
│   │   └── layout.tsx
│   ├── (client)/                    # portal cliente — auth: client_*
│   │   ├── projetos/
│   │   ├── aprovacoes/
│   │   └── layout.tsx
│   ├── (auth)/                      # login, signup, magic link
│   ├── api/                         # route handlers (apenas quando Server Action não couber)
│   ├── globals.css                  # tokens e CSS variables
│   └── layout.tsx
├── components/
│   ├── ui/                          # shadcn primitives (button, card, dialog, etc.)
│   ├── internal/                    # componentes da área interna
│   ├── client/                      # componentes do portal
│   └── shared/                      # usados nos dois mundos
├── lib/
│   ├── db/
│   │   ├── schema.ts                # Drizzle schema completo
│   │   ├── queries/                 # queries reutilizáveis (uma por arquivo)
│   │   └── migrations/              # geradas pelo drizzle-kit
│   ├── auth/                        # helpers de auth + RLS context
│   └── analytics/                   # queries analíticas (CTEs, window functions)
├── public/
│   └── brand/                       # logos oficiais
├── tests/
│   ├── queries/                     # testes das queries de /lib/db/queries
│   └── rls/                         # testes de isolamento RLS
├── CLAUDE.md                        # contexto permanente para Claude Code
├── ROADMAP.md                       # este arquivo
└── README.md
```

### Por que route groups `(internal)` e `(client)`

Separar fisicamente os dois mundos no roteamento torna explícito o que pertence a cada audiência. Permite middleware de auth distinto para cada grupo, evita acidentes de "componente interno renderizado no portal do cliente", e força disciplina ao adicionar features novas.

### Por que `lib/db/queries/` separado

Toda query passa por aqui — **nunca SQL inline em componente**. Razões:
- Reuso entre Server Components, Server Actions e analytics.
- Camada onde testes de RLS mordem.
- Quando uma query precisa de otimização, há um único lugar para mexer.

---

## 6. Modelo de dados

### 6.1 Esqueleto (entidades-núcleo)

```
Organization
  └── Client (clienteId, nome, slug, ativo)
        └── Project (projetoId, clienteId, nome, status, prazo)
              └── BacklogItem (taskId, projetoId, ...)
                    ├── Comment
                    ├── Attachment
                    └── StatusHistory (uma linha por mudança de status)

User (id, email, role)
  └── ProjectMembership (userId, projetoId, permissões)

Person (membro do time interno, separado de User para casos onde a pessoa não tem login)
```

### 6.2 BacklogItem — campos críticos

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `clienteId` | uuid (fk) | denormalizado para queries rápidas |
| `projetoId` | uuid (fk) | |
| `pessoaId` | uuid (fk, null) | quem é responsável |
| `titulo` | text | |
| `descricao` | text | markdown permitido |
| `prioridade` | enum `P0|P1|P2|P3` | |
| `esforco` | numeric | em horas |
| `prazo` | date (null) | |
| `status` | enum `backlog|andamento|bloqueado|concluido` | |
| `clientVisible` | boolean | **crítico**: define se aparece no portal do cliente |
| `aguardandoCliente` | boolean | bloqueio externo, alimenta a visão "aguardando cliente" |
| `criadoEm` | timestamptz | |
| `atualizadoEm` | timestamptz | trigger de update |

### 6.3 Decisões de modelagem importantes

- **`clientVisible` modelado desde o dia 1**, mesmo que o portal do cliente seja Onda 2. Sem isso, refactor garantido depois.
- **`StatusHistory` desde o dia 1**. Toda transição grava: `taskId, fromStatus, toStatus, byUserId, at`. É a base de todas as métricas de fluxo.
- **`Person` separado de `User`**. Nem todo membro do time tem login (ex: estagiário, contratado externo). Tarefa pode ser atribuída a uma `Person` que não autentica.
- **`aguardandoCliente` como flag separada de `status='bloqueado'`**. Bloqueio interno e bloqueio externo (esperando cliente) são problemas operacionais diferentes — o segundo vira ouro pra cobrar cliente.
- **`organizationId` em quase tudo** para suportar futuro multi-org (mesmo que hoje só haja a Kliente 360, modelar evita refactor caso o app vire produto).

### 6.4 Índices essenciais

- `(clienteId, status)` em `BacklogItem` — filtros do backlog
- `(projetoId, status)` em `BacklogItem`
- `(pessoaId, status)` em `BacklogItem` — carga por pessoa
- `(prazo)` em `BacklogItem` filtrado por status ativo — listagem de atrasados
- `(taskId, at DESC)` em `StatusHistory` — histórico de uma tarefa

---

## 7. Workflow Cloud Design → Claude Code

### 7.1 Loop por onda

1. **Desenhar no Figma (cloud design) as 3–5 telas-chave** que definem o padrão visual da onda. Não precisa desenhar tudo — apenas o suficiente para extrair tokens e padrões.
2. **Extrair tokens** (cores, espaçamentos, tipografia) para `app/globals.css` como CSS variables. Pode pedir ao Claude Code para converter spec/print do Figma em CSS.
3. **Implementar o design system primeiro** — botões, cards, tabelas, badges de prioridade/status — antes das telas. É o que mantém consistência depois.
4. **Telas, uma por uma**. Para cada, dar ao Claude Code: referência visual + lista de dados que aparecem + interações esperadas. Resultado tende a ser bom quando essas três entradas vêm estruturadas.
5. **Revisar no navegador, ajustar, commitar pequeno**. Sessões longas no Claude Code degradam — preferir PRs pequenos e focados.

### 7.2 Hábitos críticos com Claude Code

- **`CLAUDE.md` na raiz**, sempre. Reforçar em cada sessão se necessário.
- **Commits pequenos com mensagens descritivas**. Permitem reverter pontual sem perder trabalho útil.
- **Revisar antes de aceitar abstrações**. Claude tende a sugerir generalizações prematuras ("vamos criar um sistema de plugins de prioridade?"). A resposta é não — princípio "opinativo, não configurável".
- **Migrações com `drizzle-kit generate`**, nunca `push` em produção. Toda migration commitada.
- **Testes em duas camadas**: queries de `/lib/db/queries/*` e funções de RLS. O resto do app pode ter cobertura mais leve.
- **Sessão nova quando trocar de assunto**. Histórico longo polui o contexto.

---

## 8. CLAUDE.md inicial

Documento que vai na raiz do repo do app real (Onda 0 em diante). Template:

```markdown
# CLAUDE.md

## Projeto
App de gestão de backlog interno + portal cliente da Kliente 360.

## Princípios (não negociar)
- Opinativo, não configurável.
- Executivo, não detalhista.
- Cliente NUNCA vê jargão de PM (sprint, epic, story point, velocity).
- Esforço sempre em horas. Prioridade sempre P0–P3.

## Stack
Next.js 15 (App Router) + TypeScript strict. Drizzle + Postgres (Supabase).
Tailwind + shadcn/ui. Recharts. Resend. Vercel. Sentry + PostHog.

## Convenções de código
- Server Components por padrão. Client Component só com estado/interação.
- Server Actions para mutações. API route handlers só quando Server Action não couber.
- Queries em `/lib/db/queries/*`. Nunca SQL inline em componente.
- Toda mutação que muda status de tarefa grava `StatusHistory`.
- CSS variables para todas as cores. Sem cores hardcoded.
- Componentes shadcn antes de criar novos.

## Auth
Dois mundos: (internal) e (client). Middleware de auth distinto por route group.
RLS habilitado em toda tabela com `clientId` ou `organizationId`.

## Identidade visual
Cor primária: #009900 (verde Kliente). Tipografia: Quicksand (display), Manrope (corpo), JetBrains Mono (dados).
Status colors: P0 #C8392B, P1 #C77A1A, P2 #2D7AA8, P3 #6E7A72.

## Não fazer
- Campos customizados, workflows configuráveis, sub-tarefas aninhadas.
- Sprints, story points, velocity.
- Substituir "horas" por outra unidade.
- Adicionar dependência sem justificar.
- Criar abstrações antes de existir um segundo caso de uso.
```

Expandir conforme decisões surgirem.

---

## 9. Roadmap de ondas

### Premissas de timeline

- **1 dev full-time competente**: MVP usável internamente em ~6 semanas; portal cliente em produção em ~9 semanas; versão completa com analytics em ~13 semanas.
- **2 devs full-time**: versão completa em ~8–9 semanas.

Timelines abaixo assumem 1 dev. Multiplicar por ~0.6 para 2 devs.

---

### 9.0 Onda protótipo pós-H1/H2/H3 — ganhos de fechamento (maio/2026)

> Onda informal feita **dentro do protótipo single-file**, antes da Onda 0. Objetivo: extrair valor máximo do `index.html` antes do investimento da Onda 0, e maturar requisitos com base em uso real.

#### Onda H1 — UX rasa (✅ concluída)

| # | Item | Commit |
|---|---|---|
| H1.1 | Toasts no lugar de `alert()` | `fa4256d` |
| H1.2 | Mini-modal de renomear no lugar de `prompt()` | `a4eff22` |
| H1.3 | Optimistic UI em todo o CRUD (tasks, clientes, projetos, pessoas) | `36fc0a7` |
| H1.4 | Empty states com CTA acionável | `93ec72f` |

#### Onda H2 — Funcionalidades de uso (✅ concluída)

| # | Item | Commit |
|---|---|---|
| H2.1 | Filtros persistem em querystring | `a986b83` |
| H2.2 | Search já cobria descrição (no-op) | — |
| H2.3 | Mini-modal de confirmação no lugar de `confirm()` | `7f45015` |
| H2.4 | Export CSV (visão atual filtrada) + dropdown CSV/JSON | `bb77e9b` |

#### Onda H3 — Login + histórico (✅ concluída, login toggleable)

| # | Item | Commit |
|---|---|---|
| H3.1 | Schema: `pessoas.email`, `pessoas.user_id`, `task_status_history` | `606e106` |
| H3.2 | Tela de login magic link + menu de usuário | `5ef9dfd` |
| H3.3 | Cadastro de email + botão "convidar" em pessoas | `a9a8bfd` |
| H3.4 | Logging de mudanças de status (app + Edge Function) + timeline | `68d6a7d` |
| — | `AUTH_ENABLED` toggle (atualmente `false`, religar quando estabilizar) | `465eaee` |

#### Vale agora — fechamento de ciclos abertos (✅ concluída)

| # | Item | Commit |
|---|---|---|
| 1 | Aging indicators no backlog e kanban | `f45bad7` |
| 2 | Comentários do app (não só Salesforce) | `a2c3a33` |
| 3 | Métricas de velocidade (throughput, lead, cycle) no Dashboard | `e1ca509` |

#### Se aparecer dor real — itens promovidos antecipadamente (✅ concluída)

| # | Item | Commit |
|---|---|---|
| 4 | Reordenação manual no backlog (DnD com `tasks.ordem` float) | `31804d1` |
| 5 | Tags / etiquetas (`tasks.tags text[]`) | `92e5526` |

#### Outros ganhos avulsos

| Item | Commit |
|---|---|
| Endpoint `delete-task` para sync com Salesforce | `4832d43` |
| PWA: apple-touch-icon, favicon, manifest | `d0d0e32`, `acdb3d9` |

#### O que ficou explicitamente fora desta onda (vai pra Onda 0+)

- **Anexos**: precisa Supabase Storage + UI heavy.
- **Notificações** (email/push): Edge Function + cron + templates.
- **Recorrência de tasks**: lógica não-trivial.
- **Search global indexado** (FTS / Algolia).
- **Permissões granulares** (RLS apertada por papel).
- **Multi-responsável**: mexe schema fundamental.
- **Histórico de campos não-status** (título, prazo, atribuição).

#### Critérios de saída do protótipo (pra autorizar Onda 0)

Não inventar features novas até bater todos:

1. ≥2 pessoas do time usando todo dia por 2+ semanas.
2. ≥3 dores documentadas que NÃO dá pra resolver no protótipo.
3. ≥1 cliente externo formalmente pedindo acesso ao próprio backlog.

Se 2-3 semanas de uso passarem sem bater os 3 critérios, abrir conversa séria sobre se vale construir Onda 0 ou se a Kliente fica neste protótipo (que é mais robusto do que parece).

---

### Onda 0 — Fundação (2 semanas)

**Objetivo**: garantir que o esqueleto suporta tudo que vem depois sem refactor.

Entregas:
- Setup do projeto Next.js 15, TypeScript strict, Tailwind, shadcn/ui inicial.
- Auth multi-tenant via Supabase (login email + magic link).
- RBAC com 4 roles: `internal_admin`, `internal_member`, `client_viewer`, `client_approver`.
- CRUD básico de Cliente, Projeto e Pessoa (sem decoração ainda).
- Layout do app interno com navegação principal.
- RLS configurado em todas as tabelas com `clientId`.
- **Design system base**: tokens, componentes shadcn customizados (button, card, dialog, table, badge), badges de prioridade e status.
- `CLAUDE.md` na raiz, `ROADMAP.md` (este arquivo).
- Sentry + PostHog plugados.
- Pipeline CI básico (lint + typecheck).

**Por que parece "over-engineering" mas vale**: invest aqui economiza semanas nas ondas 1–3.

---

### Onda 1 — MVP do backlog interno (3–4 semanas)

**Objetivo**: substituir o Trello/Notion/planilha que o time usa hoje.

Entregas:
- Modelo `BacklogItem` completo, com `clientVisible` e `aguardandoCliente` já modelados.
- `StatusHistory` automático em toda transição.
- **Tela de backlog** (lista com filtros: cliente, projeto, pessoa, status, prioridade, busca textual; ordenação por qualquer coluna; paginação se necessário).
- **Tela Kanban** (4 colunas: Backlog → Em andamento → Bloqueado → Concluído; drag-and-drop; soma de horas por coluna).
- **Modal de tarefa** (criar/editar; todos os campos; validação básica).
- **Comentários por tarefa** (markdown leve, menção a usuário).
- **Anexos por tarefa** (upload via Supabase Storage).
- **Auditoria visível** (timeline de mudanças por tarefa).
- Atalhos de teclado básicos (`n` nova tarefa, `/` busca, `esc` fecha modal).

Critério de pronto: o time interno consegue parar de usar a ferramenta atual.

---

### Onda 2 — Portal do cliente (2–3 semanas)

**Objetivo**: cliente conseguir acompanhar o próprio backlog sem precisar pedir status por email.

Entregas:
- Login externo (magic link preferencial, evita gestão de senha).
- Layout do portal — visualmente diferente do interno, sem jargão de PM.
- **Visão do projeto** (lista de tarefas com `clientVisible: true`, agrupadas por status).
- **Comentários do cliente** (cliente pode comentar em tarefas visíveis).
- **Aprovação/rejeição** de itens marcados como "aguardando aprovação".
- **Página de status do projeto** (visão simples: "o que está sendo feito", "próximas entregas", "o que precisa de você").
- Onboarding por convite via email (admin interno convida cliente, cliente cria conta com magic link).
- Notificação por email quando há item novo aguardando aprovação.

**Lembrete crítico**: portal é produto, não consequência. UX completamente diferente do interno.

---

### Onda 3 — Analytics executivo (2–3 semanas)

**Objetivo**: liderança consegue rodar reuniões executivas direto do app, sem planilha auxiliar.

Entregas:
- **Dashboard interno** com 8 visões (ver seção 10).
- **Dashboard cliente** (versão simplificada para o portal: progresso do projeto, próximas entregas, itens aguardando aprovação).
- Filtros transversais (período, cliente, projeto).
- Exportação de cada visão como PNG ou CSV.

**Pré-requisito implícito**: `StatusHistory` precisa estar populado e correto desde a Onda 1. Se houver buracos no histórico, esta onda fica fraca.

---

### Onda 4 — Operação madura (3–4 semanas)

**Objetivo**: app suporta operação de verdade, com automações que reduzem trabalho manual.

Entregas:
- **Notificações por email** (Resend): nova tarefa, mudança de responsável, mudança de prazo, item aguardando aprovação, prazo próximo.
- **Integração Slack** (webhook): canal por projeto recebe atualizações.
- **Relatórios PDF** exportáveis (status report semanal por cliente).
- **Integração com calendário** (iCal feed por pessoa: tarefas com prazo viram eventos).
- **Templates de projeto** (criar projeto novo a partir de template com tarefas pré-preenchidas).
- **SLA por cliente** (regras configuráveis: P0 responde em X horas, P1 em Y, etc.).
- **Automações simples** (regras tipo: "se atrasar X dias, escala pro PM via Slack").

---

### Pendentes (a decidir)

- **Importação em massa via CSV** — usuário vai colar CSV com tasks; gerar `supabase/seeds/import_<data>.sql` com INSERTs prontos resolvendo cliente/projeto/pessoa por nome. Pendente: receber o CSV + decidir se cadastros faltantes são auto-criados ou bloqueiam o import.
- **Arquivamento de clientes / projetos / tasks** — substitui qualquer controle de "ativo/inativo".
  - **Manual**: clientes e projetos podem ser arquivados/desarquivados via botão no cadastro.
  - **Automático**: tasks com status `concluido` há +14 dias são arquivadas por job (cron na edge function).
  - **Modelo**: coluna `arquivado_em timestamptz null` em `clientes`, `projetos`, `tasks`. `null` = ativo. Filtros do app ignoram arquivados por padrão.
  - **UI** (decisão pendente — leaning B):
    - (a) toggle "ver arquivados" no Backlog/Kanban/Cadastros
    - (b) tela dedicada "Arquivo" com tabelão único (clientes, projetos, tasks) + filtros (tipo, cliente, período, busca) e ação de desarquivar
  - **Impacto**: Backlog/Kanban/Dashboard/Adoption ganham filtro automático `arquivado_em is null`. Edit form: botão "arquivar" ao invés de excluir (manter excluir só pra erro). Realtime continua propagando.

### Onda 5+ — Diferenciação com IA

**Objetivo**: usar a história acumulada do app para virar diferencial competitivo.

#### Stack proposta

- **API**: Anthropic API (chave `ANTHROPIC_API_KEY` em env do Supabase).
- **Modelos**: Sonnet 4.6 para análise de prosa/contexto longo; Haiku 4.5 para tarefas curtas e baratas (classificação, extração).
- **Prompt caching** ligado em todas as chamadas — corta drasticamente o custo de jobs recorrentes (resumo semanal etc).
- **Onde rodar**: Edge Functions do Supabase, mesmo padrão dos endpoints existentes (`ingest-task`, `delete-task`).
- **Orçamento estimado**: <$20/mês mesmo com uso intenso, dado o volume atual e prompt caching.

#### Frentes ranqueadas (custo × valor)

**1. Sugestão de complexidade + esforço ao criar/editar task** ⭐ — *começar aqui*

- Usuário digita título + descrição → Claude propõe `complexidade` e `esforco`.
- RAG simples: usa tarefas fechadas do mesmo cliente/projeto como contexto.
- Botão "✨ sugerir" no form, não-intrusivo. Sempre revisável pelo humano.
- **Por que primeiro**: custo baixo, valor visível imediato, ótimo pitch de "IA preenche pra você". Risco de qualidade percebida mínimo (a sugestão é opcional).
- **Edge function nova**: `ai-suggest`.

**2. Resumo executivo semanal por projeto** ⭐⭐

- Cron sexta na edge function: para cada projeto ativo, gera 4-6 bullets — o que avançou, o que ficou para trás, riscos, próximos marcos.
- Aparece numa aba nova "Insights" e/ou seção opcional no PDF executivo.
- **Por que segundo**: maior impacto pro CEO/cliente. É o tipo de coisa que vende e pode ser entregue ao cliente final.

**3. Detector de risco antecipado** ⭐⭐

- Job diário olhando aging + bloqueios + atrasos crescentes + texto de comentários.
- Produz lista priorizada de "olhar aqui" com explicação contextualizada (ex.: "Cliente X: 3 tasks em homologação há +14d, comentário recente cita 'aguardando aprovação jurídica'").
- Aparece como banner no Dashboard ou em "Insights".
- **Por que terceiro**: protege operação e justifica renovação. Alta percepção de inteligência.

**4. Auto-categorização de tags + clusters**

- Ao criar task, Claude sugere tags coerentes com o padrão do projeto.
- Periodicamente, sugere fundir tags duplicadas (`bug-front`/`frontend-bug`).
- Reduz fricção. Valor médio.

**5. Chat com seu backlog** (tool use)

- Caixa de chat onde se pergunta "quais tasks do cliente X estão em risco?", "mostra o que tá parado há +10d".
- Claude usa tool calls em queries do Supabase pra responder com dados reais.
- **Cuidados**: prompt injection se aceitar texto de comments na query — manejar privilégio com tool defs restritas e schema-only nos resultados.
- Coolest demo. Maior esforço de engenharia.

#### Pré-requisitos pra começar

1. Chave Anthropic em env do Supabase.
2. Definir orçamento mensal aceitável.
3. Detalhar arquitetura e prompt do **item 1** (`ai-suggest`).

---

## 10. Analytics — as 8 visões

Decisão: 8 visões fixas, dentro do app, sem ferramenta externa de BI.

### Para liderança e sócios

1. **Throughput semanal** — itens entregues por semana, série de 12 semanas. Linha simples. Permite ver tendência de capacidade.

2. **Lead time médio por cliente** — do momento que tarefa entra "em andamento" até "concluída". Barras horizontais. Mostra quais clientes drenam mais tempo.

3. **Carga por pessoa** — horas planejadas vs. capacidade configurada, semana atual e próximas 2. Heatmap ou barras com linha de capacidade. Sinaliza quem está sobrecarregado.

4. **Itens atrasados** — lista priorizada, ordenada por dias de atraso × prioridade × cliente. Gráfico complementar: contagem de atrasados por cliente.

### Para gestão operacional

5. **Saúde por projeto** — semáforo por projeto (verde / amarelo / vermelho). Critérios: % de itens atrasados, tendência de throughput, presença de bloqueios. Lista de projetos com indicador.

6. **Distribuição de esforço por cliente** — horas por cliente no mês corrente. Pizza ou barras. Insumo para conversa comercial e renegociação de escopo.

7. **Aging do backlog** — há quanto tempo cada item está parado em cada status. Histograma por status. Indica fricções no fluxo (ex: muito tempo em "andamento" = falta de foco; muito tempo em "bloqueado" = problema crônico).

8. **Itens aguardando cliente** — bloqueios externos, ordenados por dias parados e por cliente. **A visão mais subestimada**: operações geralmente não medem isso e é onde mais escapa prazo. Vira ouro para cobrar cliente sem fricção.

### Implementação técnica

- Queries em `/lib/analytics/*`, uma por visão.
- Postgres dá conta de tudo com window functions e CTEs. Sem necessidade de OLAP.
- Recharts para todos os gráficos.
- Cache leve (React Server Component + revalidate por minuto) para evitar recomputar em cada página view.

---

## 11. Armadilhas conhecidas

Lista de riscos identificados, com mitigação. Revisitar antes de cada onda.

### "Vamos virar Jira"

**Sintoma**: pedido para adicionar campos customizados, sub-tarefas, workflows configuráveis, integrações com tudo.

**Mitigação**: princípio 2.1. Repetir em voz alta: "opinativo, não configurável". Cada campo opcional dobra o custo de manutenção.

### Portal do cliente como afterthought

**Sintoma**: portal sai com vocabulário de PM, telas reaproveitadas do interno, fricção alta.

**Mitigação**: tratar Onda 2 como produto separado em UX. Ter pessoa diferente revisando o portal (ou pelo menos, mentalmente trocar de chapéu). Cliente nunca lê "sprint" ou "story".

### Esforço em horas vs pontos

**Sintoma**: alguém propõe "vamos suportar os dois?". Resultado: nenhum dos dois funciona.

**Mitigação**: horas, decidido. Se algum dia houver pressão real para mudar, é decisão de produto deliberada, não acidente.

### Analytics sem dados confiáveis

**Sintoma**: Onda 3 entrega gráficos, mas eles refletem dados ruins (status mal mantido, transições não registradas).

**Mitigação**: desde a Onda 1, criar fricção operacional para manter status correto: lembrete diário, status review semanal, regra "tarefa sem status atualizado em 7 dias vira alerta". `StatusHistory` populado automaticamente em todas as mudanças.

### RLS quebrado em produção

**Sintoma**: cliente A consegue ver dados de cliente B por bug em policy.

**Mitigação**: testes de RLS em `/tests/rls/` desde a Onda 0. Cada nova tabela com `clientId` ganha teste correspondente. Em PR, falha o CI se faltar teste.

### Drift de Claude Code entre sessões

**Sintoma**: depois de algumas sessões, código começa a divergir das convenções (importa ORM diferente, cria componente custom em vez de shadcn, esquece de gravar StatusHistory).

**Mitigação**: `CLAUDE.md` revisitado a cada onda. Code review humano em todo PR. Linter customizado para regras críticas (ex: ESLint rule banindo SQL inline em componente).

### Tentação de aceitar tudo que Claude propõe

**Sintoma**: PR vem com 3 abstrações novas, "factories" prematuras, "design patterns" que não resolvem problema real.

**Mitigação**: revisar pensando "este código existe porque algum problema concreto pediu, ou porque pareceu elegante?". Se for o segundo, descartar.

### Migrations rodadas em produção sem revisão

**Sintoma**: alguém roda `drizzle-kit push` direto em prod, perde dados.

**Mitigação**: nunca `push` em prod. Sempre `generate` → revisão → `migrate`. Pipeline CI roda migrations em banco de teste antes de aprovar PR.

---

## 12. Registro de decisões

Decisões tomadas durante a discussão inicial, com motivo. Sirva como ADR (Architecture Decision Record) condensado.

| # | Decisão | Motivo |
|---|---|---|
| 1 | Next.js 15 monolito (não microservices) | Time pequeno, escopo claro, monolito leve é o que cabe |
| 2 | Drizzle (não Prisma) | Sem `generate` step; previsível para Claude Code |
| 3 | Supabase (não Postgres self-hosted + Auth0) | Concentra infra, RLS pronto, mais barato no início |
| 4 | shadcn/ui (não MUI/Chakra) | Componentes copiados, customização total, casa com identidade visual |
| 5 | Esforço em horas (não pontos) | Cliente entende, executivo calcula custo |
| 6 | Prioridade fechada P0–P3 (não livre) | Opinativo, não configurável |
| 7 | Analytics interno fixo (não Metabase) | 8 visões pragmáticas, sem cerimônia de BI |
| 8 | Route groups `(internal)` e `(client)` | Separação física força disciplina |
| 9 | RLS desde a primeira migration | Refactor depois é caro e arriscado |
| 10 | `clientVisible` modelado desde dia 1 | Mesmo que portal seja Onda 2, modelo precisa estar pronto |
| 11 | `StatusHistory` automático em toda transição | Base de toda métrica de fluxo |
| 12 | `aguardandoCliente` separado de `status='bloqueado'` | Diferencial: medir bloqueio externo é ouro |
| 13 | Magic link para clientes externos | Reduz fricção de senha esquecida |
| 14 | Sentry + PostHog desde dia 1 | Plugar depois é fácil de adiar e nunca acontece |
| 15 | Quicksand + Manrope + JetBrains Mono | Alinha com logo (Quicksand-like), legibilidade UI, dados em mono |
| 16 | Status colors afastadas do verde da marca | Verde é da marca; usar verde para "ok" gera conflito visual |

---

## 13. Glossário

Termos com significado específico neste produto.

| Termo | Significado |
|---|---|
| **Tarefa / item / `BacklogItem`** | Unidade básica de trabalho. Tem cliente, projeto, pessoa, prioridade, esforço, prazo, status. |
| **Backlog** | Estado inicial de uma tarefa (ainda não começou). Também: nome da tela principal e do app. |
| **P0–P3** | Prioridade. P0 = urgente, P1 = alta, P2 = normal, P3 = baixa. Sem variações. |
| **Esforço** | Tempo estimado em horas. Sempre horas. |
| **Lead time** | Tempo de "andamento" até "concluído". Medido por `StatusHistory`. |
| **Throughput** | Quantidade de tarefas concluídas por semana. |
| **Aging** | Quanto tempo uma tarefa está parada no status atual. |
| **`clientVisible`** | Flag que decide se a tarefa aparece no portal do cliente. |
| **`aguardandoCliente`** | Flag separada para sinalizar bloqueio externo (esperando ação do cliente). |
| **Onda** | Fase de entrega do roadmap. Ondas 0 a 5+. |
| **Portal cliente** | Área externa onde o cliente vê seu próprio backlog. Onda 2. |
| **Área interna** | Onde o time da Kliente 360 trabalha. Ondas 0 e 1. |
| **RLS** | Row-Level Security do Postgres. Garante isolamento de dados entre clientes. |

---

*Fim do roadmap. Atualizar este documento sempre que uma decisão estrutural mudar.*
