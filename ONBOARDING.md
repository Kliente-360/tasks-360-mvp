# tasks 360 — guia de onboarding

> Três perspectivas da mesma ferramenta. Leia a sua, dê uma passada de olho nas outras.

---

# CEO · gestão e tomada de decisão

> "Olho nas pessoas certas, nos clientes certos, na hora certa."

## Para que serve, do seu lugar

O tasks 360 é a fonte de verdade do que está rolando na operação. Você não precisa abrir Notion, Drive, Slack e planilhas pra entender saúde de cliente, capacidade do time e onde está atrasando. O **Dashboard** consolida 8 visões executivas; o resto do app é onde o time alimenta o dado que vira essas visões.

**Premissa central**: o app é opinativo. Não tem 30 campos pra preencher. Tem o mínimo necessário pra responder: *isso está atrasado? quem está sobrecarregado? onde estamos perdendo cliente?*

## Conceitos que importam pra você

- **Cliente.tier** — `estratégico` / `recorrente` / `transacional`. Heurísticas usam isso pra escalar alertas. Ex: tarefa atrasada de cliente estratégico pisca no banner; transacional não.
- **Projeto.tipo** — `discovery` / `entrega` / `recorrente`. Define como ler o lead time esperado.
- **Projeto.sla_* + orcamento_horas** — habilitam alertas de SLA iminente e de estouro de orçamento.
- **Heurísticas pré-IA** (9 no banner do Dashboard) — alertas determinísticos, sem caixa-preta. Cada um tem critério explícito.
- **Status como verdade única** — não há "status real" e "status do app". O que está no app É o estado da operação. Se o time não atualizar, você está cego.
- **Saúde por projeto** — semáforo verde/âmbar/vermelho com critérios fixos. Vermelho = atrasadas, SLA quase vencido, ou bloqueio +5d. Não é palpite.
- **Capacidade por pessoa** — % alocado vs capacidade declarada (`capacidade_horas_semana`). Vermelho = overflow.

## Como ler o Dashboard em 90 segundos

1. **Banner de heurísticas no topo** — leia primeiro. Se tem item ali, alguma coisa precisa de atenção esta semana.
2. **Saúde por projeto** — qualquer vermelho é conversa de hoje, não de amanhã.
3. **Capacidade por pessoa** — se alguém está em vermelho, ou você redistribui ou aceita o atraso conscientemente.
4. **Lead time por cliente** — tendência. Se está subindo num cliente, esse cliente está virando dor.
5. **Aging do backlog** — tarefas paradas há muito tempo são dívida silenciosa.
6. **Aguardando cliente** — sua munição pra cobrar. Mostra o que está parado por *eles*, não por você.

## Casos de uso práticos

**1-on-1 com sócio / head de operação**
- Abrir Dashboard → banner heurísticas → puxar cada item.
- "Por que essa tarefa estratégica está em vermelho?" Click → modal da task → histórico unificado mostra quando entrou, quem mexeu, quando foi reaberta.

**Reunião de cliente**
- Filtrar Backlog por cliente → ordenar por prazo → ver o que está em risco.
- Ou abrir o **Portal do cliente** (mesmo a partir do seu login admin) pra ver exatamente o que o cliente vê.

**Decisão de contratação**
- Capacidade por pessoa em vermelho persistente por 3+ semanas → time sub-dimensionado.
- Aguardando cliente subindo → o problema não é capacidade, é cobrança.

**Decisão de demitir cliente**
- Cliente transacional consumindo horas de projeto estratégico → ver Volume por cliente + Lead time por cliente.

## Dicas de produtividade

- **Cmd+K (command palette)** — buscar qualquer task/cliente/projeto sem clicar. Use isso como ponto de entrada padrão.
- **Atalho `g d`** — vai pro Dashboard. `g b` Backlog. `g f` Meu foco.
- **Não preencha tarefas**. Sua função é ler o sistema, não alimentá-lo. Se você está abrindo task, o time não está fazendo o trabalho dele.
- **Olhe o Dashboard 1x/dia, não 1x/semana**. O banner muda; você quer ver mudança, não acúmulo.
- **Defina `tier` em todos os clientes**. Sem isso, metade das heurísticas não funciona.

