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
| **Time externo (Salesforce)** | Sincronização automática: tasks criadas/atualizadas/deletadas no SF refletem aqui em tempo real. Comentários do Chatter aparecem no app. |
| **Clientes** (futuro) | Portal restrito com a visão do próprio backlog em linguagem de cliente, não de PM. |

---

## O que entrega hoje

### Operação no dia-a-dia

- **7 visões integradas**: Meu foco (urgências do dia), Backlog (tabela filtrável), Kanban (operacional 11 colunas / executiva 4 macros), Calendário (entregas por mês), Dashboard, Cadastros, Adoption.
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

### Integração com Salesforce

- **Edge Function `ingest-task`**: SF cria/atualiza tasks via REST; resolução automática de cliente/projeto/responsável por nome.
- **Edge Function `delete-task`**: SF apaga tasks com cascade automático (comments e histórico vão junto).
- **Comentários do Chatter**: pulled automaticamente, exibidos com badge SF.
- **Histórico bidirecional**: mudança de status no SF aparece com `actor_source='salesforce'` na timeline.

### Portal cliente

- **Visão restrita**: cliente logado vê só as tasks do próprio cliente_id marcadas como visíveis (`tasks.visivel_cliente=true`).
- **Conversa pública**: cliente pode comentar; interno responde herdando a visibilidade do thread. Toggle interno/externo controla o que sobe pro Portal.
- **Replies aninhados**: thread visual de pergunta-resposta, com herança de visibilidade pra não vazar contexto interno.

### Outros

- **Login com magic link** (toggleable): lista fechada de pessoas, sem senha. Vincula automaticamente pessoa cadastrada à conta auth no primeiro login.
- **PWA com ícone próprio + tab title "tasks 360"**: "Adicionar à tela de início" no iPhone instala como app.
- **Export PDF — relatório executivo**: snapshot CEO-first em 2 páginas A4 (capa com KPIs + sinais de risco + 3 charts; tabela de backlog priorizado). Ignora filtros — sempre relatório completo.
- **Export CSV** filtrado: gestão pega a planilha do que tá visível.
- **Tema claro / escuro**: respeita preferência do sistema. Header do modal task usa charcoal `#1f2937`.
- **Realtime**: qualquer mudança propaga em segundos pra todas as sessões abertas — inclusive comentários, checklist e anexos.
- **Cascade total**: ao excluir task (manual ou bulk), os anexos somem do storage (best-effort no client + cron 30d cobrindo órfãos).

---

## Stack

Single-file deliberadamente enxuto, focado em validar fluxo e UX antes de construir a versão "de verdade":

- **Frontend**: HTML único + [Alpine.js](https://alpinejs.dev/) + Tailwind CDN + Chart.js + marked.js
- **Backend**: [Supabase](https://supabase.com) — Postgres com RLS aberta (protótipo), Realtime, Edge Functions, Storage (anexos), pg_cron + pg_net (cleanup agendado)
- **Hosting**: [Netlify](https://www.netlify.com/) (deploy automático no push)
- **Auth**: Supabase Auth (magic link, sem senha)
- **Helpers puros**: `lib/helpers.js` expõe constantes do domínio (STATUS, ROLE, PRIORIDADE, …) e funções puras (`atrasada`, `effEsforco`, `triageFailures`, `cargaNivelFromPctCap`). Carregado **antes** do script inline pra Alpine consumir os mesmos símbolos que os testes.
- **Sem build step**: editar `index.html` e refrescar. Versão atual em `lib/helpers.js` segue `v1.01.<PR_number>`.

A justificativa do "single-file": é uma fase, não a arquitetura final. O foco é descobrir requisitos com uso real antes de pagar o custo de framework, design system e RLS apertada. A migração pra stack profissional (Next + Drizzle + RLS apertada + design system extraído) é a próxima onda. **RLS aberta agora é decisão consciente** — todas as tabelas têm policy `prototipo_all (using true with check true)`.

---

## Como rodar

```bash
git clone https://github.com/Kliente-360/tasks-360-mvp.git
cd tasks-360-mvp
# Editar SUPABASE_URL e SUPABASE_ANON_KEY em index.html
# Abrir index.html em qualquer servidor estático (ou só duplo-click)
```

**Supabase via Dashboard, sempre.** Nada de CLI. Rodar SQLs em `supabase/migrations/` na ordem cronológica do filename no SQL Editor. Edge Functions copy-paste no painel de Edge Functions. Cron via SQL Editor (pg_cron + pg_net habilitados em Database > Extensions). Detalhes em [`CLAUDE.md`](./CLAUDE.md).

Para integrar com Salesforce, deploy das Edge Functions em `supabase/functions/` (ingest-task, ingest-comment, delete-task).

---

## Estado atual

**Maio 2026 — single-file MVP em uso real.** Versão atual: `v1.01.171` (bumpa a cada PR mergeado em main).

Camadas entregues:
- Ondas de polimento H1/H2/H3 completas
- Modal de task com 4 abas (Detalhes/Conversa/Anexos/Histórico)
- Comentários ricos (mentions, edit, delete, reply nested, visibilidade toggleable)
- Checklist colapsável por task
- Anexos paste-only (storage + cleanup automático 30d)
- Portal cliente com replies aninhados + herança de visibilidade
- Mobile layout dedicado (sheet card + safe-area)

Detalhes históricos em [`ROADMAP.md`](./ROADMAP.md).

**Próximo passo recomendado**: continuar de uso real pelo time + validação com 1 cliente piloto, antes de iniciar a Onda 0 (rebuild com Next + Drizzle + RLS apertada).

---

## Documentos relacionados

- [`HOWTO.md`](./HOWTO.md) — manual do usuário com tudo o que dá pra fazer no app, atualizado a cada release
- [`ONBOARDING.md`](./ONBOARDING.md) — guia de primeiros passos por perfil (sócio/PM/consultor)
- [`ROADMAP.md`](./ROADMAP.md) — roadmap canônico, decisões, ondas, registro de decisões
- [`CONTEXT.md`](./CONTEXT.md) — handoff técnico curto pra continuidade no Claude Code
- [`CLAUDE.md`](./CLAUDE.md) — convenções do projeto (Supabase via Dashboard, versionamento, git)
- [`DESIGN_HANDOFF.md`](./DESIGN_HANDOFF.md) — briefing pra designer (marca, tokens, dores visuais)
- [`HABILITAR_DEPOIS.md`](./HABILITAR_DEPOIS.md) — features prontas mas escondidas; quando reativar
- [`supabase/`](./supabase/) — schema SQL e Edge Functions
