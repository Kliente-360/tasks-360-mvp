# Onda 0 — Plano de migração de stack

> Documento de referência para a sessão dedicada à migração.
> Captura todas as decisões arquiteturais tomadas antes de começar a implementar.
> Atualizar conforme novas decisões surgirem.

---

## Objetivo

Migrar o app Alpine.js (`index.html` + `lib/`) para Next.js 15 + Drizzle + Supabase,
**mantendo funcionalidade e UX 100% idênticas ao app atual.**
Sem melhorias, sem novas features — apenas trocar a fundação.

Os ganhos reais da migração:
- TypeScript (pega bugs antes de chegar ao usuário)
- Drizzle (queries tipadas, sem SQL inline em componente)
- Componentes reutilizáveis (não sustenta 2+ devs em single-file)
- Melhor bundling e Vercel edge
- Base pra escalar

---

## Decisão central: arquitetura híbrida

**Não é "tudo em Server Component".** O app tem duas categorias de tela bem distintas:

### Categoria A — Server Component + Server Actions

Telas read-heavy, baixa interatividade, mutações simples (formulários).

| Tela | Razão |
|---|---|
| Cadastros (clientes, projetos, pessoas) | Listas com arquivar/editar — já implementado |
| Rotas de auth (login, magic link) | Sem estado reativo |

Padrão: `page.tsx` como Server Component, busca dados com Drizzle diretamente,
mutações via Server Actions com `revalidatePath`.

### Categoria B — Client Component com Supabase JS

Telas com filtros instantâneos, realtime, drag-and-drop, modais com autosave.
**Essas telas replicam o padrão do Alpine: dados carregados no boot, filtros em memória.**

| Tela | Interatividade que exige client |
|---|---|
| Backlog | Filtros encadeados, sort multi-coluna, bulk actions, DnD manual, realtime |
| Kanban | DnD entre colunas, filtros, realtime |
| Modal de task | Autosave debounced, thread de comentários, checklist |
| Triagem | Filtros, bulk triage |
| Meu Foco | Filtros por pessoa, grupos dinâmicos |
| Calendário | Navegação de mês, click em dia, mini-modal |
| Command Palette | Estado local, busca fuzzy em memória |

Padrão: `page.tsx` é um shell Server Component leve (só metadata/layout),
o componente pesado abaixo é `'use client'` e carrega dados via Supabase JS client,
igual ao app Alpine hoje.

---

## Por que não Server Actions nas telas interativas

O usuário já sentiu a latência no Cadastros. Para telas como Backlog:

- Cada clique em filtro = round-trip ao servidor = UX degradada
- Sort/filtro em memória no Alpine é instantâneo — perder isso é regressão
- Realtime via Supabase JS não funciona em Server Components
- Autosave debounced (800ms) precisa de estado local no cliente

Regra prática: **se a tela tem mais de 1 interação por segundo em uso normal, é Client Component.**

---

## Padrão de dados para Client Components

O Alpine carrega tudo no boot e filtra client-side. Manter esse padrão:

```typescript
// Em Client Components pesados (Backlog, Kanban, etc.)
// Supabase JS client — mesmo que o Alpine usa hoje
import { createClient } from '@/lib/supabase/client'

// Boot: carrega tasks + clientes + projetos + pessoas
// Filtra/ordena em memória com os mesmos helpers de lib/helpers.js
// Realtime: assina canal tasks e aplica delta local (igual ao Alpine)
```

Os helpers de `lib/helpers.js` já estão em `web/src/lib/task-utils.ts` (portados).
`effEsforco`, `triageFailures`, `bucketTasksByWeek`, etc. — mesma lógica, só TypeScript.

---

## Realtime

Manter o padrão atual: Supabase Realtime no cliente.

```typescript
// web/src/lib/supabase/client.ts — singleton do browser client
// Cada Client Component pesado assina o canal tasks
// Aplica delta (INSERT/UPDATE/DELETE) no estado local — não refetch completo
```

Não usar Server-Sent Events nem polling — o Supabase Realtime já resolve.

---

## Estrutura de arquivos target

