/* ============ tasks 360 · Notifications + Checklist ============
 * Notificações in-app (sino) + checklist mini-tasks dentro do modal.
 * Agrupadas pra evitar muitos arquivos pequenos.
 *
 * Dependências em app() (permanecem lá):
 *   - this.notifications, this.unreadCount (state)
 *   - this.editing (state do modal)
 *   - this.toast, this.openEdit
 *
 * Dependências em window: sb (supabase-client.js)
 * ============================================================
 */

(function () {
  'use strict';

  function makeNotificationsView() {
    return {
      // ===================== NOTIFICATIONS =====================
      get unreadNotifications() {
        return this.notifications.filter(n => !n.read_at);
      },
      get unreadCount() { return this.unreadNotifications.length; },
      // Lista filtrada por kind para os chips do dropdown.
      get notificationsFiltradas() {
        if (this.notifKindFilter === 'all') return this.notifications;
        return this.notifications.filter(n => this.notifKindGroup(n) === this.notifKindFilter);
      },
      // Contadores por grupo pra mostrar nos chips.
      get notifKindCounts() {
        const counts = { all: 0, mention: 0, assignment: 0, status: 0 };
        for (const n of this.notifications) {
          counts.all++;
          const g = this.notifKindGroup(n);
          if (counts[g] != null) counts[g]++;
        }
        return counts;
      },
      async loadNotifications() {
        if (!this.currentPessoa) { this.notifications = []; return; }
        const { data, error } = await sb
          .from('notifications')
          .select('id, recipient_pessoa_id, kind, payload, source_task_id, source_comment_id, criado_em, read_at')
          .eq('recipient_pessoa_id', this.currentPessoa.id)
          .order('criado_em', { ascending: false })
          .limit(50);
        if (error) { console.error('[notif] load failed:', error); return; }
        this.notifications = data || [];
      },
      subscribeNotifications() {
        if (this._notifsSubscribed || !this.currentPessoa) return;
        this._notifsSubscribed = true;
        sb.channel('notif-' + this.currentPessoa.id)
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'notifications',
            filter: `recipient_pessoa_id=eq.${this.currentPessoa.id}`,
          }, (payload) => {
            const n = payload.new;
            this.notifications = [n, ...this.notifications].slice(0, 50);
            // Toast leve apenas como sinal — UX silenciosa
            this.toast('info', this.notifSummary(n), 6000);
          })
          .subscribe();
      },
      notifSummary(n) {
        const p = n.payload || {};
        const who = p.author || 'alguém';
        switch (n.kind) {
          case 'mention':            return `${who} te mencionou em uma tarefa`;
          case 'assigned':           return `${who} te atribuiu a uma tarefa`;
          case 'comment_on_my_task': return `${who} comentou em uma tarefa sua`;
          case 'cliente_respondeu':  return `Cliente respondeu em uma tarefa sua`;
          case 'status_change':      return `${who} mudou status de uma tarefa sua` + (p.to ? ` → ${p.to}` : '');
          default:                   return 'nova notificação';
        }
      },
      // Agrupamento por tipo pra filter chips no dropdown.
      // 'all' não filtra. 'mention' = @menções. 'assignment' = atribuições +
      // comentários em tarefas suas. 'status' = mudanças de status macro.
      notifKindGroup(n) {
        switch (n.kind) {
          case 'mention':            return 'mention';
          case 'assigned':
          case 'comment_on_my_task':
          case 'cliente_respondeu':  return 'assignment';
          case 'status_change':      return 'status';
          default:                   return 'other';
        }
      },
      async openNotification(n) {
        // Marca como lida e abre a task referenciada (se houver).
        await this.markNotificationRead(n.id);
        this.notifPanelOpen = false;
        if (n.source_task_id) {
          const t = this.tasksById.get(n.source_task_id);
          if (t) this.openEdit(t);
        }
      },
      async markNotificationRead(id) {
        const i = this.notifications.findIndex(n => n.id === id);
        if (i < 0) return;
        const prev = this.notifications[i];
        if (prev.read_at) return;
        const nowIso = new Date().toISOString();
        this.notifications[i] = { ...prev, read_at: nowIso };
        const { error } = await sb.from('notifications').update({ read_at: nowIso }).eq('id', id);
        if (error) { this.notifications[i] = prev; }
      },
      async markAllNotificationsRead() {
        const ids = this.unreadNotifications.map(n => n.id);
        if (!ids.length) return;
        const nowIso = new Date().toISOString();
        this.notifications = this.notifications.map(n => n.read_at ? n : { ...n, read_at: nowIso });
        await sb.from('notifications').update({ read_at: nowIso }).in('id', ids);
      },
      // ----- helpers pra criar notificações -----
      async _notifyMentions(taskId, commentId, body) {
        if (!this.currentPessoa || !body) return;
        const re = /@([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]*)/g;
        const found = new Set();
        let m;
        while ((m = re.exec(body)) !== null) found.add(m[1]);
        if (!found.size) return;
        const recipients = this.pessoas
          .filter(p => p.role !== ROLE.CLIENTE)
          .filter(p => found.has((p.nome || '').split(/\s+/)[0]))
          // self-mention é permitido (uso pra lembrete/auto-controle)
          .map(p => p.id);
        if (!recipients.length) return;
        const rows = recipients.map(rid => ({
          recipient_pessoa_id: rid,
          kind: 'mention',
          payload: { author: this.currentPessoa.nome, task_id: taskId, comment_id: commentId },
          source_task_id: taskId,
          source_comment_id: commentId,
        }));
        await sb.from('notifications').insert(rows);
      },
      async _notifyAssignment(taskId, newPessoaId, oldPessoaId) {
        if (!newPessoaId || newPessoaId === oldPessoaId) return;
        if (this.currentPessoa && newPessoaId === this.currentPessoa.id) return; // self-assign não notifica
        await sb.from('notifications').insert({
          recipient_pessoa_id: newPessoaId,
          kind: 'assigned',
          payload: { author: this.currentPessoa ? this.currentPessoa.nome : 'app', task_id: taskId },
          source_task_id: taskId,
        });
      },
      async _notifyCommentOnTaskOwner(taskId, commentId, body, ownerPessoaId) {
        if (!ownerPessoaId) return;
        if (this.currentPessoa && ownerPessoaId === this.currentPessoa.id) return; // próprio dono comentando
        await sb.from('notifications').insert({
          recipient_pessoa_id: ownerPessoaId,
          kind: 'comment_on_my_task',
          payload: { author: this.currentPessoa ? this.currentPessoa.nome : 'app', task_id: taskId, comment_id: commentId, preview: (body || '').slice(0, 80) },
          source_task_id: taskId,
          source_comment_id: commentId,
        });
      },
      async _notifyClienteRespondeu(taskId, commentId, body, ownerPessoaId) {
        if (!ownerPessoaId) return;
        await sb.from('notifications').insert({
          recipient_pessoa_id: ownerPessoaId,
          kind: 'cliente_respondeu',
          payload: { task_id: taskId, comment_id: commentId, preview: (body || '').slice(0, 80) },
          source_task_id: taskId,
          source_comment_id: commentId,
        });
      },
      // Notifica o responsável da task quando outra pessoa muda o status macro.
      // Não dispara em mudanças de subetapa que mantêm o mesmo status macro.
      async _notifyStatusChange(taskId, fromStatus, toStatus, ownerPessoaId) {
        if (!ownerPessoaId) return;
        if (fromStatus === toStatus) return;
        if (this.currentPessoa && ownerPessoaId === this.currentPessoa.id) return; // próprio dono mudando
        await sb.from('notifications').insert({
          recipient_pessoa_id: ownerPessoaId,
          kind: 'status_change',
          payload: {
            author: this.currentPessoa ? this.currentPessoa.nome : 'app',
            task_id: taskId,
            from: fromStatus || '∅',
            to: toStatus,
          },
          source_task_id: taskId,
        });
      },
  
      subscribeRealtime() {
        // Idempotente: se já assinou, não tenta de novo.
        // Sem isso, segundas chamadas (init + onAuthStateChange) crashavam
        // com "cannot add postgres_changes callbacks ... after subscribe()".
        if (this._realtimeSubscribed) return;
        this._realtimeSubscribed = true;
        // tasks: aplica o payload do evento DIRETO no estado local — sem
        // refetch da tabela inteira. Antes, cada mudança de qualquer pessoa
        // disparava um SELECT de todas as tasks em todos os clientes
        // conectados (tempestade O(clientes × mudanças × tabela) que piorava
        // com a adoção do time). clientes/projetos/pessoas mudam raramente
        // e são tabelas pequenas — refetch debounced (coalesce de rajadas).
        // Pré-requisito: rodar supabase/realtime.sql + api_patch_comments.sql.
        //
        // Channel scoping: cliente externo (Portal) só enxerga o próprio
        // backlog — filtrar a assinatura por `cliente_id` corta o ruído de
        // receber a corrente de mudanças da agência inteira. Staff continua
        // no canal amplo (precisa ver tudo). A RLS já garante segurança;
        // isto é puramente eficiência de rede.
        const isCliente = this.currentPessoa && this.currentPessoa.role === ROLE.CLIENTE;
        const cid = this.currentPessoa && this.currentPessoa.cliente_id;
        const scope = (isCliente && cid) ? `cliente_id=eq.${cid}` : null;
        const tasksFilter = scope
          ? { event: '*', schema: 'public', table: 'tasks', filter: scope }
          : { event: '*', schema: 'public', table: 'tasks' };
        const projetosFilter = scope
          ? { event: '*', schema: 'public', table: 'projetos', filter: scope }
          : { event: '*', schema: 'public', table: 'projetos' };

        sb.channel('kliente360-changes')
          .on('postgres_changes', tasksFilter, (payload) => this._applyTaskRealtime(payload))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => this._scheduleRefetch('clientes'))
          .on('postgres_changes', projetosFilter, () => this._scheduleRefetch('projetos'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'pessoas'  }, () => this._scheduleRefetch('pessoas'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, (payload) => {
            const tid = (payload.new && payload.new.task_id) || (payload.old && payload.old.task_id);
            if (this.modal && this.editing.id && this.editing.id === tid) this.loadComments(this.editing.id);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'task_field_history' }, (payload) => {
            const tid = (payload.new && payload.new.task_id) || (payload.old && payload.old.task_id);
            if (this.modal && this.editing.id && this.editing.id === tid) this.loadHistory(this.editing.id);
            if (payload.new && payload.new.field === 'status') {
              if (payload.eventType === 'INSERT') {
                this.historyAll = [payload.new, ...this.historyAll];
              } else if (payload.eventType === 'DELETE') {
                this.historyAll = this.historyAll.filter(h => h.id !== payload.old.id);
              }
            }
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'task_attachments' }, (payload) => {
            const tid = (payload.new && payload.new.task_id) || (payload.old && payload.old.task_id);
            if (this.modal && this.editing.id && this.editing.id === tid) this.loadAttachments(this.editing.id);
          })
          .subscribe();
      },
      // Aplica um evento realtime de `tasks` direto no estado local, sem
      // refetch da tabela inteira. O payload do evento já carrega a linha
      // completa (`payload.new`) — só aplicamos o delta. taskFromDb lê
      // colunas snake_case, então funciona direto na row crua do Postgres.
      _applyTaskRealtime(payload) {
        try {
          const ev = payload && payload.eventType;
          if (ev === 'DELETE') {
            const id = payload.old && payload.old.id;
            if (id) this._removeTask(id);
            return;
          }
          // INSERT ou UPDATE — payload.new traz a linha completa.
          const row = payload && payload.new;
          if (!row || !row.id) { this._scheduleRefetch('tasks'); return; }
          this._upsertTask(taskFromDb(row));
        } catch (e) {
          // Payload inesperado — cai no fallback de refetch coalescido.
          console.warn('[realtime] falha ao aplicar evento de task:', e);
          this._scheduleRefetch('tasks');
        }
      },
      // Refetch coalescido: junta uma rajada de eventos num único SELECT.
      // Usado por clientes/projetos/pessoas (baixa frequência) e como
      // fallback de tasks quando o payload do evento vem inutilizável.
      _scheduleRefetch(which) {
        this._refetchTimers = this._refetchTimers || {};
        clearTimeout(this._refetchTimers[which]);
        const fn = {
          tasks:    () => this.refreshTasks(),
          clientes: () => this.refreshClientes(),
          projetos: () => this.refreshProjetos(),
          pessoas:  () => this.refreshPessoas(),
        }[which];
        if (!fn) return;
        this._refetchTimers[which] = setTimeout(fn, 1200);
      },
      async loadComments(taskId) {
        if (!taskId) { this.editingComments = []; return; }
        const { data, error } = await sb.from('task_comments')
          .select('id, parent_id, author, author_external_id, author_pessoa_id, body, posted_em, criado_em, edited_em, external_source, external_id, visivel_cliente, from_cliente')
          .eq('task_id', taskId)
          .order('posted_em', { ascending: true, nullsFirst: true })
          .order('criado_em', { ascending: true });
        if (!error) this.editingComments = data || [];
      },
  
      // ===================== CHECKLIST =====================
      addChecklistItem(at) {
        if (!Array.isArray(this.editing.checklist)) this.editing.checklist = [];
        const item = { id: 'cli-' + Math.random().toString(36).slice(2, 9), body: '', done: false };
        const idx = (typeof at === 'number') ? at : this.editing.checklist.length;
        this.editing.checklist.splice(idx, 0, item);
        this.$nextTick(() => {
          const inputs = document.querySelectorAll('.tmodal input[placeholder="mini-task…"]');
          const el = inputs[idx];
          if (el) el.focus();
        });
      },
      removeChecklistItem(idx) {
        if (!Array.isArray(this.editing.checklist)) return;
        this.editing.checklist.splice(idx, 1);
      },
      toggleChecklistItem(idx) {
        if (!Array.isArray(this.editing.checklist)) return;
        const item = this.editing.checklist[idx];
        if (!item) return;
        this.editing.checklist[idx] = { ...item, done: !item.done };
      },
      updateChecklistBody(idx, value) {
        if (!Array.isArray(this.editing.checklist)) return;
        const item = this.editing.checklist[idx];
        if (!item) return;
        this.editing.checklist[idx] = { ...item, body: value };
      },
    };
  }

  window.makeNotificationsView = makeNotificationsView;
})();
