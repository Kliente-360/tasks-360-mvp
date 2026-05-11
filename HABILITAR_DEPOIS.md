# HABILITAR_DEPOIS

> Features **desenvolvidas** (schema + lógica + UI antiga preservada) que estão **temporariamente escondidas** pra simplificar o app durante a fase de adoção. Reativar quando aparecer dor real ou quando a maturidade do uso justificar.
>
> Quando reativar: tirar o comentário `<!-- HIDDEN_DESDE_v1.01.X · ... -->` no `index.html` e validar.

## Lista atual (escondidos a partir de v1.01.147)

| # | Feature | Onde estava | Schema preservado | Quando trazer de volta |
|---|---|---|---|---|
| 1 | **Tags em task** | Modal task (entre Descrição e Atribuição) | `tasks.tags text[]` | Quando vocabulário de tags virar dor: equipe pedir filtros nomeados ou criar +20 tasks similares sem agrupar |
| 2 | **Tipo de trabalho** select | Modal task · seção Esforço · prazo | `tasks.tipo_trabalho text` (`bug/feature/discovery/manutencao/admin`) | Quando aparecer demanda de classificação por tipo (relatório, distribuição, IA classificar) |
| 3 | **ID externo** (Salesforce) input manual | Modal task · seção Metadata | `tasks.external_id text` + ingest-task lê/escreve | Manter escondido — ingest cria/atualiza automaticamente. Reativar só se precisar editar manual |
| 4 | **Dependências** UI (chips + picker) | Modal task · entre Esforço e Metadata | `task_dependencies(task_id, depende_de_id)` + `addDependencia/removeDependencia/_candidatesDependencia` + heurística "bloqueio-dependencia" | Quando equipe começar a sinalizar "task X parada esperando Y" mais de 2x/semana |
| 5 | **Visível ao cliente (comment)** checkbox | Modal task · composer de comentário | `task_comments.visivel_cliente bool` | Quando abrir Portal real e treinar curadoria de comentários. Hoje todo comentário fica interno |

## Reativados

- v1.01.148 · **Visível ao cliente (task)** checkbox em Metadata — voltou ao lado de Etapa

## Princípio

Tudo que está aqui:
- **Já tem schema rodado** em produção → não precisa migration nova
- **Já tem código JS funcional** → só falta exibir
- **Já foi testado** em ondas anteriores
- **Continua sendo gravado** quando vier de outras fontes (ingest-task pra external_id; defaults pra visivel_cliente)

Reativar = remover bloco `<!-- HIDDEN_DESDE_v1.01.X · descrição -->` e validar.

## Não confundir com "descartado"

Estes itens estão **desenvolvidos e testados**, só não exibidos. Itens descartados (que viraram parked no roadmap) estão em **§9.2.X · Heurísticas / Atributos · 🚫 parked** do `ROADMAP.md`.
