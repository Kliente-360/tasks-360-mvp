# Design critique · tasks 360 (Next, v1.02.162)

Crítica forward-looking só do app novo. Lente de designer: hierarquia, affordance, densidade, ritmo tipográfico, microinterações, voz. Telas em parking (Briefing, Dashboard, Portal cliente, Adoção) ignoradas.

---

## 0 · O que tá funcionando (não mexer)

- **Voz visual coerente**. Brand verde puro como ação, charcoal como autoridade, mono pra dado bruto. A paleta de prioridade (P0 vermelho, P1 âmbar, P2 azul, P3 cinza) sustenta sem se confundir com a marca. Decisão madura — raro em apps internos.
- **Hero do Foco**. O banner com "SEU DIA · QUINTA-FEIRA · 11 entregas pra hoje, 6 atrasadas… → Comece por (mais atrasada, P0)" é a melhor microinteração de produto da app. Narrativa, com CTA contextual, opinativo. Esse padrão deveria virar template pra outras telas que precisam guiar.
- **Modal de task**. Estrutura 2-colunas (forma à esquerda, conversa à direita) é o layout certo. Header dark, footer com hierarquia de ação correta (arquivar gray → excluir red → fechar outline → salvar filled). Comentários com INTERNO pill + responder + autosave indicador funciona.
- **Dark mode genuíno**, não retroengenharia. Brand verde respira no dark, mono fica legível, charcoal vira o background. Trabalho bem feito.

---

## 1 · Cross-cutting (onde uma decisão escala pra app inteira)

### 1.1 · Cards de métrica no topo: igualdade visual mata urgência **[alto]**

Backlog mostra 5 cards: TOTAL FILTRADO · BACKLOG · EM ANDAMENTO · BLOQUEADAS · ATRASADAS. Foco mostra 4: ATRASADAS · PARA HOJE · BLOQUEADAS · P0/P1 ATIVAS. Todos com mesmo tamanho, mesmo peso tipográfico, mesma altura, números gigantes (~64px).

O problema: TOTAL FILTRADO é metadata (quantas eu vejo agora). ATRASADAS é uma chamada pra ação. Mesmo peso = nenhuma hierarquia. Olho não sabe pra onde ir.

**Recomendação**: dividir em duas classes visuais:
- **Cards de contexto** (TOTAL FILTRADO, BACKLOG, EM ANDAMENTO): tipografia menor, fundo neutro, sem borda colorida. Função: "quantos itens".
- **Cards de risco** (BLOQUEADAS, ATRASADAS, P0/P1 ATIVAS): mais altos, número grande, borda viva, talvez ícone, hover/click filtra a tabela.

Bonus: o número 64px é desnecessário. 36-40px com bom peso da fonte basta. Os 24px que sobram = mais 1 linha da tabela visível.

### 1.2 · Estado dos filtros é invisível **[alto]**

Os 6 selects do Backlog (Cliente · Projeto · Responsável · Pri · Cmplx · Abertas) mostram só o placeholder. Quando o usuário seleciona "VB" em Cliente, o dropdown mostra "VB" — mas a barra inteira tem 6 dropdowns visualmente idênticos, sem chip filtrado, sem contador, sem "limpar filtros".

Problema: usuário esquece o que filtrou. "Por que não tô vendo a task X?" → 5 minutos depois descobre que o filtro `Responsável: João` tava ativo.

**Recomendação**:
- Filtros ativos viram chips coloridos abaixo da barra (`Cliente: VB ✕`, `Responsável: João ✕`).
- Botão "limpar filtros" visível quando há ≥1 ativo.
- Contador discreto: `Backlog · 178 tarefas · 2 filtros ativos`.

O mesmo vale pra Kanban e Calendário.

### 1.3 · Mono font: brilhante quando contido, ruidoso quando se espalha **[médio]**

IBM Plex Mono usado em: versão (`V1.02.162`), números dos cards de métrica, `21/05 · +0d`, `hoje nesta etapa`, `8 criadas por IA`, `criada há 6d`, `5 sem resp.`, contadores `(11 item(s))`. É bonito como assinatura técnica, mas a app inteira começa a parecer um log de terminal.

