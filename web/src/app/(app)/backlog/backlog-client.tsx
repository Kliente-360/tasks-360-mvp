'use client';

import { useData, useClientesById, useProjetosById, usePessoasById } from '@/lib/data-store';

/**
 * Smoke screen do Bloco 2.1 — apenas valida que o DataProvider boota,
 * carrega tasks/clientes/projetos/pessoas, resolve nomes via Maps e
 * que realtime troca o array (mudou no banco → reflete aqui).
 * UI completa do Backlog vem no Bloco 2.2.
 */
export function BacklogSmoke() {
  const { tasks, clientes, projetos, pessoas, loading, error, refreshAll } = useData();
  const clientesById = useClientesById();
  const projetosById = useProjetosById();
  const pessoasById = usePessoasById();

  if (loading) return <div className="text-muted text-sm">Carregando…</div>;
  if (error) return <div className="text-[color:var(--danger)] text-sm">Erro: {error}</div>;

  const ativas = tasks.filter((t) => !t.arquivadoEm);

  return (
    <div className="space-y-4">
      <div className="page-bar hidden md:flex">
        <div className="page-bar-info">
          <span className="page-bar-narrative">
            Backlog (smoke 2.1)
            <span className="text-muted font-normal">
              {' · '}
              <strong className="text-ink">{ativas.length}</strong> tarefas ·{' '}
              {clientes.length} clientes · {projetos.length} projetos · {pessoas.length} pessoas
            </span>
          </span>
        </div>
        <div className="page-bar-controls">
          <button className="btn btn-ghost text-xs" onClick={() => refreshAll()}>
            ↻ recarregar
          </button>
        </div>
      </div>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Tarefa</th>
              <th>Cliente · Projeto</th>
              <th>Responsável</th>
              <th>Pri</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ativas.slice(0, 50).map((t) => {
              const cli = clientesById.get(t.clienteId);
              const proj = projetosById.get(t.projetoId);
              const pes = pessoasById.get(t.pessoaId);
              return (
                <tr key={t.id}>
                  <td>
                    <div className="tbl-title" title={t.titulo}>
                      {t.titulo}
                    </div>
                  </td>
                  <td>
                    <span className="tbl-cliproj">
                      {(cli?.nome ?? '—') + ' · ' + (proj?.nome ?? '—')}
                    </span>
                  </td>
                  <td className="text-ink-soft truncate">{pes?.nome ?? '—'}</td>
                  <td>
                    <span className={`pri pri-${t.prioridade}`}>
                      <span className="pri-dot" />
                      {t.prioridade}
                    </span>
                  </td>
                  <td>
                    <span className="status" data-s={t.status}>
                      <span className="status-dot" />
                      {t.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {ativas.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted text-sm">
                  Nenhuma task carregada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {ativas.length > 50 && (
        <div className="text-xs text-muted text-center">
          mostrando 50 de {ativas.length} · paginação vem no 2.2
        </div>
      )}
    </div>
  );
}
