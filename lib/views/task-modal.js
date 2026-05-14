/* ============ tasks 360 · Modal de Tarefa + Autosave ============
 * Abertura/fechamento do modal, criação/edição/exclusão de task,
 * autosave silencioso com debounce, gestão de mentions, status flow.
 *
 * Dependências em app() (permanecem lá):
 *   - this.tasks (state)
 *   - this.editing, this.modal, this.modalTab (state do modal)
 *   - this.toast, this.askConfirm, this.track
 *
 * Dependências em window:
 *   - sb (supabase-client.js), taskFromDb, taskToDb, STATUS, STAGE_RANK,
 *     TASK_FIELDS, makeBlank, ROLE
 * ==================================================================
 */

(function () {
  'use strict';

  function makeTaskModalView() {
    return {
      // ===================== MODAL TAREFA =====================
      openNew() {
        this.editing = this.blankTask();
        this.editing.checklist = [];
        this.checklistOpen = false;
        this.editingCommentId = '';
        this.editingCommentDraft = '';
        this.editingComments = [];
        this.editingHistory = [];
        this.editingAttachments = [];
        this.attachmentUrls = {};
        this.newComment = '';
        this.replyingToId = '';
        this.newReply = '';
        this.newDepId = '';
        this.modal = true;
        this.$nextTick(() => this.$refs.tituloInput && this.$refs.tituloInput.focus());
      },
      openEdit(t) {
        this.track('task_view', { id: t.id, subetapa: t.subetapa, status: t.status });
        this.editing = JSON.parse(JSON.stringify(t));
        this.editing.tempoRealHoras = this.editing.tempoRealHoras == null ? '' : this.editing.tempoRealHoras;
        this.editing.dependencias = [...this.getDependencias(t.id)];
        if (!Array.isArray(this.editing.checklist)) this.editing.checklist = [];
        this.checklistOpen = this.editing.checklist.length > 0;
        this.editingCommentId = '';
        this.editingCommentDraft = '';
        this.newDepId = '';
        this.editingComments = [];
        this.editingHistory = [];
        this.editingAttachments = [];
        this.attachmentUrls = {};
        // Restaura rascunho de comment se houver (defesa contra fechamento sem flush)
        this.newComment = this._loadCommentDraft(t.id);
        this.replyingToId = '';
        this.newReply = '';
        if (this.newComment) {
          // Notifica user que tem rascunho recuperado
          this.$nextTick(() => this.toast('info', 'Rascunho de comentário recuperado.', 4000));
        }
        // Autosave: reseta estado ao abrir. Watcher inicial dispara um "dirty" falso porque
        // editing muda inteiro — supressamos limpando o timer logo após o tick.
        this.saveState = 'saved';
        this.lastSavedAt = Date.now();
        this.modalTab = this.isMobileViewport ? 'detalhes' : 'conversa';
        clearTimeout(this._autosaveTimer);
        this.$nextTick(() => { clearTimeout(this._autosaveTimer); this.saveState = 'saved'; });
        this.modal = true;
        this.loadComments(t.id);
        this.loadHistory(t.id);
        this.loadAttachments(t.id);
        // Lazy: descricao não vem no boot (column projection). Puxa só agora.
        if (this.editing.descricao === undefined) this.loadDescricao(t.id);
      },
      async loadDescricao(taskId) {
        const { data, error } = await sb.from('tasks').select('descricao').eq('id', taskId).single();
        if (error) return;
        const desc = (data && data.descricao) || '';
        // Atualiza editing se ainda for a mesma task; e patcha this.tasks cache.
        if (this.editing && this.editing.id === taskId) this.editing.descricao = desc;
        const cached = this.tasksById.get(taskId);
        if (cached) cached.descricao = desc;
      },
      async postComment() {
        const body = (this.newComment || '').trim();
        if (!body || !this.editing.id) return;
        this.track('comment_post', { public: !!this.newCommentPublico, has_mention: /@/.test(body) });
        const author = (this.currentPessoa && this.currentPessoa.nome) || 'app';
        const authorPessoaId = (this.currentPessoa && this.currentPessoa.id) || null;
        const visivel = !!this.newCommentPublico;
        const tempId = 'tmp-' + Math.random().toString(36).slice(2, 8);
        const optimistic = {
          id: tempId, author, body,
          author_pessoa_id: authorPessoaId,
          external_source: null, posted_em: null,
          criado_em: new Date().toISOString(),
          visivel_cliente: visivel, from_cliente: false,
        };
        this.editingComments = [optimistic, ...this.editingComments];
        this.newComment = '';
        this._clearCommentDraft(this.editing.id);
        const { data, error } = await sb.from('task_comments')
          .insert({ task_id: this.editing.id, author, body, author_pessoa_id: authorPessoaId, visivel_cliente: visivel, from_cliente: false })
          .select('id, author, body, author_pessoa_id, external_source, posted_em, criado_em, visivel_cliente, from_cliente')
          .single();
        if (error) {
          this.editingComments = this.editingComments.filter(c => c.id !== tempId);
          this.newComment = body;
          this._saveCommentDraft(this.editing.id, body);
          this.toast('error', 'Erro ao comentar: ' + error.message);
          return;
        }
        // Substitui temp pelo registro real (realtime também trariam, mas evita duplicar visual)
        this.editingComments = this.editingComments.map(c => c.id === tempId ? data : c);
        // Notificações: mentions + dono da task (se outro)
        try {
          await this._notifyMentions(this.editing.id, data.id, body);
          const owner = this.editing.pessoaId;
          if (owner) await this._notifyCommentOnTaskOwner(this.editing.id, data.id, body, owner);
        } catch (e) { console.warn('[notif] postComment notify failed:', e); }
      },

      // Rascunho de comment em localStorage por task_id. Defesa pra crash/refresh
      // (mesmo que flushModalSaves seja chamado em close, se algo falhar ali
      // o draft fica). Limpa após postComment bem-sucedido.
      _commentDraftKey(taskId) { return 'k360-draft-comment-' + taskId; },
      _saveCommentDraft(taskId, body) {
        if (!taskId) return;
        try {
          if (body && body.trim()) localStorage.setItem(this._commentDraftKey(taskId), body);
          else localStorage.removeItem(this._commentDraftKey(taskId));
        } catch(_) {}
      },
      _clearCommentDraft(taskId) {
        if (!taskId) return;
        try { localStorage.removeItem(this._commentDraftKey(taskId)); } catch(_) {}
      },
      _loadCommentDraft(taskId) {
        if (!taskId) return '';
        try { return localStorage.getItem(this._commentDraftKey(taskId)) || ''; } catch(_) { return ''; }
      },
      async loadHistory(taskId) {
        if (!taskId) { this.editingHistory = []; return; }
        const { data } = await sb.from('task_field_history')
          .select('id, field, from_value, to_value, actor_pessoa_id, actor_source, occurred_at')
          .eq('task_id', taskId);
        this.editingHistory = (data || []).sort(
          (a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)
        );
      },

      // ============ FLUSH ANTES DE FECHAR ============
      // Chamada em todos os pontos de saída do modal (X, Esc, click fora,
      // botão "fechar"). Cancela timer de autosave, dispara save imediato
      // se há mutação pendente, e posta comments/replies que ficaram em
      // rascunho. Bloqueia o fechamento até completar (async).
      //
      // Retorna true se foi possível salvar tudo; false se algo falhou
      // (raro — caller pode decidir manter modal aberto se quiser).
      async flushModalSaves() {
        if (!this.modal || !this.editing || !this.editing.id) return true;
        const tasks = [];

        // 1. Cancela timer pendente; vamos disparar manualmente abaixo.
        if (this._autosaveTimer) {
          clearTimeout(this._autosaveTimer);
          this._autosaveTimer = null;
        }

        // 2. Comment rascunho não enviado → posta agora.
        if (this.newComment && this.newComment.trim()) {
          tasks.push(this.postComment());
        }

        // 3. Reply rascunho ativa → submete.
        if (this.replyingToId && this.newReply && this.newReply.trim()) {
          tasks.push(this.submitReply(this.replyingToId));
        }

        // 4. Comment-edit em rascunho → salva.
        if (this.editingCommentId && this.editingCommentDraft && this.editingCommentDraft.trim()) {
          tasks.push(this.saveEditComment(this.editingCommentId));
        }

        // 5. Mutação dirty no editing (campos, checklist) → save síncrono.
        //    Reusa autosaveTaskNow que internamente chama saveTask({silent:true}).
        if (this.saveState === 'dirty') {
          tasks.push(this.autosaveTaskNow());
        }

        if (!tasks.length) return true;
        try {
          await Promise.all(tasks);
          return true;
        } catch (e) {
          console.warn('[flush] erro ao persistir antes de fechar:', e);
          this.toast('error', 'Algo não foi salvo: ' + (e.message || e), 8000);
          return false;
        }
      },

      // Helper de fechamento seguro do modal task. Substitui `modal=false`
      // direto em todos os handlers (X, Esc, click fora, botão fechar).
      async closeModal() {
        await this.flushModalSaves();
        this.modal = false;
      },

      // === Autosave silencioso ===
      // Roda em paralelo ao saveTask() do botão. NÃO fecha modal, NÃO toasta sucesso,
      // só atualiza o indicador. Reaproveita saveTask({ silent: true }).
      async autosaveTaskNow() {
        if (!this.modal) return;
        if (!this.editing || !this.editing.id) return;
        if (!this.editing.titulo || !this.editing.titulo.trim()) return;
        const seq = ++this._autosaveSeq;
        this.saveState = 'saving';
        try {
          await this.saveTask({ silent: true });
          // Ignora resposta stale (outra mutação já disparou save)
          if (seq !== this._autosaveSeq) return;
          this.saveState = 'saved';
          this.lastSavedAt = Date.now();
        } catch (err) {
          if (seq !== this._autosaveSeq) return;
          this.saveState = 'error';
          console.warn('[autosave] falhou:', err);
        }
      },
      // Label do indicador de autosave (header do modal).
      // Estados: idle = "autosave ativo" · dirty · saving · saved · error.
      // Não mostra "há Xs/min" — exigia ticker reativo e cust/benefício não compensou.
      autosaveLabel() {
        if (this.saveState === 'saving') return 'salvando…';
        if (this.saveState === 'dirty')  return 'editando…';
        if (this.saveState === 'error')  return 'falhou · tentar de novo';
        if (this.saveState === 'saved')  return 'salvo';
        return 'autosave ativo';
      },
      async saveTask(opts) {
        const silent = !!(opts && opts.silent);
        const e = this.editing;
        if (!e.titulo || !e.titulo.trim()) {
          if (!silent) this.toast('error', 'Dê um título à tarefa.');
          return;
        }
        this.track(e.id ? 'task_edit' : 'task_create', { subetapa: e.subetapa, prioridade: e.prioridade });
        e.titulo = e.titulo.trim();
        e.esforco = +e.esforco || 0;
        // Status (macro) é derivado da subetapa.
        e.subetapa = e.subetapa || 'backlog';
        e.status = this.SUB_TO_MACRO[e.subetapa] || 'backlog';
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const payload = taskToDb(e);
  
        if (e.id) {
          // Optimistic update: aplica local antes do round-trip.
          const i = this.tasks.findIndex(t => t.id === e.id);
          const prev = i >= 0 ? this.tasks[i] : null;
          const subChanged    = prev && prev.subetapa !== e.subetapa;
          const statusChanged = prev && prev.status   !== e.status;
          if (i >= 0) {
            if (subChanged)    payload.subetapa_em = nowIso;
            if (statusChanged) payload.status_em   = nowIso;
            this.tasks[i] = {
              ...prev,
              titulo: e.titulo, descricao: e.descricao || '',
              clienteId: e.clienteId, projetoId: e.projetoId, pessoaId: e.pessoaId,
              prioridade: e.prioridade, esforco: +e.esforco || 0,
              prazo: e.prazo || '', status: e.status, subetapa: e.subetapa,
              complexidade: e.complexidade || 'media',
              bloqueadoPor: e.subetapa === 'bloqueado' ? (e.bloqueadoPor || '') : '',
              visivelCliente: e.visivelCliente !== false,
              tags: Array.isArray(e.tags) ? [...e.tags] : [],
              checklist: Array.isArray(e.checklist) ? JSON.parse(JSON.stringify(e.checklist)) : [],
              tipoTrabalho: e.tipoTrabalho || '',
              tempoRealHoras: e.tempoRealHoras === '' || e.tempoRealHoras == null ? null : +e.tempoRealHoras,
              statusEm:   statusChanged ? nowMs : prev.statusEm,
              subetapaEm: subChanged    ? nowMs : prev.subetapaEm,
            };
          }
          // Aguarda update no banco ANTES de fechar modal — evita race onde
          // user vê modal fechado mas update falhou + toast aparece no ar.
          const { error } = await sb.from('tasks').update(payload).eq('id', e.id);
          if (error) {
            if (prev) this.tasks[i] = prev;
            if (!silent) this.toast('error', 'Erro ao salvar: ' + error.message);
            else throw new Error(error.message);
            return;
          }
          // Sucesso: fecha modal só agora (botão Salvar) ou mantém aberto (autosave).
          if (!silent) this.modal = false;
          if (statusChanged) {
            await sb.from('task_field_history').insert({
              task_id: e.id, field: 'status', from_value: prev.status, to_value: e.status,
              actor_pessoa_id: this.currentPessoa ? this.currentPessoa.id : null,
              actor_source: 'app', occurred_at: nowIso,
            });
          }
          // Loga mudanças de campos não-status (prazo, esforço etc).
          await this._logFieldChanges(e.id, prev, e, nowIso);
          // Notifica novo responsável (assignment)
          try {
            if (prev && prev.pessoaId !== e.pessoaId) {
              await this._notifyAssignment(e.id, e.pessoaId, prev.pessoaId);
            }
            if (statusChanged && e.pessoaId) {
              await this._notifyStatusChange(e.id, prev.status, e.status, e.pessoaId);
            }
          } catch (err) { console.warn('[notif] notify failed:', err); }
          // Sincroniza dependências (diff vs prev)
          await this._syncDependencias(e.id, e.dependencias || []);
        } else {
          // Insert — aguarda confirmar antes de fechar
          payload.status_em = nowIso;
          payload.subetapa_em = nowIso;
          const { data, error } = await sb.from('tasks').insert(payload).select('*').single();
          if (error) {
            if (!silent) this.toast('error', 'Erro ao criar: ' + error.message);
            else throw new Error(error.message);
            return;
          }
          if (!silent) this.modal = false;
          if (data && !this.tasks.some(t => t.id === data.id)) {
            this.tasks = [taskFromDb(data), ...this.tasks];
          }
          // Primeira entrada do histórico: criação
          if (data) {
            await sb.from('task_field_history').insert({
              task_id: data.id, field: 'status', from_value: null, to_value: data.status,
              actor_pessoa_id: this.currentPessoa ? this.currentPessoa.id : null,
              actor_source: 'app', occurred_at: nowIso,
            });
            await this._syncDependencias(data.id, e.dependencias || []);
          }
        }
      },
      // Compara prev vs next e insere uma row em task_field_history pra
      // cada campo rastreado que mudou.
      async _logFieldChanges(taskId, prev, next, nowIso) {
        if (!taskId || !prev || !next) return;
        const norm = (v) => v === '' || v == null ? null : String(v);
        const TRACKED = [
          ['prazo',          'prazo',           v => v || null],
          ['esforco',        'esforco',         v => v == null ? null : String(v)],
          ['prioridade',     'prioridade',      v => v || null],
          ['complexidade',   'complexidade',    v => v || null],
          ['pessoaId',       'pessoa',          v => v || null],
          ['subetapa',       'subetapa',        v => v || null],
          ['tipoTrabalho',   'tipo_trabalho',   v => v || null],
          ['tempoRealHoras', 'tempo_real_horas',v => v == null ? null : String(v)],
          ['bloqueadoPor',   'bloqueado_por',   v => v || null],
        ];
        const rows = [];
        const actor = this.currentPessoa ? this.currentPessoa.id : null;
        for (const [key, field, fmt] of TRACKED) {
          const fromV = fmt(prev[key]);
          const toV   = fmt(next[key]);
          if (norm(fromV) === norm(toV)) continue;
          rows.push({
            task_id: taskId, field,
            from_value: fromV, to_value: toV,
            actor_pessoa_id: actor, actor_source: 'app', occurred_at: nowIso,
          });
        }
        if (!rows.length) return;
        const { error } = await sb.from('task_field_history').insert(rows);
        if (error) console.warn('[history] field log failed:', error);
      },
      async _syncDependencias(taskId, dependeDeIds) {
        const wanted = new Set(dependeDeIds.filter(Boolean));
        const current = new Set(this.getDependencias(taskId));
        const toAdd = [...wanted].filter(id => !current.has(id));
        const toDel = [...current].filter(id => !wanted.has(id));
        if (toAdd.length) {
          const rows = toAdd.map(depende_de_id => ({ task_id: taskId, depende_de_id }));
          const { error } = await sb.from('task_dependencies').insert(rows);
          if (error) { this.toast('error', 'Erro ao salvar dependências: ' + error.message); return; }
        }
        for (const depId of toDel) {
          const { error } = await sb.from('task_dependencies').delete()
            .eq('task_id', taskId).eq('depende_de_id', depId);
          if (error) { this.toast('error', 'Erro ao remover dependência: ' + error.message); return; }
        }
        if (toAdd.length || toDel.length) {
          // Recarrega taskDeps pra refletir o estado novo
          const { data, error } = await sb.from('task_dependencies').select('task_id, depende_de_id');
          if (!error) this.taskDeps = data || [];
        }
      },
      addDependencia() {
        const id = this.newDepId;
        if (!id) return;
        if (this.editing.id && id === this.editing.id) {
          this.toast('error', 'Tarefa não pode depender de si mesma.');
          this.newDepId = '';
          return;
        }
        this.editing.dependencias = this.editing.dependencias || [];
        if (!this.editing.dependencias.includes(id)) {
          this.editing.dependencias.push(id);
        }
        this.newDepId = '';
      },
      removeDependencia(id) {
        this.editing.dependencias = (this.editing.dependencias || []).filter(d => d !== id);
      },
      get _candidatesDependencia() {
        // Candidatos: tasks do mesmo cliente, exceto a própria e as já dependentes.
        const e = this.editing;
        if (!e) return [];
        const already = new Set(e.dependencias || []);
        return this._visibleTasks.filter(t =>
          t.id !== e.id &&
          !already.has(t.id) &&
          t.status !== STATUS.CONCLUIDO &&
          (!e.clienteId || t.clienteId === e.clienteId)
        );
      },
      async _purgeTaskStorage(id) {
        // Best-effort: lista anexos e tenta apagar do storage antes do DB cascade limpar as rows.
        // Se falhar, o cron cleanup-attachments pega os órfãos depois.
        try {
          const { data } = await sb.from('task_attachments').select('storage_path').eq('task_id', id);
          const paths = (data || []).map(a => a.storage_path).filter(Boolean);
          if (paths.length) await sb.storage.from('task-attachments').remove(paths);
        } catch (_) {}
      },
      deleteTask() {
        this.askConfirm('Excluir esta tarefa? Esta ação não pode ser desfeita.', async () => {
          const id = this.editing.id;
          const i = this.tasks.findIndex(t => t.id === id);
          const prev = i >= 0 ? this.tasks[i] : null;
          if (i >= 0) this.tasks.splice(i, 1);
          this.modal = false;
          await this._purgeTaskStorage(id);
          const { error } = await sb.from('tasks').delete().eq('id', id);
          if (error) {
            if (prev) this.tasks.splice(i, 0, prev);
            this.toast('error', 'Erro ao excluir: ' + error.message);
          }
        });
      },
      deleteTaskById(id) {
        const t = this.tasksById.get(id);
        if (!t) return;
        this.askConfirm(`Excluir "${t.titulo}"?`, async () => {
          const i = this.tasks.findIndex(x => x.id === id);
          const prev = this.tasks[i];
          this.tasks.splice(i, 1);
          await this._purgeTaskStorage(id);
          const { error } = await sb.from('tasks').delete().eq('id', id);
          if (error) {
            this.tasks.splice(i, 0, prev);
            this.toast('error', 'Erro ao excluir: ' + error.message);
          }
        });
      },
    };
  }

  window.makeTaskModalView = makeTaskModalView;
})();