```
web/src/
├── app/
│   ├── (app)/
│   │   ├── backlog/
│   │   │   ├── page.tsx          ← Server Component: só shell + metadata
│   │   │   └── backlog-client.tsx ← 'use client': toda lógica
│   │   ├── kanban/
│   │   │   ├── page.tsx
│   │   │   └── kanban-client.tsx
│   │   ├── cadastros/
│   │   │   └── page.tsx          ← Server Component puro (já feito)
│   │   └── ...
│   └── (auth)/
│       ├── login/page.tsx
│       └── callback/route.ts
├── components/
│   ├── task-modal.tsx             ← 'use client', reutilizado em todas as abas
│   ├── app-nav.tsx               ← já feito
│   └── ...
├── lib/
│   ├── db/                        ← Drizzle (só server-side)
│   ├── supabase/
│   │   ├── client.ts              ← browser client (singleton)
│   │   └── server.ts              ← server client (Server Components/Actions)
│   ├── task-utils.ts              ← helpers portados de lib/helpers.js
│   └── nav.ts                     ← já feito
```

---

## Auth

Usar Supabase Auth — igual ao app atual.

- Login: email + magic link (mesmo fluxo)
- Google OAuth para internos (já existe no app atual)
- `(auth)/login/page.tsx` como Server Component simples
- Middleware Next.js (`middleware.ts`) verifica sessão e redireciona

RLS:
- **Role cliente**: RLS apertada no Postgres (não confiar só no front)
- **Roles admin/interno**: gating no front (igual ao app atual) — Onda 0 não apertará RLS pra internos

---

## Schema Drizzle

O `web/src/lib/db/schema.ts` atual é um draft. Antes de implementar as telas:

1. Rodar `npm run db:pull` (dentro de `web/`) com `DATABASE_URL` real no `.env.local`
2. Isso sobrescreve o schema com a estrutura real do banco
3. Ajustar tipos TypeScript conforme necessário

Tabelas ainda não modeladas (do banco real):
- `task_field_history`
- `task_dependencies`
- `task_attachments`
- `notifications`
- `comments`

---

## O que NÃO fazer nesta onda

- **Não melhorar UX** — idêntico ao atual, validar depois
- **Não adicionar shadcn/ui ainda** — usar CSS puro portado de `lib/styles.css` (já feito)
- **Não instalar Recharts** — os charts do Dashboard são Onda 3
- **Não apertar RLS de admin/interno** — Onda posterior
- **Não implementar features novas** — zero features novas

---

## Ordem de implementação sugerida

### Bloco 1 — Pré-requisitos (fazer antes de qualquer tela)
1. `db:pull` pra alinhar schema com banco real
2. `lib/supabase/client.ts` + `lib/supabase/server.ts`
3. Middleware de auth (`middleware.ts`)
4. Rota de login (`(auth)/login/`)

### Bloco 2 — Telas Onda 1 (Client Components)
5. Backlog (maior + mais complexo — bom pra validar o padrão)
6. Modal de task (reutilizado em todas as abas)
7. Kanban
8. Triagem
9. Meu Foco
10. Calendário

### Bloco 3 — Cadastros completo (Server Component)
11. Modais de criação/edição de cliente, projeto, pessoa

### Bloco 4 — Polimento
12. Command Palette
13. PWA manifest
14. Testes básicos

---

## Estado atual (antes da sessão dedicada)

| Item | Status |
|---|---|
| Design system completo (`globals.css`) | ✅ portado de `lib/styles.css` |
| Fontes IBM Plex Sans + Mono | ✅ |
| Tailwind config com todos os tokens | ✅ |
| `AppNav` idêntica ao app atual | ✅ |
| Cadastros (leitura + arquivar) | ✅ Server Component |
| Schema Drizzle (draft) | ⚠️ precisa `db:pull` |
| `lib/supabase/client.ts` | ❌ |
| `lib/supabase/server.ts` | ❌ |
| Middleware de auth | ❌ |
| Login page | ❌ |
| Backlog, Kanban, Modal, Triagem, Foco, Calendário | ❌ |
| Cadastros — modais criar/editar | ❌ |
