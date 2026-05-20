'use client';

/**
 * Triagem — Onda 0 · Bloco 2.5
 *
 * Lista de tasks que precisam de triagem (sem responsável/cliente/prazo/
 * esforço conforme STAGE_RANK). Filtros chip-toggle (sem resp / sem prazo
 * / sem esforço / origem IA). Bulk: responsável, prazo, esforço.
 *
 * Reusa:
 *   - triageFailures (lib/task-utils)
 *   - useData() + useTaskModal()
 *   - .triage-chip / .triage-filter-chip (já em globals.css)
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useData } from '@/lib/data-store';
import { useTaskModal } from '@/components/task-modal';
import { createClient } from '@/lib/supabase/client';
import { agingDays, triageFailures } from '@/lib/task-utils';
import { STATUS, SUB_LABELS } from '@/lib/task-constants';
import type { Task } from '@/lib/types';

const NONE = '__none__';

type TriagemFilter = {
  semResp: boolean;
  semPrazo: boolean;
  semEsforco: boolean;
  origem: '' | 'ia' | 'humano';
};

type BulkPending = {
  pessoa: string;
  prazo: string;
  esforco: string;
};

const DEFAULT_FILTER: TriagemFilter = {
  semResp: false,
  semPrazo: false,
  semEsforco: false,
  origem: '',
};

const DEFAULT_BULK: BulkPending = { pessoa: '', prazo: '', esforco: '' };

export function TriagemClient() {
  const { tasks, pessoas, patchTasks, loading, error } = useData();
  const { openEdit } = useTaskModal();

  const sbRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!sbRef.current) sbRef.current = createClient();
  const sb = sbRef.current;

  const [filter, setFilter] = useState<TriagemFilter>(DEFAULT_FILTER);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPending, setBulkPending] = useState<BulkPending>(DEFAULT_BULK);

  const pessoasNaoCliente = useMemo(
    () => pessoas.filter((p) => p.role !== 'cliente'),
    [pessoas],
  );

  // ===== triagemTasks: visíveis não-concluídas com falhas, ordenadas =====
  type TaskWithFailures = Task & { _failures: string[]; _failCount: number };
  const triagemTasks = useMemo<TaskWithFailures[]>(() => {
    const out: TaskWithFailures[] = [];
    for (const t of tasks) {
      if (t.arquivadoEm) continue;
      if (t.status === STATUS.CONCLUIDO) continue;
      const failures = triageFailures(t);
      if (!failures.length) continue;
      out.push({ ...t, _failures: failures, _failCount: failures.length });
    }
    out.sort((a, b) => b._failCount - a._failCount || (a.criadoEm || 0) - (b.criadoEm || 0));
    return out;
  }, [tasks]);

  const filtered = useMemo(() => {
    return triagemTasks.filter((t) => {
      if (filter.semResp && !t._failures.includes('sem responsável')) return false;
      if (filter.semPrazo && !t._failures.includes('sem prazo')) return false;
      if (filter.semEsforco && !t._failures.includes('sem esforço')) return false;
      if (filter.origem === 'ia' && !t.criadoPorIa) return false;
      if (filter.origem === 'humano' && t.criadoPorIa) return false;
      return true;
    });
  }, [triagemTasks, filter]);

  const anyFilter = filter.semResp || filter.semPrazo || filter.semEsforco || !!filter.origem;

  // Contadores nos chips (todas as triagemTasks, independente dos filtros)
  const counts = useMemo(
    () => ({
      semResp: triagemTasks.filter((t) => !t.pessoaId).length,
      semPrazo: triagemTasks.filter((t) => !t.prazo).length,
      semEsforco: triagemTasks.filter((t) => !Number(t.esforco)).length,
      ia: triagemTasks.filter((t) => t.criadoPorIa).length,
    }),
    [triagemTasks],
  );

  // ===== Bulk =====
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setBulkPending(DEFAULT_BULK);
  }, []);

  const bulkSave = useCallback(async () => {
    const p = bulkPending;
    const ids = [...selectedIds];
    if (!ids.length) return;
    const updates: Record<string, unknown> = {};
    const localPatch: Partial<Task> = {};
    if (p.pessoa) {
      updates.pessoa_id = p.pessoa === NONE ? null : p.pessoa;
      localPatch.pessoaId = p.pessoa === NONE ? '' : p.pessoa;
    }
    if (p.prazo) {
      updates.prazo = p.prazo;
      localPatch.prazo = p.prazo;
    }
    if (p.esforco !== '') {
      const num = Number(p.esforco);
      if (!(num >= 0)) {
        alert('Esforço inválido.');
        return;
      }
      updates.esforco = num;
      localPatch.esforco = num;
    }
    if (Object.keys(updates).length === 0) return;
    const { error } = await sb.from('tasks').update(updates).in('id', ids);
    if (error) {
      alert('Erro: ' + error.message);
      return;
    }
    patchTasks(ids, localPatch);
    setBulkPending(DEFAULT_BULK);
  }, [bulkPending, selectedIds, sb, patchTasks]);

  if (loading) return <div className="text-muted text-sm">Carregando…</div>;
  if (error) return <div className="text-[color:var(--danger)] text-sm">Erro: {error}</div>;

  return (
    <div className="max-w-[1100px] mx-auto space-y-4 md:space-y-5">
      {/* Desktop page bar */}
      {triagemTasks.length > 0 && (
        <div className="page-bar hidden md:flex">
          <div className="page-bar-info">
            <span className="page-bar-narrative">
              <strong>{filtered.length}</strong>
              {anyFilter && (
                <span className="text-muted font-normal"> / {triagemTasks.length}</span>
              )}{' '}
              tarefa{filtered.length !== 1 ? 's' : ''} pra triar
            </span>
          </div>
          <div className="page-bar-controls">
            <FilterChip
              active={filter.semResp}
              onClick={() => setFilter({ ...filter, semResp: !filter.semResp })}
              count={counts.semResp}
              label="sem resp."
            />
            <FilterChip
              active={filter.semPrazo}
              onClick={() => setFilter({ ...filter, semPrazo: !filter.semPrazo })}
              count={counts.semPrazo}
              label="sem prazo"
            />
            <FilterChip
              active={filter.semEsforco}
              onClick={() => setFilter({ ...filter, semEsforco: !filter.semEsforco })}
              count={counts.semEsforco}
              label="sem esforço"
            />
            <FilterChip
              active={filter.origem === 'ia'}
              onClick={() =>
                setFilter({ ...filter, origem: filter.origem === 'ia' ? '' : 'ia' })
              }
              count={counts.ia}
              label="🤖 criadas por IA"
              title="Filtra só tasks criadas por automação IA (Cowork etc)."
            />
          </div>
        </div>
      )}

      {/* Mobile chips */}
      {triagemTasks.length > 0 && (
        <div className="flex items-center gap-1.5 md:hidden flex-wrap">
          <FilterChip
            active={filter.semResp}
            onClick={() => setFilter({ ...filter, semResp: !filter.semResp })}
            count={counts.semResp}
            label="sem resp."
            mobile
          />
          <FilterChip
            active={filter.semPrazo}
            onClick={() => setFilter({ ...filter, semPrazo: !filter.semPrazo })}
            count={counts.semPrazo}
            label="sem prazo"
            mobile
          />
          <FilterChip
            active={filter.semEsforco}
            onClick={() => setFilter({ ...filter, semEsforco: !filter.semEsforco })}
            count={counts.semEsforco}
            label="sem esforço"
            mobile
          />
          <FilterChip
            active={filter.origem === 'ia'}
            onClick={() =>
              setFilter({ ...filter, origem: filter.origem === 'ia' ? '' : 'ia' })
            }
            count={counts.ia}
            label="🤖 IA"
            mobile
          />
        </div>
      )}

      {/* Empty states */}
      {triagemTasks.length === 0 && (
        <div className="card p-8 md:p-10 text-center">
          <div className="font-brand text-lg text-ink mb-2">Nenhuma tarefa em triagem</div>
          <div className="text-sm text-muted">
            Toda task tem responsável, cliente e — onde aplica — prazo e esforço.
          </div>
        </div>
      )}
      {triagemTasks.length > 0 && filtered.length === 0 && (
        <div className="card p-6 text-center text-sm text-muted italic">
          Nenhuma task casa com os filtros ativos.
        </div>
      )}

      {/* Cards */}
      {filtered.map((t) => {
        const sel = selectedIds.includes(t.id);
        return (
          <div
            key={t.id}
            className={`card p-3 md:p-5 cursor-pointer hover:border-line-strong transition-colors ${sel ? 'bg-brand-tint' : ''}`}
            onClick={() => openEdit(t.id)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 flex items-center gap-3">
                <input
                  type="checkbox"
                  className="shrink-0"
                  checked={sel}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelect(t.id);
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap mb-1">
                    {t.prioridade && (
                      <span className={`pri pri-${t.prioridade}`}>
                        <span className="pri-dot" />
                        {t.prioridade}
                      </span>
                    )}
                    {t.privada && (
                      <span className="ia-chip ia-chip-mini" title="Task privada">
                        🔒
                      </span>
                    )}
                    {t.criadoPorIa && (
                      <span className="ia-chip ia-chip-mini" title="Criada por automação IA">
                        🤖 IA
                      </span>
                    )}
                    <span className="font-medium text-ink break-words">{t.titulo}</span>
                  </div>
                  <div className="text-xs text-muted font-mono break-words">
                    {SUB_LABELS[t.subetapa] ?? t.subetapa}
                    {/* Aging baseado em criadoEm (com cast pra reusar agingDays). */}
                    {t.criadoEm > 0 && (
                      <>
                        {' · criada há '}
                        {agingDays({ statusEm: t.criadoEm })}d
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="hidden md:flex flex-wrap gap-1 shrink-0 justify-end max-w-[55%]">
                {t._failures.map((f) => (
                  <span key={f} className="triage-chip">
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2 pl-7 md:hidden">
              {t._failures.map((f) => (
                <span key={f} className="triage-chip">
                  {f}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      {/* Bulk bar */}
      {selectedIds.length > 0 && (
        <div
          className="fixed z-[55] shadow-xl left-3 right-3 rounded-lg p-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:p-2 md:px-3 md:max-w-[calc(100vw-24px)]"
          style={{
            bottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
            background: 'var(--surface-1)',
            border: '1px solid var(--line)',
            borderTop: '3px solid var(--brand)',
          }}
        >
          <div className="flex items-center justify-between md:justify-start gap-2">
            <span className="text-sm md:text-xs font-mono text-muted">
              <strong className="text-ink">{selectedIds.length}</strong> selecionada
              {selectedIds.length !== 1 ? 's' : ''}
            </span>
            <div className="hidden md:block w-px h-4 mx-1 bg-line" />
            <button className="btn btn-ghost text-xs md:hidden" onClick={clearSelection}>
              ✕ limpar
            </button>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2 md:mt-0 md:ml-2">
            <select
              className="inp text-sm md:text-xs py-2 md:py-1.5 w-full md:w-[120px]"
              value={bulkPending.pessoa}
              onChange={(e) => setBulkPending({ ...bulkPending, pessoa: e.target.value })}
              title="Responsável"
            >
              <option value="">responsável…</option>
              <option value={NONE}>— nenhum —</option>
              {pessoasNaoCliente.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="inp text-sm md:text-xs py-2 md:py-1.5 w-full md:w-[110px]"
              value={bulkPending.prazo}
              onChange={(e) => setBulkPending({ ...bulkPending, prazo: e.target.value })}
              title="Prazo"
            />
            <input
              type="number"
              min={0}
              step={1}
              placeholder="esforço (h)"
              className="inp text-sm md:text-xs py-2 md:py-1.5 w-full md:w-[110px]"
              value={bulkPending.esforco}
              onChange={(e) => setBulkPending({ ...bulkPending, esforco: e.target.value })}
              title="Esforço em horas"
            />
            <div className="flex gap-2 md:contents">
              <button
                className="btn btn-primary text-sm md:text-xs py-2 md:py-1.5 px-3 md:px-2 flex-1 md:flex-none justify-center"
                onClick={bulkSave}
                disabled={!(bulkPending.pessoa || bulkPending.prazo || bulkPending.esforco !== '')}
              >
                salvar
              </button>
              <div className="hidden md:block w-px h-4 mx-1 bg-line" />
              <button
                className="btn btn-ghost text-sm md:text-xs py-2 md:py-1.5 px-3 md:px-2 hidden md:inline-flex"
                onClick={clearSelection}
              >
                limpar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  count,
  label,
  mobile,
  title,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  label: string;
  mobile?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`triage-filter-chip ${active ? 'is-on' : ''} ${mobile ? 'flex-1 justify-center' : ''}`}
      onClick={onClick}
      title={title}
    >
      <strong>{count}</strong>&nbsp;{label}
    </button>
  );
}
