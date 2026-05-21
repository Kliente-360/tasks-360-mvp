# tasks 360 — rebuild (Next.js)

App novo, em reconstrução. **Não substitui o app atual** — o app Alpine
single-file continua na raiz do repo (`../index.html` + `../lib/`),
buildando `main` no site Netlify original, intocado.

Este `web/` vive na branch `rebuild/next-app` e builda num site Netlify
**separado**. Os dois rodam em paralelo até o cutover.

## Stack

- **Next.js 15** (App Router, React 19) + **TypeScript** strict
- **Tailwind CSS** v3 — tokens da marca Kliente 360 em `globals.css`
- **Drizzle ORM** — schema em `src/lib/db/schema.ts`, conecta no mesmo Postgres do Supabase
- **Supabase** — mesmo projeto do app atual (Auth, Realtime, Postgres)
- shadcn/ui — alvo `src/components/ui/` (componentes adicionados sob demanda)

## Rodar local

```bash
cd web
cp .env.example .env.local   # preencher as 3 chaves
npm install
npm run dev                  # http://localhost:3000
```

## Env vars (`.env.local` + painel do site Netlify novo)

| var | o quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (mesmo do app atual) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (pública — RLS protege) |
| `DATABASE_URL` | connection string do Postgres pro Drizzle (server-only) |

## Deploy (site Netlify novo)

`../netlify.toml` (raiz, só nesta branch) já define `base = "web"` +
plugin Next. No painel do Netlify: criar site novo apontando pra este
repo, branch de produção `rebuild/next-app`, e configurar as env vars.

## Banco de dados

Mesmo Postgres do app atual. O schema Drizzle (`src/lib/db/schema.ts`)
é um **draft** portado de `../lib/adapters.js` — rodar `npm run db:pull`
com a `DATABASE_URL` real reconcilia com a verdade do banco.

⚠️ Enquanto o rebuild não tem CRUD, evitar escrita pelo app novo no
banco de produção. Leitura é segura.

## Status do rebuild

- [x] **Onda 0 — Fundação**: scaffold Next.js + TS + Tailwind + tokens,
      Drizzle, wiring Supabase (client/server/middleware), shell de
      navegação com as 10 abas (rotas prontas, conteúdo placeholder).
- [ ] **Onda 1 — MVP backlog interno**: auth + gating por role, CRUD de
      task/cliente/projeto/pessoa, Backlog, Kanban, Triagem, Calendário, Foco.
- [ ] **Onda 2 — Portal cliente**
- [ ] **Onda 3 — Analytics** (Dashboard, Briefing, Resumo Executivo PDF)
- [ ] **Onda 4 — Operação madura** (Adoção, heurísticas, notificações)
- [ ] **Onda 5+ — IA**

Roadmap detalhado: `../ROADMAP.md` §9.2.
