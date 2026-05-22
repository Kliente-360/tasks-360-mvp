# Plano de execução · Design Critique do Next

Plano salvo pra retomar quando for a hora. Baseado em [DESIGN_CRITIQUE_NEXT.md](DESIGN_CRITIQUE_NEXT.md).

## Decisões de processo (já alinhadas)

- **Timing**: Ondas A-B antes do cutover (Bloco 5), Ondas C-F depois.
- **Base branch**: `feat/onda-0` (é onde vive o Next deployado em `app.kliente360.com`).
- **Validação**: screenshots before/after capturados via Chrome MCP, colados no PR. Sem Playwright visual regression.
- **Workflow**: 1 PR por wave, squash-merge, bump `APP_VERSION` (lib/helpers.js + web/src/components/app-nav.tsx).

## Estado atual

- Wave A começou (branch `feat/critique-wave-a` criada, edições aplicadas em globals.css, task-utils.ts, foco-client.tsx, kanban-client.tsx, backlog-client.tsx, app-nav.tsx, lib/helpers.js).
- Edições **descartadas** ao trocar pra `fix/parity-backlog-modal`. Nada commitado, branch deletada.
- Lint passou (exit 0). Vitest 44/44 passou.

## Pra retomar Wave A do zero

```bash
cd "/Users/felipegonzaga/Library/Mobile Documents/com~apple~CloudDocs/Kliente 360/antigravity/tasks-360-migracao"
git checkout feat/onda-0 && git pull origin feat/onda-0
git checkout -b feat/critique-wave-a
```

### Wave A · Foundations · Escopo

**1. Status pills · 3 níveis · `web/src/app/globals.css:307-322`**

Tirar o tratamento "vivid" de `[data-s="andamento"]` (não tem fundo tinto, não tem borda verde, só dot colorido). Manter `.aging-warn` / `.aging-stale` / `.triage-chip` como o tratamento "action-required". Diff:

```css
/* ANTES */
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); }
.status[data-s="andamento"] .status-dot { background: var(--brand); }
.status[data-s="andamento"] { border-color: var(--brand); color: var(--brand-dark); background: var(--brand-tint); }
.status[data-s="bloqueado"] .status-dot { background: var(--p0); }
.status[data-s="bloqueado"] { color: var(--p0); border-color: color-mix(in srgb, var(--p0) 30%, transparent); }
.status[data-s="concluido"] .status-dot { background: var(--p3); }
.status[data-s="concluido"] { color: var(--muted); }
.status[data-s="backlog"] .status-dot { background: var(--muted); }
.status[data-s="backlog"] { color: var(--ink-soft); border-color: var(--line-strong); }

/* DEPOIS */
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); }
.status[data-s="andamento"] .status-dot { background: var(--brand); }
.status[data-s="bloqueado"] .status-dot { background: var(--p0); }
.status[data-s="concluido"] .status-dot { background: var(--p3); }
.status[data-s="concluido"] { color: var(--muted); }
.status[data-s="backlog"] .status-dot { background: var(--muted); }
```

**2. Helpers novos · `web/src/lib/task-utils.ts`**

Adicionar após `tempoNaEtapa`:

```ts
/** Linguagem natural pra "tempo numa etapa/status": hoje · 1 dia · N dias. */
export function fmtTempoEtapa(ts?: number | null): string {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return 'hoje';
  if (d === 1) return '1 dia';
  return `${d} dias`;
}

/** Label de atraso em linguagem natural: 'Xd atrasada' (sem o '+'). */
export function fmtAtrasoLabel(dias: number): string {
  if (dias <= 0) return '';
  if (dias === 1) return '1 dia atrasada';
  return `${dias} dias atrasada`;
}
```

E refatorar `tempoNaEtapa` pra `return fmtTempoEtapa(t.statusEm);` (mantém retrocompat).

**3. Mono discipline · 4 arquivos**

