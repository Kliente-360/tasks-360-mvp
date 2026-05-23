# Design Review · Onda 0 (Alpine → Next, pré-cutover)

Audit combinando (a) comparação source-level `index.html` + `lib/**` vs `web/src/**` e (b) navegação lado a lado em `tasks-360-mvp.netlify.app` (Alpine prod, v1.02.098) e `app.kliente360.com` (Next preview, v1.02.162). Items marcados **[browser]** vieram da navegação visual; **[source]** do diff de código; **[both]** confirmados nas duas frentes.

> Tudo declarado parking em `web/ONDA0.md` / `HABILITAR_DEPOIS.md` foi ignorado (Briefing, Dashboard, Portal cliente, Adoção).

---

## 1 · Regressão de paridade (Alpine tinha, Next perdeu)

### crítico

**1.1 · Mention picker `@` no composer de comentários** · Modal de task **[both]**
- Alpine: `lib/views/anexos.js:350-500` + `index.html:3879-3944` — dropdown reativo conforme digita `@`, navegação ↑↓/Enter/Tab, autocompleta nome, fecha em ESC ou click-outside. Reutilizado em newComment e newReply.
- Next: `web/src/components/task-modal.tsx:14` declara postergado. No browser: rodapé do composer em Alpine mostra `⌘↩ envia · @ menciona` + link visível **"@ mencionar"** ao lado do botão `comentar`. Next mostra só `⌘↩ envia` — sem hint, sem picker.
- Impacto: feature core de colaboração silenciosamente quebrada. Quem digitar "@Felipi" em vez de "@Felipe" não dispara notificação e não tem feedback visual.
- Fix: portar `mentionablePessoas()` + dropdown ancorado ao caret (`getBoundingClientRect` da textarea). Reutilizar em `newComment` e `newReply`.

**1.2 · Rascunho de comentário em `localStorage`** · Modal de task **[source]**
- Alpine: `lib/views/task-modal.js:62-67, 142-157` — chave `k360-draft-comment-<task_id>`, toast "Rascunho recuperado" na abertura, limpeza pós-post; também salvo em `flushModalSaves`.
- Next: ausente. `task-modal.tsx:265` só tem `useState('')`. Fechar acidentalmente ou refresh perde tudo.
- Impacto: perda real de trabalho em sessões longas com modal aberto.
- Fix: `useEffect` lendo `localStorage` na abertura; debounce 400ms em onChange salvando; cleanup em postComment.

**1.3 · Convidar / reenviar magic link** · Cadastros · Pessoas **[source]**
- Alpine: `index.html:2509-2511` — botões `convidar` (quando `role=cliente && email && !invited_at`) e `reenviar link` chamam `convidarPessoa(p)`.
- Next: `cadastros-client.tsx:393-400` mostra os chips de status (acesso ativo / aguardando 1º login / inativa) mas **não tem o botão de ação**. Admin não consegue enviar magic link sem ir manualmente ao Supabase Dashboard.
- Impacto: bloqueia onboarding de clientes via Portal — feature de aquisição inutilizável pós-cutover.
- Fix: portar `convidarPessoa` (Edge Function `invite-pessoa` ou `auth.admin.inviteUserByEmail`) + botão condicional ao lado do `EditPessoaButton`.

**1.4 · Botão de ação inline ✕ na linha do Backlog** · Backlog **[browser]**
- Alpine: cada row da tabela tem um ✕ no extremo direito (quick dismiss / archive / close).
- Next: a row termina no chip de STATUS. Confirmado: nem visível nem aparece em hover, em light e dark mode.
- Impacto: usuário perdeu o atalho de descarte rápido sem abrir modal. Provavelmente era "arquivar" — uma ação de limpeza de lista comum.
- Fix: confirmar com produto qual é a ação (dismiss/archive) e re-adicionar o ícone na coluna de actions. Manter consistente com Alpine.

### alto

**1.5 · Atalho `?` (toggle shortcuts help)** · Global **[source]**
- Alpine: `lib/views/utilities.js:74` — `if (k === '?') shortcutsHelpOpen = !shortcutsHelpOpen`.
- Next: `web/src/components/global-shortcuts.tsx` — sem binding pra `?`. Help só abre via profile menu.
- Impacto: power user que confia no `?` cai em vazio. `HOWTO.md` ainda menciona o atalho.
- Fix: adicionar `if (k === '?') { e.preventDefault(); /* abrir HelpModal */ }` usando `useHelp()`.

