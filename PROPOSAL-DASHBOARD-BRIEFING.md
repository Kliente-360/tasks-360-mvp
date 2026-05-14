# Proposta · Revisão Dashboard + Briefing

> **Status**: rascunho em análise · maio/2026 · v1.02.012
> **Contexto**: gerado durante sessão de análise data-driven da aba Adoption (PRs #243-#246) e Dashboard. Identificou-se risco de **redundância** entre Dashboard e Briefing — ambos hoje renderizando essencialmente as mesmas heurísticas em formatos parecidos. Esta proposta separa os dois com identidades conceituais distintas.

---

## 1. Premissa & problema

Hoje **Dashboard** e **Briefing** compartilham:
- Mesmas heurísticas-fonte (~14 heurísticas Onda A-D)
- Mesmas listas (atrasadas, bloqueadas, aguardando cliente)
- Banner de alertas no Dashboard que duplica o que vai pro Briefing
- Dados de saúde (semáforos) similares

**Risco**: se Dashboard vira "Briefing com mais gráficos", desperdiça-se a oportunidade de cada aba ter uma função própria. Usuário tem que decidir qual abrir, em vez de saber instintivamente quando usar cada uma.

---

## 2. Eixo de diferenciação proposto

| Aspecto | **Briefing** | **Dashboard** |
|---|---|---|
| Pergunta-resposta | "**Sobre o que conversar** esta semana?" | "**Como tá performando** e onde tá o gap?" |
| Verbo dominante | Prescritivo: "conversar com…", "decidir…" | Descritivo+comparativo: "lead time piorou X%…", "carga desbalanceada Y:1…" |
| Tom | Editorial, prosa, voz narrativa | Métrico, percentual, benchmark |
| Granularidade temporal | Semanal (foto + delta) | Real-time + trend (tendência viva) |
| Output principal | PDF/carta executiva pra reunião | Painel interativo de instrumentos |
| Audiência primária | Sócios / CEO / reuniões de portfólio | Gestor operacional / PM no dia a dia |
| Cadência de uso | 1× por semana | Diário |

**Princípio**: Briefing **prescreve**. Dashboard **mensura**.

---

## 3. Briefing redesenhado · "Carta editorial executiva"

Hoje o Briefing já é cards. Reescrever para ser **prosa explícita**, voz narrativa, zero tabela.

### 6 cards conversacionais propostos

| Card | Exemplo de prosa |
|---|---|
| **Quem precisa conversar** | "**Bodytech** atrasou 3 entregas e sponsor não responde há 5d. Risco de churn perceptual. Conversa imediata recomendada com [sponsor]." |
| **Quem precisa de você** | "**Drieli** a 130% de capacidade W0, com 2 P0 atrasadas. Realocar 1-2 tasks antes da quarta evita estouro." |
| **Esta semana foi diferente** | "Throughput dobrou (8 → 16 entregas). Time Bodytech contribuiu com 60% do delta. Cliente Banzai ficou 5d sem bloqueio — recorde do trimestre." |
| **Próximas 2 semanas** | "12 entregas previstas, 3 em risco de SLA. Capacidade total: 280h, demanda: 310h (sobra ↓10%). Foco operacional aqui." |
| **Decisões a tomar** | "Skill mismatch em 3 tasks. Margem do contrato Acme em risco (110% executado). Tag de risco em 2 entregas." |
| **Sinais positivos** | "Cliente Banzai 30d sem bloqueio aguardando. Time entregou na sprint do trimestre. Lead time Bodytech caiu 1.5d." |

### Implementação

Cada card é 2-4 sentenças construídas a partir das mesmas heurísticas, mas **renderizadas como prosa**, não tabela. Variáveis injetadas via template strings (já existe parcialmente).

### Output

PDF "Memo executivo · semana N" continua como entregável principal (já existe). A diferença é que o **conteúdo** será mais editorial, menos data-em-tabela.

---

## 4. Dashboard redesenhado · "Painel analítico do gestor"

Reposicionar como **análise quantitativa interpretativa**, não apenas dados crus. **A novidade conceitual** é a seção "Gaps & desvios".

### 5 seções propostas

#### Seção 1 · Hero · 4 KPIs de performance (com sinal)

Throughput W1 · Lead time · Cycle time · % no prazo. Verde/amarelo/vermelho + conclusão heurística (mesmo padrão visual da Adoption).

**Throughput mora aqui** (não na Adoption — usuário definiu que throughput é performance, não adoção da ferramenta).

| KPI | Meta sugerida | Drive |
|---|---|---|
| Throughput W1 (com Δ pp vs sem ant) | ≥ 8/sem em time 5-8 pessoas (calibrar com histórico) | Output semana a semana |
| Lead time médio 30d | ≤ 7d | Quanto tempo task vive aberta |
| Cycle time médio 30d | ≤ 4d | Velocidade no pipeline ativo |
| % entregue no prazo (NEW · 30d) | ≥ 80% | Qualidade da estimativa + execução |

#### Seção 2 · Gaps & desvios · **a novidade conceitual**

Análises quantitativas **interpretadas**, em prosa curta com números embedded. 4-6 gaps por vez, ordenados por severidade.

Exemplos concretos:

> **Lead time piorou 30%** em 14d. Antes: 5.4d. Agora: 7.1d. Pessoas mais impactadas: Drieli (+45%), João (+20%).

> **Carga desbalanceada**: variância 2.4x entre Drieli (145%) e João (60%). Meta < 1.5x. Sinal de gargalo individual.

> **SLA breach rate** 12% no mês (5% no mês anterior). 3 contratos próximos do estouro.

> **Bottleneck em "Em homologação"**: tasks ficam 4.2d (vs 1.8d em desenvolvimento). Pode ser falta de revisor.

> **Concentração de cliente**: 60% das horas do time em Acme. Risco de churn ↑ vs diversificação.

Cada gap = 1 sentença com **número + comparativo + interpretação implícita**. **NÃO inclui a ação** — ação fica no Briefing. Aqui é só "olha onde tá o desvio".

#### Seção 3 · Distribuição de carga (chartCargaPessoa)

Stacked bar on-time × overdue por pessoa. Mantém exatamente como está hoje. **Único gráfico que sobrevive** — mostra algo que tabela não mostra bem.

#### Seção 4 · Saúde por projeto + por pessoa (2 colunas)

Semáforos com detail inline. Mantém — visão de status agregado.

#### Seção 5 · Top ofensores (3 colunas, top 5 cada)

Atrasadas · Bloqueadas · Aguardando cliente. Não decora — é o ponto de entrada pra ação tática quando o gestor olha o Dashboard no dia.

### Cortar do Dashboard

- ❌ Banner "alertas heurísticos" (passa pra Briefing como prosa)
- ❌ 4 KPI count cards (Em andamento h, Backlog h, Bloqueadas, Atrasadas) — redundantes com listas
- ❌ Timeline 8 sem chart — capacity já no chartCargaPessoa
- ❌ Calendar 6 sem heat-map — duplicado com aba Calendário
- ❌ chartClientes (volume horas por cliente) — vanity

### Detalhes opcionais (`<details>` collapsed)

- Throughput trend 8 sem chart
- Lead time por cliente chart

---

## 5. Mapa de heurísticas

Cada heurística existente é renderizada em **um lugar primário**. Algumas serão referenciadas no outro com voz diferente.

| Heurística | Briefing (prescreve · prosa) | Dashboard (mensura · número) |
|---|---|---|
| Cliente estratégico atrasado | "Conversar com Acme imediato" | Gap: "Estratégico Acme: 5 atrasadas, 0 entregas em 14d" |
| Pessoa sobrecarga semana W | "Realocar 2 tasks de Drieli até quarta" | Gap: "Variância de carga 2.4x" + chartCargaPessoa |
| SLA iminente | "SLA Bodytech vence sexta, alinhar entrega" | Gap: "SLA breach rate 12% no mês" |
| Bloqueio cliente +5d | "Cliente Acme não responde há 5d" | Top ofensores · aguardando cliente |
| Sustentação estourando contrato | "Renegociar escopo Bodytech sustentação" | Gap: "Sustentação BT 115% do orçamento" |
| Reaberturas crônicas | "Padrão de retrabalho em [task]" | Gap: "Reopen rate subiu 8% → 14%" |
| Júnior + complexidade alta | "Pareamento com sênior em 2 tasks" | (não aparece — é prescrição pura) |
| Estimativa furada | "Recalibrar estimativa do tipo X" | Gap: "Estimativas furadas em 22% das tasks" |

**Mesma heurística, voz diferente.** Usuário vai entender naturalmente: Briefing pra reunião, Dashboard pra acompanhar.

---

## 6. Sequência de execução proposta

### Fase 1 · Dashboard reescrito (5 PRs · ~10h)

| PR | Escopo | Esforço |
|---|---|---|
| D1 | Hero 4 KPIs performance + conclusão heurística | ~3h |
| D2 | **Seção "Gaps & desvios"** · 4-6 análises quantitativas interpretadas | ~3h |
| D3 | Cortar redundâncias (KPI count, timeline, calendar, chartClientes, alertas banner) | ~2h |
| D4 | Listas top 5 + saúde mantida | ~1h |
| D5 | Charts collapsed em `<details>` | ~30min |

### Fase 2 · Briefing reescrito (2 PRs · ~4h)

| PR | Escopo | Esforço |
|---|---|---|
| B1 | Reescrever 4 cards atuais como prosa editorial completa (sem tabela) — usa heurísticas existentes via templates novos | ~3h |
| B2 | Adicionar card "Sinais positivos" + reordenação dos 6 cards | ~1h |

**Total: ~14h** pra reposicionar ambos com identidade clara.

---

## 7. Decisões pendentes / perguntas abertas

1. **Ordem das fases**: começar por Dashboard (manter momentum da análise atual) ou por Briefing (estabelecer "voz" editorial primeiro e Dashboard se diferencia depois)?
2. **Calibração dos thresholds** (Throughput W1, Lead time, Cycle time, % no prazo): rodar com defaults teóricos primeiro e ajustar conforme dado real chega? Ou pedir dado histórico pra calibrar antes?
3. **Heurística "% entregue no prazo"** é nova: precisa definir exatamente — tasks concluídas no período que tinham prazo, % que `data_conclusao <= prazo`. OK?
4. **Banner de alertas no Dashboard**: cortar totalmente (vai pra Briefing) ou manter como "5 prioridades do dia" curtas com link "ver no Briefing"?
5. **Adoption hero (já existe)** segue o mesmo padrão visual do Dashboard hero proposto (mesma estrutura de cards com sinal). Vale alinhar visualmente os dois?

---

## 8. Próximos passos

- [ ] Usuário revisa esta proposta durante operação da semana
- [ ] Decisões 1-5 acima respondidas
- [ ] Aprovação pra iniciar Fase 1 ou ajustes
- [ ] Execução PR a PR com pausa entre eles pra validação