- `web/src/app/(app)/foco/foco-client.tsx:338` — `{items.length} item(s)` em mono → sans com pluralização (`1 task` / `N tasks`).
- `web/src/app/(app)/foco/foco-client.tsx:360-363` — rodapé "tarefas concluídas e não atribuídas…" tirar mono.
- `web/src/app/(app)/foco/foco-client.tsx:434-437` — prazo display: mono só na data, sufixo `· {fmtAtrasoLabel}` em sans. Importar `fmtAtrasoLabel`.
- `web/src/app/(app)/kanban/kanban-client.tsx:218-225` — substituir `tempoNaSubetapa` por `fmtTempoEtapa(t.subetapaEm || t.statusEm)`. Importar `fmtTempoEtapa`.
- `web/src/app/(app)/kanban/kanban-client.tsx:375, 418` — `<div className="text-[10px] text-muted font-mono">` → tirar `font-mono`.
- `web/src/app/(app)/backlog/backlog-client.tsx:1054-1057` — substituir IIFE inline por `fmtTempoEtapa(t.statusEm)`. Importar.
- `web/src/app/(app)/backlog/backlog-client.tsx:1166-1168` — `text-[10px] font-mono text-muted` → tirar `font-mono`.

**Manter mono em**: timestamps (`.cmsg-when`, `.tmodal-history-item .when`), contadores numéricos (`.tmodal-tab .count`), data de calendário (`.cal-day-num`, `.cal-num`, `.cal-head`), version (`V1.02.x`), labels uppercase de KPI cards.

**4. Bump APP_VERSION → `v1.02.163`** em:
- `lib/helpers.js:18`
- `web/src/components/app-nav.tsx:16`

**5. Validar**

```bash
cd web
npm run lint        # passou na rodada anterior
npm run typecheck
npm test            # 44/44 passou na rodada anterior
npm run build
npm run test:e2e
```

**6. Screenshots AFTER** (já tem BEFOREs salvos em IDs `ss_7031pztwu` [Foco], `ss_1617yc8i4` [Kanban], `ss_6882vcj9a` [Backlog] mas pode recapturar). Subir `npm run dev` na porta 3100, capturar via Chrome MCP, mesma viewport.

**7. Commit message sugerida**

```
feat(web/design): wave A · mono discipline + status pills neutros · v1.02.163

- status pills perdem o tratamento "vivid" do em-andamento (só dot
  colorido sinaliza). Action-required fica reservado pra aging-warn/
  stale e triage-chip.
- mono sai de strings em linguagem natural (item(s), nesta etapa,
  rodapés explicativos). Permanece em timestamps, contadores, datas,
  versão e KPI labels.
- copy: '+Xd' vira 'Xd atrasada'; tempoNaEtapa retorna '1 dia' / 'N
  dias' em vez de 'há 1d' / 'há Nd'.
- helpers novos: fmtTempoEtapa, fmtAtrasoLabel em task-utils.ts.
```

## Próximas waves (não iniciadas)

### Pré-cutover

**Wave B · Filtros + Métricas + Empty states**
- §1.1 Hierarquia cards de métrica (contexto vs risco)
- §1.2 `<FilterChips>` componente: chips de filtros ativos + botão limpar + contador
- §1.6 Empty states com voz opinativa
- Telas tocadas: backlog, foco, kanban, calendário

### Pós-cutover

**Wave C · Triagem rebuild** — cards compactos · chips → inline inputs · bulk actions · smart-case dos títulos UPPERCASE.

**Wave D · Kanban + Calendário** — sticky macro headers · colunas vazias colapsam · aging chip nos cards · "hoje" acentuado no calendário · concluídas com cor neutra (sem sumir).

**Wave E · Modal refinement** — prioridade vira chip-picker · `Interno/Cliente` vira segmented · contador no checklist colapsado · arquivar/excluir movem pra menu `⋯` do header.

**Wave F · Polish + Mobile** — AppNav slim (esconder parking tabs) · Foco prazo cleanup · FAB mobile · a11y audit · mobile real audit em iPhone.

## Referência cruzada

- Crítica detalhada item-a-item: [DESIGN_CRITIQUE_NEXT.md](DESIGN_CRITIQUE_NEXT.md)
- Auditoria de paridade original (em buckets, agora deprecated em favor da crítica forward-looking): [DESIGN_REVIEW_ONDA0.md](DESIGN_REVIEW_ONDA0.md)