**1.6 · Sort por "Projeto" no Backlog** **[source]**
- Alpine: `lib/app.js:36-46` lista `sortOptions` com `{ key: 'projetoId', label: 'Projeto' }`.
- Next: `backlog-client.tsx:81-90` SORT_OPTIONS omite `projetoId`. A função `resolveVal` em `backlog-client.tsx:212` já reconhece a chave — só falta o item no menu.
- Impacto: regressão funcional — usuário não consegue mais ordenar por projeto.
- Fix: adicionar `{ key: 'projetoId', label: 'Projeto' }` em SORT_OPTIONS.

**1.7 · Ordem do menu de sort embaralhada** · Backlog mobile **[source]**
- Alpine `lib/app.js:36-46`: `Prazo → Prioridade → Etapa → Esforço → Complexidade → Título → Cliente → Projeto → Responsável`. Prazo primeiro porque é o caso de uso dominante.
- Next `backlog-client.tsx:81-90`: `Título → Cliente → Responsável → Prioridade → Esforço → Complexidade → Prazo → Status`. Prazo virou o penúltimo.
- Impacto: regressão sutil — menu mobile muda hierarquia de descoberta.
- Fix: realinhar SORT_OPTIONS pra ordem Alpine.

**1.8 · Ícone "copiar link da task" no header do modal** · Modal de task **[browser]**
- Alpine: header do modal tem ícone copy-link (📋) ao lado do status indicator e do ✕ — copia URL `?task=<uuid>` pra colar em Slack/email.
- Next: ícone ausente. Header só tem indicator + ✕.
- Impacto: compartilhar uma task agora exige copiar URL da barra do browser — fluxo bem mais chato.
- Fix: adicionar botão com `navigator.clipboard.writeText(window.location.origin + '/?task=' + editing.id)` + toast "Link copiado".

### médio

**1.9 · Manual sort (DnD) na linha do backlog** **[source]**
- Alpine: `lib/views/backlog-kanban.js:68-78, 196, 205-216` + `index.html:1221-1225` — quando `sortKeys[0].key === 'manual'`, linhas viram draggable e gravam `ordem` em `tasks`.
- Next: `backlog-client.tsx:26-27` declara explicitamente removido (contradição com Alpine ainda em prod). Coluna `ordem` continua lida em `resolveVal`, mas sem UI pra editar.
- Impacto: usuários que organizam manualmente perdem isso pós-cutover.
- Fix: confirmar com produto se é dropper definitivo; se sim, migration limpando `ordem`; se não, portar handlers (Kanban DnD já existe — copy/paste).

**1.10 · Atalho `g+a` → MVP** · Global **[source]**
- Alpine: `lib/views/utilities.js:53` `{ ..., a: 'mvp' }`.
- Next: `global-shortcuts.tsx:25-32` sem `a`. Sem rota `/mvp`.
- Impacto: baixo se MVP é parking. Confirmar status em ROADMAP §9.3.
- Fix: se parking, atualizar HOWTO/Help; senão portar rota.

---

## 2 · Regressão sutil de UX (mesma feature, execução pior)

### alto

**2.1 · `g+l` / `g+c` invertidos** · Global shortcuts **[source]**
- Alpine `lib/views/utilities.js:53`: `{ f: foco, b: backlog, k: kanban, l: cal, d: dash, c: cad, a: mvp }`. **`l` = caLendário**, **`c` = Cadastros**.
- Next `global-shortcuts.tsx:25-32, 68-71`: **`c` = caLendário**, **`l` = clear filters**.
- Impacto: muscle-memory quebrado — veterano `g+c` esperando Cadastros cai no Calendário; `g+l` esperando Calendário roda clear-filters.
- Fix: alinhar com Alpine (`l`=calendário, `c`=cadastros, mover clear-filters pra `x`). Fix de ~5 linhas.

**2.2 · Indicador de autosave: "salvo" → "autosave ativo"** · Modal de task **[browser]**
- Alpine: header mostra **`● salvo`** (estado atual, conciso).
- Next: header mostra **`● autosave ativo`** (descreve a feature, não o estado).
- Impacto: copy regredida — usuário não sabe se foi salvo *agora* ou só se a feature tá ligada.
- Fix: trocar pra `● salvo` quando idle, `● salvando…` quando em flight, `● rascunho` quando há diff. Alinhar com Alpine.

**2.3 · Calendário começa em Domingo (era Segunda)** · Calendário **[browser]**
- Alpine: colunas SEG–DOM. Convenção work-tracking comum em times de produto.
- Next: colunas DOM–SÁB. Provável default do `Intl.DateTimeFormat` ou `firstDayOfWeek` não setado.
- Impacto: semana de trabalho fica "partida" visualmente — fim-de-semana invade o canto direito quebrando a leitura natural.
- Fix: setar `weekStartsOn: 1` em date-fns (ou equivalente) no `calendario-client.tsx`.

### médio

