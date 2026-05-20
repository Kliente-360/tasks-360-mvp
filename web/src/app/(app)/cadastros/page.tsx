import Link from 'next/link';
import { eq, isNull, count } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { cn } from '@/lib/utils';
import { arquivarCliente, desarquivarCliente, arquivarProjeto, desarquivarProjeto } from './actions';

type Tab = 'clientes' | 'projetos' | 'pessoas';

export default async function CadastrosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; arquivados?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = (sp.tab as Tab) || 'clientes';
  const showArquivados = sp.arquivados === '1';

  // ── Contadores globais ──────────────────────────────────────────────
  const [[{ total: totalClientes }], [{ total: totalProjetos }], [{ total: totalPessoas }]] =
    await Promise.all([
      db.select({ total: count() }).from(schema.clientes).where(isNull(schema.clientes.arquivadoEm)),
      db.select({ total: count() }).from(schema.projetos).where(isNull(schema.projetos.arquivadoEm)),
      db.select({ total: count() }).from(schema.pessoas),
    ]);

  // ── Dados da aba ativa ──────────────────────────────────────────────
  const clientes =
    tab === 'clientes'
      ? await db.query.clientes.findMany({ orderBy: (c, { asc }) => [asc(c.nome)] })
      : [];

  const projetos =
    tab === 'projetos'
      ? await db.query.projetos.findMany({ orderBy: (p, { asc }) => [asc(p.nome)] })
      : [];

  const pessoas =
    tab === 'pessoas'
      ? await db.query.pessoas.findMany({ orderBy: (p, { asc }) => [asc(p.nome)] })
      : [];

  // Contadores de tasks por cliente/projeto/pessoa
  const taskCountRows = await db
    .select({ ref: schema.tasks.clienteId, n: count() })
    .from(schema.tasks)
    .where(isNull(schema.tasks.arquivadoEm))
    .groupBy(schema.tasks.clienteId);
  const tasksByCliente = new Map(taskCountRows.map((r) => [r.ref, r.n]));

  const tasksByProjetoRows = await db
    .select({ ref: schema.tasks.projetoId, n: count() })
    .from(schema.tasks)
    .where(isNull(schema.tasks.arquivadoEm))
    .groupBy(schema.tasks.projetoId);
  const tasksByProjeto = new Map(tasksByProjetoRows.map((r) => [r.ref, r.n]));

  const projetosByClienteRows = await db
    .select({ ref: schema.projetos.clienteId, n: count() })
    .from(schema.projetos)
    .where(isNull(schema.projetos.arquivadoEm))
    .groupBy(schema.projetos.clienteId);
  const projetosByCliente = new Map(projetosByClienteRows.map((r) => [r.ref, r.n]));

  const clienteById = new Map(clientes.map((c) => [c.id, c.nome]));
  const allClientes = tab === 'projetos'
    ? await db.query.clientes.findMany({ columns: { id: true, nome: true } })
    : clientes;
  const clienteNameById = new Map(allClientes.map((c) => [c.id, c.nome]));

  const clientesSemDominio = clientes.filter(
    (c) => !c.ehInterno && !c.arquivadoEm && (!c.dominios || c.dominios.length === 0),
  );

  const TAB_HREF = (t: Tab, a?: boolean) =>
    `/cadastros?tab=${t}${a ? '&arquivados=1' : ''}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* ── Page bar ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted">
          <strong className="text-ink">{totalClientes}</strong> clientes ·{' '}
          <strong className="text-ink">{totalProjetos}</strong> projetos ·{' '}
          <strong className="text-ink">{totalPessoas}</strong> pessoas
          {tab === 'clientes' && clientesSemDominio.length > 0 && (
            <span className="ml-2 font-mono text-[11px] text-amber-700">
              · <strong>{clientesSemDominio.length}</strong> sem domínio
            </span>
          )}
        </p>

        <div className="flex items-center gap-2">
          {/* Sub-tabs */}
          <div className="flex rounded-md border border-line overflow-hidden text-sm">
            {(['clientes', 'projetos', 'pessoas'] as Tab[]).map((t) => (
              <Link
                key={t}
                href={TAB_HREF(t, showArquivados)}
                className={cn(
                  'px-3 py-1.5 capitalize transition-colors',
                  tab === t
                    ? 'bg-brand-tint font-semibold text-brand-dark'
                    : 'text-ink-soft hover:bg-brand-tint',
                )}
              >
                {t}
              </Link>
            ))}
          </div>

          {/* Toggle arquivados (só clientes/projetos) */}
          {tab !== 'pessoas' && (
            <Link
              href={TAB_HREF(tab, !showArquivados)}
              className={cn(
                'text-xs px-2 py-1.5 rounded border transition-colors',
                showArquivados
                  ? 'border-brand text-brand-dark bg-brand-tint'
                  : 'border-line text-muted hover:border-line-strong',
              )}
            >
              arquivados
            </Link>
          )}
        </div>
      </div>

      {/* ── Clientes ─────────────────────────────────────────── */}
      {tab === 'clientes' && (
        <div className="rounded-xl border border-line bg-bg-elev divide-y divide-line">
          {clientes
            .filter((c) => showArquivados || !c.arquivadoEm)
            .map((c) => (
              <div
                key={c.id}
                className={cn(
                  'flex items-center justify-between gap-3 flex-wrap px-4 py-3',
                  c.arquivadoEm && 'opacity-60',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-brand-soft flex items-center justify-center text-sm font-bold text-brand shrink-0">
                    {c.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap text-sm font-medium">
                      <span>{c.nome}</span>
                      <Chip
                        show={c.tier === 'estrategico'}
                        label="estratégico"
                        className="bg-brand-soft text-brand-dark"
                      />
                      <Chip
                        show={c.tier === 'potencial'}
                        label="potencial"
                        className="bg-yellow-50 text-yellow-700 border border-yellow-200"
                      />
                      <Chip
                        show={c.tier === 'descoberta'}
                        label="descoberta"
                        className="bg-bg-elev text-muted border border-line"
                      />
                      <Chip
                        show={!!c.arquivadoEm}
                        label="arquivado"
                        className="bg-bg-elev text-muted border border-line"
                      />
                      <Chip
                        show={!!c.ehInterno}
                        label="interno"
                        className="bg-slate-100 text-slate-600"
                      />
                      {!c.ehInterno && !c.arquivadoEm && (!c.dominios || c.dominios.length === 0) && (
                        <span className="chip border border-yellow-300 bg-yellow-50 text-amber-700">
                          sem domínio
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      {tasksByCliente.get(c.id) ?? 0} tarefas ·{' '}
                      {projetosByCliente.get(c.id) ?? 0} projetos
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {!c.arquivadoEm && !c.ehInterno && (
                    <form action={arquivarCliente.bind(null, c.id)}>
                      <button className="btn-ghost-sm">arquivar</button>
                    </form>
                  )}
                  {c.arquivadoEm && (
                    <form action={desarquivarCliente.bind(null, c.id)}>
                      <button className="btn-ghost-sm">desarquivar</button>
                    </form>
                  )}
                  <button className="btn-ghost-sm opacity-40 cursor-not-allowed" disabled title="Edição em breve">
                    editar
                  </button>
                </div>
              </div>
            ))}
          {clientes.filter((c) => showArquivados || !c.arquivadoEm).length === 0 && (
            <EmptyState label="Nenhum cliente cadastrado." />
          )}
        </div>
      )}

      {/* ── Projetos ─────────────────────────────────────────── */}
      {tab === 'projetos' && (
        <div className="rounded-xl border border-line bg-bg-elev divide-y divide-line">
          {projetos
            .filter((p) => showArquivados || !p.arquivadoEm)
            .map((p) => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center justify-between gap-3 flex-wrap px-4 py-3',
                  p.arquivadoEm && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap text-sm font-medium">
                    <span>{p.nome}</span>
                    <Chip show={!!p.tipo} label={p.tipo ?? ''} className="bg-bg-elev text-muted border border-line" />
                    {p.slaEntregaDias && (
                      <Chip show label={`SLA ${p.slaEntregaDias}d`} className="bg-bg-elev text-muted border border-line" />
                    )}
                    {p.orcamentoHoras && (
                      <Chip show label={`${p.orcamentoHoras}h`} className="bg-bg-elev text-muted border border-line" />
                    )}
                    <Chip show={!!p.arquivadoEm} label="arquivado" className="bg-bg-elev text-muted border border-line" />
                  </div>
                  <p className="text-xs text-muted">
                    {clienteNameById.get(p.clienteId ?? '') ?? '—'} ·{' '}
                    {tasksByProjeto.get(p.id) ?? 0} tarefas
                  </p>
                </div>
                <div className="flex gap-1">
                  {!p.arquivadoEm && (
                    <form action={arquivarProjeto.bind(null, p.id)}>
                      <button className="btn-ghost-sm">arquivar</button>
                    </form>
                  )}
                  {p.arquivadoEm && (
                    <form action={desarquivarProjeto.bind(null, p.id)}>
                      <button className="btn-ghost-sm">desarquivar</button>
                    </form>
                  )}
                  <button className="btn-ghost-sm opacity-40 cursor-not-allowed" disabled title="Edição em breve">
                    editar
                  </button>
                </div>
              </div>
            ))}
          {projetos.filter((p) => showArquivados || !p.arquivadoEm).length === 0 && (
            <EmptyState label="Nenhum projeto cadastrado." />
          )}
        </div>
      )}

      {/* ── Pessoas ──────────────────────────────────────────── */}
      {tab === 'pessoas' && (
        <div className="rounded-xl border border-line bg-bg-elev divide-y divide-line">
          {pessoas.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 flex-wrap px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-brand-soft flex items-center justify-center text-sm font-bold text-brand shrink-0">
                  {p.nome.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap text-sm font-medium">
                    <span>{p.nome}</span>
                    <Chip show={p.role === 'admin'} label="admin" className="bg-brand-soft text-brand-dark" />
                    <Chip show={p.role === 'cliente'} label="cliente externo" className="bg-yellow-50 text-yellow-700 border border-yellow-200" />
                    {p.senioridade && p.role !== 'cliente' && (
                      <Chip show label={p.senioridade} className="bg-bg-elev text-muted border border-line" />
                    )}
                    <Chip
                      show={!!p.invitedAt && !!p.userId}
                      label="acesso ativo"
                      className="bg-brand-soft text-brand-dark"
                    />
                    <Chip
                      show={!!p.invitedAt && !p.userId}
                      label="aguardando 1º login"
                      className="bg-yellow-50 text-yellow-700 border border-yellow-200"
                    />
                    <Chip
                      show={!p.invitedAt && !!p.email}
                      label="inativa"
                      className="bg-bg-elev text-muted border border-line"
                    />
                  </div>
                  <p className="text-xs text-muted font-mono truncate">
                    {p.email ?? '—'}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost-sm opacity-40 cursor-not-allowed" disabled title="Edição em breve">
                  editar
                </button>
              </div>
            </div>
          ))}
          {pessoas.length === 0 && <EmptyState label="Nenhuma pessoa cadastrada." />}
        </div>
      )}
    </div>
  );
}

function Chip({ show, label, className }: { show: boolean; label: string; className: string }) {
  if (!show) return null;
  return (
    <span className={cn('chip', className)}>{label}</span>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-10 text-center text-sm italic text-muted">{label}</p>;
}
