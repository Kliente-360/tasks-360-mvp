/* ============ tasks 360 · view do Portal cliente ============
 * Métodos e getters do Portal cliente externo. Extraído de app.js
 * pra reduzir tamanho e isolar lógica do portal. State (portalClienteId,
 * portalTask, portalTaskOpen, etc) continua em app().
 *
 * Métodos referenciam `this.*` que é o proxy Alpine — funciona porque
 * em app() usamos `Object.defineProperties(base, getOwnPropertyDescriptors(makePortalView()))`,
 * preservando getters.
 *
 * Dependências externas (em window por outros módulos):
 *   - STATUS (helpers.js)
 *   - sb (supabase-client.js)
 *
 * Não inclui: `effectivePortalClienteId` (fica em app() com viewerRole
 * e outros helpers de role), `_notifyClienteRespondeu` (notifications).
 * ============================================================
 */

(function () {
  'use strict';

  function makePortalView() {
    return {
      setPortalCliente(cid) {
        this.portalClienteId = cid || '';
        try { localStorage.setItem('kliente360-portal-cliente', this.portalClienteId); } catch(_) {}
      },
      get portalCliente() {
        return this.clientesById.get(this.effectivePortalClienteId) || null;
      },
      get portalTasks() {
        const cid = this.effectivePortalClienteId;
        if (!cid) return [];
        return this.tasks.filter(t =>
          t.clienteId === cid
          && t.visivelCliente !== false
          && !t.arquivadoEm
        );
      },
      get portalCards() {
        const arr = this.portalTasks;
        const todayIso = new Date().toISOString().slice(0,10);
        const in14 = new Date(); in14.setDate(in14.getDate() + 14);
        const in14Iso = in14.toISOString().slice(0,10);
        const cutoff30 = Date.now() - 30 * 86400000;
        const prioRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
        const sortPri = (a,b) => (prioRank[a.prioridade]??9) - (prioRank[b.prioridade]??9);
        // 1. Em andamento — status macro = andamento, sem distinção de bloqueado
        const emAndamento = arr.filter(t => t.status === 'andamento').sort(sortPri);
        // 2. Próximas entregas — não concluídas, com prazo em até 14d (incluindo hoje), exclui já atrasadas
        const proximas = arr.filter(t =>
          t.status !== STATUS.CONCLUIDO
          && t.prazo
          && t.prazo >= todayIso
          && t.prazo <= in14Iso
        ).sort((a,b) => a.prazo.localeCompare(b.prazo));
        // 3. Aguardando você — bloqueada com bloqueado_por=cliente
        const aguardando = arr.filter(t =>
          t.subetapa === 'bloqueado' && t.bloqueadoPor === 'cliente'
        ).sort(sortPri);
        // 4. Entregues recentemente — concluído, statusEm <= 30d
        const recentes = arr.filter(t =>
          t.status === STATUS.CONCLUIDO && t.statusEm && t.statusEm >= cutoff30
        ).sort((a,b) => (b.statusEm||0) - (a.statusEm||0));
        return { emAndamento, proximas, aguardando, recentes };
      },

      // ============ Portal · análises quantitativas ============
      get portalMetrics() {
        const arr = this.portalTasks;
        const now = Date.now();

        // Entregas por mês (últimos 6 meses, do mais antigo pro mais recente)
        const today = new Date();
        const mesesLabels = [];
        const mesesCounts = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const next = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
          const ini = d.getTime(), fim = next.getTime();
          const count = arr.filter(t =>
            t.status === STATUS.CONCLUIDO && t.statusEm && t.statusEm >= ini && t.statusEm < fim
          ).length;
          mesesLabels.push(d.toLocaleString('pt-BR', { month: 'short' }).replace('.', ''));
          mesesCounts.push(count);
        }
        const entregasMaxMes = Math.max(1, ...mesesCounts);
        const mesAtual = mesesCounts[mesesCounts.length - 1];
        const mesAnterior = mesesCounts[mesesCounts.length - 2];
        const mediaTrimestre = mesesCounts.slice(-3).reduce((a,b)=>a+b,0) / 3;
        const mediaSemestre = mesesCounts.reduce((a,b)=>a+b,0) / mesesCounts.length;

        // Lead time médio (concluídas com criadoEm + statusEm, últimos 90d)
        const cutoff90 = now - 90 * 86400000;
        const concluidasRecentes = arr.filter(t =>
          t.status === STATUS.CONCLUIDO && t.statusEm && t.statusEm >= cutoff90 && t.criadoEm
        );
        const leadTimes = concluidasRecentes.map(t => (t.statusEm - t.criadoEm) / 86400000);
        const leadTimeMedio = leadTimes.length
          ? Math.round(leadTimes.reduce((a,b)=>a+b,0) / leadTimes.length)
          : null;

        // Distribuição por projeto (ativas, top 5)
        const porProjeto = new Map();
        for (const t of arr) {
          if (t.status === STATUS.CONCLUIDO) continue;
          const pid = t.projetoId || '__sem__';
          porProjeto.set(pid, (porProjeto.get(pid) || 0) + 1);
        }
        const distribuicao = Array.from(porProjeto.entries())
          .map(([pid, count]) => ({
            projetoId: pid,
            nome: pid === '__sem__' ? 'sem projeto' : this.nomeProjeto(pid),
            count,
          }))
          .sort((a,b) => b.count - a.count)
          .slice(0, 5);
        const distribuicaoTotal = distribuicao.reduce((a,b)=>a+b.count, 0) || 1;

        // Próxima entrega (em ativas, com prazo)
        const todayIso = new Date().toISOString().slice(0,10);
        const proximaEntrega = arr
          .filter(t => t.status !== STATUS.CONCLUIDO && t.prazo && t.prazo >= todayIso)
          .sort((a,b) => a.prazo.localeCompare(b.prazo))[0] || null;
        const diasAteProxima = proximaEntrega
          ? Math.max(0, Math.ceil((new Date(proximaEntrega.prazo + 'T00:00:00').getTime() - new Date(todayIso + 'T00:00:00').getTime()) / 86400000))
          : null;

        // Aguardando você: aging máximo (em dias)
        const agdAging = this.portalCards.aguardando.map(t => {
          const ts = t.subetapaEm || t.statusEm || t.criadoEm || now;
          return Math.floor((now - ts) / 86400000);
        });
        const aguardandoAgingMax = agdAging.length ? Math.max(...agdAging) : 0;

        // Total visível no portal
        const totalAtivas = arr.filter(t => t.status !== STATUS.CONCLUIDO).length;
        const totalConcluidas = arr.filter(t => t.status === STATUS.CONCLUIDO).length;

        return {
          mesesLabels, mesesCounts, entregasMaxMes,
          mesAtual, mesAnterior, mediaTrimestre, mediaSemestre,
          leadTimeMedio, leadTimeAmostra: leadTimes.length,
          distribuicao, distribuicaoTotal,
          proximaEntrega, diasAteProxima,
          aguardandoAgingMax,
          totalAtivas, totalConcluidas,
        };
      },

      // Alertas amigáveis pro cliente
      get portalAlerts() {
        const m = this.portalMetrics;
        const c = this.portalCards;
        const out = [];
        // 1. Aguardando você há tempo
        if (m.aguardandoAgingMax >= 5) {
          out.push({
            severity: 'alta',
            icon: '⏳',
            titulo: c.aguardando.length === 1
              ? 'Tem um item aguardando sua resposta há ' + m.aguardandoAgingMax + ' dias'
              : c.aguardando.length + ' itens aguardando sua resposta, o mais antigo há ' + m.aguardandoAgingMax + ' dias',
            detalhe: 'Responder destrava o time pra seguir.',
          });
        }
        // 2. Prazo próximo (≤3 dias) em alguma ativa com prazo
        if (m.diasAteProxima != null && m.diasAteProxima <= 3 && m.proximaEntrega) {
          out.push({
            severity: 'media',
            icon: '📅',
            titulo: m.diasAteProxima === 0
              ? 'Entrega prevista pra hoje'
              : (m.diasAteProxima === 1 ? 'Entrega prevista pra amanhã' : 'Entrega prevista em ' + m.diasAteProxima + ' dias'),
            detalhe: m.proximaEntrega.titulo,
          });
        }
        // 3. Mês corrente com pico positivo
        if (m.mesAtual > 0 && m.mediaSemestre > 0 && m.mesAtual >= m.mediaSemestre * 1.3) {
          out.push({
            severity: 'positivo',
            icon: '↑',
            titulo: 'Mês forte: ' + m.mesAtual + ' entregas até agora',
            detalhe: 'Acima da média dos últimos 6 meses (' + m.mediaSemestre.toFixed(1) + ').',
          });
        }
        // 4. Streak de queda
        if (m.mesAtual === 0 && m.mesAnterior > 0 && m.totalAtivas > 0 && new Date().getDate() >= 15) {
          out.push({
            severity: 'media',
            icon: '·',
            titulo: 'Sem entregas neste mês ainda',
            detalhe: 'Mas há ' + m.totalAtivas + ' tarefa(s) em andamento. Acompanhe as próximas entregas abaixo.',
          });
        }
        return out;
      },

      // Headline narrativa pro topo do portal (1 frase)
      get portalHeadline() {
        const m = this.portalMetrics;
        const c = this.portalCards;
        const partes = [];
        if (m.totalAtivas > 0) {
          partes.push(m.totalAtivas + ' ' + (m.totalAtivas === 1 ? 'tarefa em andamento' : 'tarefas em andamento'));
        }
        if (c.aguardando.length > 0) {
          partes.push(c.aguardando.length + ' aguardando você');
        }
        if (m.mesAtual > 0) {
          partes.push(m.mesAtual + ' ' + (m.mesAtual === 1 ? 'entrega' : 'entregas') + ' este mês');
        }
        return partes.join(' · ') || 'Nenhuma demanda ativa no momento.';
      },

      async openPortalTask(t) {
        // Defesa em profundidade: garante que a task pertence ao cliente
        // e é visível. RLS já bloqueia no banco; este guard evita race
        // conditions (ex: task chegando via realtime antes de filtragem).
        if (!t || t.clienteId !== this.effectivePortalClienteId || t.visivelCliente === false || t.arquivadoEm) {
          return;
        }
        this.portalTask = t;
        this.portalTaskOpen = true;
        this.portalNewComment = '';
        this.portalReplyText = '';
        await this.loadPortalComments(t.id);
      },
      closePortalTask() {
        this.portalTaskOpen = false;
        this.portalTask = null;
        this.portalNewComment = '';
        this.portalReplyText = '';
        this.portalTaskComments = [];
      },
      async loadPortalComments(taskId) {
        if (!taskId) { this.portalTaskComments = []; return; }
        const { data, error } = await sb.from('task_comments')
          .select('id, parent_id, author, author_pessoa_id, body, posted_em, criado_em, external_source, visivel_cliente, from_cliente')
          .eq('task_id', taskId)
          .eq('visivel_cliente', true)
          .order('posted_em', { ascending: true, nullsFirst: true })
          .order('criado_em', { ascending: true });
        if (!error) this.portalTaskComments = data || [];
      },
      async submitPortalComment() {
        const body = (this.portalNewComment || '').trim();
        if (!body || !this.portalTask) return;
        const cliNome = (this.portalCliente && this.portalCliente.nome) || 'cliente';
        const { data, error } = await sb.from('task_comments').insert({
          task_id: this.portalTask.id,
          author: cliNome,
          body,
          author_pessoa_id: null,
          visivel_cliente: true,
          from_cliente: true,
        }).select('id').single();
        if (error) { this.toast('error', 'Erro ao comentar: ' + error.message); return; }
        this.portalNewComment = '';
        await this.loadPortalComments(this.portalTask.id);
        this.toast('success', 'Comentário enviado.');
        try {
          if (this.portalTask.pessoaId) {
            await this._notifyClienteRespondeu(this.portalTask.id, data && data.id, body, this.portalTask.pessoaId);
          }
        } catch (e) { console.warn('[notif] portal comment notify failed:', e); }
      },
      async submitJaRespondi() {
        const body = (this.portalReplyText || '').trim();
        if (!body || !this.portalTask) return;
        const cliNome = (this.portalCliente && this.portalCliente.nome) || 'cliente';
        const { data, error } = await sb.from('task_comments').insert({
          task_id: this.portalTask.id,
          author: cliNome,
          body: '✓ Já respondi: ' + body,
          author_pessoa_id: null,
          visivel_cliente: true,
          from_cliente: true,
        }).select('id').single();
        if (error) { this.toast('error', 'Erro: ' + error.message); return; }
        this.portalReplyText = '';
        await this.loadPortalComments(this.portalTask.id);
        this.toast('success', 'Sua resposta foi enviada ao time. Eles vão verificar.');
        try {
          if (this.portalTask.pessoaId) {
            await this._notifyClienteRespondeu(this.portalTask.id, data && data.id, body, this.portalTask.pessoaId);
          }
        } catch (e) { console.warn('[notif] já respondi notify failed:', e); }
      },
      portalTaskTimeline(t) {
        if (!t) return [];
        const items = [];
        if (t.criadoEm) items.push({ ts: t.criadoEm, label: 'Tarefa criada' });
        if (t.statusEm && t.statusEm !== t.criadoEm) {
          const macro = t.status === 'andamento' ? 'Em andamento'
                      : t.status === 'bloqueado' ? 'Em pausa'
                      : t.status === STATUS.CONCLUIDO ? 'Concluída'
                      : 'No backlog';
          items.push({ ts: t.statusEm, label: macro });
        }
        return items.sort((a,b) => a.ts - b.ts);
      },

      // Comments helpers do Portal (top-level filtering + replies)
      portalRepliesOf(parentId) {
        return this.portalTaskComments.filter(c => c.parent_id === parentId);
      },
      get portalTopLevelComments() {
        return this.portalTaskComments.filter(c => !c.parent_id);
      },
    };
  }

  window.makePortalView = makePortalView;
})();