## O que NÃO fazer

- Não abrir 50 abas de "ideias" no app. Use Notion/Drive pra exploração; tasks 360 é só o que está em execução.
- Não usar pra micro-gestão ("cliquei na task do Fulano de manhã pra ver se ele já mexeu"). O Dashboard responde isso sem precisar abrir task.
- Não trocar os critérios de heurística sem alinhar. São determinísticos por design.

---

# Gerente de projetos · agilista

> "Cerimônia bem feita = todo mundo sabe o que fazer no dia seguinte sem perguntar."

## Para que serve, do seu lugar

O tasks 360 é onde você **conduz** as cerimônias e o time **executa**. Refinamento, daily, retro, planning — todas usam o app como artefato único. Sua função é manter o backlog limpo, priorizado, com prazo realista, e garantir que o time saiba o que fazer.

Você é a pessoa que mais usa o app no dia-a-dia depois dos analistas.

## Conceitos que importam pra você

- **Etapa (status macro)** + **subetapa** — etapa é o macro (backlog / fazendo / done), subetapa é o detalhe operacional. Trigger sincroniza automaticamente; você só mexe na subetapa.
- **Esforço em horas** (não pontos) — decisão deliberada do produto. Se time não souber estimar, treine; não troque de unidade.
- **Prioridade P0–P3** — P0 = pra ontem; P1 = essa semana; P2 = essa quinzena; P3 = quando der.
- **Complexidade** vs **esforço** — complexidade é "quão difícil"; esforço é "quanto tempo". Tarefa pode ser simples mas longa.
- **Dependências** (chips no modal) — task A bloqueia task B. Habilita heurística "bloqueio por dependência".
- **Reopen_count** — incrementa automaticamente quando volta de done. Se ≥2, a heurística "reaberturas crônicas" pisca.
- **Bloqueado por** — campo livre pra dizer o que está travando ("aguardando aprovação X"). Conta na heurística "bloqueio cliente +5d".
- **Aguardando cliente** (subetapa) — *muito* importante. Quando uso isso, sai da nossa contagem de tempo.
- **`visivel_cliente` na task / comment** — controla o que aparece no Portal. Use com intenção.

## Guia de uso por cerimônia

### Refinamento (1-2x/semana)
1. Filtre Backlog por subetapa = `triagem`.
2. Pra cada task: definir título claro, cliente, projeto, esforço estimado, complexidade, prioridade.
3. Se depende de outra, ligar via chips de dependência.
4. Mover pra subetapa `pronto pra fazer`.

### Daily (15min)
1. Abrir **Kanban**.
2. Cada pessoa puxa o que está em "fazendo" e diz: feito ontem, hoje, impedimentos.
3. Impedimento real → preencher `bloqueado_por` + mover pra `bloqueado` + tipo apropriado.
4. Não use o app pra reportar tempo — analista preenche `tempo_real_horas` ao fechar.

### Planning (semanal)
1. Dashboard → **Capacidade por pessoa**. Vermelho = ninguém pega tarefa nova; redistribuir o que já está.
2. Backlog filtrado por `pronto pra fazer`, ordenar por prioridade, atribuir respeitando capacidade.
3. Definir prazo. Se time pediu prazo curto, anote complexidade alta — heurística "estimativa furada" vai te avisar depois se passou de 1.5x.

### Retro (quinzenal)
1. Dashboard → **Throughput semanal** (pra ver evolução), **Lead time por cliente**, **Aging**.
2. Banner de heurísticas — quais alertas mais apareceram nas últimas semanas?
3. Histórico unificado da task em discussão — mostra exatamente o que mudou.

## Casos de uso práticos

