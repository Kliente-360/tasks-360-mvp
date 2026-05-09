# Design handoff — tasks 360 (Kliente 360)

> Briefing pra design agent revisar e elevar a identidade visual do app de "protótipo funcional" pra "produto pago, executivo, polido".
>
> **Documento autossuficiente**. Assume que o agente não conhece o repositório.
> Última atualização: 09/05/2026.

---

## 0. TL;DR pro design agent

**O que é**: app interno + portal cliente de gestão de backlog para consultoria Salesforce. Single-file HTML + Alpine + Tailwind CDN + Supabase. Já em uso real.

**O que mais incomoda hoje**: **tipografia inconsistente** (escalas, pesos, espaçamento entre famílias) e **espaçamento sem ritmo claro** (paddings ad hoc, ar visual irregular entre seções e cards).

**Direção**: elegância editorial. Notion como referência de partida — buscar marcas executivas que combinem **sobriedade pra gestão** com **fluidez consultivo-produtiva** (Stripe Dashboard, Linear, Pipedrive moderno, Vercel, Cron). **Não imitar genericamente** — adaptar pra identidade Kliente 360 (verde #009900).

**Escopo**: tudo. 8 abas + 3 modais + componentes (cards, chips, badges, tabelas, kanban, calendar, palette, comments). Mas as decisões de tokens (tipografia + spacing + cores) são o eixo central — o resto cai em cascata.

**Stack obrigatória**: manter single-file, Alpine, Tailwind CDN. Pode trocar todo o CSS, ajustar HTML pra estrutura/semântica, mas não pode quebrar realtime, auth gating, RLS, roles, atalhos, ⌘K, exports.

---

## 1. Contexto de produto

### 1.1 O que é

**tasks 360** — sistema de gestão executiva de backlog para consultoria Salesforce. Não é Jira, não é Trello: é uma ferramenta opinativa que respeita o método da Kliente 360 (todo trabalho tem cliente, projeto, dono; esforço em horas; prioridade P0–P3; analytics fixo).

### 1.2 Audiências

| Perfil | O que faz | Como vê o produto |
|---|---|---|
| **Admin** (sócios, liderança) | Tudo. Configura, audita, monitora. | "Quero confiança e densidade — me mostre TUDO sem ruído." |
| **Time Kliente 360** (interno) | PMs, consultores, devs Salesforce. CRUD em tasks, kanban, comentários. | "Quero produtividade e clareza — backlog grande, foco no meu dia." |
| **Cliente externo** (piloto: Pão e Talho) | Vê portal escopado ao próprio cliente. Só leitura + comentários. | "Quero transparência sem jargão — 'o que tá rolando comigo?'" |

### 1.3 Estado atual

Em uso real. Time interno usa diariamente. Piloto cliente externo agendado pro Pão e Talho. ~100 tasks ativas distribuídas em 8 clientes. Auth (magic link) está temporariamente desligado por bugs — todo usuário é admin por default, gating já implementado mas inerte.

---

## 2. Identidade visual atual

### 2.1 Brand

- **Cor primária**: verde Kliente 360 — `#009900` (light) / `#1AAF1A` (dark)
- **Logo/wordmark**: "tasks 360" (verde brand) + "gestão executiva · kliente 360" (cinza, uppercase espaçado)
- **Mark**: 4 quadrados em grid (k360-mark CSS já implementado)
- **Voz**: PT-BR, executiva, sem jargão de PM no Portal cliente

### 2.2 Tipografia atual (a ser revisada)

```
Inter            — corpo, UI
Manrope          — títulos, números (h1, KPIs hero)
JetBrains Mono   — chips, dados numéricos, labels uppercase, code
Quicksand        — usado em alguns lugares (kpi, font-brand) — INCONSISTENTE
```

**Problema**: 4 famílias é demais. Quicksand aparece em alguns pontos, Manrope em outros, sem regra clara. Tamanhos inconsistentes (h1 26→34px, KPI 44px, chip 11px, mas há intermediários ad hoc). Pesos misturados.

**Sugestão**: agente pode propor 2 famílias (sans + mono) ou 3 com regra clara, e definir escala tipográfica disciplinada (ex. modular scale 1.250 ou 1.333).

### 2.3 Cores tokenizadas (CSS vars — no `:root`)

```css
/* light */
--brand: #009900;        --brand-dark: #007A00;
--brand-soft: #E6F5E6;   --brand-tint: #F2FAF2;
--bg: #FAFAF8;           --bg-elev: #FFFFFF;
--ink: #0F1A14;          --ink-soft: #3A4A40;
--muted: #7C8A82;        --line: #E8ECE8;
--line-strong: #D4DAD4;

/* status semânticos (NÃO mexer em hue, são parte da linguagem) */
--p0: #C8392B;  /* urgente, vermelho */
--p1: #C77A1A;  /* alta, âmbar */
--p2: #2D7AA8;  /* normal, azul */
--p3: #6E7A72;  /* baixa, cinza */
```

Variantes dark já configuradas — manter coerência ao revisar.

### 2.4 Espaçamento atual (a ser revisado)

Ad hoc. Mistura de `gap-2`, `gap-3`, `gap-4`, padding `p-3 md:p-5`, `py-3 md:py-4`. Sem grid baseline. Cards têm padding de tamanhos variados. Headers de seção têm distâncias visuais inconsistentes.

**Sugestão**: agente pode propor sistema de spacing baseado em 4px (4, 8, 12, 16, 20, 24, 32, 40, 48) e auditar os usos.

### 2.5 Componentes atuais (o que existe)

- **`.card`**: container base, padding interno variável, sombra leve `--shadow-card`
- **`.btn`**: 4 variantes — `btn-primary`, `btn-ghost`, `btn-danger`, `btn-icon`
- **`.inp`**: input padrão, border-radius 6px, padding 9×12
- **`.tab`**: aba do header, border-bottom no estado ativo
- **`.pri`**: chip de prioridade (P0/P1/P2/P3) com dot e cor semântica
- **`.cx`**: chip de complexidade (alta/média/baixa) com mini-barras
- **`.status`**: chip de status macro com dot
- **`.aging-badge`**: badge de aging (warn/stale)
- **`.tag-chip`**: chip de tag livre
- **`.kcard`**: card do kanban
- **`.kpi`**: bloco grande de KPI (no Dashboard)

---

## 3. Stack e restrições técnicas

### 3.1 Manter

- **Single-file `index.html`** (~5500 linhas hoje). Sem build step. Editar e refrescar.
- **Alpine.js 3.14** para reatividade
- **Tailwind via CDN** + estilos inline em `<style>` tag (extender Tailwind via classe + CSS custom)
- **Chart.js 4.4** para charts do Dashboard e PDF report
- **marked 13** para renderizar HOWTO no app
- **Supabase** (Postgres + RLS + Realtime + Edge Functions)
- **PWA** (manifest + ícones já configurados)

### 3.2 Pode mudar

- **Todo o CSS** dentro do `<style>` block
- **Estrutura HTML** dos componentes (manter os bindings Alpine — `x-show`, `x-text`, `@click`, etc.)
- **Tipografia, escala, paleta secundária, ícones, espaçamento, sombras, radius**
- **Layout de qualquer aba** desde que mantenha as funcionalidades
- **Microinterações** (hover, focus, transition)

### 3.3 Não pode quebrar

- **Realtime**: subscriptions `task_*`, `comment_*` precisam continuar disparando renders
- **Auth gating** (mesmo desligado hoje): `viewerRole` + `visibleTabs` + RLS pra `cliente`
- **Atalhos teclado** (`⌘K`, `n`, `/`, `g + letra`, `?`, `Esc`)
- **Command palette** (⌘K) — pode redesenhar mas tem que continuar funcional
- **Exports** (CSV, PDF executivo via window.print() com layout dedicado)
- **Comentários com flags** `visivel_cliente` e `from_cliente`
- **3 roles**: admin / interno / cliente
- **Subetapas do kanban** (11 colunas operacional, 4 macros executiva)

---

## 4. Catálogo de telas

> 9 áreas principais. Cada uma com: propósito, jobs-to-be-done, peças visuais críticas.

### 4.1 Header (sticky top)

- Logo "tasks 360" + tagline
- Botões: ↓ exportar · ? manual · ☾ tema · | · + Nova tarefa · avatar (auth on)
- Tabs row (desktop) ou dropdown (mobile)

**JTBD**: navegar rápido, não distrair.

### 4.2 Meu foco (default pra interno; primeira aba)

- Selector "atuando como pessoa"
- 4 KPIs hero: Atrasadas · Para hoje · Bloqueadas · P0/P1
- 4 listas curadas (mesmo set, ordenadas)
- Cards de task com prio chip + título + cliente · projeto · etapa + prazo

**JTBD**: "o que devo atacar agora?"

### 4.3 Backlog

- Linha de controles: agrupar por · ✕ limpar filtros · ordem manual · contador
- Filtros em grid responsiva (Busca · Cliente · Projeto · Resp · Pri · Cmplx · Status · Tag)
- Tabela densa: checkbox · Tarefa (+ tags + descrição truncada) · Cliente · Projeto · Resp · Pri · Hrs · Cmplx · Prazo · Status · ✕
- Suporte a agrupamento de 1 nível com headers colapsáveis
- Bulk actions bar fixed-bottom quando há seleção

**JTBD**: "ver tudo, filtrar, mover em massa". Ferramenta de power-user.

### 4.4 Kanban

- Toggle Operacional / Executiva (desktop)
- **Operacional**: 11 colunas com scroll horizontal, faixa colorida no topo indicando macro (verde/vermelho/cinza), header com macro breadcrumb + nome da sub + contador, cards arrastáveis, "+ adicionar" inline por coluna
- **Executiva**: 4 colunas macro (Backlog/Em andamento/Bloqueado/Concluído), read-only
- Cards iguais aos do Calendar (componente `.kcard` compartilhado)

**JTBD**: visualização de fluxo, mover entre etapas.

### 4.5 Calendário

- Header: nav (‹ hoje ›) + nome do mês
- Grid mensal seg-dom (6 semanas)
- Cells: número + chips com título (desktop) ou dots (mobile)
- Click num dia abre tabela de cards abaixo (idêntica ao kanban op, ordem por prioridade)
- Legenda inferior: contagem do mês + dots semânticos

**JTBD**: ver carga por data, planning.

### 4.6 Dashboard

- KPIs hero (em andamento, backlog, bloqueadas, atrasadas, com horas)
- Métricas de velocidade (throughput 7d/30d, lead time, cycle time)
- 4 charts (clientes, pessoas, throughput 8 semanas, timeline 5 semanas)
- Lista de atrasadas

**JTBD**: saúde da operação numa página.

### 4.7 Cadastros

- Sub-tabs: Clientes · Projetos · Pessoas
- Botão "+ Nova X" (modal pra pessoa, inline pra cliente/projeto)
- Lista com avatar/inicial + nome + meta + ações (renomear/editar/excluir)
- Pessoas: badges admin/cliente externo + status convite

**JTBD**: configuração e curadoria.

### 4.8 Adoption

- KPIs de uso (DAUs, eventos, comentários)
- Gráficos volume/uso

**JTBD**: medir adoção do protótipo. Visível só pra admin.

### 4.9 Portal cliente

- Header com nome do cliente + tagline
- 4 KPIs hero (Em andamento, Próximas 14d, Aguardando você, Entregues 30d)
- 4 cards listas com tasks visíveis ao cliente
- Drawer de detalhe: status humanizado, descrição, projeto, contato, "Já respondi" se aguardando, linha do tempo, conversa pública

**JTBD**: cliente acompanha sem jargão. **Linguagem é o produto** — zero P0/P1, complexidade, esforço em horas, aging técnico, sub-etapas. Substituir por palavras humanas.

### 4.10 Componentes flutuantes

- **Modal task**: título + 11 campos + comentários + histórico
- **Modal pessoa**: nome + email + perfil + cliente vinculado
- **Modal renomear / confirm** (genéricos)
- **Command palette (⌘K)**: input + resultados (tarefa/cliente/projeto/pessoa/ação) + footer
- **Atalhos overlay (?)**: tabela de atalhos
- **Manual overlay**: TOC + markdown renderizado
- **Bulk actions bar**: fixed bottom no Backlog
- **Toasts**: bottom-right
- **PDF executivo**: layout dedicado em A4 (print-only)

---

## 5. Pontos fracos atuais (oportunidades de elevação)

### 5.1 Tipografia (PRIORIDADE)

- **4 famílias** (Inter, Manrope, JetBrains Mono, Quicksand) sem regra clara
- **Tamanhos** ad hoc: h1 oscila, KPIs têm 3 escalas diferentes (`text-2xl`, `text-3xl`, `kpi-num 44px`), chips entre 9-11px
- **Pesos**: 400/500/600/700 misturados sem hierarquia clara
- **Espaçamento**: line-height inconsistente (1.15 nos kcols, 1.65 no help-md, default em outros)
- **Tracking**: uppercase com 0.18em em alguns lugares, 0.12em em outros, 0.06em em outros
- **Mono usado demais** em chips/badges — fica barulhento

### 5.2 Espaçamento (PRIORIDADE)

- Cards com paddings 3/4/5 misturados sem rule
- Mb/mt entre seções: 4/5/6/8 sem ritmo
- Gap em rows: 2/3/4 ad hoc
- Header da página: distância ao primeiro elemento varia muito por aba
- Mobile não tem ritmo separado — só "menos padding"

### 5.3 Hierarquia visual

- Cards quase iguais entre si — KPI card, lista card, listagem card têm a mesma sombra/border
- KPIs hero não saltam o suficiente
- Badges/chips competem por atenção (status + pri + cmplx + aging + tags numa linha só na tabela)
- "Atrasada" e "Bloqueada" usam vermelhos parecidos — sinal duplicado, ruído

### 5.4 Cores

- Status semânticos (P0–P3) ok, mas tons saturados
- "Sucesso" / "concluído" não tem cor própria forte (usa cinza ou opacidade reduzida do brand)
- Brand verde aparece em poucos lugares — pode ser aproveitado como "guia visual" em vez de só botão

### 5.5 Microinterações

- Hover states genéricos (Tailwind defaults)
- Sem feedback de loading nos botões
- Transitions inconsistentes (algumas 120ms, outras 200ms, outras none)

### 5.6 Mobile

- Header comprimindo logo (já corrigido)
- Tabela do Backlog: linhas com altura variável (resolvido em parte com `hidden md:block` na descrição)
- Filtros stacked all full-width — funciona mas pesado visualmente
- Alguns modais com tap targets pequenos

### 5.7 Portal cliente

- Linguagem ainda tem resquícios técnicos ("etapa", "subetapa")
- Layout dos 4 cards é repetitivo, podia ter hierarquia visual diferente entre "Aguardando você" (urgente) e "Entregues recentemente" (calmo)
- Cliente não tem identidade própria — abre o app e parece ferramenta interna

---

## 6. Direção e tom

### 6.1 Referências sugeridas (estudar pra inspiração, **não copiar**)

- **Notion** — tipografia limpa, espaçamento generoso, hierarquia editorial
- **Stripe Dashboard** — sobriedade executiva, dados com peso, identidade verde sutil
- **Linear** — densidade controlada, atalhos teclado-first, microinterações refinadas
- **Vercel Dashboard** — minimalismo escuro/claro com personalidade
- **Cron / Notion Calendar** — calendário elegante
- **Pipedrive 2024** — kanban executivo
- **Height** — bulk actions e command palette inspirados

### 6.2 Tom da marca

| Atributo | Sim | Não |
|---|---|---|
| Profissionalismo | sóbrio, confiável | corporativo morto |
| Densidade | informação rica, escaneável | poluído |
| Modernidade | tipografia atualizada, microinterações | trend-chasing, glassmorphism |
| Identidade | verde Kliente 360 marca presença pontual | verde brand em todo lugar |
| Brasilidade | PT-BR, frases naturais | tradução literal de inglês |

**Voice**: executivo pra liderança + consultivo-produtivo pra time.

---

## 7. Não-objetivos / decisões já fechadas

- **Manter etapas macro fixas**: backlog/andamento/bloqueado/concluído. Granularidade é via subetapa.
- **Manter linguagem PT-BR sem jargão de PM** no Portal cliente.
- **Não trocar fonts pra serif** (manter sans no corpo).
- **Não usar emoji decorativo** em nenhum lugar — só funcional (✓, ✕, ⚠, →).
- **Não ir mobile-first ao ponto de prejudicar densidade desktop**: target principal é desktop pra interno; mobile é "consulta rápida".
- **Manter dark mode funcional** (não regredir).
- **Não introduzir build step** (Tailwind CDN, sem PostCSS, sem npm).
- **Não trocar Chart.js por outra lib** (já está integrado).

---

## 8. Critérios de sucesso

1. **Tipografia**: máximo 3 famílias com regra clara (corpo / títulos / mono opcional). Escala modular consistente. Hierarquia visível em 1 segundo.
2. **Spacing**: sistema baseado em 4px aplicado em todo o app. Ritmo visual claro entre seções, cards e elementos.
3. **Hierarquia**: ao abrir qualquer tela, fica óbvio o que é importante (KPI > listagem > meta > footer).
4. **Identidade**: brand verde reforça personalidade sem dominar. App parece "Kliente 360" e não "outro app verde".
5. **Polimento**: hover/focus/transition consistentes. Loading states sutis. Sem quebras visuais.
6. **Acessibilidade**: contraste mínimo WCAG AA em todos os elementos textuais. Focus visible. Touch targets ≥ 44×44 mobile.
7. **Portal cliente sente diferente**: ao abrir o Portal, a sensação é "isto é pra mim" (cliente externo) vs "isto é pra eu trabalhar" (interno).
8. **Manter funcionalidades**: zero regressão nas features atuais.

---

## 9. Deliverables esperados

1. **Patch no `index.html`** com:
   - `<style>` block reformulado: novos tokens (cores, tipografia, spacing, radius, sombras), redesign dos componentes
   - Ajustes pontuais no markup onde a estrutura ajuda hierarquia (ex.: cards com `<header>`/`<footer>` semânticos)
   - Imports de fonts atualizados
2. **Comentários inline** nas mudanças significativas explicando intenção
3. **Não criar arquivos novos** a menos que estritamente necessário (single-file é parte da identidade)
4. **Não tocar em**: lógica Alpine, queries Supabase, edge functions, schema SQL

Se o agente quiser propor mudanças de comportamento (não só visual), **sinalize antes de mudar** — comente como "// considerar: ..." em vez de fazer.

---

## 10. Materiais de referência no repo

- `README.md` — overview + features
- `ROADMAP.md` — decisões, ondas, plano IA, roles+portal, custos
- `HOWTO.md` — manual do usuário (também renderizado dentro do app via `?`)
- `index.html` — todo o app em um arquivo
- `supabase/` — schema, patches, edge functions
- **`docs/screenshots/`** — prints do estado atual (desktop + iPhone) — ver §11 abaixo

---

## 11. Screenshots do estado atual

Prints "ANTES" pra o agente referenciar enquanto desenha o "DEPOIS". 16 arquivos em `docs/screenshots/`:

### Desktop (1440×900)

| Arquivo | Aba |
|---|---|
| `01-foco-desktop.png` | Meu foco |
| `02-backlog-desktop.png` | Backlog (sem agrupamento) |
| `03-backlog-grouped-desktop.png` | Backlog agrupado por Cliente |
| `04-kanban-op-desktop.png` | Kanban operacional (11 cols) |
| `05-kanban-exec-desktop.png` | Kanban executiva (4 macros) |
| `06-calendar-desktop.png` | Calendário com dia selecionado |
| `07-dashboard-desktop.png` | Dashboard com charts |
| `08-portal-desktop.png` | Portal cliente (Pão e Talho) |

### Mobile (iPhone Pro, 393×852)

| Arquivo | Aba / componente |
|---|---|
| `09-foco-mobile.png` | Meu foco |
| `10-backlog-mobile.png` | Backlog mobile |
| `11-kanban-mobile.png` | Kanban (sempre executiva no mobile) |
| `12-calendar-mobile.png` | Calendário |
| `13-dashboard-mobile.png` | Dashboard |
| `14-portal-mobile.png` | Portal cliente |
| `15-modal-task-mobile.png` | Modal de edição de tarefa |
| `16-cmdk-mobile.png` | Command palette aberto |

> **Pro agente**: abrir cada print antes de desenhar a respectiva tela. Ver `docs/screenshots/README.md` pro contexto de cada estado.

---

## Apêndice A — Mapa de classes CSS importantes

```
.card .card-elev .modal-card        — containers
.btn .btn-primary .btn-ghost
  .btn-danger .btn-icon             — botões
.inp .lbl                           — form
.tab .tabs-row                      — abas
.pri .pri-dot .pri-P0..P3           — chip prioridade
.cx .cx-bar .cx-alta/media/baixa    — chip complexidade
.status .status-dot                 — chip status
.aging-badge .aging-warn/stale      — aging
.tag-chip                           — tag livre
.kcard .kcol .kcol-op .kcol-readonly
  .kanban-scroll .kanban-scroll-op  — kanban
.cal-grid .cal-cell .cal-task .cal-dot — calendário
.kpi .kpi-num .kpi-lbl .kpi-trend   — Dashboard
.k360-mark                          — wordmark
.help-md *                          — manual renderizado
.print-only .pr-* *                 — PDF executivo
.view-toggle                        — toggle Op/Exec
.toast .toast-success/error/info    — toasts
.badge-count                        — contador de filtros
.late                               — texto vermelho de prazo vencido
```

---

**Quando pronto, criar PR com `[design]` no título e descrever no body as decisões de tokens (tipografia escolhida, escala, sistema de spacing, mudanças de hierarquia).**