**Recomendação**: reservar mono pra **dados puros** — números absolutos, IDs, timestamps técnicos, versão. Tirar de:
- Status temporais em linguagem natural: `hoje nesta etapa`, `criada há 6d` viram Plex Sans em italic claro (menos coding-like).
- Contadores como `11 item(s)` viram Plex Sans regular.
- `8 criadas por IA` vira sans regular (o emoji 🤖 já carrega o tom).

Resultado: o mono fica raro o suficiente pra ainda significar algo. Hoje significa "tudo é técnico".

### 1.4 · Status pills têm 3 estilos coexistindo **[médio]**

Observei pelo menos três tratamentos pra pills de status:
- **Em desenvolvimento**: borda verde + dot verde + texto verde. Aspecto "vivo".
- **Em definição**, **Backlog**, **Em revisão**: borda cinza + dot colorido + texto neutro. Aspecto "padrão".
- **TRIAR** (em alguns cards do Kanban): fundo creme/amarelo, sem borda, uppercase. Aspecto "alerta".

Sem regra clara que diferencie eles. Em desenvolvimento ganhou destaque arbitrário (porque é "ativo"?). TRIAR é warning (porque precisa ação?). Mas BLOQUEADO, ATRASADA, EM HOMOLOGAÇÃO também são "ativos / precisam atenção" e ficam com o tratamento neutro.

**Recomendação**: três níveis claros:
- **Neutro** (default, todos os status genéricos): borda fina, dot colorido por etapa, texto neutro.
- **Ativo** (em desenvolvimento, em andamento — o status do dia a dia): mesmo tratamento neutro, sem brilho especial.
- **Action-required** (TRIAR, atrasada-warning): fundo viva (amarelo/vermelho claro), uppercase opcional. Sinaliza que tem coisa pra fazer.

Hoje "Em desenvolvimento" rouba atenção que deveria ir pra "TRIAR" e "ATRASADA".

### 1.5 · CTAs primárias estão escondidas no canto **[médio]**

O `+ task` verde fica no header, top-right. Em uma tela de trabalho, o usuário tá olhando pra tabela/cards no centro. Pra criar uma task ele cruza ~700px do mouse / scroll do polegar.

**Recomendação**:
- Manter `+ task` no header (anchor consistente)
- **Adicionar** um FAB (floating action button) verde inferior-direita no mobile.
- No desktop, considerar uma linha "+ Nova tarefa..." inline acima da tabela (mais discoverable, padrão Linear/Notion).

### 1.6 · Empty state inexistente / silencioso **[médio]**

Não vi nenhum empty state da app rodando — sempre tem dado de produção. Mas em todos os fluxos com filtro restritivo, o resultado de "0 tarefas" provavelmente mostra só tabela vazia ou uma frase neutra.

**Recomendação**: cada empty state vira uma microcópia opinativa + ação. Exemplos:
- Backlog com 0 resultados após filtro: `Nada bate esse filtro. Tira o "P0" ou troca o cliente?` + botão "Limpar filtros".
- Triagem com 0 itens: `Triagem zerada. Boa.` (curto, premia o estado).
- Foco com 0 atrasadas/hoje: `Sem entregas pra hoje. Vê o que vem amanhã?` + link.

A app já tem voz opinativa no banner do Foco. Estender pra empty states.

---

## 2 · Por tela

### 2.1 · Backlog **[refinar]**

Pontos fortes: tabela respira, colunas têm hierarquia razoável (TAREFA é a mais larga), PRI usa dot+pill consistente.

Pra mexer:
- **`+0d` no Foco/Backlog**: linguagem técnica. `hoje`, `1d atrasada`, `5d atrasada` em sans seriam mais legíveis.
- **Coluna `H` (horas)** e **`CMPLX`**: labels truncados deliberadamente, mas `Cmplx` no filtro e `CMPLX` na coluna criam ruído. Padroniza pra `Complx` ou `Esforço`/`Compl.` consistente nos dois.
- **Coluna PRAZO** mostra `—` quando vazio. Combinar com chip "sem prazo" amarelo discreto = converte um "nothing to see" em uma micro-CTA pra preencher.
- **Linha hover**: pintura sutil OK, mas adicionar quick actions inline (ícone de archive, ícone de mudar status) que aparecem só no hover ajudam ações rápidas.
- **Coluna STATUS** + chip status interno: redundância. O usuário lê PRI, depois STATUS — ambos com chip. Se a STATUS é a etapa, talvez transformar em uma barra colorida vertical à esquerda da linha (status = identidade da linha) e liberar a coluna.

