/* ============ tasks 360 · CRUD de Cadastros ============
 * Clientes, Projetos e Pessoas — adicionar, editar, arquivar, excluir.
 * Self-contained; UI vive na aba Cadastros do index.html.
 *
 * Dependências em app() (permanecem lá):
 *   - this.clientes, this.projetos, this.pessoas (state)
 *   - this.editingCliente, this.editingProjeto, this.editingPessoa
 *   - this.toast, this.askConfirm
 *
 * Dependências em window:
 *   - sb (supabase-client.js), ROLE (helpers.js)
 * ========================================================
 */

(function () {
  'use strict';

  function makeCadastrosView() {
    return {
      // ===================== CADASTROS =====================
      async addCliente() {
        const n = (this.newCli || '').trim();
        if (!n) return;
        this.newCli = '';
        const tempId = 'tmp-' + Math.random().toString(36).slice(2, 8);
        const optimistic = { id: tempId, nome: n, tier: '', arquivadoEm: null };
        this.clientes = [...this.clientes, optimistic].sort((a,b) => a.nome.localeCompare(b.nome));
        const { data, error } = await sb.from('clientes').insert({ nome: n }).select('id,nome,tier,arquivado_em').single();
        if (error) {
          this.clientes = this.clientes.filter(c => c.id !== tempId);
          this.toast('error', 'Erro: ' + error.message);
          return;
        }
        this.clientes = this.clientes.map(c => c.id === tempId ? clienteFromDb(data) : c).sort((a,b) => a.nome.localeCompare(b.nome));
      },
      renomeiaCliente(c) { this.openRename('cliente', c); },
      openNewCliente() {
        // Modo "criar": editingCliente sem id → saveCliente faz insert.
        this.editingCliente = { id: null, nome: '', tier: '' };
        this.modalCliente = true;
      },
      openEditCliente(c) {
        this.editingCliente = {
          id: c.id,
          nome: c.nome || '',
          tier: c.tier || '',
        };
        this.modalCliente = true;
      },
      async saveCliente() {
        const e = this.editingCliente;
        if (!e) return;
        const nome = (e.nome || '').trim();
        if (!nome) { this.toast('error', 'Nome obrigatório.'); return; }
        const payload = { nome, tier: e.tier || null };

        // Modo CRIAR (sem id) — insert otimista
        if (!e.id) {
          const tempId = 'tmp-' + Math.random().toString(36).slice(2, 8);
          const optimistic = { id: tempId, nome, tier: e.tier || '', arquivadoEm: null };
          this.clientes = [...this.clientes, optimistic].sort((a,b) => a.nome.localeCompare(b.nome));
          this.modalCliente = false;
          const { data, error } = await sb.from('clientes').insert(payload).select('id,nome,tier,arquivado_em').single();
          if (error) {
            this.clientes = this.clientes.filter(c => c.id !== tempId);
            this.toast('error', 'Erro ao criar: ' + error.message);
            return;
          }
          this.clientes = this.clientes.map(c => c.id === tempId ? clienteFromDb(data) : c).sort((a,b) => a.nome.localeCompare(b.nome));
          this.toast('success', `Cliente "${nome}" criado.`);
          return;
        }

        // Modo EDITAR
        const i = this.clientes.findIndex(x => x.id === e.id);
        const prev = i >= 0 ? this.clientes[i] : null;
        if (i >= 0) this.clientes[i] = { ...prev, nome, tier: e.tier || '' };
        this._dataRev++;
        this.modalCliente = false;
        const { error } = await sb.from('clientes').update(payload).eq('id', e.id);
        if (error) {
          if (prev) this.clientes[i] = prev;
          this._dataRev++;
          this.toast('error', 'Erro ao salvar: ' + error.message);
          return;
        }
        this.clientes.sort((a,b) => a.nome.localeCompare(b.nome));
        this.toast('success', 'Cliente atualizado.');
      },
      async arquivarTask(t) {
        const id = (t && t.id) || (this.editing && this.editing.id);
        if (!id) return;
        const i = this.tasks.findIndex(x => x.id === id);
        if (i < 0) return;
        const prev = this.tasks[i];
        const nowIso = new Date().toISOString();
        this.tasks[i] = { ...prev, arquivadoEm: nowIso };
        this.track('task_arquivar', { id });
        if (this.editing && this.editing.id === id) {
          this.editing.arquivadoEm = nowIso;
          this.modal = false;
        }
        const { error } = await sb.from('tasks').update({ arquivado_em: nowIso }).eq('id', id);
        if (error) { this.tasks[i] = prev; this.toast('error', 'Erro: ' + error.message); return; }
        this.toast('success', `"${prev.titulo}" arquivada.`);
      },
      async desarquivarTask(t) {
        const id = (t && t.id) || (this.editing && this.editing.id);
        if (!id) return;
        const i = this.tasks.findIndex(x => x.id === id);
        if (i < 0) return;
        const prev = this.tasks[i];
        this.tasks[i] = { ...prev, arquivadoEm: null };
        this.track('task_desarquivar', { id });
        if (this.editing && this.editing.id === id) this.editing.arquivadoEm = null;
        const { error } = await sb.from('tasks').update({ arquivado_em: null }).eq('id', id);
        if (error) { this.tasks[i] = prev; this.toast('error', 'Erro: ' + error.message); return; }
        this.toast('success', `"${prev.titulo}" desarquivada.`);
      },
      async bulkArquivar() {
        const ids = [...this.selectedIds];
        if (!ids.length) return;
        this.track('bulk_action', { kind: 'arquivar', count: ids.length });
        const nowIso = new Date().toISOString();
        const { error } = await sb.from('tasks').update({ arquivado_em: nowIso }).in('id', ids);
        if (error) { this.toast('error', 'Erro: ' + error.message); return; }
        this.tasks = this.tasks.map(t => ids.includes(t.id) ? { ...t, arquivadoEm: nowIso } : t);
        this.selectedIds = [];
        this.toast('success', ids.length + ' tarefa(s) arquivada(s).');
      },
  
      async arquivarCliente(c) {
        const i = this.clientes.findIndex(x => x.id === c.id);
        if (i < 0) return;
        // Conta filhos ativos pra propor cascade.
        const projsAtivos = (this.projetosByCliente.get(c.id) || []).filter(p => !p.arquivadoEm);
        const tasksAtivas = (this.tasks || []).filter(t => t.clienteId === c.id && !t.arquivadoEm);
        if (projsAtivos.length === 0 && tasksAtivas.length === 0) {
          return this._doArquivarCliente(c, [], []);
        }
        // Confirm explícito: lista o que vai cascatear.
        const parts = [];
        if (projsAtivos.length) parts.push(`${projsAtivos.length} projeto${projsAtivos.length === 1 ? '' : 's'}`);
        if (tasksAtivas.length) parts.push(`${tasksAtivas.length} tarefa${tasksAtivas.length === 1 ? '' : 's'} ativa${tasksAtivas.length === 1 ? '' : 's'}`);
        this.askConfirm(
          `Arquivar "${c.nome}" e também ${parts.join(' e ')}? Desarquivar é manual depois (sem cascade reverso).`,
          () => this._doArquivarCliente(c, projsAtivos, tasksAtivas),
          { label: 'arquivar tudo', danger: false }
        );
      },
      async _doArquivarCliente(c, projsAtivos, tasksAtivas) {
        const i = this.clientes.findIndex(x => x.id === c.id);
        if (i < 0) return;
        const prev = this.clientes[i];
        const nowIso = new Date().toISOString();
        // Optimistic local
        this.clientes[i] = { ...prev, arquivadoEm: nowIso };
        if (projsAtivos.length) {
          const projIds = new Set(projsAtivos.map(p => p.id));
          this.projetos = this.projetos.map(p => projIds.has(p.id) ? { ...p, arquivadoEm: nowIso } : p);
        }
        if (tasksAtivas.length) {
          const taskIds = new Set(tasksAtivas.map(t => t.id));
          this.tasks = this.tasks.map(t => taskIds.has(t.id) ? { ...t, arquivadoEm: nowIso } : t);
        }
        this._dataRev++;
        this.track('cliente_arquivar', { id: c.id, projetos: projsAtivos.length, tasks: tasksAtivas.length });
  
        // Server-side (em paralelo)
        const ops = [sb.from('clientes').update({ arquivado_em: nowIso }).eq('id', c.id)];
        if (projsAtivos.length) ops.push(sb.from('projetos').update({ arquivado_em: nowIso }).in('id', projsAtivos.map(p => p.id)));
        if (tasksAtivas.length) ops.push(sb.from('tasks').update({ arquivado_em: nowIso }).in('id', tasksAtivas.map(t => t.id)));
        const results = await Promise.all(ops);
        const err = results.find(r => r.error);
        if (err) { this.toast('error', 'Erro parcial no arquivamento: ' + err.error.message); return; }
        const detalhe = [];
        if (projsAtivos.length) detalhe.push(`${projsAtivos.length} projeto(s)`);
        if (tasksAtivas.length) detalhe.push(`${tasksAtivas.length} tarefa(s)`);
        this.toast('success', `"${c.nome}" arquivado${detalhe.length ? ' · ' + detalhe.join(' · ') + ' também' : ''}.`);
      },
      async desarquivarCliente(c) {
        const i = this.clientes.findIndex(x => x.id === c.id);
        if (i < 0) return;
        const prev = this.clientes[i];
        this.clientes[i] = { ...prev, arquivadoEm: null };
        this._dataRev++;
        this.track('cliente_desarquivar', { id: c.id });
        const { error } = await sb.from('clientes').update({ arquivado_em: null }).eq('id', c.id);
        if (error) { this.clientes[i] = prev; this._dataRev++; this.toast('error', 'Erro: ' + error.message); return; }
        this.toast('success', `"${c.nome}" desarquivado. (projetos/tarefas continuam arquivados — restaure manualmente se precisar)`);
      },
      async deleteCliente(c) {
        const tasks = (this.tasksByCliente.get(c.id) || []).length;
        const projs = (this.projetosByCliente.get(c.id) || []).length;
        if (tasks || projs) {
          this.toast('error', `Não é possível excluir: existem ${tasks} tarefa(s) e ${projs} projeto(s) vinculados.`);
          return;
        }
        this.askConfirm(`Excluir cliente "${c.nome}"?`, async () => {
          const i = this.clientes.findIndex(x => x.id === c.id);
          const prev = this.clientes[i];
          this.clientes.splice(i, 1);
          const { error } = await sb.from('clientes').delete().eq('id', c.id);
          if (error) { this.clientes.splice(i, 0, prev); this.toast('error', 'Erro: ' + error.message); }
        });
      },
  
      async addProjeto() {
        const n = (this.newProj.nome || '').trim();
        if (!n) return;
        if (!this.newProj.clienteId) { this.toast('error', 'Selecione o cliente do projeto.'); return; }
        const cid = this.newProj.clienteId;
        this.newProj = { nome: '', clienteId: '' };
        const tempId = 'tmp-' + Math.random().toString(36).slice(2, 8);
        const optimistic = { id: tempId, nome: n, clienteId: cid, slaRespostaHoras: null, slaEntregaDias: null, orcamentoHoras: null, arquivadoEm: null };
        this.projetos = [...this.projetos, optimistic].sort((a,b) => a.nome.localeCompare(b.nome));
        const { data, error } = await sb.from('projetos')
          .insert({ nome: n, cliente_id: cid })
          .select('id,nome,cliente_id,sla_resposta_horas,sla_entrega_dias,orcamento_horas,tipo,arquivado_em').single();
        if (error) {
          this.projetos = this.projetos.filter(p => p.id !== tempId);
          this.toast('error', 'Erro: ' + error.message);
          return;
        }
        this.projetos = this.projetos.map(p => p.id === tempId ? projetoFromDb(data) : p).sort((a,b) => a.nome.localeCompare(b.nome));
      },
      renomeiaProjeto(p) { this.openRename('projeto', p); },
      openNewProjeto() {
        this.editingProjeto = {
          id: null, nome: '', clienteId: '',
          slaRespostaHoras: '', slaEntregaDias: '', orcamentoHoras: '', tipo: '',
        };
        this.modalProjeto = true;
      },
      openEditProjeto(p) {
        this.editingProjeto = {
          id: p.id,
          nome: p.nome || '',
          clienteId: p.clienteId || '',
          slaRespostaHoras: p.slaRespostaHoras == null ? '' : p.slaRespostaHoras,
          slaEntregaDias:   p.slaEntregaDias   == null ? '' : p.slaEntregaDias,
          orcamentoHoras:   p.orcamentoHoras   == null ? '' : p.orcamentoHoras,
          tipo:             p.tipo || '',
        };
        this.modalProjeto = true;
      },
      async saveProjeto() {
        const e = this.editingProjeto;
        if (!e) return;
        const nome = (e.nome || '').trim();
        if (!nome) { this.toast('error', 'Nome obrigatório.'); return; }
        if (!e.clienteId) { this.toast('error', 'Cliente obrigatório.'); return; }
        const numOrNull = (v) => v === '' || v == null ? null : +v;
        const payload = {
          nome,
          cliente_id: e.clienteId,
          sla_resposta_horas: numOrNull(e.slaRespostaHoras),
          sla_entrega_dias:   numOrNull(e.slaEntregaDias),
          orcamento_horas:    numOrNull(e.orcamentoHoras),
          tipo:               e.tipo || null,
        };

        // Modo CRIAR (sem id)
        if (!e.id) {
          const tempId = 'tmp-' + Math.random().toString(36).slice(2, 8);
          const optimistic = {
            id: tempId, nome, clienteId: e.clienteId,
            slaRespostaHoras: payload.sla_resposta_horas,
            slaEntregaDias:   payload.sla_entrega_dias,
            orcamentoHoras:   payload.orcamento_horas,
            tipo:             payload.tipo || '',
            arquivadoEm: null,
          };
          this.projetos = [...this.projetos, optimistic].sort((a,b) => a.nome.localeCompare(b.nome));
          this.modalProjeto = false;
          const { data, error } = await sb.from('projetos').insert(payload)
            .select('id,nome,cliente_id,sla_resposta_horas,sla_entrega_dias,orcamento_horas,tipo,arquivado_em').single();
          if (error) {
            this.projetos = this.projetos.filter(p => p.id !== tempId);
            this.toast('error', 'Erro ao criar: ' + error.message);
            return;
          }
          this.projetos = this.projetos.map(p => p.id === tempId ? projetoFromDb(data) : p).sort((a,b) => a.nome.localeCompare(b.nome));
          this.toast('success', `Projeto "${nome}" criado.`);
          return;
        }

        // Modo EDITAR
        const i = this.projetos.findIndex(x => x.id === e.id);
        const prev = i >= 0 ? this.projetos[i] : null;
        if (i >= 0) {
          this.projetos[i] = { ...prev,
            nome,
            clienteId: e.clienteId,
            slaRespostaHoras: payload.sla_resposta_horas,
            slaEntregaDias:   payload.sla_entrega_dias,
            orcamentoHoras:   payload.orcamento_horas,
            tipo:             payload.tipo || '',
          };
        }
        this._dataRev++;
        this.modalProjeto = false;
        const { error } = await sb.from('projetos').update(payload).eq('id', e.id);
        if (error) {
          if (prev) this.projetos[i] = prev;
          this._dataRev++;
          this.toast('error', 'Erro ao salvar: ' + error.message);
          return;
        }
        this.projetos.sort((a,b) => a.nome.localeCompare(b.nome));
        this.toast('success', 'Projeto atualizado.');
      },
      async arquivarProjeto(p) {
        const i = this.projetos.findIndex(x => x.id === p.id);
        if (i < 0) return;
        const tasksAtivas = (this.tasks || []).filter(t => t.projetoId === p.id && !t.arquivadoEm);
        if (tasksAtivas.length === 0) {
          return this._doArquivarProjeto(p, []);
        }
        this.askConfirm(
          `Arquivar "${p.nome}" e também ${tasksAtivas.length} tarefa${tasksAtivas.length === 1 ? '' : 's'} ativa${tasksAtivas.length === 1 ? '' : 's'}? Desarquivar é manual depois.`,
          () => this._doArquivarProjeto(p, tasksAtivas),
          { label: 'arquivar tudo', danger: false }
        );
      },
      async _doArquivarProjeto(p, tasksAtivas) {
        const i = this.projetos.findIndex(x => x.id === p.id);
        if (i < 0) return;
        const prev = this.projetos[i];
        const nowIso = new Date().toISOString();
        this.projetos[i] = { ...prev, arquivadoEm: nowIso };
        if (tasksAtivas.length) {
          const taskIds = new Set(tasksAtivas.map(t => t.id));
          this.tasks = this.tasks.map(t => taskIds.has(t.id) ? { ...t, arquivadoEm: nowIso } : t);
        }
        this._dataRev++;
        this.track('projeto_arquivar', { id: p.id, tasks: tasksAtivas.length });
  
        const ops = [sb.from('projetos').update({ arquivado_em: nowIso }).eq('id', p.id)];
        if (tasksAtivas.length) ops.push(sb.from('tasks').update({ arquivado_em: nowIso }).in('id', tasksAtivas.map(t => t.id)));
        const results = await Promise.all(ops);
        const err = results.find(r => r.error);
        if (err) { this.toast('error', 'Erro parcial no arquivamento: ' + err.error.message); return; }
        this.toast('success', `"${p.nome}" arquivado${tasksAtivas.length ? ' · ' + tasksAtivas.length + ' tarefa(s) também' : ''}.`);
      },
      async desarquivarProjeto(p) {
        const i = this.projetos.findIndex(x => x.id === p.id);
        if (i < 0) return;
        const prev = this.projetos[i];
        this.projetos[i] = { ...prev, arquivadoEm: null };
        this._dataRev++;
        this.track('projeto_desarquivar', { id: p.id });
        const { error } = await sb.from('projetos').update({ arquivado_em: null }).eq('id', p.id);
        if (error) { this.projetos[i] = prev; this._dataRev++; this.toast('error', 'Erro: ' + error.message); return; }
        this.toast('success', `"${p.nome}" desarquivado. (tarefas continuam arquivadas — restaure manualmente se precisar)`);
      },
      async deleteProjeto(p) {
        const tasks = this.tasks.filter(t => t.projetoId === p.id).length;
        if (tasks) { this.toast('error', `Não é possível excluir: existem ${tasks} tarefa(s) vinculadas.`); return; }
        this.askConfirm(`Excluir projeto "${p.nome}"?`, async () => {
          const i = this.projetos.findIndex(x => x.id === p.id);
          const prev = this.projetos[i];
          this.projetos.splice(i, 1);
          const { error } = await sb.from('projetos').delete().eq('id', p.id);
          if (error) { this.projetos.splice(i, 0, prev); this.toast('error', 'Erro: ' + error.message); }
        });
      },
  
      openNewPessoa() {
        this.editingPessoa = {
          id: '',
          nome: '',
          email: '',
          role: 'interno',
          cliente_id: null,
          cliente_principal_id: null,
          cliente_secundario_id: null,
          capacidade_horas_semana: 40,
          skills: [],
          _skillsInput: '',
          senioridade: '',
          invited_at: null,
          user_id: null,
        };
        this.modalPessoa = true;
      },
      renomeiaPessoa(p) { this.openRename('pessoa', p); },
      openEditPessoa(p) {
        const skills = Array.isArray(p.skills) ? p.skills : [];
        this.editingPessoa = {
          id: p.id,
          nome: p.nome || '',
          email: p.email || '',
          role: p.role || 'interno',
          cliente_id: p.cliente_id || null,
          cliente_principal_id: p.cliente_principal_id || null,
          cliente_secundario_id: p.cliente_secundario_id || null,
          capacidade_horas_semana: p.capacidade_horas_semana == null ? 40 : +p.capacidade_horas_semana,
          skills,
          _skillsInput: '',
          senioridade: p.senioridade || '',
          invited_at: p.invited_at,
          user_id: p.user_id,
        };
        this.modalPessoa = true;
      },
      async savePessoa() {
        const e = this.editingPessoa;
        if (!e) return;
        const nome = (e.nome || '').trim();
        const email = (e.email || '').trim().toLowerCase();
        if (!nome) { this.toast('error', 'Dê um nome à pessoa.'); return; }
        if (e.role === ROLE.CLIENTE && !e.cliente_id) {
          this.toast('error', 'Cliente externo precisa de um cliente vinculado.');
          return;
        }
        // Skills: já vêm como array (chips). Mantém o que tem +
        // se sobrou texto digitado sem confirmar, normaliza e adiciona.
        const skills = Array.isArray(e.skills) ? [...e.skills] : [];
        const pending = this.normalizeTag(e._skillsInput || '');
        if (pending && !skills.includes(pending)) skills.push(pending);
        const payload = {
          nome,
          email: email || null,
          role: e.role || 'interno',
          cliente_id: e.role === ROLE.CLIENTE ? e.cliente_id : null,
          cliente_principal_id: e.role !== ROLE.CLIENTE ? (e.cliente_principal_id || null) : null,
          cliente_secundario_id: e.role !== ROLE.CLIENTE ? (e.cliente_secundario_id || null) : null,
          capacidade_horas_semana: e.role !== ROLE.CLIENTE ? (+e.capacidade_horas_semana || 40) : 40,
          skills: e.role !== ROLE.CLIENTE ? skills : [],
          senioridade: e.role !== ROLE.CLIENTE ? (e.senioridade || null) : null,
        };
        if (e.id) {
          // Update
          const i = this.pessoas.findIndex(x => x.id === e.id);
          const prev = i >= 0 ? this.pessoas[i] : null;
          if (i >= 0) this.pessoas[i] = { ...prev, ...payload };
          this._dataRev++;
          this.modalPessoa = false;
          const { error } = await sb.from('pessoas').update(payload).eq('id', e.id);
          if (error) {
            if (prev) this.pessoas[i] = prev;
            this._dataRev++;
            this.toast('error', 'Erro ao salvar: ' + error.message);
            return;
          }
          this.toast('success', 'Pessoa atualizada.');
        } else {
          // Insert
          const tempId = 'tmp-' + Math.random().toString(36).slice(2, 8);
          const optimistic = { id: tempId, ...payload, invited_at: null, user_id: null };
          this.pessoas = [...this.pessoas, optimistic].sort((a,b) => a.nome.localeCompare(b.nome));
          this._dataRev++;
          this.modalPessoa = false;
          const { data, error } = await sb.from('pessoas').insert(payload).select('id, nome, email, user_id, invited_at, role, cliente_id, cliente_principal_id, cliente_secundario_id, capacidade_horas_semana,skills,senioridade').single();
          if (error) {
            this.pessoas = this.pessoas.filter(p => p.id !== tempId);
            this.toast('error', 'Erro: ' + error.message);
            return;
          }
          this.pessoas = this.pessoas.map(p => p.id === tempId ? data : p).sort((a,b) => a.nome.localeCompare(b.nome));
          this.toast('success', 'Pessoa criada.');
        }
      },
      openRename(kind, item) {
        this.renameTarget = { kind, item };
        this.renameValue = item.nome;
        this.$nextTick(() => this.$refs.renameInput && this.$refs.renameInput.focus());
      },
      async confirmRename() {
        if (!this.renameTarget) return;
        const { kind, item } = this.renameTarget;
        const novo = (this.renameValue || '').trim();
        if (!novo || novo === item.nome) { this.renameTarget = null; return; }
        const tableMap = { cliente: 'clientes', projeto: 'projetos', pessoa: 'pessoas' };
        const arrMap   = { cliente: this.clientes, projeto: this.projetos, pessoa: this.pessoas };
        const arr = arrMap[kind];
        const i = arr.findIndex(x => x.id === item.id);
        const prevNome = i >= 0 ? arr[i].nome : null;
        if (i >= 0) arr[i] = { ...arr[i], nome: novo };
        this.renameTarget = null;
        const { error } = await sb.from(tableMap[kind]).update({ nome: novo }).eq('id', item.id);
        if (error) {
          if (i >= 0 && prevNome !== null) arr[i] = { ...arr[i], nome: prevNome };
          this.toast('error', 'Erro: ' + error.message);
          return;
        }
        this.toast('success', kind.charAt(0).toUpperCase()+kind.slice(1) + ' renomeado.');
      },
      async deletePessoa(p) {
        const tasks = (this.tasksByPessoa.get(p.id) || []).length;
        if (tasks) { this.toast('error', `Não é possível excluir: existem ${tasks} tarefa(s) atribuídas.`); return; }
        this.askConfirm(`Excluir "${p.nome}"?`, async () => {
          const i = this.pessoas.findIndex(x => x.id === p.id);
          const prev = this.pessoas[i];
          this.pessoas.splice(i, 1);
          const { error } = await sb.from('pessoas').delete().eq('id', p.id);
          if (error) { this.pessoas.splice(i, 0, prev); this.toast('error', 'Erro: ' + error.message); }
        });
      },
    };
  }

  window.makeCadastrosView = makeCadastrosView;
})();
