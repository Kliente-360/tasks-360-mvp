# Proposta · Resumo Executivo · tasks 360 · semana N

> **Status**: aprovada · em execução (mai/2026 · v1.02.033)
> **Substitui**: rascunho anterior de revisão Dashboard+Briefing (descartado — abas atuais ficam intactas)
> **Decisão estratégica**: em vez de redesenhar 2 abas separadamente (Dashboard quantitativo + Briefing prescritivo), concentramos o storytelling executivo num **único PDF semanal** consolidado. App existente continua servindo gestor operacional diário. PDF vira o artefato de reunião/comercial/board.

---

## 1. Por quê concentrar no PDF

| Vantagem | Por quê |
|---|---|
| **1 entregável definitivo** | Em vez de redundância Dashboard/Briefing, foco em um documento que vai pra reunião |
| **PDF é o artefato real** | Sócios leem; cliente recebe; board apresenta. App é ferramenta interna |
| **Diferencial competitivo** | PSAs (Productive/Scoro) cobram caro por isso e ainda entregam tabelão. Memo narrativo é raro |
| **Aproveita 100% das heurísticas** | Zero duplicação de lógica — todos os getters já existem |
| **App existente preservado** | Dashboard segue painel operacional; Briefing in-app fica simples (cards) |
| **Iteração mais rápida** | Refatora um template em vez de coordenar 2 abas |

---

## 2. Decisões fechadas

| # | Decisão |
|---|---|
| 1 | **Nome**: `Resumo Executivo · tasks 360 · semana N` |
| 2 | **Audiência**: sócios / CEO (interno alto-nível) |
| 3 | **Frequência**: semanal default, mas pode sair sob demanda — sempre na perspectiva de **consolidação de período semanal** |
| 4 | **Anexos**: manter (PDF de 6-8 páginas, anexos incluem detalhe quantitativo de apoio) |
| 5 | **Dashboard + Briefing in-app**: manter exatamente como estão |

---

## 3. Estrutura proposta · 8 páginas

Cada página responde uma pergunta diferente, todas conectadas numa narrativa coesa.

### Página 1 · Capa + Sumário Executivo
**Pergunta**: "Em 60 segundos, o que aconteceu esta semana?"

- Logo · "Resumo Executivo · tasks 360 · semana N · DD/MM/YYYY"
- 4-6 frases em prosa editorial (não bullets):

> "Esta semana entregamos **16 tarefas** (+50% vs semana ant). Lead time caiu de 7d → 5d. **Bodytech** preocupa: 3 atrasadas + sponsor 5d sem resposta. **Drieli** em sobrecarga W0 (145%) — realocar tasks antes da quarta. Operação saudável em 4 dos 6 indicadores; **adoção ainda inconsistente** (DAU/WAU 65%)."

**Fonte de dados**: novo getter `memoSumario` consolidando narrativa de `briefingTendencia` + alertas top.

### Página 2 · Performance da operação
**Pergunta**: "Como estamos performando vs metas?"

Quatro KPIs (já existem em `dashboardVelocityIndicators`):
- Throughput W1 com Δ
- Lead time médio 30d
- Cycle time médio 30d
- % no prazo

Cada um com **sinal verde/amarelo/vermelho + meta + 1 frase narrativa explicando o número** (não só o valor cru).

Conclusão narrativa de 1 parágrafo no rodapé da página.

### Página 3 · Saúde por cliente
**Pergunta**: "Quem precisa conversar e o quê?"

Lista de clientes ativos, cada um com semáforo + **1 frase prescritiva** (não tabela):

> 🔴 **Bodytech** — 3 atrasadas críticas, sponsor 5d sem resposta. **Conversar imediato** com [contato] antes da sexta. SLA Onboarding vence 18/05.
>
> 🟡 **Acme** — Aguardando aprovação há 4d. Reforçar follow-up.
>
> 🟢 **Banzai** — 30d sem bloqueios. Padrão a celebrar.

**Fonte**: `reportClientHealth` + `reportClientesExec` consolidados em prosa via novo helper.

### Página 4 · Saúde por pessoa
**Pergunta**: "Quem está como?"

Mesma estrutura, foco em time/capacidade:

> 🔴 **Drieli** — 145% capacidade W0, 2 P0 atrasadas. **Realocar 2 tasks** (sugestão: Maria, que tem Bodytech como secundário e está em 70%).
>
> 🟡 **João** — 95% cap, 1 atrasada em Acme. Pressão pontual.
>
> 🟢 **Pedro** — fluxo regular.

**Fonte**: `reportTeamLoad` + `weeklyRedistSuggestions` (a sugestão entra como ação concreta).

### Página 5 · Gaps & desvios analíticos
**Pergunta**: "Onde estão os gargalos quantitativos invisíveis no dia a dia?"

4-6 análises **interpretadas** (não só dados):

> **Lead time piorou 30%** em 14d. Antes: 5.4d. Agora: 7.1d. Pessoas mais impactadas: Drieli (+45%), João (+20%).
>
> **Variância de carga 2.4x** entre Drieli (145%) e Pedro (60%). Meta < 1.5x. Sinal de gargalo individual.
>
> **SLA breach rate 12%** no mês (5% no mês anterior). 3 contratos próximos do estouro.
>
> **Bottleneck em "Em homologação"**: tasks ficam 4.2d (vs 1.8d em desenvolvimento). Possivelmente falta de revisor.
>
> **Concentração de cliente**: 60% das horas do time em Bodytech. Risco de churn ↑ vs diversificação.

**Fonte**: novos cálculos (variância, breach rate, bottleneck, concentração) + getters existentes. Marca a chegada dos KPIs propostos no `KPIS.md`.

