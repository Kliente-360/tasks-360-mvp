# Prompt para Claude Code — merge pixel-perfect do patch de design

Cole o bloco abaixo na sessão do Claude Code, dentro do seu repo local (com `tasks-360-mvp/index.html` versionado em git).

---

## Contexto

Recebi dois arquivos de um agente de design que fez patch visual no `tasks-360-mvp/index.html`:

- `index_handoff_design.html` — versão completa com **todo o patch de design já aplicado**: tokens (cores/tipografia/spacing/radius/sombras), header/tabs, cards, chips, kanban, command palette, portal cliente, bulk-bar, KPI hero do Meu Foco, **modal task two-pane com autosave indicator** (debounced 800ms rodando em paralelo ao botão Salvar).
- `preview-design.html` — preview estático isolado do design system (mocks dos componentes, incluindo o modal two-pane com demo dos 5 estados do autosave). Não vai pra produção — fica como **referência viva** do sistema.

Quero que você atue como integrador. **Não vamos sobrescrever** meu `index.html` cegamente — o arquivo do agente está atrasado em relação ao meu (pode ter ficado dias parado no projeto de design enquanto eu mexi em lógica/features aqui).

## Objetivo

Fazer **merge pixel-perfect** das mudanças **visuais e de estado de autosave** do `index_handoff_design.html` para o meu `tasks-360-mvp/index.html` atual, preservando todas as features de lógica/dados/realtime/auth que evoluíram em paralelo.

## Plano (executar nesta ordem)

### 1. Inventário das diferenças
- Diff os dois arquivos: `git diff --no-index tasks-360-mvp/index.html index_handoff_design.html`
- Separe os hunks em 3 buckets:
  - **VISUAL**: `<style>` block, classes Tailwind em markup, estrutura HTML de componentes visuais, fonts no `<head>`
  - **AUTOSAVE**: estado Alpine novo (`saveState`, `lastSavedAt`, `_autosaveTimer`, `_autosaveSeq`), watcher no `init()`, métodos `autosaveTaskNow()` / `autosaveLabel()`, flag `silent` no `saveTask()`, indicador `.autosave` no header do modal task
  - **POSSÍVEIS REGRESSÕES**: qualquer mudança em handlers Alpine, queries Supabase, lógica de status/subetapa, atalhos, command palette, edge functions, schema. **NÃO aplicar.** Listar pra eu validar.

### 2. Aplicar bucket VISUAL
- Substituir o `<style>` block inteiro pelo do handoff (é a fonte canônica do design system agora)
- Substituir imports de fonts no `<head>` (deve ser **IBM Plex Sans + IBM Plex Mono** apenas — remover Inter/Manrope/Quicksand)
- Para mudanças de classe em markup: aplicar por componente, comparando trecho a trecho. **Preservar todos os bindings Alpine** (`x-show`, `x-text`, `@click`, `x-model`, `x-for`, `x-if`, `:class`, `:style`).

### 3. Aplicar bucket AUTOSAVE
Localizar no `index_handoff_design.html` (procurar pelos comentários `=== Autosave`):
- Bloco de estado em `app()` (próximo a `modal: false,`)
- `$watch('editing', ...)` dentro do `async init()`
- Reset de `saveState` no `openEdit(t)` (final do método, depois do `this.modal = true`)
- Métodos `autosaveTaskNow()` e `autosaveLabel()`
- Refactor de `saveTask(opts)` aceitando `{ silent }`: condicional em `this.modal = false` e `toast('error', ...)` — silent re-lança erro pro caller
- Indicador `.autosave` no header do modal (HTML)
- Bloco CSS `.autosave` + keyframe `as-pulse`

Aplicar **integralmente esses blocos**. Eles foram desenhados pra rodar em paralelo ao botão Salvar existente sem mudar comportamento dele.

### 4. Sanidade
Rodar mentalmente os cenários abaixo no arquivo final:
- Abrir modal de task existente → editar título → esperar 800ms → indicador vai de `dirty` → `saving` → `saved`
- Abrir modal de task existente → editar título → clicar **Salvar** → modal fecha (comportamento antigo intacto)
- Abrir modal de task **nova** → autosave **não dispara** (sem `id`) → exige botão Salvar
- Erro de rede no autosave → `saveState = 'error'`, toast NÃO aparece (silencioso), botão Salvar segue funcionando como fallback
- Mudar de task A pra task B com edição pendente → `_autosaveSeq` ignora a resposta stale da A

Confirme que:
- `realtime` (`task_*`, `comment_*`), `auth gating`, `RLS`, atalhos (`⌘K`, `n`, `/`, `g+letra`, `?`, `Esc`), command palette, exports CSV/PDF, comentários com `visivel_cliente`/`from_cliente`, roles admin/interno/cliente, 11 subetapas op + 4 macros exec — **nada foi tocado**.

### 5. Relatório
Antes de commitar, me mostre:
- Lista dos hunks aplicados (visual + autosave)
- Lista dos hunks **rejeitados** (bucket "possíveis regressões") com motivo
- `git diff --stat` do resultado
- Qualquer conflito de markup onde meu `index.html` evoluiu e o handoff não sabe (ex: campos novos no modal, novas abas, novos botões) — preservar minha versão e adaptar só as classes/estilos.

## Restrições firmes

- **Single-file**: não criar arquivos novos, não introduzir build step
- **Sem regressão funcional**: zero quebra nas features listadas no bucket 4
- **Comentários inline** do agente de design devem ser **preservados** (eles documentam decisões: "// autosave roda em paralelo ao botão Salvar", "// botão Salvar continua presente como fallback explícito", etc.)
- **PT-BR** mantido, dark mode mantido

## Output

Quando terminar, commit em branch separada (`design/patch-handoff`) com mensagem detalhada listando tudo que foi aplicado. **Não merge na main** — abro PR pra revisão.
