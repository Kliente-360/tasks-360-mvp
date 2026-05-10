# Migrations

## `applied/` — patches já rodados

Histórico cronológico das mudanças no schema. **Não rodar de novo** em projetos onde já foram aplicados — alguns são idempotentes mas outros não.

Se for criar projeto Supabase do zero, rodar todos em ordem (próximo da ordem alfabética por enquanto, mas ler o cabeçalho de cada um pra dependências).

| Arquivo | Tema |
|---|---|
| `api_patch.sql` | Endpoints iniciais (campos extra em tasks) |
| `api_patch_comments.sql` | Tabela `task_comments` |
| `mvp_dados_patch.sql` | `author_pessoa_id` em comments |
| `comments_reply_patch.sql` | `parent_id` em comments + trigger anti-treplica |
| `tags_patch.sql` | `tags text[]` em tasks |
| `manual_order_patch.sql` | `ordem` em tasks |
| `auth_history_patch.sql` | `task_status_history` + `actor_pessoa_id` |
| `invited_at_patch.sql` | `invited_at` em pessoas (gating de convite) |
| `complexidade_patch.sql` | `complexidade` em tasks |
| `subetapa_patch.sql` | `subetapa` em tasks + trigger sync com `status` macro |
| `roles_portal_patch.sql` | `role` + `cliente_id` em pessoas; `visivel_cliente` + `from_cliente` em comments; `bloqueado_por` + `visivel_cliente` em tasks; RLS pra cliente externo |
| `2026-05-10_notifications.sql` | tabela `notifications` + RLS + realtime publication |
| `2026-05-10_heuristicas_onda_a.sql` | atributos Onda A: `tasks.tamanho` (deprecated, agora computado), `pessoas.cliente_principal/secundario/capacidade_horas_semana/skills`, `clientes.tier`, `projetos.sla_*`/`orcamento_horas` |
| `2026-05-10_arquivamento.sql` | `arquivado_em timestamptz` em `clientes` e `projetos` |
| `2026-05-10_heuristicas_onda_b.sql` | Onda B: `pessoas.senioridade`, `projetos.tipo`, `tasks.reopen_count` + trigger |
| `2026-05-10_heuristicas_onda_c.sql` | Onda C: `tasks.tipo_trabalho`, `tasks.tempo_real_horas`, tabela `task_dependencies` |

## `pending/` — aguardando execução

Patches escritos mas ainda **não rodados em produção**. Fluxo:

1. Criar `pending/<data>_<descricao>.sql` (ex: `2026-05-15_arquivamento.sql`)
2. Cabeçalho do SQL deve listar premissas (idempotência, dependências, rollback)
3. Rodar no SQL Editor do projeto
4. Confirmar OK
5. `git mv pending/<arquivo> applied/`
6. Commit

## Regras gerais

- **Idempotência sempre que possível** (`if not exists`, `drop ... if exists`).
- **Comentário no topo** explicando o quê e por quê.
- **Sem ALTER destrutivo sem rollback** — se for dropar coluna, anotar como reverter.
- Se um patch tem dependência (ex: precisa de outro rodado antes), comentar no topo.
