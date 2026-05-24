'use client';

/**
 * Dashboard · cockpit operacional — Onda 1 · feat/dashboard-briefing
 *
 * Bloco 1 · KPI cards (throughput W-1, abertas, atrasadas, projetos em risco)
 * Bloco 2 · Banner de heurísticas (H1–H15)
 * Bloco 3 · Semáforo de projetos
 * Bloco 4 · Heatmap capacidade pessoa × semana W0–W3
 * Bloco 5 · Throughput 8 semanas (barra CSS)
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useData,
  useClientesById,
  usePessoasById,
  useProjetosById,
} from '@/lib/data-store';
import { cn } from '@/lib/utils';
import { atrasada } from '@/lib/task-utils';
import {
  computeHeuristicAlerts,
  computeWeeklyCapacityAnalysis,
  computeProjetosSaude,
  computeThroughput,
  type HeuristicAlert,
  type WeekData,
} from '@/lib/heuristics';

// ─────────────────────────────────────────────────────────
//  Helpers visuais
// ─────────────────────────────────────────────────────────

function severityColor(s: string) {
  if (s === 'alta') return 'text-[var(--danger)] bg-[var(--p0-soft)] border-[var(--p0)]';
  if (s === 'media') return 'text-[var(--warn)] bg-[var(--p1-soft)] border-[var(--p1)]';
  return 'text-[var(--muted)] bg-[var(--surface-3)] border-[var(--line)]';
}

function heatmapColor(nivel: string) {
  if (nivel === 'sobrecarga') return 'bg-[var(--p0-soft)] text-[var(--p0)] font-semibold';
  if (nivel === 'pressao') return 'bg-[var(--p1-soft)] text-[var(--warn)] font-semibold';
  if (nivel === 'ok') return 'bg-[var(--brand-tint)] text-[var(--brand-dark)]';
  if (nivel === 'folga') return 'bg-[var(--surface-3)] text-[var(--muted)]';
  return 'bg-[var(--surface-3)] text-[var(--muted)]';
}

function sinalDot(sinal: string) {
  if (sinal === 'vermelho') return 'bg-[var(--danger)]';
  if (sinal === 'amarelo') return 'bg-[var(--warn)]';
  return 'bg-[var(--brand)]';
}

// ─────────────────────────────────────────────────────────
//  Componentes auxiliares
// ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  delta,
  deltaSign,
  sub,
  danger,
}: {
  label: string;
  value: number | string;
  delta?: string;
  deltaSign?: 'up' | 'down' | 'neutral';
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-elev border border-line rounded-xl p-4 flex flex-col gap-1 min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</div>
      <div
        className={cn(
          'text-3xl font-semibold tabular-nums leading-none mt-1',
          danger && Number(value) > 0 ? 'text-[var(--danger)]' : 'text-[var(--ink)]',
        )}
      >
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            'text-xs mt-0.5',
            deltaSign === 'up' ? 'text-[var(--brand)]' : deltaSign === 'down' ? 'text-[var(--danger)]' : 'text-muted',
          )}
        >
          {deltaSign === 'up' ? '▲' : deltaSign === 'down' ? '▼' : '●'} {delta}
        </div>
      )}
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function HeuristicRow({ alert, expanded }: { alert: HeuristicAlert; expanded: boolean }) {
  return (
    <div
      className={cn(
        'border rounded-lg px-3 py-2.5 text-sm',
        severityColor(alert.severity),
      )}
    >
      <div className="flex items-start gap-2">
        <span className="shrink-0 text-xs font-bold uppercase mt-0.5 opacity-70">
          {alert.severity === 'alta' ? '●' : '○'}
        </span>
        <div className="min-w-0">
          <div className="font-medium leading-snug">{alert.titulo}</div>
          {expanded && alert.detalhe && (
            <div className="text-xs opacity-80 mt-0.5">{alert.detalhe}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Dashboard principal
// ─────────────────────────────────────────────────────────

export function DashboardClient() {
  const { tasks, clientes, projetos, pessoas, loading, refreshing } = useData();
  const clientesById = useClientesById();
  const pessoasById = usePessoasById();
  const projetosById = useProjetosById();
  const router = useRouter();

  const [filterCliente, setFilterCliente] = useState('');
  const [filterPessoa, setFilterPessoa] = useState('');
  const [filterProjeto, setFilterProjeto] = useState('');
  const [heurExpanded, setHeurExpanded] = useState(false);
  const [heurFilter, setHeurFilter] = useState<'' | 'alta' | 'media'>('');

  // Tasks filtradas (excluindo arquivadas)
  const baseTasks = useMemo(
    () => tasks.filter((t) => !t.arquivadoEm),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    return baseTasks.filter((t) => {
      if (filterCliente && t.clienteId !== filterCliente) return false;
      if (filterPessoa && t.pessoaId !== filterPessoa) return false;
      if (filterProjeto && t.projetoId !== filterProjeto) return false;
      return true;
    });
  }, [baseTasks, filterCliente, filterPessoa, filterProjeto]);

  // Throughput W-1 vs W-2 pra delta
  const throughput = useMemo(() => computeThroughput(baseTasks), [baseTasks]);
  const throughputW1 = throughput[throughput.length - 2]?.count ?? 0;
  const throughputW2 = throughput[throughput.length - 3]?.count ?? 0;
  const throughputDelta = throughputW1 - throughputW2;

  // KPIs
  const abertas = useMemo(
    () => filteredTasks.filter((t) => t.status !== 'concluido'),
    [filteredTasks],
  );
  const atrasadas = useMemo(
    () => abertas.filter((t) => atrasada(t)),
    [abertas],
  );

  // Projetos em risco (semáforo vermelho/amarelo)
  const projetosSaude = useMemo(
    () => computeProjetosSaude(filteredTasks, projetos, clientes),
    [filteredTasks, projetos, clientes],
  );
  const projsEmRisco = projetosSaude.filter((p) => p.sinal !== 'verde').length;

  // Heurísticas (usa tasks sem filtro de pessoa/cliente pra não perder alertas)
  const heuristicAlerts = useMemo(
    () => computeHeuristicAlerts(baseTasks, clientes, projetos, pessoas),
    [baseTasks, clientes, projetos, pessoas],
  );
  const alertsToShow = heurFilter
    ? heuristicAlerts.filter((a) => a.severity === heurFilter)
    : heuristicAlerts;
  const countAlta = heuristicAlerts.filter((a) => a.severity === 'alta').length;
  const countMedia = heuristicAlerts.filter((a) => a.severity === 'media').length;

  // Capacidade semanal (portfólio completo — não filtrado)
  const wca = useMemo(
    () => computeWeeklyCapacityAnalysis(baseTasks, clientes, projetos, pessoas),
    [baseTasks, clientes, projetos, pessoas],
  );

  // Selects de filtro
  const clientesAtivos = useMemo(
    () => clientes.filter((c) => !c.arquivadoEm && !c.ehInterno).sort((a, b) => a.nome.localeCompare(b.nome)),
    [clientes],
  );
  const pessoasAtivas = useMemo(
    () => pessoas.filter((p) => p.role !== 'cliente').sort((a, b) => a.nome.localeCompare(b.nome)),
    [pessoas],
  );
  const projetosAtivos = useMemo(
    () =>
      projetos
        .filter((p) => {
          if (p.arquivadoEm) return false;
          if (filterCliente && p.clienteId !== filterCliente) return false;
          return true;
        })
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [projetos, filterCliente],
  );

  const weekLabels = ['Esta sem.', 'Próx. sem.', 'Em 2 sem.', 'Em 3 sem.'];
  const maxThroughput = Math.max(...throughput.map((w) => w.count), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted text-sm">
        Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--ink)]">Dashboard</h1>
          <p className="text-xs text-muted mt-0.5">
            {refreshing ? 'Atualizando…' : 'Cockpit operacional · dados ao vivo'}
          </p>
        </div>
        <a
          href="/briefing"
          className="text-xs text-[var(--brand)] hover:underline font-medium self-start sm:self-auto"
        >
          Ver Briefing executivo →
        </a>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterCliente}
          onChange={(e) => { setFilterCliente(e.target.value); setFilterProjeto(''); }}
          className="text-sm border border-line rounded-lg px-3 py-1.5 bg-elev text-ink focus:outline-none focus:border-[var(--cyan)] min-w-[140px]"
        >
          <option value="">Todos clientes</option>
          {clientesAtivos.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <select
          value={filterPessoa}
          onChange={(e) => setFilterPessoa(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-1.5 bg-elev text-ink focus:outline-none focus:border-[var(--cyan)] min-w-[140px]"
        >
          <option value="">Todas pessoas</option>
          {pessoasAtivas.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
        <select
          value={filterProjeto}
          onChange={(e) => setFilterProjeto(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-1.5 bg-elev text-ink focus:outline-none focus:border-[var(--cyan)] min-w-[140px]"
        >
          <option value="">Todos projetos</option>
          {projetosAtivos.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
        {(filterCliente || filterPessoa || filterProjeto) && (
          <button
            onClick={() => { setFilterCliente(''); setFilterPessoa(''); setFilterProjeto(''); }}
            className="text-xs text-muted hover:text-ink underline px-1"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── Bloco 1 · KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Throughput W-1"
          value={throughputW1}
          delta={
            throughputDelta !== 0
              ? `${Math.abs(throughputDelta)} vs W-2`
              : 'igual a W-2'
          }
          deltaSign={throughputDelta > 0 ? 'up' : throughputDelta < 0 ? 'down' : 'neutral'}
          sub="tasks concluídas"
        />
        <KpiCard
          label="Tasks abertas"
          value={abertas.length}
          sub={filterCliente || filterPessoa || filterProjeto ? 'no filtro' : 'total ativas'}
        />
        <KpiCard
          label="Atrasadas"
          value={atrasadas.length}
          sub="com prazo vencido"
          danger
        />
        <KpiCard
          label="Projetos em atenção"
          value={projsEmRisco}
          sub="vermelho ou âmbar"
          danger={projsEmRisco > 0}
        />
      </div>

      {/* ── Bloco 2 · Heurísticas ── */}
      <div className="bg-elev border border-line rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">Alertas operacionais</h2>
            {countAlta > 0 && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--p0-soft)] text-[var(--danger)]">
                {countAlta} crítico{countAlta > 1 ? 's' : ''}
              </span>
            )}
            {countMedia > 0 && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--p1-soft)] text-[var(--warn)]">
                {countMedia} atenção
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(['', 'alta', 'media'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setHeurFilter(f)}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded border transition-colors',
                    heurFilter === f
                      ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-dark)] font-medium'
                      : 'border-line text-muted hover:border-[var(--line-strong)]',
                  )}
                >
                  {f === '' ? 'Todos' : f === 'alta' ? 'Críticos' : 'Atenção'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setHeurExpanded((v) => !v)}
              className="text-xs text-muted hover:text-ink"
            >
              {heurExpanded ? 'Menos ▴' : 'Detalhes ▾'}
            </button>
          </div>
        </div>

        {alertsToShow.length === 0 ? (
          <div className="text-sm text-muted py-2">
            {heuristicAlerts.length === 0 ? '✓ Nenhum alerta no momento' : 'Nenhum alerta nesta categoria'}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {alertsToShow.map((a, i) => (
              <HeuristicRow key={i} alert={a} expanded={heurExpanded} />
            ))}
          </div>
        )}
      </div>

      {/* ── Bloco 3 · Semáforo de projetos ── */}
      <div className="bg-elev border border-line rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-ink">Saúde por projeto</h2>
        </div>
        {projetosSaude.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted">
            Nenhum projeto ativo no filtro
          </div>
        ) : (
          <div className="divide-y divide-line">
            {projetosSaude.map((ps) => (
              <div
                key={ps.projetoId}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-3)] transition-colors"
              >
                <span
                  className={cn('shrink-0 w-2.5 h-2.5 rounded-full', sinalDot(ps.sinal))}
                  title={ps.sinal}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">{ps.nome}</div>
                  <div className="text-xs text-muted truncate">{ps.nomeCliente}</div>
                </div>
                <div className="text-xs text-muted shrink-0 hidden sm:block">{ps.motivo}</div>
                <div className="text-xs text-muted shrink-0 tabular-nums">
                  {ps.nAbertas} abertas
                  {ps.nAtrasadas > 0 && (
                    <span className="text-[var(--danger)] ml-1">· {ps.nAtrasadas} atras.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bloco 4 · Heatmap capacidade ── */}
      <div className="bg-elev border border-line rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Capacidade por pessoa · 4 semanas</h2>
          <div className="flex items-center gap-3 text-[10px] text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[var(--p0-soft)] inline-block" /> Sobrecarga
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[var(--p1-soft)] inline-block" /> Pressão
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[var(--brand-tint)] inline-block" /> OK
            </span>
          </div>
        </div>
        {wca.pessoas.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted">Nenhum dado de capacidade</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[400px] px-4 py-3">
              {/* Header */}
              <div
                className="grid gap-1.5 mb-2"
                style={{ gridTemplateColumns: '120px repeat(4, 1fr)' }}
              >
                <div />
                {weekLabels.map((l) => (
                  <div key={l} className="text-center text-[10px] text-muted font-medium uppercase tracking-wide">
                    {l}
                  </div>
                ))}
              </div>
              {/* Rows */}
              <div className="space-y-1.5">
                {wca.pessoas.map((p) => (
                  <div
                    key={p.pessoaId}
                    className="grid gap-1.5 items-center"
                    style={{ gridTemplateColumns: '120px repeat(4, 1fr)' }}
                  >
                    <div
                      className="text-xs text-ink font-medium truncate pr-2"
                      title={p.nome}
                    >
                      {p.nome.split(' ')[0]}
                      {p.nome.split(' ').length > 1 ? ` ${p.nome.split(' ')[1][0]}.` : ''}
                    </div>
                    {p.weeks.map((wk, i) => (
                      <div
                        key={i}
                        className={cn(
                          'text-center text-xs py-1.5 rounded-md font-mono',
                          heatmapColor(wk.nivel),
                        )}
                        title={`${wk.hours}h`}
                      >
                        {wk.pctCap != null ? `${wk.pctCap}%` : '—'}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {wca.pessoas.some((p) => p.capacidade === 0) && (
                <p className="text-[10px] text-muted mt-2">
                  * Sem capacidade cadastrada → % não calculado
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bloco 5 · Throughput ── */}
      <div className="bg-elev border border-line rounded-xl p-4">
        <h2 className="text-sm font-semibold text-ink mb-4">Throughput semanal · últimas 8 semanas</h2>
        <div className="flex items-end gap-1.5 h-28">
          {throughput.map((week, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[10px] text-muted tabular-nums">{week.count}</div>
              <div
                className={cn(
                  'w-full rounded-t-sm transition-all',
                  week.isCurrent ? 'bg-[var(--brand)]' : 'bg-[var(--brand-soft)]',
                )}
                style={{
                  height: `${Math.max(3, (week.count / maxThroughput) * 72)}px`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-1">
          {throughput.map((week, i) => (
            <div key={i} className="flex-1 text-center text-[9px] text-muted truncate">
              {week.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