### 2.2 · Foco **[manter, ampliar a fórmula]**

A melhor tela. O hero é excelente.

Pra mexer:
- **4 cards equal-weight**: aplicar §1.1.
- **Seções "Atrasadas / Para hoje / …"**: o título da seção tá fino e à esquerda, com "(6 item(s))" mono à direita. Falta respiro vertical entre seções. Adicionar 24-32px de margin-top.
- **Cards de task no Foco**: o Prazo `21/05 · +0d` no canto direito é o elemento mais visualmente intenso (mono, alinhado direita). Em uma task atrasada, o `+3d` em vermelho funciona. Em uma task "do dia" com `+0d`, o destaque é desproporcional. Considerar mostrar prazo só quando ≠ hoje (e em "hoje", trocar por chip "hoje" verde discreto).
- **Macro stage chevron** `Em andamento › Em homologação`: a seta vai pra direita, sugerindo movimento, mas é só info. Pode ser substituído por `· Em homologação` (mesma info, menos ruído visual).

### 2.3 · Kanban **[reorganizar a escala]**

11 colunas é o limite do que cabe na tela. Hoje todas têm width igual, então usuário precisa de scroll horizontal pesado pra ver tudo.

Pra mexer:
- **Macro stage como sticky group header** acima das colunas: `BACKLOG (4 colunas) · EM ANDAMENTO (3) · EM HOMOLOGAÇÃO (2) · …`. Visualmente agrupa o que já tá agrupado conceitualmente (a label `BACKLOG` uppercase em cima de cada coluna detalhada).
- **Colunas vazias colapsam**: substage com 0 cards vira uma faixa fina vertical de 24-32px com só o nome. Recupera espaço horizontal.
- **Cards mais informativos**: hoje cada card mostra título, cliente/projeto, P, responsável, prazo, "hoje nesta etapa", e opcionalmente substage chevron. Mas falta sinal de **risco** (ex: 14d na mesma etapa = stale). Adicionar um chip aging ao lado de "hoje nesta etapa" quando > X dias.
- **Toggle Operacional / Executiva**: bom padrão, mas o estado ativo (verde filled, outro outline) poderia ser segmented control mais robusto, hoje parece "dois botões".

### 2.4 · Triagem **[densidade + ação]**

Cards enormes — 3 visíveis na tela. A triagem é justamente onde o usuário precisa **velocidade**: bater olho, despachar, próximo.

Pra mexer:
- **Cards mais compactos**: row de ~64px de altura. Avatar/checkbox · P · IA chip · Título (1 linha truncada com tooltip) · meta · chips de gap (sem prazo / sem resp.) · ação rápida.
- **Chips "sem prazo / sem esforço" viram inputs inline**: hoje são decorativos amarelos. Clica no chip → abre um popover pequeno com input de data/numero direto na linha, sem precisar abrir modal. Triagem 5x mais rápida.
- **Bulk actions**: checkbox em cada row + barra de ações no topo (`Atribuir responsável a 5 tasks`, `Definir prazo`, `Triar como P3`). Hoje cada task exige modal individual.
- **Título em CAIXA ALTA**: muitas tasks vêm de Service Now em UPPERCASE (`PERMISSÃO PARA QUE OS EXECUTIVOS...`). Visualmente ofensivo e quebra hierarquia. Aplicar `text-transform: none` + smart-case na renderização (primeira letra de cada sentença).
- **Empty state**: já recomendado em §1.6 — `Triagem zerada. Boa.`

### 2.5 · Calendário **[acentuar o "agora", baixar volume do "depois"]**

A grade funciona. Quase tudo bate.