### Página 6 · Capacidade próximas 4 semanas
**Pergunta**: "O que vem aí?"

- Heatmap pessoa × semana (cores W0-W3)
- Sustentações estourando/ociosas
- Projetos fechados (% orçamento)

**Fonte**: `weeklyCapacityAnalysis` (já existe).

### Página 7 · Decisões + sinais positivos
**Pergunta**: "O que decidir esta semana? O que celebrar?"

Duas colunas em prosa curta:

**Decisões pendentes**:
- Renegociar escopo Bodytech sustentação (110% executado)
- Pareamento de júnior em 2 tasks de alta complexidade
- Investigar regressão lead time

**Sinais positivos** (importantes pra moral):
- Banzai 30d sem bloqueio
- Time entregou na sprint do trimestre
- Pedro virou power user (Adoption)

**Fonte**: heurísticas pendentes + `usageAlertas` (positivos).

### Página 8 · Anexos · dados de apoio
**Pergunta**: "Quero o detalhe granular."

- Tabela: Top 5 atrasadas (com responsável, prazo, dias de atraso)
- Tabela: Top 5 bloqueadas (com motivo)
- Tabela: Top 5 aguardando cliente (com aging)
- Gráfico: Throughput trend 8 semanas
- Gráfico: Lead time por cliente (90d)

**Fonte**: getters existentes (`atrasadasList`, `bloqList`, `aguardandoClienteList`, `kpiVelocity`, `leadTimePorCliente`).

---

## 4. Tom da escrita

- **Prosa executiva, prescritiva**: "Conversar com Bodytech — sponsor 5d sem resposta", não "Bodytech tem 3 atrasadas"
- **Números embedded em frases** explicativas, não tabelas inflacionadas
- **Cada parágrafo responde uma pergunta**, não enumera dados secos
- **Voz**: 3ª pessoa neutra com ações claras ("realocar", "conversar", "investigar")
- **Calibre**: como se um sócio leitor estivesse lendo num domingo à noite preparando a semana

---

## 5. Implementação técnica

### Reusos (zero nova lógica de heurística)

| Página | Getter reutilizado |
|---|---|
| 1 Sumário | `briefingNarrativa` (refator pra mais editorial) + heurísticas top |
| 2 Performance | `dashboardVelocityIndicators` (já existe) |
| 3 Saúde cliente | `reportClientHealth`, `reportClientesExec` |
| 4 Saúde pessoa | `reportTeamLoad`, `weeklyRedistSuggestions` |
| 5 Gaps & desvios | **NOVOS**: variância carga, SLA breach, bottleneck sub-etapa, concentração cliente |
| 6 Capacidade | `weeklyCapacityAnalysis` (perfeito como está) |
| 7 Decisões | combinação de heurísticas |
| 8 Anexos | `atrasadasList`, `bloqList`, `aguardandoClienteList`, `kpiVelocity`, `leadTimePorCliente` |

### Arquitetura técnica

- Template HTML do PDF: refatorar `<section class="print-only">` em `index.html` (linhas 3075-3310 atualmente)
- Mantém `window.print()` + CSS print (zero dependências novas)
- CSS classes `.memo-*` mantidas e expandidas
- Novos getters em `lib/views/briefing.js` (consolidação narrativa) e `lib/views/core-data.js` (KPIs propostos)

### Charts no PDF (página 8 · Anexos)

Atualmente `buildPrintCharts()` é no-op. Vamos ativar Chart.js pra throughput trend e lead time por cliente nos anexos (já tem `chartTheme()` e infra pronta).

---

## 6. Plano de execução · 4 PRs (~10h)

| PR | Escopo | Esforço | Páginas |
|---|---|---|---|
| **M1** | Sumário Executivo (pág 1) + Performance hero (pág 2) com prosa | ~2.5h | 1, 2 |
| **M2** | Saúde cliente (pág 3) + Saúde pessoa (pág 4) em prosa prescritiva | ~2.5h | 3, 4 |
| **M3** | Gaps & desvios analíticos (pág 5) com 4-6 análises + KPIs novos (variância carga, breach rate, bottleneck, concentração) | ~3h | 5 |
| **M4** | Capacidade (pág 6) + Decisões/sinais (pág 7) + Anexos (pág 8) com charts | ~2h | 6, 7, 8 |

Cada PR mergeável independentemente — o template tem todas as 8 seções desde o início, só o conteúdo de cada vai sendo polido por PR.

---

## 7. Sucesso

Como sabemos que funcionou?
- Sócios lendo o PDF semanal em ~5min e saindo com ações claras anotadas
- Cliente externo recebendo (versão filtrada futura) e percebendo valor narrativo
- Em uma reunião de portfólio, o PDF substitui o slide-deck improvisado

Métricas indiretas (Adoption):
- `event: export_pdf` aumenta em frequência
- Briefing in-app vira "preview rápido" durante semana, PDF vira "leitura definitiva" no domingo

---

## 8. Após implementação

Atualizar:
- `CONTEXT.md §14` — nova narrativa de produto (PDF como diferencial)
- `ROADMAP.md` — fechamento da proposta
- `KPIS.md` — KPIs propostos saem do "proposto" pro "ativo" quando entrarem na pág 5

---

## Anexo · ordem narrativa do PDF (referência rápida)

```
Pág 1  →  Sumário · "60s de overview"
Pág 2  →  Performance · "como vamos"
Pág 3  →  Saúde cliente · "quem conversar"
Pág 4  →  Saúde pessoa · "quem está como"
Pág 5  →  Gaps · "onde está o gargalo invisível"
Pág 6  →  Capacidade · "o que vem aí"
Pág 7  →  Decisões + Positivos · "agir + celebrar"
Pág 8  →  Anexos · "detalhe quantitativo"
```
