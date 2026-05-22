# Backlog Kliente 360

**Gestão executiva de backlog para consultoria Salesforce — opinativa, integrada e enxuta.**

Sistema interno da [Kliente 360](https://kliente360.com) para gestão de tarefas por cliente, projeto, pessoa, prioridade, esforço e prazo. Não é um Jira, não é um Trello: é uma ferramenta executiva que respeita o jeito de operar de uma consultoria, com analytics embutido e sincronização bidirecional com Salesforce.

---

## Por que existe

Consultorias Salesforce vivem o dilema da governança: **PMs precisam controlar; sócios precisam enxergar; clientes precisam acompanhar — sem cada um abrir uma ferramenta diferente**.

Ferramentas genéricas (Jira, Asana, Trello, ClickUp) resolvem isso adicionando complexidade configurável: campos customizados, workflows opcionais, sprints, story points, automações. Cada cliente novo entra na consultoria e a ferramenta vira um Frankenstein.

A **Kliente 360** opera com método claro:
- todo trabalho tem cliente, projeto e dono
- esforço sempre em horas (não story points)
- prioridade sempre P0..P3 (não fibonacci)
- analytics executivo é fixo, não construível

Esta ferramenta materializa esse método. Quem não opera assim não vai gostar — e tudo bem, não é o público.

---

## Para quem

| Público | O que ganha |
|---|---|
| **Sócios e liderança** | Dashboard com throughput, lead time, cycle time, atrasos e represa por status. Saúde da operação numa página. |
| **PMs e consultores** | Backlog filtrável, kanban com drag-and-drop, calendário de entregas, reordenação manual, comentários. |
| **Time externo (Salesforce) + automações IA** | Sincronização automática: tasks criadas/atualizadas/deletadas no SF refletem aqui em tempo real. Comentários do Chatter aparecem no app. Automações de IA (ex: Cowork) criam tasks via API, marcadas com chip 🤖 IA. |
| **Clientes** | Portal restrito com a visão do próprio backlog em linguagem de cliente, não de PM. **Em produção.** |

---

## O que entrega hoje

### Operação no dia-a-dia

- **Visões integradas**: Meu foco (urgências do dia), Briefing executivo (admin), Triagem (tasks incompletas), Backlog (tabela filtrável), Kanban (operacional 11 colunas / executiva 4 macros), Calendário (entregas por mês), Dashboard, Cadastros, Adoption — mais o Portal cliente. Visibilidade por role.
- **Etapas em dois níveis**: 4 macros fixas (Backlog, Em andamento, Bloqueado, Concluído) + 11 sub-etapas (Priorizado, Em definição, Em desenvolvimento, Em homologação, Pronto p/ produção etc.). Macro derivada da sub via trigger; toggle Operacional/Executiva no kanban.
- **Modal de task com 4 abas**: Detalhes (campos), Conversa (comentários), Anexos (imagens), Histórico (timeline de mudanças). Mobile fica em sheet-card com safe-area pra home indicator do iPhone.
- **Quick add inline**: cada coluna do kanban operacional tem `+ adicionar` para captura rápida — só título + Enter.
- **Bulk actions**: seleção múltipla na tabela do Backlog com barra flutuante (mover etapa, atribuir, mudar prioridade, excluir — com cascade nos anexos).
- **Command palette (⌘K)**: busca global em tarefas, clientes, projetos, pessoas e ações. Navegação 100% teclado.
- **Atalhos de teclado**: `n` nova tarefa, `/` busca, `g f/b/k/l/d/c/a` navega abas, `?` ajuda. ESC encadeado fecha picker → reply → lightbox → modal.
- **Filtros que viram link**: cliente, projeto, pessoa, status, prioridade, tag persistem na URL. Botão "✕ limpar filtros" com contador.
- **Reordenação manual** no backlog: arraste para definir prioridade fina; persistência via float-precision (zero numerações periódicas).
- **Tags livres**: campo `tags[]` por task; chip-input com auto-complete, filtro por tag, clique no chip filtra. (Atualmente escondido na UI — ver `HABILITAR_DEPOIS.md`.)
- **Checklist por task**: lista colapsável de mini-tasks com checkbox + risco quando done. Enter cria próxima linha; ESC em linha vazia remove. Contador done/total no título.
- **Anexos paste-only**: cole imagem (⌘V / Ctrl+V) em qualquer lugar do modal — downscale automático pra 1600px, cap 2MB, JPG/PNG/WebP. Lightbox click pra ampliar. Cron de 30d limpa anexos de tasks concluídas.
- **Comentários ricos**: time conversa direto na task com @mentions (notif), edit/delete pelo autor, toggle interno/externo no header, reply 1-nível encadeado, ⌘↵ envia. Comentários do Salesforce Chatter aparecem badged como "SF".
- **Histórico completo**: timeline unificada de mudanças de status + campos (prazo, esforço, responsável etc.) com quem moveu, de onde para onde, quando.
- **Modelo da task**: título, descrição, cliente, projeto, responsável, prioridade P0–P3, esforço (h), **complexidade** (alta/média/baixa), prazo, sub-etapa, tags, checklist, visível ao cliente, anexos.

### Sinalização proativa

- **Aging indicators**: badges automáticos quando uma task está parada além do limite saudável do status (laranja em warn, vermelho em stale). Thresholds por status macro: bloqueado >3d, andamento >7d, backlog >30d. Aging granular por sub-etapa também é registrado (`subetapa_em`).
- **Atraso por prazo**: prazo vencido em vermelho em todas as visões.
- **Sinais de risco** automáticos no relatório executivo: atrasadas concentradas, bloqueadas há +5d, aging crítico, tasks sem responsável, fila sem prazo.

### Analytics executivo

- **KPIs operacionais**: tasks em andamento, backlog, bloqueadas, atrasadas, com horas alocadas.
- **Velocidade da operação**: throughput 7d/30d, lead time médio, cycle time médio.
- **Throughput semanal**: barras de 8 semanas mostrando ritmo de entregas.
- **Volume por cliente** e **carga por pessoa**: distribuição de horas em tarefas abertas.
- **Lista de atrasadas** com dias de atraso, ordenada por urgência.

### Integração com Salesforce e automações externas

- **Edge Function `ingest-task`**: SF e automações de IA criam/atualizam tasks via REST; resolução automática de cliente/projeto/responsável por nome. Aceita `criado_por_ia` e cliente vazio / sentinel `"Triagem"`.
- **Edge Function `ingest-comment`**: comentários do Chatter pulled automaticamente, exibidos com badge SF.
- **Edge Function `delete-task`**: SF apaga tasks com cascade automático (comments e histórico vão junto).
- **Edge Functions `get-clientes` / `get-pessoas`**: leitura — expõem clientes (com domínios de email + projetos) e pessoas (candidatos a responsável) pra automações descobrirem o vocabulário antes de criar task.
- **Histórico bidirecional**: mudança de status no SF aparece com `actor_source='salesforce'` na timeline.

### Portal cliente

- **Visão restrita**: cliente logado vê só as tasks do próprio cliente_id marcadas como visíveis (`tasks.visivel_cliente=true`).
- **Conversa pública**: cliente pode comentar; interno responde herdando a visibilidade do thread. Toggle interno/externo controla o que sobe pro Portal.
- **Replies aninhados**: thread visual de pergunta-resposta, com herança de visibilidade pra não vazar contexto interno.

### Outros

- **Login com magic link** (toggleable): lista fechada de pessoas, sem senha. Vincula automaticamente pessoa cadastrada à conta auth no primeiro login.
- **PWA com ícone próprio + tab title "tasks 360"**: "Adicionar à tela de início" no iPhone instala como app.
- **Export PDF — Resumo Executivo**: documento narrativo de 8 seções (sinal geral, performance, saúde de clientes/pessoas, gaps & desvios, capacidade, decisões, anexos), pensado pra reunião de sócios. Ignora filtros — sempre relatório completo.
- **Export CSV** filtrado: gestão pega a planilha do que tá visível.
- **Tema claro / escuro**: respeita preferência do sistema. Header do modal task usa charcoal `#1f2937`.
- **Realtime**: qualquer mudança propaga em segundos pra todas as sessões abertas — inclusive comentários, checklist e anexos.
- **Cascade total**: ao excluir task (manual ou bulk), os anexos somem do storage (best-effort no client + cron 30d cobrindo órfãos).

---

## Stack

Single-file deliberadamente enxuto, focado em validar fluxo e UX antes de construir a versão "de verdade":

- **Frontend**: HTML único + [Alpine.js](https://alpinejs.dev/) + Tailwind CDN + Chart.js + marked.js
- **Backend**: [Supabase](https://supabase.com) — Postgres com RLS fechada role-aware (admin/interno/cliente), Realtime, Edge Functions, Storage (anexos), pg_cron + pg_net (cleanup agendado)
- **Hosting**: [Netlify](https://www.netlify.com/) (deploy automático no push)
- **Auth**: Supabase Auth (magic link, sem senha)
- **Helpers puros**: `lib/helpers.js` expõe constantes do domínio (STATUS, ROLE, PRIORIDADE, …) e funções puras (`atrasada`, `effEsforco`, `triageFailures`, `cargaNivelFromPctCap`). Carregado **antes** do script inline pra Alpine consumir os mesmos símbolos que os testes.
- **Sem build step**: editar arquivos em `lib/` e refrescar. Versão atual em `lib/helpers.js` segue `v1.<MINOR>.<BUILD>` — BUILD é sequencial por commit em main, **independente do número do PR** (os dois divergiram; ver `CLAUDE.md`).

A justificativa do "sem build step": é uma fase, não a arquitetura final. O foco é descobrir requisitos com uso real antes de pagar o custo de framework e bundler. Em mai/2026, a fase single-file deu lugar a fase modular: vários arquivos JS/CSS carregados em sequência via `<script>`/`<link>`, sem bundler. A migração pra stack profissional (Next + Drizzle + design system extraído) continua sendo a próxima onda quando o multi-file pesar. **RLS hoje é role-aware e tenant-scoped** — `prototipo_all` foi removida em mai/2026 (PRs #185-#188).

---

## Como rodar

```bash
git clone https://github.com/Kliente-360/tasks-360-mvp.git
cd tasks-360-mvp
# Editar SUPABASE_URL e SUPABASE_ANON_KEY em index.html
# Abrir index.html em qualquer servidor estático (ou só duplo-click)
```

**Supabase via Dashboard, sempre.** Nada de CLI. Rodar SQLs em `supabase/migrations/` na ordem cronológica do filename no SQL Editor. Edge Functions copy-paste no painel de Edge Functions. Cron via SQL Editor (pg_cron + pg_net habilitados em Database > Extensions). Detalhes em [`CLAUDE.md`](./CLAUDE.md).

Para integrar com Salesforce e automações externas, deploy das Edge Functions em `supabase/functions/` (`ingest-task`, `ingest-comment`, `delete-task`, `cleanup-attachments`, `get-clientes`, `get-pessoas`).

---

## Estado atual

**Maio 2026 — Onda 0 (rebuild Next) feature-complete · pré-cutover.** Versão atual: `v1.02.161` (BUILD bumpa a cada commit em main).

**Dois apps coexistem hoje:**

1. **App Alpine em produção** (`index.html` + `lib/`) — modo manutenção desde `v1.02.050`. Atende time interno + cliente externo. Modular: `lib/helpers.js` + `lib/adapters.js` + `lib/supabase-client.js` + 13 views em `lib/views/*` + `lib/app.js`. RLS fechada role-aware (admin/interno/cliente).

2. **App Next em preview Vercel** (`web/`, branch `feat/onda-0`) — paridade UX 100% com Alpine + PWA (manifest + ícone + splash iOS + service worker) + 44 unit tests Vitest + 3 e2e Playwright + CI no GitHub Actions. **Próximo passo é o cutover** (apontar domínio principal pro projeto Next).

Camadas entregues no app Alpine (continuam no Next):
- Modal de task com 4 abas (Detalhes/Conversa/Anexos/Histórico)
- Comentários ricos (mentions, edit, delete, reply nested, visibilidade toggleable)
- Checklist colapsável por task
- Anexos paste-only (storage + cleanup automático 30d)
- Portal cliente com replies aninhados + herança de visibilidade *(ainda em parking no Next · sai pós-cutover)*
- Mobile layout dedicado (sheet card + safe-area)
- Capacidade semanal + 14 heurísticas determinísticas + Briefing executivo *(Briefing/Dashboard em parking no Next · sai na próxima onda)*
- Resumo Executivo em PDF (8 seções) *(PDF em parking no Next · CSV ativo)*
- Integração de automação IA: flag `criado_por_ia`, domínios de cliente, edge functions `get-clientes`/`get-pessoas`

Roadmap completo **pós-Onda 0** (Now/Next/Later/Cold + inventário de tudo discutido — IA, time tracking, push, Portal, schema pendente) em **[`ROADMAP.md` §9.3](./ROADMAP.md)**.

**Próximo passo recomendado**: Bloco 5 · Cutover Vercel (checklist em [`web/ONDA0.md`](./web/ONDA0.md)). Depois: habilitar realtime publication + Sentry + JWT exp 1h.

---

## Documentos relacionados

- [`HOWTO.md`](./HOWTO.md) — manual do usuário com tudo o que dá pra fazer no app, atualizado a cada release
- [`ONBOARDING.md`](./ONBOARDING.md) — guia de primeiros passos por perfil (sócio/PM/consultor)
- [`ROADMAP.md`](./ROADMAP.md) — roadmap canônico (§9.3 = roadmap consolidado pós-Onda 0)
- [`CONTEXT.md`](./CONTEXT.md) — handoff técnico curto pra continuidade no Claude Code
- [`CLAUDE.md`](./CLAUDE.md) — convenções do projeto (Supabase via Dashboard, versionamento, git, CI, testes)
- [`DESIGN_HANDOFF.md`](./DESIGN_HANDOFF.md) — briefing pra designer (marca, tokens, dores visuais)
- [`HABILITAR_DEPOIS.md`](./HABILITAR_DEPOIS.md) — features prontas mas escondidas; quando reativar
- [`web/ONDA0.md`](./web/ONDA0.md) — plano + fechamento da Onda 0 (rebuild Next)
- [`web/README.md`](./web/README.md) — entry point técnico do app Next
- [`supabase/`](./supabase/) — schema SQL e Edge Functions
