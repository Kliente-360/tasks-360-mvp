/**
 * Helpers puros de task — portados de lib/helpers.js do app atual.
 * Operam sobre o tipo in-memory `Task` (camelCase, prazo ISO 'YYYY-MM-DD',
 * statusEm em epoch ms). Sem dependência de DOM, React ou Supabase.
 */

import type { Task } from './types';
import { STATUS, STAGE_RANK } from './task-constants';

/** Esforço efetivo: usa o declarado, ou 4h como fallback se zero/null. */
export function effEsforco(t: Pick<Task, 'esforco'>): number {
  const e = Number(t.esforco) || 0;
  return e > 0 ? e : 4;
}

/** Ocupação restante = horas ainda por trabalhar (piso 0). */
export function effOcupacao(t: Pick<Task, 'esforco' | 'tempoRealHoras'>): number {
  return Math.max(0, effEsforco(t) - (Number(t.tempoRealHoras) || 0));
}

/** Tamanho de task baseado no effEsforco. */
export function effTamanho(t: Pick<Task, 'esforco'>): string {
  const h = effEsforco(t);
  if (h < 2) return 'mini';
  if (h < 8) return 'small';
  if (h < 24) return 'medio';
  if (h < 80) return 'grande';
  return 'mini_projeto';
}

/** Task atrasada: tem prazo, não concluída, prazo < hoje. */
export function atrasada(t: Pick<Task, 'prazo' | 'status'>, today?: string): boolean {
  if (!t.prazo) return false;
  if (t.status === STATUS.CONCLUIDO) return false;
  const ref = today ?? new Date().toISOString().slice(0, 10);
  return t.prazo < ref;
}

/** Quantos dias de atraso (negativo = ainda no prazo). */
export function diasAtraso(t: Pick<Task, 'prazo'>): number {
  if (!t.prazo) return 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(t.prazo + 'T00:00:00');
  return Math.floor((hoje.getTime() - prazo.getTime()) / 86400000);
}

/** Dias parados na etapa atual. */
export function agingDays(t: Pick<Task, 'statusEm'>): number {
  if (!t.statusEm) return 0;
  return Math.floor((Date.now() - t.statusEm) / 86400000);
}

export type AgingLevel = 'fresh' | 'warn' | 'stale';

/** Limites por status pra sinalizar represa. */
export function agingLevel(t: Pick<Task, 'status' | 'statusEm'>): AgingLevel {
  if (!t || t.status === STATUS.CONCLUIDO) return 'fresh';
  const thr: Record<string, [number, number]> = {
    andamento: [7, 14],
    bloqueado: [3, 7],
    backlog: [30, 60],
  };
  const limits = thr[t.status];
  if (!limits) return 'fresh';
  const d = agingDays(t);
  if (d >= limits[1]) return 'stale';
  if (d >= limits[0]) return 'warn';
  return 'fresh';
}

/** Tempo na etapa atual em label curto ('hoje', 'há 1d', 'há Nd'). */
export function tempoNaEtapa(t: Pick<Task, 'statusEm'>): string {
  if (!t.statusEm) return '';
  const d = Math.floor((Date.now() - t.statusEm) / 86400000);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'há 1d';
  return `há ${d}d`;
}

/** Lista o que falta na task pra estar "triada". Vazio = ok. */
export function triageFailures(t: Pick<Task, 'status' | 'subetapa' | 'pessoaId' | 'clienteId' | 'prazo' | 'esforco'>): string[] {
  if (!t || t.status === STATUS.CONCLUIDO) return [];
  const rank = STAGE_RANK[t.subetapa] ?? 0;
  const out: string[] = [];
  if (!t.pessoaId) out.push('sem responsável');
  if (!t.clienteId) out.push('sem cliente');
  if (rank >= 2 && !t.prazo) out.push('sem prazo');
  if (rank >= 4 && !Number(t.esforco)) out.push('sem esforço');
  return out;
}

export function needsTriage(t: Parameters<typeof triageFailures>[0]): boolean {
  return triageFailures(t).length > 0;
}

/** Formata 'YYYY-MM-DD' como 'DD/MM/YYYY'. */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, m, da] = d.split('-');
  return `${da}/${m}/${y}`;
}

export function fmtDateShort(d: string | null | undefined): string {
  if (!d) return '—';
  const [, m, da] = d.split('-');
  return `${da}/${m}`;
}

export function lblStatus(s: string | undefined | null): string {
  return ({ backlog: 'Backlog', andamento: 'Em andamento', bloqueado: 'Bloqueado', concluido: 'Concluído' } as Record<string, string>)[s ?? ''] ?? (s ?? '');
}

export function lblComplex(c: string | undefined | null): string {
  return ({ alta: 'Alta', media: 'Média', baixa: 'Baixa' } as Record<string, string>)[c ?? ''] ?? 'Média';
}

/** Normaliza string pra slug curto (lowercase, hífen, máx 24 chars). */
export function normalizeTag(s: string): string {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24);
}

// ============ Janelas de prazo (filtros) ============

export type PrazoFilter = '' | 'atrasadas' | 'semana' | 'd7' | 'd15' | 'mes';

/** ISO 'YYYY-MM-DD' do dia local (não UTC). */
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Segunda e domingo da semana ISO em que cai a data. */
function weekRangeIso(iso: string): [string, string] {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay(); // 0 dom .. 6 sab
  const diffMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
}

/** Primeiro e último dia do mês em que cai a data. */
function monthRangeIso(iso: string): [string, string] {
  const d = new Date(iso + 'T00:00:00');
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = (x: Date) => {
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const da = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  };
  return [fmt(start), fmt(end)];
}

/** Testa se a task se encaixa na janela de prazo escolhida. */
export function matchesPrazoFilter(
  t: Pick<Task, 'prazo' | 'status'>,
  mode: PrazoFilter,
): boolean {
  if (!mode) return true;
  if (mode === 'atrasadas') return atrasada(t);
  if (!t.prazo) return false;
  const today = todayIso();
  if (mode === 'semana') {
    const [mon, sun] = weekRangeIso(today);
    return t.prazo >= mon && t.prazo <= sun;
  }
  if (mode === 'd7') return t.prazo >= today && t.prazo <= addDaysIso(today, 7);
  if (mode === 'd15') return t.prazo >= today && t.prazo <= addDaysIso(today, 15);
  if (mode === 'mes') {
    const [start, end] = monthRangeIso(today);
    return t.prazo >= start && t.prazo <= end;
  }
  return true;
}
