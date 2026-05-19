/* ============ tasks 360 · Backlog + Kanban + Bulk actions ============
 * Filtros do backlog, sort, group, view kanban + bulk actions (multi-select).
 *
 * Dependências em app() (permanecem lá):
 *   - this.tasks, this.f (filters), this.sortKey, this.sortDir
 *   - this.selectedIds, this.showArchivedTasks
 *   - this.tab, this.tasksById, this.SUBS_FLAT
 *
 * Dependências em window:
 *   - sb, STATUS, ROLE
 * ====================================================================
 */

(function () {
  'use strict';

  function makeBacklogKanbanView() {
    return {
      // ===================== BACKLOG (filtros + sort) =====================
      get projetosFiltrados() {
        if (!this.f.cliente) return this.projetos;
        return this.projetosByCliente.get(this.f.cliente) || [];
      },
      // Base pra qualquer view que NUNCA deve mostrar arquivadas
      // (Kanban, Foco, Triagem, Calendário, Dashboard, Heurísticas, Briefing, Portal).
      // Backlog respeita o toggle showArchivedTasks separadamente em `filtered`.
      get _visibleTasks() {
        return this.tasks.filter(t => !t.arquivadoEm);
      },
      // Assinatura dos filtros/sort do Backlog — chave de memo pra filtered
      // e groupedFiltered. Combina _tasksSig (mudança nas tasks) + estado de
      // filtro/sort. Sem isto, filtered (filter+sort de TODAS as tasks) era
      // recalculado a cada tick reativo do Alpine.
      get _backlogFilterSig() {
        const f = this.f;
        return this._tasksSig + '|' + this.showArchivedTasks + '|' + JSON.stringify(this.sortKeys) +
          '|' + f.q + '|' + f.cliente + '|' + f.projeto + '|' + f.pessoa + '|' + f.pri +
          '|' + f.complexidade + '|' + f.status + '|' + f.tag + '|' + f.origem;
      },
      get filtered() {
        return this._memo('filtered', this._backlogFilterSig, () => this._computeFiltered());
      },
      _computeFiltered() {
        const f = this.f;
        const q = (f.q || '').toLowerCase().trim();
        const base = this.showArchivedTasks ? this.tasks : this._visibleTasks;
        let arr = base.filter(t => {
          if (q && !(t.titulo + ' ' + (t.descricao||'')).toLowerCase().includes(q)) return false;
          // Sentinel '__empty__' = filtrar onde o campo está vazio/null.
          if (f.cliente === '__empty__') { if (t.clienteId) return false; }
          else if (f.cliente && t.clienteId !== f.cliente) return false;
          if (f.projeto === '__empty__') { if (t.projetoId) return false; }
          else if (f.projeto && t.projetoId !== f.projeto) return false;
          if (f.pessoa === '__empty__') { if (t.pessoaId) return false; }
          else if (f.pessoa && t.pessoaId !== f.pessoa) return false;
          if (f.status === 'abertas') { if (t.status === STATUS.CONCLUIDO) return false; }
          else if (f.status && t.status !== f.status) return false;
          if (f.pri === '__empty__') { if (t.prioridade) return false; }
          else if (f.pri && t.prioridade !== f.pri) return false;
          if (f.complexidade === '__empty__') { if (t.complexidade) return false; }
          else if (f.complexidade && (t.complexidade||'media') !== f.complexidade) return false;
          if (f.tag === '__empty__') { if ((t.tags || []).length) return false; }
          else if (f.tag && !(t.tags || []).includes(f.tag)) return false;
          if (f.origem === 'ia'     && !t.criadoPorIa) return false;
          if (f.origem === 'humano' &&  t.criadoPorIa) return false;
          return true;
        });
        if (this.sortKeys[0]?.key === 'manual') {
          // tarefas com ordem definida vêm primeiro (asc); resto cai no fim por criadoEm desc
          arr.sort((a, b) => {
            const ao = a.ordem, bo = b.ordem;
            if (ao != null && bo != null) return ao - bo;
            if (ao != null) return -1;
            if (bo != null) return 1;
            return (b.criadoEm || 0) - (a.criadoEm || 0);
          });
          return arr;
        }
        // Resolve valor comparável para uma chave de sort
        const resolveVal = (t, k) => {
          let v = t[k];
          if (k === 'clienteId')  v = this.nomeCliente(v);
          if (k === 'projetoId')  v = this.nomeProjeto(v);
          if (k === 'pessoaId')   v = this.nomePessoa(v);
          if (k === 'status')     { const o={andamento:0,bloqueado:1,backlog:2,concluido:3}; v = o[v] ?? 99; }
          if (k === 'subetapa')   { const o=Object.fromEntries(this.SUBS_FLAT.map((s,i)=>[s,i])); v = o[v] ?? 99; }
          if (k === 'prioridade') v = v ? +v.slice(1) : 99;
          if (k === 'complexidade') { const o={alta:0,media:1,baixa:2}; v = o[v] ?? 1; }
          return v == null ? '' : v;
        };
        arr.sort((a, b) => {
          for (const { key, dir } of this.sortKeys) {
            const mul = dir === 'asc' ? 1 : -1;
            const av = resolveVal(a, key), bv = resolveVal(b, key);
            if (av < bv) return -mul;
            if (av > bv) return  mul;
          }
          return 0;
        });
        return arr;
      },
      // Limite de linhas renderizadas por grupo (pagination simples no
      // backlog). Bumpa em _LIST_LIMIT_STEP via loadMoreBacklog().
      _listLimit: 100,
      _LIST_LIMIT_STEP: 100,
      loadMoreBacklog() { this._listLimit += this._LIST_LIMIT_STEP; },
  
      // Agrupamento de 1 nível. Retorna sempre array de grupos; se groupBy
      // estiver vazio, devolve um único grupo "todas" sem header.
      // Cada grupo é truncado em this._listLimit (mostra "carregar mais"
      // quando excede). Evita renderizar 500+ rows de uma vez.
      get groupedFiltered() {
        return this._memo(
          'groupedFiltered',
          this._backlogFilterSig + '|' + this.groupBy + '|' + this._listLimit,
          () => this._computeGroupedFiltered(),
        );
      },
      _computeGroupedFiltered() {
        const lim = this._listLimit;
        const trim = (tasks) => {
          const total = tasks.length;
          if (total <= lim) return { tasks, tasksTotal: total, hasMore: false };
          return { tasks: tasks.slice(0, lim), tasksTotal: total, hasMore: true };
        };
        const arr = this.filtered;
        if (!this.groupBy) return [{ key: '__all__', label: '', isAll: true, ...trim(arr) }];
        const map = new Map();
        for (const t of arr) {
          let key, label;
          switch (this.groupBy) {
            case 'pessoa':       key = t.pessoaId  || '__none__'; label = t.pessoaId  ? this.nomePessoa(t.pessoaId)   : 'sem responsável'; break;
            case 'cliente':      key = t.clienteId || '__none__'; label = t.clienteId ? this.nomeCliente(t.clienteId) : '— sem cliente';   break;
            case 'projeto':      key = t.projetoId || '__none__'; label = t.projetoId ? this.nomeProjeto(t.projetoId) : '— sem projeto';   break;
            case 'status':       key = t.status;                  label = this.lblStatus(t.status);                   break;
            case 'subetapa':     key = t.subetapa;                label = this.lblSub(t.subetapa);                    break;
            case 'prioridade':   key = t.prioridade;              label = t.prioridade;                                break;
            case 'complexidade': key = t.complexidade || 'media'; label = this.lblComplex(t.complexidade);            break;
            default:             key = '__all__';                 label = '';                                          break;
          }
          if (!map.has(key)) map.set(key, { key, label, tasks: [] });
          map.get(key).tasks.push(t);
        }
        // Aplica trim por grupo
        const groups = Array.from(map.values()).map(g => ({ ...g, ...trim(g.tasks) }));
        // Ordenação dos grupos por tipo
        if (this.groupBy === 'prioridade') {
          const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
          groups.sort((a, b) => (order[a.key] ?? 9) - (order[b.key] ?? 9));
        } else if (this.groupBy === 'status') {
          const order = { andamento: 0, bloqueado: 1, backlog: 2, concluido: 3 };
          groups.sort((a, b) => (order[a.key] ?? 9) - (order[b.key] ?? 9));
        } else if (this.groupBy === 'subetapa') {
          const order = Object.fromEntries(this.SUBS_FLAT.map((s, i) => [s, i]));
          groups.sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99));
        } else if (this.groupBy === 'complexidade') {
          const order = { alta: 0, media: 1, baixa: 2 };
          groups.sort((a, b) => (order[a.key] ?? 9) - (order[b.key] ?? 9));
        } else {
          groups.sort((a, b) => {
            if (a.key === '__none__') return 1;
            if (b.key === '__none__') return -1;
            return (a.label || '').localeCompare(b.label || '');
          });
        }
        return groups;
      },
      toggleGroup(key) {
        const i = this.collapsedGroups.indexOf(key);
        if (i >= 0) this.collapsedGroups.splice(i, 1);
        else this.collapsedGroups.push(key);
      },
      collapseAllGroups() {
        this.collapsedGroups = this.groupedFiltered.map(g => g.key);
      },
      expandAllGroups() {
        this.collapsedGroups = [];
      },
      async setManualSort() {
        // Captura ordem atualmente visível e atribui ordem 1..N como baseline.
        // Tasks fora do filtro mantêm ordem prévia (ou null).
        const visible = this.filtered;
        const updates = [];
        visible.forEach((t, idx) => {
          const novaOrdem = idx + 1;
          if (t.ordem !== novaOrdem) {
            t.ordem = novaOrdem;
            updates.push({ id: t.id, ordem: novaOrdem });
          }
        });
        this.sortKeys = [{ key: 'manual', dir: 'asc' }];
        // Persiste em paralelo
        await Promise.all(updates.map(u =>
          sb.from('tasks').update({ ordem: u.ordem }).eq('id', u.id)
        ));
      },
      clearManualSort() {
        this.sortKeys = [{ key: 'prazo', dir: 'asc' }];
      },
      onBacklogDragStart(e, t) {
        if (this.sortKeys[0]?.key !== 'manual') { e.preventDefault(); return; }
        this.backlogDragId = t.id;
        e.dataTransfer.effectAllowed = 'move';
      },
      onBacklogDragOver(e) {
        if (this.sortKeys[0]?.key !== 'manual' || !this.backlogDragId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      },
      async onBacklogDrop(e, target) {
        if (this.sortKeys[0]?.key !== 'manual') return;
        e.preventDefault();
        const draggedId = this.backlogDragId;
        this.backlogDragId = '';
        if (!draggedId || draggedId === target.id) return;
        const dragged = this.tasksById.get(draggedId);
        if (!dragged) return;
        const visible = this.filtered;
        const targetIdx  = visible.findIndex(t => t.id === target.id);
        const draggedIdx = visible.findIndex(t => t.id === draggedId);
        let nbBefore, nbAfter;
        if (draggedIdx < targetIdx) {
          nbBefore = visible[targetIdx];
          nbAfter  = visible[targetIdx + 1];
        } else {
          nbBefore = visible[targetIdx - 1];
          nbAfter  = visible[targetIdx];
        }
        const ob = nbBefore && nbBefore.id !== draggedId ? nbBefore.ordem : null;
        const oa = nbAfter  && nbAfter.id  !== draggedId ? nbAfter.ordem  : null;
        let novaOrdem;
        if (ob != null && oa != null) novaOrdem = (ob + oa) / 2;
        else if (ob != null)          novaOrdem = ob + 1;
        else if (oa != null)          novaOrdem = oa - 1;
        else                          novaOrdem = 1;
        const prevOrdem = dragged.ordem;
        dragged.ordem = novaOrdem;
        const { error } = await sb.from('tasks').update({ ordem: novaOrdem }).eq('id', draggedId);
        if (error) {
          dragged.ordem = prevOrdem;
          this.toast('error', 'Erro ao reordenar: ' + error.message);
        }
      },
      sortBy(key) {
        const primary = this.sortKeys[0];
        if (primary && primary.key === key) {
          // Mesma chave primária: alterna direção
          this.sortKeys = [{ key, dir: primary.dir === 'asc' ? 'desc' : 'asc' }, ...this.sortKeys.slice(1)];
        } else {
          // Nova chave: vira primária; mantém anteriores como tiebreaker (cap 3)
          const rest = this.sortKeys.filter(s => s.key !== key).slice(0, 2);
          this.sortKeys = [{ key, dir: 'asc' }, ...rest];
        }
      },
      sortIcon(key) {
        const idx = this.sortKeys.findIndex(s => s.key === key);
        if (idx === -1) return '';
        const { dir } = this.sortKeys[idx];
        const arrow = dir === 'asc' ? '▲' : '▼';
        return this.sortKeys.length > 1 ? `${arrow}${idx + 1}` : arrow;
      },
      sortLabel(key) {
        const opt = this.sortOptions.find(o => o.key === key);
        return opt ? opt.label : key;
      },
      pickSort(key) {
        this.sortBy(key);
        this.sortPanelOpen = false;
      },
  
      // ===================== KANBAN =====================
      // Mobile sempre força visão executiva (operacional com 11 colunas é
      // ruim em telas estreitas).
      get effectiveKanbanView() { return this.isMobileViewport ? 'exec' : this.kanbanView; },
      kanbanCol(status) {
        const arr = this._visibleTasks.filter(t =>
          t.status === status
          && (!this.f.cliente || t.clienteId === this.f.cliente)
          && (!this.f.pessoa  || t.pessoaId  === this.f.pessoa)
        );
        // ordem da coluna = mais recentemente entrou nesta etapa primeiro
        arr.sort((a,b) => (b.statusEm || b.criadoEm || 0) - (a.statusEm || a.criadoEm || 0));
        return arr;
      },
      kanbanColSub(sub) {
        const arr = this._visibleTasks.filter(t =>
          t.subetapa === sub
          && (!this.f.cliente || t.clienteId === this.f.cliente)
          && (!this.f.pessoa  || t.pessoaId  === this.f.pessoa)
        );
        arr.sort((a,b) => (b.subetapaEm || b.statusEm || b.criadoEm || 0) - (a.subetapaEm || a.statusEm || a.criadoEm || 0));
        return arr;
      },
      lblSub(s) { return this.SUB_LABELS[s] || s || '—'; },
      tempoNaSubetapa(t) {
        const ts = t.subetapaEm || t.statusEm;
        if (!ts) return '';
        const d = Math.floor((Date.now() - ts) / 86400000);
        if (d <= 0) return 'hoje';
        if (d === 1) return 'há 1d';
        return 'há ' + d + 'd';
      },
      async setTaskSubetapa(t, newSub) {
        if (!t || t.subetapa === newSub) return;
        const newMacro = this.SUB_TO_MACRO[newSub] || t.status;
        const macroChanged = t.status !== newMacro;
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        // Optimistic.
        const prev = this._patchTask(t.id, {
          subetapa: newSub,
          status: newMacro,
          subetapaEm: nowMs,
          statusEm: macroChanged ? nowMs : t.statusEm,
        });
        if (!prev) return;
        const payload = { subetapa: newSub, subetapa_em: nowIso };
        if (macroChanged) payload.status_em = nowIso;
        const { error } = await sb.from('tasks').update(payload).eq('id', t.id);
        if (error) {
          this._replaceTask(t.id, prev);
          this.toast('error', 'Erro ao mover: ' + error.message);
          return;
        }
        if (macroChanged) {
          await sb.from('task_field_history').insert({
            task_id: t.id, field: 'status',
            from_value: prev.status, to_value: newMacro,
            actor_pessoa_id: this.currentPessoa ? this.currentPessoa.id : null,
            actor_source: 'app', occurred_at: nowIso,
          });
          try { await this._notifyStatusChange(t.id, prev.status, newMacro, prev.pessoaId); } catch(_) {}
        }
      },
      // ===================== BULK ACTIONS =====================
      toggleSelect(id) {
        const i = this.selectedIds.indexOf(id);
        if (i >= 0) this.selectedIds.splice(i, 1); else this.selectedIds.push(id);
      },
      toggleSelectAll() {
        const visible = this.filtered.map(t => t.id);
        const allSelected = visible.length > 0 && visible.every(id => this.selectedIds.includes(id));
        if (allSelected) this.selectedIds = this.selectedIds.filter(id => !visible.includes(id));
        else this.selectedIds = Array.from(new Set([...this.selectedIds, ...visible]));
      },
      clearSelection() { this.selectedIds = []; this.bulkPending = { subetapa: '', pessoa: '', cliente: '', projeto: '', prioridade: '', prazo: '', esforco: '' }; },
      async bulkSave() {
        const p = this.bulkPending;
        const hasAny = p.subetapa || p.pessoa || p.cliente || p.projeto || p.prioridade || p.prazo || p.esforco !== '';
        if (!hasAny || !this.selectedIds.length) return;
        if (p.subetapa)   await this.bulkSetSubetapa(p.subetapa);
        if (p.pessoa)     await this.bulkSetPessoa(p.pessoa);
        if (p.cliente)    await this.bulkSetCliente(p.cliente);
        if (p.projeto)    await this.bulkSetProjeto(p.projeto);
        if (p.prioridade) await this.bulkSetPriority(p.prioridade);
        if (p.prazo)      await this.bulkSetPrazo(p.prazo);
        if (p.esforco !== '') await this.bulkSetEsforco(p.esforco);
        this.bulkPending = { subetapa: '', pessoa: '', cliente: '', projeto: '', prioridade: '', prazo: '', esforco: '' };
      },
      async bulkSetSubetapa(sub) {
        if (!sub) return;
        const ids = [...this.selectedIds];
        this.track('bulk_action', { kind: 'setSubetapa', count: ids.length, value: sub });
        for (const id of ids) {
          const t = this.tasksById.get(id);
          if (t && t.subetapa !== sub) await this.setTaskSubetapa(t, sub);
        }
        this.toast('success', ids.length + ' tarefa(s) movida(s).');
      },
      async bulkSetPessoa(pid) {
        if (!pid) return;
        const target = pid === '__none__' ? null : pid;
        const ids = [...this.selectedIds];
        this.track('bulk_action', { kind: 'setPessoa', count: ids.length });
        const { error } = await sb.from('tasks').update({ pessoa_id: target }).in('id', ids);
        if (error) { this.toast('error', 'Erro: ' + error.message); return; }
        // Optimistic local update
        this._patchTasks(ids, { pessoaId: target || '' });
        this.toast('success', ids.length + ' tarefa(s) atualizada(s).');
      },
      async bulkSetCliente(cid) {
        if (!cid) return;
        const target = cid === '__none__' ? null : cid;
        const ids = [...this.selectedIds];
        this.track('bulk_action', { kind: 'setCliente', count: ids.length });
        // Ao trocar cliente, limpa projeto (projeto pertence ao cliente anterior).
        const { error } = await sb.from('tasks').update({ cliente_id: target, projeto_id: null }).in('id', ids);
        if (error) { this.toast('error', 'Erro: ' + error.message); return; }
        this._patchTasks(ids, { clienteId: target || '', projetoId: '' });
        this.toast('success', ids.length + ' tarefa(s) atualizada(s).');
      },
      async bulkSetProjeto(pid) {
        if (!pid) return;
        const target = pid === '__none__' ? null : pid;
        const ids = [...this.selectedIds];
        this.track('bulk_action', { kind: 'setProjeto', count: ids.length });
        const { error } = await sb.from('tasks').update({ projeto_id: target }).in('id', ids);
        if (error) { this.toast('error', 'Erro: ' + error.message); return; }
        this._patchTasks(ids, { projetoId: target || '' });
        this.toast('success', ids.length + ' tarefa(s) atualizada(s).');
      },
      async bulkSetPriority(p) {
        if (!p) return;
        const ids = [...this.selectedIds];
        this.track('bulk_action', { kind: 'setPriority', count: ids.length, value: p });
        const { error } = await sb.from('tasks').update({ prioridade: p }).in('id', ids);
        if (error) { this.toast('error', 'Erro: ' + error.message); return; }
        this._patchTasks(ids, { prioridade: p });
        this.toast('success', ids.length + ' tarefa(s) atualizada(s).');
      },
      async bulkSetPrazo(prazo) {
        // string vazia = limpar prazo
        const target = prazo || null;
        const ids = [...this.selectedIds];
        if (!ids.length) return;
        this.track('bulk_action', { kind: 'setPrazo', count: ids.length });
        const { error } = await sb.from('tasks').update({ prazo: target }).in('id', ids);
        if (error) { this.toast('error', 'Erro: ' + error.message); return; }
        this._patchTasks(ids, { prazo: target || '' });
        this.toast('success', ids.length + ' tarefa(s) atualizada(s).');
      },
      async bulkSetEsforco(val) {
        const num = val === '' || val == null ? null : Number(val);
        if (num != null && !(num >= 0)) { this.toast('error', 'Esforço inválido.'); return; }
        const ids = [...this.selectedIds];
        if (!ids.length) return;
        this.track('bulk_action', { kind: 'setEsforco', count: ids.length, value: num });
        const { error } = await sb.from('tasks').update({ esforco: num }).in('id', ids);
        if (error) { this.toast('error', 'Erro: ' + error.message); return; }
        this._patchTasks(ids, { esforco: num ?? 0 });
        this.toast('success', ids.length + ' tarefa(s) atualizada(s).');
      },
      // Select all aplicado às tarefas atualmente visíveis na Triagem (após filtro).
      toggleSelectAllTriagem() {
        const visible = this.triagemTasksFiltered.map(t => t.id);
        const allSelected = visible.length > 0 && visible.every(id => this.selectedIds.includes(id));
        if (allSelected) this.selectedIds = this.selectedIds.filter(id => !visible.includes(id));
        else this.selectedIds = Array.from(new Set([...this.selectedIds, ...visible]));
      },
      bulkDelete() {
        const n = this.selectedIds.length;
        if (!n) return;
        this.askConfirm('Excluir ' + n + ' tarefa(s)? Esta ação não pode ser desfeita.', async () => {
          const ids = [...this.selectedIds];
          this.track('bulk_action', { kind: 'delete', count: ids.length });
          // Best-effort: limpa storage dos anexos antes do cascade DB.
          try {
            const { data: atts } = await sb.from('task_attachments').select('storage_path').in('task_id', ids);
            const paths = (atts || []).map(a => a.storage_path).filter(Boolean);
            if (paths.length) await sb.storage.from('task-attachments').remove(paths);
          } catch (_) {}
          const { error } = await sb.from('tasks').delete().in('id', ids);
          if (error) { this.toast('error', 'Erro: ' + error.message); return; }
          this._removeTasks(ids);
          this.selectedIds = [];
          this.toast('success', n + ' tarefa(s) excluída(s).');
        });
      },
  
      openQuickAdd(sub) {
        this.quickAddSub = sub;
        this.quickAddTitle = '';
        this.$nextTick(() => {
          const el = document.getElementById('quickAdd-' + sub);
          if (el) el.focus();
        });
      },
      closeQuickAdd() {
        this.quickAddSub = '';
        this.quickAddTitle = '';
      },
      async quickAddSubmit(sub) {
        const t = (this.quickAddTitle || '').trim();
        if (!t) { this.toast('error', 'Digite um título.'); return; }
        const macro = this.SUB_TO_MACRO[sub] || 'backlog';
        const nowIso = new Date().toISOString();
        const payload = {
          titulo: t, descricao: '',
          cliente_id: null, projeto_id: null, pessoa_id: null,
          prioridade: 'P2', esforco: 4, complexidade: 'media',
          prazo: null, status: macro, subetapa: sub,
          tags: [], status_em: nowIso, subetapa_em: nowIso,
        };
        this.quickAddTitle = '';
        const { data, error } = await sb.from('tasks').insert(payload).select('*').single();
        if (error) { this.toast('error', 'Erro ao criar: ' + error.message); return; }
        if (data) {
          this._upsertTask(taskFromDb(data));
          await sb.from('task_field_history').insert({
            task_id: data.id, field: 'status', from_value: null, to_value: data.status,
            actor_pessoa_id: this.currentPessoa ? this.currentPessoa.id : null,
            actor_source: 'app', occurred_at: nowIso,
          });
        }
        this.toast('success', 'Tarefa criada.');
        // Mantém o quick-add aberto pra criação contínua na mesma coluna.
        this.$nextTick(() => {
          const el = document.getElementById('quickAdd-' + sub);
          if (el) el.focus();
        });
      },
      async onDropSub(ev, sub) {
        const id = ev.dataTransfer.getData('text/plain') || this.draggingId;
        this.dragOverCol = '';
        this.draggingId = '';
        if (!id) return;
        const t = this.tasksById.get(id);
        if (t) await this.setTaskSubetapa(t, sub);
      },
      async setTaskStatus(t, newStatus) {
        if (!t || t.status === newStatus) return;
        // Optimistic: muda local imediatamente pra UI ser instantânea.
        const nowMs = Date.now();
        const prev = this._patchTask(t.id, { status: newStatus, statusEm: nowMs });
        if (!prev) return;
        // Persiste em background. Realtime cuida de propagar a outras sessões.
        const occurredIso = new Date(nowMs).toISOString();
        const { error } = await sb.from('tasks')
          .update({ status: newStatus, status_em: occurredIso })
          .eq('id', t.id);
        if (error) {
          this._replaceTask(t.id, prev);
          this.toast('error', 'Erro ao mover: ' + error.message);
          return;
        }
        // Log do histórico (não-bloqueante)
        await sb.from('task_field_history').insert({
          task_id: t.id, field: 'status',
          from_value: prev.status, to_value: newStatus,
          actor_pessoa_id: this.currentPessoa ? this.currentPessoa.id : null,
          actor_source: 'app', occurred_at: occurredIso,
        });
        try { await this._notifyStatusChange(t.id, prev.status, newStatus, prev.pessoaId); } catch(_) {}
      },
      async moveTask(t, dir) {
        const order = ['backlog', 'andamento', 'bloqueado', 'concluido'];
        const i = order.indexOf(t.status);
        const ni = i + dir;
        if (ni < 0 || ni >= order.length) return;
        await this.setTaskStatus(t, order[ni]);
      },
      onDragStart(ev, t) {
        this.draggingId = t.id;
        ev.dataTransfer.setData('text/plain', t.id);
        ev.dataTransfer.effectAllowed = 'move';
      },
      async onDrop(ev, col) {
        const id = ev.dataTransfer.getData('text/plain') || this.draggingId;
        this.dragOverCol = '';
        this.draggingId = '';
        if (!id) return;
        const t = this.tasksById.get(id);
        if (t) await this.setTaskStatus(t, col);
      },
  
    };
  }

  window.makeBacklogKanbanView = makeBacklogKanbanView;
})();