**Cliente reclamou de atraso**
- Filtrar Backlog por cliente. Ordenar por prazo. Identificar o que de fato atrasou.
- Histórico da task → quando o prazo mudou? Quem moveu pra `aguardando cliente`? Tem evidência.

**Pessoa nova no time**
- Atribuir tasks pequenas (esforço <4h) e simples (complexidade baixa) primeiro.
- Heurística "júnior + complexidade alta" alerta se você esquecer.

**Tarefa parada há 2 semanas**
- Aging do backlog mostra. Decidir: arquivar (não vai fazer), ou repriorizar (vai fazer agora).
- Não deixar morrer no meio. Backlog inflado = sinal de gerência ruim.

**Replanejar projeto**
- Cadastros → editar projeto → ajustar `sla_*` ou `orcamento_horas`.
- Heurística de SLA iminente passa a alertar com base nos novos limites.

## Dicas de produtividade

- **Cmd+K** é seu melhor amigo. Pular pra task, pra cliente, pra projeto sem clicar.
- **Bulk actions** na tabela: selecione N tasks e mude pessoa/etapa/prioridade de uma vez. Use isso em planning.
- **`g k` Kanban / `g b` Backlog / `g d` Dashboard** — ganha 30s por hora.
- **@mention em comentário** dispara notif. Use pra escalar pro analista certo sem mandar Slack.
- **Tags como vocabulário compartilhado** — sugestão automática mostra tags existentes ao digitar; padronize ("frontend", "design", "auth"). Não crie tag nova se já tem similar.
- **Arquive cliente/projeto inativo** — somem dos selects sem perder histórico. Toggle "incluir arquivados" reaparece quando precisa.

## O que NÃO fazer

- **Não inventar etapa nova** — etapas e subetapas são opinativas. Se sua operação não cabe, conversa com o produto antes de hackear.
- **Não usar `bloqueado_por` como diário** — campo é um motivo, uma frase. Discussão vai em comentário.
- **Não aceitar task sem prazo nem esforço**. Backlog cego é dívida.
- **Não fechar task que não foi entregue** — analista preenche `tempo_real_horas` antes de marcar done. Sem isso, você não consegue medir nada.
- **Não usar P0 pra tudo**. Se tudo é P0, nada é. P0 é raro.

---

# Analista · execução

> "Saber o que fazer agora, sem perguntar. Registrar pro time saber o que rolou."

## Para que serve, do seu lugar

O tasks 360 te diz o que fazer hoje (**Meu foco**), recebe o que você produziu (status, tempo real, comentários), e mantém histórico do que aconteceu. Você não precisa lembrar do que combinou na daily — está no app.

A regra de ouro: **se mexeu, atualiza**. Status desatualizado prejudica todo mundo.

## Conceitos que importam pra você

- **Meu foco** — primeira aba que você abre todo dia. Suas tasks priorizadas, com vencidas no topo.
- **Subetapa** — onde você atualiza estado. As principais:
  - `pronto pra fazer` — gerência colocou pra você pegar.
  - `fazendo` — você puxou e está executando.
  - `aguardando cliente` — passou a bola pro cliente. *Pausa o cronômetro do nosso lado.*
  - `revisão` — entregou; alguém precisa validar.
  - `done` — concluído.
  - `bloqueado` — não consegue prosseguir; preenche `bloqueado_por`.
- **Esforço estimado** — *não é cobrança*, é planejamento. Se gastou 8h numa task de 4h, registra real e segue.
- **Tempo real (`tempo_real_horas`)** — preenche **ao fechar**. Sem isso, não tem aprendizado.
- **Comentário público (`visivel_cliente`)** — checkbox no comentário. Marcado = cliente vê no Portal. Desmarcado = só time interno. *Em dúvida, deixe interno.*
- **@mention** — `@nome` em comentário avisa a pessoa. Use pra perguntar ou repassar.
- **Tag** — vocabulário compartilhado. Ao digitar, app sugere tags existentes. Use as que já existem antes de criar nova.
- **Reabrir uma task** — não tem botão "reabrir": muda de `done` pra outra subetapa. Trigger incrementa `reopen_count`. Se reabrir 2+ vezes, gerência vai ver no banner.