**2.4 · ISO date local vs UTC misturados** **[source]**
- Next `task-utils.ts:35, 139, 151` usa `new Date().toISOString().slice(0,10)` (UTC) pra `today`/`fmtMonday`/`fmtWeekRange`.
- Next `calendario-client.tsx:48-53` define `isoLocal()` local. Inconsistência: Calendário local, Backlog/Foco/Kanban UTC via `atrasada()`.
- Impacto: às 21h-23h BRT, task com prazo "hoje" pode aparecer ainda como hoje no Calendário mas já como atrasada no Backlog. Bug real e observável.
- Fix: mover `isoLocal` pra `task-utils.ts` e usar em `atrasada`/`agingDays` também.

**2.5 · "criar nova" task: tabs de conversa visíveis mas inativas sem hint** · Modal **[source]**
- Alpine `index.html:3858-3870`: tabs visíveis com tooltip "salve primeiro".
- Next `task-modal.tsx:1552-1665`: tabs visíveis, conteúdo mostra texto "Comentários aparecem após salvar a tarefa." Sem hint visual no header da tab — fica clicável aparentemente.
- Impacto: micro-friction.
- Fix: `opacity-50 cursor-not-allowed` ou esconder count badges quando `!editing.id`.

**2.6 · Aging label duplicado no Backlog desktop** **[source]**
- Alpine `index.html:1275`: chip só com número (`5d`), tooltip explicativo.
- Next `backlog-client.tsx:1049-1070`: `<span class="status">` ganhou title inline `hoje / há 1d / há 5d` **e** o `.aging-badge` mostra `5d` separado.
- Impacto: ruído visual mínimo.
- Fix: deixar só o badge externo (consistente com Alpine), simplificar title da `.status`.

**2.7 · Layout shift no page-bar do Backlog** · Backlog **[source]**
- Next `backlog-client.tsx:623-638`: select de Tag é condicional (`allTags.length > 0`). Adicionar primeira tag faz page-bar pular de largura.
- Impacto: layout shift sutil.
- Fix: renderizar sempre com placeholder `(sem tags ainda)` ou `visibility: hidden` mantendo width.

### baixo

**2.8 · `confirm()` nativo em vez de modal `askConfirm`** **[source]**
- Alpine `lib/views/task-modal.js:466, 481` usa `this.askConfirm(...)` (estilizado, dark-mode-aware).
- Next `task-modal.tsx:853, 995, 1041`: `confirm()` nativo. Quebra estética dark, deteriora UX no iOS Safari.
- Impacto: estética/consistência.
- Fix: portar `askConfirm` pro Toast provider (`useToast`) ou criar `<ConfirmModal>` reutilizável.

---

## 3 · Inconsistência interna do Next

### alto

**3.1 · `taskFromDb` inline no insert path** **[source]**
- `task-modal.tsx:553-562`: ao criar task, monta `next: Task` inline com campos do `data` retornado + `editingRef.current`. Pode divergir do adapter canônico em `web/src/lib/adapters.ts`.
- Impacto: campo novo adicionado em adapters não chega no insert path. Bug latente.
- Fix: chamar `taskFromDb(data)` igual o update path. Importar de `@/lib/adapters`.

**3.2 · Ordenação de comentários: top-level desc, replies asc** **[source]**
- `task-modal.tsx:1091-1106`: `topLevel` ordenado por `posted_em || criado_em` **desc**; `repliesOf` retorna `posted_em asc, criado_em asc`. Thread principal desc, dentro da thread asc.
- Alpine `lib/views/notifications-checklist.js:284-287`: query asc; markup ASC em ambos.
- Impacto: UX inconsistente. Era ASC em Alpine.
- Fix: ASC em ambos (Alpine paradigm) ou DESC em ambos — não mesclar.

### médio

**3.3 · `viewerRole === 'admin'` para deletar task** **[source]**
- Next `task-modal.tsx:1737`: `editing.id && isAdmin` ← `viewerRole === 'admin'`.
- Alpine `lib/views/task-modal.js:465`: sem role-check no `deleteTask`.
- Impacto: possivelmente mais restritivo do que Alpine.
- Fix: confirmar regra com produto e documentar. Se intencional, é melhoria silenciosa.

**3.4 · Filtros: singular no Next, plural no Alpine** · Backlog, Kanban, Calendário **[browser]**
- Alpine: `Clientes / Projetos / Pessoas / Responsáveis`.
- Next: `Cliente / Projeto / Responsável`. E "Pessoas" virou "Responsável" no Backlog.
- Impacto: pattern consistente *dentro* do Next (bom), mas deviation do Alpine. "Responsável" é mais específico que "Pessoas" pro contexto Backlog — provavelmente intencional.
- Fix: confirmar se é mudança de copy proposital. Se sim, documentar em ONDA0.md. Se não, voltar pro plural.

