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

- **4 visões integradas**: Backlog (tabela filtrável), Kanban (drag-and-drop entre status), Calendário (entregas por dia), Dashboard.
- **Filtros que viram link**: cliente, projeto, pessoa, status, prioridade e tag persistem na URL. Visões compartilháveis instantaneamente.
- **Reordenação manual**: arraste para definir prioridade fina; persistência via float-precision (zero numerações periódicas).
- **Tags livres**: campo `tags[]` por task; chip-input com auto-complete, filtro por tag, clique no chip filtra.
- **Comentários bidirecionais**: time conversa direto na task; comentários do Salesforce Chatter aparecem badged como "SF".
- **Histórico completo de status**: timeline com quem moveu, de onde para onde, quando.

### Sinalização proativa

- **Aging indicators**: badges automáticos quando uma task está parada além do limite saudável do status (laranja em warn, vermelho em stale). Thresholds por status: bloqueado >3d, andamento >7d, backlog >30d.
- **Atraso por prazo**: prazo vencido em vermelho em todas as visões.
- **Calendário com heatmap**: 1-2 tasks no dia em verde claro, 3-4 em amarelo, 5+ ou atrasadas em vermelho.

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

### Outros

- **Login com magic link** (toggleable): lista fechada de pessoas, sem senha. Vincula automaticamente pessoa cadastrada à conta auth no primeiro login.
- **PWA com ícone próprio**: "Adicionar à tela de início" no iPhone instala como app.
- **Export CSV** filtrado: gestão pega a planilha do que tá visível.
- **Export JSON** completo: snapshot de backup.
- **Tema claro / escuro**: respeita preferência do sistema.
- **Realtime**: qualquer mudança propaga em segundos pra todas as sessões abertas.

---

## Stack

Protótipo deliberadamente enxuto, focado em validar fluxo e UX antes de construir a versão "de verdade":

- **Frontend**: HTML único + [Alpine.js](https://alpinejs.dev/) + Tailwind CDN + Chart.js
- **Backend**: [Supabase](https://supabase.com) (Postgres + RLS + Realtime + Edge Functions)
- **Hosting**: [Netlify](https://www.netlify.com/) (deploy automático no push)
- **Auth**: Supabase Auth (magic link)
- **Sem build step**: editar e refrescar

A justificativa do "single-file": o protótipo é descartável por definição. O foco é descobrir requisitos com uso real antes de pagar o custo de framework, design system e RLS apertada. A migração pra stack profissional (Next + Drizzle + RLS apertada + design system extraído) é a próxima onda.

---

## Como rodar

```bash
git clone https://github.com/Kliente-360/tasks-360-mvp.git
cd tasks-360-mvp
# Editar SUPABASE_URL e SUPABASE_ANON_KEY em index.html
# Abrir index.html em qualquer servidor estático (ou só duplo-click)
```

Para o Supabase, rodar os SQLs em `supabase/` na ordem cronológica do filename. Para integrar com Salesforce, deploy das Edge Functions em `supabase/functions/`.

---

## Estado atual

**Maio 2026 — protótipo MVP completo.** Todas as ondas de polimento (H1, H2, H3) entregues + 3 ganhos de fechamento de ciclo + 2 itens "se aparecer dor real". Detalhes em [`ROADMAP.md`](./ROADMAP.md).

**Próximo passo recomendado**: 2-3 semanas de uso real pelo time + validação com 1 cliente piloto, antes de iniciar a Onda 0 (rebuild com Next + Drizzle + RLS apertada). Nada de codar mais antes disso.

---

## Documentos relacionados

- [`ROADMAP.md`](./ROADMAP.md) — roadmap canônico, decisões, ondas, registro de decisões
- [`CONTEXT.md`](./CONTEXT.md) — handoff técnico curto pra continuidade no Claude Code
- [`supabase/`](./supabase/) — schema SQL e Edge Functions
