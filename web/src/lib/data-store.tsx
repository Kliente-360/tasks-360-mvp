'use client';

/**
 * Store de dados do app — equivalente em React do padrão Alpine:
 * boot carrega tasks+clientes+projetos+pessoas, realtime aplica delta
 * em tasks (e refetch debounced em clientes/projetos/pessoas), e
 * expõe helpers de mutação local + lookups (nomeCliente etc).
 *
 * Cada tela client (Backlog, Kanban, Modal…) consome via useData().
 * Uma única instância por sessão — Provider montado em (app)/layout.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from './supabase/client';
import { TASK_LIGHT_COLS, clienteFromDb, pessoaFromDb, projetoFromDb, taskFromDb } from './adapters';
import type { Cliente, Pessoa, Projeto, Task } from './types';

/** Janela de tasks concluídas trazidas no boot (resto vem sob demanda). */
const TASKS_CONCLUIDAS_WINDOW_DAYS = 60;

interface DataState {
  tasks: Task[];
  clientes: Cliente[];
  projetos: Projeto[];
  pessoas: Pessoa[];
  loading: boolean;
  error: string | null;
}

interface DataActions {
  /** Refetch completo (botão "recarregar" / fallback). */
  refreshAll: () => Promise<void>;
  /** Mutações locais — escritas no banco continuam via supabase client direto. */
  patchTask: (id: string, changes: Partial<Task>) => Task | null;
  patchTasks: (ids: string[], changes: Partial<Task>) => void;
  replaceTask: (id: string, task: Task) => void;
  upsertTask: (task: Task) => void;
  removeTask: (id: string) => Task | null;
  removeTasks: (ids: string[]) => void;
}

type DataContextValue = DataState & DataActions;

const DataContext = createContext<DataContextValue | null>(null);

function cutoffIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - TASKS_CONCLUIDAS_WINDOW_DAYS);
  return d.toISOString();
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  // supabase é um singleton estável por sessão. createClient() do @supabase/ssr
  // já reaproveita conexão; manter ref evita re-criar a cada render.
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!sbRef.current) sbRef.current = createClient();
  const sb = sbRef.current;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs pros refetch debounced — coalescem rajadas de realtime numa única query.
  const refetchTimers = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});

  const refreshTasks = useCallback(async () => {
    const cutoff = cutoffIso();
    const { data, error } = await sb
      .from('tasks')
      .select(TASK_LIGHT_COLS)
      .or(`status.neq.concluido,status_em.gte.${cutoff}`)
      .order('criado_em', { ascending: false });
    if (error) return;
    setTasks((data ?? []).map(taskFromDb));
  }, [sb]);

  const refreshClientes = useCallback(async () => {
    const { data, error } = await sb
      .from('clientes')
      .select('id,nome,tier,eh_interno,arquivado_em,dominios')
      .order('nome');
    if (error) return;
    setClientes((data ?? []).map(clienteFromDb));
  }, [sb]);

  const refreshProjetos = useCallback(async () => {
    const { data, error } = await sb
      .from('projetos')
      .select('id,nome,cliente_id,sla_resposta_horas,sla_entrega_dias,orcamento_horas,tipo,arquivado_em')
      .order('nome');
    if (error) return;
    setProjetos((data ?? []).map(projetoFromDb));
  }, [sb]);

  const refreshPessoas = useCallback(async () => {
    const { data, error } = await sb
      .from('pessoas')
      .select('id,nome,email,user_id,invited_at,role,cliente_id,cliente_principal_id,cliente_secundario_id,capacidade_horas_semana,skills,senioridade,is_ceo')
      .order('nome');
    if (error) return;
    setPessoas((data ?? []).map(pessoaFromDb));
  }, [sb]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([refreshClientes(), refreshProjetos(), refreshPessoas(), refreshTasks()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refreshClientes, refreshProjetos, refreshPessoas, refreshTasks]);

  const scheduleRefetch = useCallback(
    (which: 'tasks' | 'clientes' | 'projetos' | 'pessoas') => {
      const t = refetchTimers.current;
      if (t[which]) clearTimeout(t[which]!);
      const fn = {
        tasks: refreshTasks,
        clientes: refreshClientes,
        projetos: refreshProjetos,
        pessoas: refreshPessoas,
      }[which];
      t[which] = setTimeout(() => {
        fn();
      }, 1200);
    },
    [refreshTasks, refreshClientes, refreshProjetos, refreshPessoas],
  );

  // Boot inicial.
  useEffect(() => {
    const timers = refetchTimers.current;
    refreshAll();
    // Realtime: aplica delta direto em tasks; refetch debounced no resto.
    const channel = sb
      .channel('kliente360-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          const ev = (payload as { eventType: string }).eventType;
          if (ev === 'DELETE') {
            const id = (payload as { old?: { id?: string } }).old?.id;
            if (id) {
              setTasks((cur) => cur.filter((t) => t.id !== id));
            }
            return;
          }
          const row = (payload as { new?: Record<string, unknown> }).new;
          if (!row || !row.id) {
            scheduleRefetch('tasks');
            return;
          }
          const next = taskFromDb(row);
          setTasks((cur) => {
            const i = cur.findIndex((t) => t.id === next.id);
            if (i >= 0) {
              const out = cur.slice();
              out[i] = next;
              return out;
            }
            return [next, ...cur];
          });
        },
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => scheduleRefetch('clientes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projetos' }, () => scheduleRefetch('projetos'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pessoas' }, () => scheduleRefetch('pessoas'))
      .subscribe();

    return () => {
      sb.removeChannel(channel);
      Object.keys(timers).forEach((k) => timers[k] && clearTimeout(timers[k]!));
    };
  }, [sb, refreshAll, scheduleRefetch]);

  // Mutações locais (optimistic). Mesma semântica dos helpers Alpine.
  const patchTask = useCallback<DataActions['patchTask']>((id, changes) => {
    let prev: Task | null = null;
    setTasks((cur) => {
      const i = cur.findIndex((t) => t.id === id);
      if (i < 0) return cur;
      prev = cur[i];
      const out = cur.slice();
      out[i] = { ...prev, ...changes };
      return out;
    });
    return prev;
  }, []);

  const patchTasks = useCallback<DataActions['patchTasks']>((ids, changes) => {
    const set = new Set(ids);
    setTasks((cur) => cur.map((t) => (set.has(t.id) ? { ...t, ...changes } : t)));
  }, []);

  const replaceTask = useCallback<DataActions['replaceTask']>((id, task) => {
    setTasks((cur) => {
      const i = cur.findIndex((t) => t.id === id);
      if (i < 0) return cur;
      const out = cur.slice();
      out[i] = task;
      return out;
    });
  }, []);

  const upsertTask = useCallback<DataActions['upsertTask']>((task) => {
    setTasks((cur) => {
      const i = cur.findIndex((t) => t.id === task.id);
      if (i >= 0) {
        const out = cur.slice();
        out[i] = task;
        return out;
      }
      return [task, ...cur];
    });
  }, []);

  const removeTask = useCallback<DataActions['removeTask']>((id) => {
    let removed: Task | null = null;
    setTasks((cur) => {
      const i = cur.findIndex((t) => t.id === id);
      if (i < 0) return cur;
      removed = cur[i];
      return cur.filter((t) => t.id !== id);
    });
    return removed;
  }, []);

  const removeTasks = useCallback<DataActions['removeTasks']>((ids) => {
    const set = new Set(ids);
    setTasks((cur) => cur.filter((t) => !set.has(t.id)));
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      tasks,
      clientes,
      projetos,
      pessoas,
      loading,
      error,
      refreshAll,
      patchTask,
      patchTasks,
      replaceTask,
      upsertTask,
      removeTask,
      removeTasks,
    }),
    [tasks, clientes, projetos, pessoas, loading, error, refreshAll, patchTask, patchTasks, replaceTask, upsertTask, removeTask, removeTasks],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData precisa estar dentro de <DataProvider>');
  return ctx;
}

// ===================== Lookups & índices =====================
// Hooks finos pra evitar reconstruir Maps a cada render quando só o
// consumidor mudou. Memos baseados em referência do array — qualquer
// mutação via helpers acima troca a ref, então o memo invalida.

export function useClientesById(): Map<string, Cliente> {
  const { clientes } = useData();
  return useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
}

export function useProjetosById(): Map<string, Projeto> {
  const { projetos } = useData();
  return useMemo(() => new Map(projetos.map((p) => [p.id, p])), [projetos]);
}

export function usePessoasById(): Map<string, Pessoa> {
  const { pessoas } = useData();
  return useMemo(() => new Map(pessoas.map((p) => [p.id, p])), [pessoas]);
}

export function useTasksById(): Map<string, Task> {
  const { tasks } = useData();
  return useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
}

export function useProjetosByCliente(): Map<string, Projeto[]> {
  const { projetos } = useData();
  return useMemo(() => {
    const m = new Map<string, Projeto[]>();
    for (const p of projetos) {
      if (!p.clienteId) continue;
      let arr = m.get(p.clienteId);
      if (!arr) {
        arr = [];
        m.set(p.clienteId, arr);
      }
      arr.push(p);
    }
    return m;
  }, [projetos]);
}
