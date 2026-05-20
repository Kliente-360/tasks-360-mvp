/**
 * Helpers puros de task — portados de lib/helpers.js do app atual.
 * Sem dependência de DOM, React ou Supabase.
 */

import type { Task } from './db/schema';

/** Esforço efetivo: usa o declarado, ou 4h como fallback se zero/null. */
export function effEsforco(t: Pick<Task, 'esforco'>): number {
  const e = Number(t.esforco) || 0;
  return e > 0 ? e : 4;
}

/**
 * Ocupação restante = horas ainda por trabalhar.
 * Desconta tempoRealHoras do effEsforco, com piso 0.
 * Usar para cálculos de capacidade (nunca para sizing).
 */
export function effOcupacao(t: Pick<Task, 'esforco' | 'tempoRealHoras'>): number {
  return Math.max(0, effEsforco(t) - (Number(t.tempoRealHoras) || 0));
}

/** Tamanho da task baseado no effEsforco. */
export function effTamanho(t: Pick<Task, 'esforco'>): string {
  const h = effEsforco(t);
  if (h < 2)  return 'mini';
  if (h < 8)  return 'small';
  if (h < 24) return 'medio';
  if (h < 80) return 'grande';
  return 'mini_projeto';
}

/** Task atrasada: tem prazo, não concluída, prazo < hoje. */
export function isAtrasada(t: Pick<Task, 'prazo' | 'status'>, today?: string): boolean {
  if (!t.prazo) return false;
  if (t.status === 'concluido') return false;
  const ref = today ?? new Date().toISOString().slice(0, 10);
  return t.prazo < ref;
}