**3.5 · Manifest shortcuts ≠ ONDA0.md doc** **[source]**
- `web/public/manifest.webmanifest:21-43`: Backlog · Meu Foco · Calendário.
- `web/ONDA0.md:287`: "Nova task / Meu Foco / Briefing".
- Impacto: doc drift (Briefing é parking, faz sentido sumir; doc não atualizada).
- Fix: atualizar ONDA0.md ou adicionar shortcut "Nova task" (`/?new=1`).

### baixo

**3.6 · `manifest.webmanifest` declara `icon-512.png` como 192x192** **[source]**
- Linha 18: `{ "src": "/assets/icon-512.png", "sizes": "192x192", ... }`. Sem `icon-192.png` físico.
- Impacto: Chrome/Android baixam 512px e renderizam em 192 — desperdício de bytes (~3-4×).
- Fix: gerar `icon-192.png` real ou remover a entrada 192.

---

## 4 · Polimento opcional

**4.1 · Logo "tasks 360"** · Next aplica charcoal em light mode (correto per brand book), Alpine usa verde sempre. Next está certo — registro só pra confirmar que **isto NÃO é regressão**, é melhoria.

**4.2 · Modal mobile tabs sem indicador ativo dark-aware** · `task-modal.tsx:1196-1219`. Tab ativa quase indistinguível em dark mode. Adicionar `bg-brand-tint dark:bg-brand-soft/10`.

**4.3 · KCard no Kanban executivo** mostra `tempoNaSubetapa`, mas visão executiva olha macro · `kanban-client.tsx:408-422`. Alpine `index.html:1660-1668` usa "tempo nesta macro". Trocar pra `statusEm`.

**4.4 · Foco · dropdown "atuando como"** aparece duplicado entre header do Foco e ProfileMenu? Conferir.

**4.5 · Backlog: filtro `abertas` não tem `is-active`** · `backlog-client.tsx:611` aplica só quando `f.status !== 'abertas'`. Filtro default fica visualmente "neutro" mas esconde concluídas — adicionar `is-active` quando ≠ `''`.

**4.6 · Anexos: nome original perdido** · `task-modal.tsx:1589` usa `alt={a.storage_path}` (cru `<task_id>/<uuid>.jpg`). Anexar `original_name` na tabela `task_attachments`.

**4.7 · Checklist colapsável sem tooltip + a11y** · `task-modal.tsx:1313`. `aria-expanded` + tooltip "Expandir / Colapsar".

**4.8 · `?` no rodapé do AppNav como discoverability** · ícone "keyboard" abrindo HelpModal. Power-user finding.

**4.9 · `theme-color` `#009900` no iOS dark mode PWA** · status bar fica esverdeada. Setar dark variant via `media="(prefers-color-scheme: dark)"`.

**4.10 · Modal: input do título sem `aria-required`** · pequeno polish a11y.

**4.11 · Cadastros · chip "inativa"** · `cadastros-client.tsx:399` usa `border-yellow-200` em vez de token `var(--p1)`/`var(--warn)`. Inconsistente com chips de prioridade.

**4.12 · Triagem: 1 linha (Alpine) vs 2 linhas (Next)** · Next expõe projeto + responsável + "sem prazo" inline. É melhoria de densidade informacional, mas é deviation. Confirmar com produto se mantém.

**4.13 · Foco · dropdown pré-seleciona usuário logado (Next) vs placeholder "atuando como…" (Alpine)** · Melhoria do Next, mas registro o deviation.

**4.14 · Calendário título "Maio De 2026" (Alpine, errado) vs "Maio de 2026" (Next, correto)** · Next está certo.

---

## Recomendação executiva

**Bloqueadores pós-cutover** (corrigir antes do Bloco 5, ou ao menos abrir issue com label `cutover-blocker`):
1. **1.1** Mention picker — colaboração silenciosamente quebrada
2. **1.2** Rascunho de comentário em localStorage — perda de trabalho
3. **1.3** Convidar/reenviar magic link em Pessoas — bloqueio de onboarding
4. **1.4** ✕ inline na row do Backlog — ação rápida perdida
5. **1.8** Copiar link da task no modal — fluxo de share regredido
6. **2.1** `g+l`/`g+c` invertidos — fix de 5 linhas

**Pode ir pro ROADMAP §9.3** (não bloqueante):
- Tudo de §1 médio em diante
- Todo §2 médio+baixo
- Todo §3 médio+baixo
- Todo §4

**Confirmar com produto** (são deviation, podem ser intencionais):
- §3.4 (singular/plural nos filtros)
- §3.3 (admin-only delete)
- §1.9 (manual DnD removido)
- §4.12 (Triagem 2 linhas)
- §4.13 (Foco pré-seleciona usuário)