Pra mexer:
- **"Hoje"**: hoje só tem borda verde fina + um chip de evento filled verde. Pra um app de gestão de tempo, hoje merece um destaque mais alto. Sugestão: fundo da célula `bg-brand-tint` muito sutil + número da data em mono **bold** verde + ainda a borda. Olho vai pro "hoje" antes de qualquer outra coisa.
- **Tasks concluídas (strikethrough)**: hoje quase invisíveis. Strikethrough + opacity baixa = "some". Manter mostrando mas com cor neutra distintiva (cinza claro) sem strikethrough — strikethrough só pra hover preview.
- **Cells de meses anteriores/próximos (dimmed)**: OK como está.
- **Cells vazias do mês atual**: indistinguíveis das cells com 0 eventos. Adicionar um `+` quase invisível no hover, com tooltip "criar task aqui" (drag-to-create seria o céu, mas crítico-baixo).
- **Header `Maio de 2026` + nav `‹ hoje ›`**: distantes. Agrupar: `‹ Maio de 2026 › • hoje`. Hoje fica como reset rápido.
- **Filtros**: aplicar §1.2.

### 2.6 · Modal de task **[refinar a respiração + comments]**

Estrutura sólida, mas tem ruído:

- **Atribuição em 2×2 grid de dropdowns**: 4 selects iguais empilhados. Visualmente repetitivo. Considerar:
  - Cliente · Projeto na mesma linha (relacionados — projeto depende de cliente).
  - Responsável separado (pessoa).
  - Prioridade como chip-picker visual (4 chips P0/P1/P2/P3 clicáveis em vez de dropdown) — picker mais rápido e mostra a paleta de prioridade direto.
- **Toggle "Visível ao cliente no Portal"** abaixo do comentário é um checkbox tradicional. Mas é uma decisão importante (público vs privado). Trocar por **segmented control** `[Interno] [Cliente]` acima do textarea, com cor de fundo do textarea mudando levemente (cinza pra interno, verde-tint pra cliente). Visualizar o "público alvo" enquanto digita.
- **Checklist colapsado**: triângulo + label "CHECKLIST". Quando expande, falta contador `3/8 done`. Hoje contador só aparece dentro? Adicionar contador no header colapsado.
- **Anexos com `alt={storage_path}`**: nomes tipo `<uuid>.jpg`. Salvar `original_name` na tabela seria fix simples (1 column + 1 update no upload handler).
- **Histórico**: aba existe, count `1`. Não inspecionei, mas worth verificar se tem layout decente quando tem 50 eventos.
- **Hierarquia do footer**: `arquivar · excluir · fechar · salvar`. Arquivar e excluir são destrutivos / quase-destrutivos mas tão lado a lado (gray sem borda · red sem borda). Considerar mover ambos pra um menu `⋯` no header do modal, deixando só `fechar · salvar` no footer. Reduz acidente.

### 2.7 · AppNav **[respirar o header]**

9 tabs em uma linha + logo + 5 ícones + avatar. É denso. Vai piorar quando o Briefing/Dashboard/Portal/Adoção saírem do parking.

Pra mexer:
- **Tabs de parking** (Briefing, Dashboard, Portal cliente, Adoção): hoje aparecem com cor reduzida. Mas ainda ocupam espaço. Considerar agrupar em um menu "Em breve" (chip discreto à direita) ou esconder até estarem prontas.
- **Logo `tasks 360` + `V1.02.162`**: o "tasks 360" em peso bold + tamanho 28px+ é pesado. A versão em mono é nerdy (gosto). Sugestão: reduzir o logo pra 20px com bold normal, manter versão. O peso visual cai 30%.
- **`+ task` button**: já é o anchor da ação. Adicionar shortcut visível `+ task ⌘N` (ou similar) ajuda discoverability.
- **Bell de notificação**: count `8` em red — bom. Hover/click abre painel? Se ainda não, adicionar peek dropdown.
- **Avatar `F`**: típico initials chip. Funciona. Considerar mostrar mini-status (cliente/admin) abaixo do nome no menu, pra usuários com >1 papel.

---

## 3 · Mobile (caveat: não consegui rodar viewport real no MCP)

Pelo source (`web/src/**` tem `*-mobile.css`, `tmodal-mobile`, page-bar com `safe-area-inset-bottom`), o trabalho mobile parece sério. Sem ter rodado em iPhone real eu *adivinho* dois pontos prováveis:

