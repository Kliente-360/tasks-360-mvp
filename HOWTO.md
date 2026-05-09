# tasks 360 — manual do usuário

> **Como usar a ferramenta no dia a dia.** Atualizado a cada release com novas funcionalidades ou mudanças de comportamento.
>
> **Dentro do app**: clique no botão **?** no topo (ou ⌘K → "Manual") pra abrir esse documento renderizado bonito, com índice navegável.
>
> Última atualização: 08/05/2026 · após onda de polimento (Meu foco · Calendário · ⌘K · atalhos · bulk actions · quick add · manual no app)

---

## Sumário

1. [Visão geral](#visão-geral)
2. [Abas do app](#abas-do-app)
3. [Modelo de uma tarefa](#modelo-de-uma-tarefa)
4. [Criando, editando e movendo tarefas](#criando-editando-e-movendo-tarefas)
5. [Filtros e busca](#filtros-e-busca)
6. [Atalhos de teclado e command palette](#atalhos-de-teclado-e-command-palette)
7. [Bulk actions na tabela](#bulk-actions-na-tabela)
8. [Comentários](#comentários)
9. [Exportar (PDF / CSV)](#exportar-pdf--csv)
10. [Login (quando ativado)](#login-quando-ativado)
11. [Tema, mobile, PWA](#tema-mobile-pwa)
12. [Glossário](#glossário)

---

## Visão geral

A **tasks 360** é a ferramenta de gestão executiva de backlog da Kliente 360. Tem uma tela só com várias abas; as decisões são opinativas (esforço em horas, prioridade P0–P3, etapas fixas), sem campo customizável.

Quem você é determina como usa:

- **Sócio / liderança** → começa pelo **Dashboard** (KPIs + charts) e pelo **PDF executivo**.
- **PM / consultor** → começa pelo **Meu foco** (urgências do dia) e usa o **Backlog** + **Kanban** pra operar.
- **Time externo (Salesforce)** → não precisa abrir o app; o que vier do SF aparece com badge "SF".

---

## Abas do app

Da esquerda pra direita no topo:

### Meu foco

Painel curado pra começar o dia. No topo, escolha a pessoa em **"atuando como"** (seleção fica salva por navegador). Aparecem 4 KPIs e 4 listas, em ordem de urgência:

1. **Atrasadas** — prazo vencido, ordenadas por dias de atraso desc
2. **Para hoje** — prazo é hoje
3. **Bloqueadas** — você é responsável e a tarefa está em `bloqueado`
4. **P0/P1 ativas** — só itens que ainda não apareceram acima

Sem login? Use o seletor manual. Quando o login voltar, isso será automático.

### Backlog

Tabela mestre. Cabeçalho ordenável por qualquer coluna (clique). Colunas: Tarefa · Cliente · Projeto · Responsável · Pri · Hrs · Cmplx · Prazo · Status. Linha clicada abre o detalhe.

- Atrasadas em vermelho
- Aging badge em laranja/vermelho quando uma tarefa está parada além do limite saudável
- **Agrupar por** (no topo da tabela): default `Responsável`. Outras opções: Cliente · Projeto · Status · Etapa · Prioridade · Complexidade. Cada grupo vira um header colapsável (clique pra expandir/recolher) com contagem e total de horas. "— sem agrupamento" volta à lista plana.
- **Ordem manual**: botão "≡ ordem manual" → arraste linhas pra reordenar (desabilitado quando há agrupamento)
- **Filtros**: cliente, projeto, pessoa, status, prioridade, tag (ver [Filtros](#filtros-e-busca))
- **Bulk actions**: checkbox por linha (ver [Bulk actions](#bulk-actions-na-tabela))

### Kanban

Duas visões via toggle no topo (no **desktop**). No **mobile** só a visão executiva aparece (a operacional, com 11 colunas, é ruim em tela estreita).

- **Operacional** (default desktop) — 11 colunas com sub-etapas em scroll horizontal. Mover entre colunas via drag-and-drop ou via o select no rodapé do card. Cada coluna tem `+ adicionar` pra criar tarefa rápido.
- **Executiva** (única no mobile) — 4 colunas macro (Backlog, Em andamento, Bloqueado, Concluído), só leitura. O sub-status atual aparece em cada card.

A faixa colorida no topo de cada coluna operacional sinaliza o grupo macro: verde = andamento, vermelho = bloqueado, cinza = backlog/concluído.

> No mobile, pra mover de etapa: abra a tarefa (toque no card) e mude o campo "Etapa" no formulário.

### Calendário

Grid mensal. Cada dia mostra as tarefas com prazo nele. No desktop, chips com título; no mobile, dots coloridos.

- **Click num dia** com tarefas → seleciona o dia (destaque verde escuro) e mostra **cards das tarefas daquele prazo abaixo do calendário**. Cards são idênticos aos do kanban (com select pra mover etapa direto dali), ordenados por prioridade. Click no card abre a tarefa.
- **Click no mesmo dia de novo** → desseleciona e fecha a tabela.
- Mudar de mês limpa a seleção automaticamente.
- Verde = no prazo · Vermelho = atrasada · Cinza riscado = concluída
- Hoje destacado em borda verde
- Header mostra navegação (‹ hoje ›). Contagens vão pra legenda inferior.

### Dashboard

KPIs hero (em andamento, backlog, bloqueadas, atrasadas) + métricas de velocidade (throughput 7d/30d, lead time, cycle time) + 4 charts (clientes, pessoas, throughput 8 semanas, timeline 5 semanas) + lista de atrasadas.

Filtros de cliente e responsável afetam tudo.

### Cadastros

Três sub-abas: Clientes · Projetos · Pessoas. Cadastre antes de criar tarefas que dependam.

### Adoption

Métricas de uso interno do app (DAUs, eventos, comentários). Pra acompanhar adoção do protótipo.

---

## Modelo de uma tarefa

Campos:

| Campo | O que é |
|---|---|
| **Título** | Obrigatório. Curto e claro. |
| **Descrição** | Opcional. No mobile, é escondida na tabela do Backlog pra manter linhas uniformes. |
| **Cliente** | Quem paga. Resolve cascata pra projetos. |
| **Projeto** | Filhote do cliente. |
| **Responsável** | Pessoa única. Pode ficar vazio (mas aparece como sinal de risco). |
| **Prioridade** | P0 (urgente) · P1 (alta) · P2 (normal) · P3 (baixa). |
| **Esforço** | Horas estimadas. Decimal aceito. |
| **Complexidade** | Alta · Média · Baixa. Aparece como chip com mini-barras na tabela do Backlog. |
| **Prazo** | Data. Se passou e o status não é `concluido` → vira atrasada. |
| **Etapa** | Sub-etapa (nível 2). Macro é derivada automaticamente: |
|   | • Backlog → backlog · priorizado · em definição · escopo definido |
|   | • Em andamento → em desenvolvimento · em homologação · em revisão · pronto p/ produção · em implantação |
|   | • Bloqueado → bloqueado |
|   | • Concluído → concluído |
| **Tags** | Lista livre, lowercase, hífens. Filtráveis e clicáveis. |

---

## Criando, editando e movendo tarefas

### Criar tarefa completa

- Botão **+ Nova tarefa** no canto superior direito (ou atalho `n`).
- Modal abre com todos os campos. Preencha o título no mínimo. Salve.

### Quick add (kanban operacional)

- Botão **+ adicionar** no topo de cada coluna sub-etapa.
- Digita só o título → Enter cria com defaults (P2, 4h, complexidade média, sem cliente/projeto/responsável). Editável depois.
- Após criar, o input continua aberto pra captura contínua. Esc fecha.

### Editar

- Clique numa linha da tabela, num card do kanban, num chip do calendário ou em qualquer item de Meu foco.
- Modal de detalhe abre com todos os campos editáveis + comentários + histórico.

### Mover de etapa

- **Kanban operacional**: arraste o card para outra coluna *ou* use o select no rodapé do card.
- **Backlog**: clique na linha, mude o campo "Etapa" no modal.
- **Bulk**: selecione várias linhas no Backlog → barra flutuante → "mover etapa".

Quando a etapa muda atravessando macros (ex: backlog → em desenvolvimento), o histórico de status registra a transição. Mudar dentro da mesma macro só atualiza o aging granular.

### Reordenar manualmente (Backlog)

1. Clique em **≡ ordem manual** no topo direito do Backlog.
2. Linhas viram arrastáveis. Solte na posição desejada.
3. Persistência via float (sem renumeração periódica). Para sair, clique em **✓ ordem manual** de novo.

### Excluir

- No modal de edição, botão **excluir tarefa** (vermelho). Confirma antes de apagar.
- Em massa: bulk action no Backlog.

---

## Filtros e busca

### Filtros do Backlog

- **Busca por título** (campo livre)
- **Cliente · Projeto · Pessoa · Pri · Cmplx · Status · Tag** (selects, na mesma ordem das colunas da tabela)
- Filtros viram URL: pode compartilhar o link e o destinatário vê a mesma visão.
- Botão **✕ limpar filtros** com contador aparece quando há ao menos um filtro ativo.

### Default do filtro de status

- Padrão é **"Abertas (sem concluídas)"** — concluídas ficam fora do dia a dia.
- Para ver concluídas, troque pra **"Todos os status"** ou **"Concluído"**.

### Filtros do Kanban / Calendário / Dashboard

Cliente e responsável aparecem como selects no topo da própria aba.

---

## Atalhos de teclado e command palette

### Command palette (⌘K / Ctrl+K)

Abre busca global por:
- Tarefas (título e descrição) → abre o detalhe
- Clientes / Projetos / Pessoas → filtra Backlog
- Ações: nova tarefa, ir pra qualquer aba, exportar PDF/CSV, limpar filtros, alternar tema, recarregar, abrir ajuda

100% teclado: ↑↓ navegar · ↵ confirmar · Esc fechar.

### Atalhos globais

| Tecla | Ação |
|---|---|
| `⌘K` · `Ctrl+K` | Abrir/fechar command palette |
| `n` | Nova tarefa |
| `/` | Foco na busca do Backlog (em outras abas, abre palette) |
| `g f` | Ir pra Meu foco |
| `g b` | Ir pra Backlog |
| `g k` | Ir pra Kanban |
| `g l` | Ir pra Calendário |
| `g d` | Ir pra Dashboard |
| `g c` | Ir pra Cadastros |
| `g a` | Ir pra Adoption |
| `?` | Abrir/fechar overlay com lista completa |
| `Esc` | Fecha modal/palette/ajuda |

Atalhos **não disparam** quando você está digitando em campos.

---

## Bulk actions na tabela

Disponível na aba **Backlog**.

1. Marque as tarefas (checkbox por linha) ou use o checkbox do header pra selecionar todas as visíveis.
2. Barra flutuante aparece no rodapé com:
   - **mover etapa** (sub-etapa, com optgroup por macro)
   - **atribuir responsável** (ou tirar)
   - **mudar prioridade** (P0–P3)
   - **excluir** (com confirmação)
   - **limpar seleção**

Mover etapa em massa registra histórico corretamente quando há cruzamento de macro.

---

## Comentários

Disponíveis no modal de edição:

- Texto livre, suporte a quebras de linha
- **Reply 1-nível**: pode responder a um comentário, mas não responder a uma resposta (anti-thread infinito)
- Comentários do **Salesforce Chatter** entram automaticamente com badge **SF**
- Histórico imutável; não dá pra editar/excluir comentários

---

## Exportar (PDF / CSV)

Botão **↓ exportar** no canto superior direito.

### PDF · relatório executivo

- Snapshot **completo** (ignora filtros)
- 2 páginas A4: capa com 6 KPIs + sinais de risco + 3 charts (status, clientes, throughput) · backlog priorizado (sem prazo no topo, depois prazo asc, atrasadas em vermelho)
- Usa o diálogo nativo de impressão do navegador → **Salvar como PDF**

### CSV (visão atual)

- Respeita filtros aplicados (visão atual)
- Inclui todos os campos
- Pra abrir no Excel sem dor de UTF-8

---

## Login (quando ativado)

> **Estado atual**: login está desativado (`AUTH_ENABLED = false`) por dois bugs de magic link em investigação. Quando voltar, o fluxo será o abaixo.

- Magic link sem senha
- Lista fechada de pessoas: precisa ter cadastro ativo (`pessoa.email` preenchido + convite enviado)
- Primeiro login vincula automaticamente a pessoa cadastrada à conta auth
- Logout pelo menu de avatar no topo direito

Quem não estiver na lista de convidados não consegue entrar.

---

## Tema, mobile, PWA

- **Tema**: ☾/☀ no topo. Respeita preferência do sistema na primeira visita.
- **Mobile**: layout adapta — barra de abas vira **dropdown** (botão com aba atual + ▾ abre lista completa), kanban vira carrossel horizontal, filtros viram drawer, descrição some da tabela do Backlog pra altura uniforme, dropdown de exportar fica colado à borda direita.
- **PWA**: no iPhone, "Adicionar à tela de início" instala como app com ícone próprio.
- **Realtime**: qualquer mudança feita por outra pessoa aparece pra você em segundos sem refresh.
- **Recarregar dados**: refresh da página puxa tudo de novo. Se quiser forçar sem F5, use ⌘K → "Recarregar dados".

---

## Glossário

- **Aging** — quanto tempo a tarefa está parada na etapa atual. Vira badge laranja (warn) e depois vermelho (stale) quando passa do limite saudável daquela etapa.
- **Atrasada** — `prazo` passou e `status` ≠ `concluido`.
- **Cycle time** — tempo médio que uma tarefa leva entre `andamento` e `concluido`.
- **Lead time** — tempo médio entre criação e conclusão.
- **Macro / Nível 1** — uma das 4 etapas grandes (Backlog, Em andamento, Bloqueado, Concluído). Derivada automaticamente da sub-etapa.
- **Sub-etapa / Nível 2** — granularidade real da etapa. Onde você opera no kanban operacional.
- **Throughput** — número de tarefas concluídas em um período (7d, 30d, semanal).
- **Visão executiva** vs **operacional** — toggle no kanban: macro 4 colunas read-only ou granular 11 colunas editável.