## Guia de uso, dia típico

### Manhã (5min)
1. **Meu foco** (`g f`). Ver atrasadas + de hoje.
2. Escolher próxima → **mover pra `fazendo`**. Sem isso, gerência não sabe que você começou.
3. Se vai esperar cliente → mover pra `aguardando cliente` antes de seguir pra outra.

### Durante (toda hora que mudar de assunto)
- Se trocou de task: **mover a anterior** pra `revisão` / `bloqueado` / `aguardando cliente`.
- Pergunta pendente? Comentário com @mention. Não Slack — Slack se perde.
- Se descobriu algo novo (subtarefa, dependência) → criar task nova ou ligar dependência.

### Ao fechar uma task
1. Preencher `tempo_real_horas` — quanto efetivamente consumiu.
2. Se tem entrega visível pro cliente → criar comentário **público** com link/print.
3. Mover pra `done`.

### Final do dia (2min)
- Olhar Meu foco. Algo em `fazendo` que não vai sair hoje? Mover pra `pronto pra fazer` ou `bloqueado`. Não deixe `fazendo` parado de um dia pro outro.

## Casos de uso práticos

**Tarefa que depende de outra ainda em andamento**
- Abrir task → seção dependências → adicionar a outra como "depende de".
- Mover pra `bloqueado` com motivo "aguardando task X".

**Cliente respondeu — task estava em `aguardando cliente`**
- Mover pra `fazendo` (ou `pronto pra fazer` se vai pegar amanhã).
- Comentário com resumo do que cliente respondeu (público se ele já vê no Portal; interno se for tradução pro time).

**Dúvida no meio da execução**
- Comentário na task com @mention da pessoa.
- *Não* mover pra `bloqueado` por dúvida pequena — só se realmente travou.

**Estimativa furou (gastou muito mais que esperado)**
- Registra `tempo_real_horas` honestamente. Heurística "estimativa furada" vai pingar; não é cobrança, é insumo pra time estimar melhor da próxima.

**Chegou pedido novo direto pra você**
- Criar task (`n` ou Cmd+K → "criar"). Cliente, projeto, descrição mínima.
- Mover pra `triagem`. Gerente refina e prioriza.

## Dicas de produtividade

- **`g f` Meu foco** — atalho mais usado. Memorize.
- **`n`** abre task nova de qualquer lugar.
- **Cmd+K** busca task pelo título. Mais rápido que rolar.
- **Tags consistentes** — ao digitar, escolha das sugestões. Cria menos lixo no banco.
- **Comentário curto e datado mentalmente** — "20/05 enviado mockup v2" vale mais que "ok mandado".
- **Notifications (sino)** — checa de vez em quando. @mention pra você fica lá.
- **Não use `bloqueado` como "preguiça"**. Bloqueado tem motivo factual; senão é só `pronto pra fazer`.

## O que NÃO fazer

- **Não fechar task sem `tempo_real_horas`**. Mata o aprendizado coletivo.
- **Não deixar tudo em `fazendo`**. Use `aguardando cliente` / `bloqueado` / `revisão` quando for o caso.
- **Não comentar em público sem checar** — `visivel_cliente` vai pro Portal. Em dúvida, interno.
- **Não criar tag nova com nome quase igual** ("Frontend" vs "frontend" vs "front"). Use a sugerida.
- **Não usar comentário pra discussão longa de design**. Discussão vai em call ou Notion; comentário é registro.
- **Não trocar prazo sem comentário**. Histórico mostra a mudança, mas o "por quê" some se você não escrever.

---

> Dúvidas? Pingue o gerente de projetos no canal #ops. Esse guia evolui — sugestões de melhoria também viram task.