- **Tabela do Backlog em mobile**: provavelmente vira lista de cards (igual Foco). Vale verificar se aging badges, pri e prazo sobreviveram à transformação.
- **Modal de task em mobile**: 2 colunas em mobile? Provavelmente vira accordion ou tabs no topo do modal (vi `tmodal-mobile-tabs` no source). Confirmar que ⌘+Enter / ESC encadeado funcionam com teclado iOS Bluetooth.

Recomendação: roda em iPhone real (Safari + add to home screen) antes do cutover. Print da PWA installada, da splash, do sheet card do Foco, e do modal aberto em portrait + landscape.

---

## 4 · A11y · low-hanging fruit

- **Focus visible**: confirmar que `*:focus-visible` tem outline em todos os interactive (dropdowns, chips, ícones do header). Tailwind default às vezes some no dark.
- **Touch targets**: alguns ícones do header (download, ?, dark toggle) parecem 32×32. WCAG mínimo é 44×44. Aumentar padding clicável.
- **Contraste do mono em muted gray**: `text-zinc-500` em mono pode ficar abaixo de 4.5:1 em algumas combos light. Bater no contrast checker.
- **Aria-labels**: ícones do header (download, ?, dark mode toggle, bell) provavelmente precisam `aria-label`. Verificar.
- **`prefers-reduced-motion`**: se há animações de modal/sheet, respeitar.

---

## 5 · Voz e copy

A app tem voz opinativa nascendo (o banner do Foco é a melhor expressão). Vale codificar:

- **Voz**: direta, BR coloquial-profissional, opinativa. Usa imperativo ("Comece por…", "Renegocia escopo"). Evita jargão corporativo. Evita PM-speak (já é princípio na §2 do ROADMAP).
- **Tom em estados de erro**: hoje muito `confirm()` nativo do browser ("Are you sure?"). Toda confirmação importante merece tom — `Apagar essa task? Não dá pra desfazer.` em vez de `Are you sure?`.
- **Tom em estados vazios**: §1.6.
- **Mensagens técnicas viraram conversa**: `+0d`, `hoje nesta etapa`, `há 6d` → linguagem natural (`hoje`, `nesta etapa há 6 dias`).

Sugestão de exercício: passar todas as strings da app por um "tira o cheiro de Jira" check.

---

## 6 · Prioridade (sugestão pra ordenar trabalho)

### Now (alta alavancagem, baixo custo)

1. **§1.1** Hierarquia dos cards de métrica — divide em dois níveis visuais.
2. **§1.2** Chips de filtros ativos + limpar filtros.
3. **§2.4 (triagem)** Cards mais compactos + bulk actions — multiplica produtividade no fluxo mais repetitivo da app.
4. **§2.5 (calendário)** Acentuar "hoje", baixar "concluídas".
5. **§1.6** Empty states com voz.

### Next (média alavancagem)

6. **§1.3** Limpar uso de mono — sans em linguagem natural.
7. **§1.4** Padronizar tratamento de status pills (3 níveis claros).
8. **§2.3 (kanban)** Sticky macro headers + colunas vazias colapsam.
9. **§2.6 (modal)** Prioridade como chip-picker, Interno/Cliente segmented, contador no checklist colapsado.
10. **§2.7 (nav)** Esconder/agrupar tabs em parking.

### Later (refinamento)

11. **§1.5** FAB em mobile.
12. **§2.2 (foco)** Refinar prazo display (omitir em hoje).
13. **§5** Copy pass — tom em confirms, mono em linguagem natural.
14. **§4** A11y audit completo com axe-core ou Lighthouse.
15. **§3** Mobile audit real em iPhone.

---

## Nota final

A app já tem **identidade**. Não é um clone genérico — tem opinião (no Foco), tem voz (no banner), tem tokens consistentes (paleta, mono, charcoal). Esse é o ativo mais difícil de construir e ele tá lá.

O que falta é **disciplina** — aplicar a opinião que já existe em mais lugares, baixar volume dos elementos que ainda gritam por igual, e cobrar coerência de padrões que apareceram em uma tela mas não em outras (o hero do Foco, as cores das pills, o uso do mono).

Trabalho de afiação, não de re-imaginação.
