/* ============ tasks 360 · views Calendar + Foco ============
 * Métodos e getters das telas Calendar e Meu Foco. Pequenos e
 * self-contained — extraídos juntos pra evitar muitos arquivos.
 *
 * Dependências em app() (permanecem lá):
 *   - this.tasks, this.focusPessoaId, this.calCursor, this.calSelectedDate
 *   - this.effectiveFocusPessoaId, this.atrasada, this.effEsforco
 *
 * Dependências em window:
 *   - STATUS (helpers.js)
 * ============================================================
 */

(function () {
  'use strict';

  function makeCalendarFocoView() {
    return {
      setFocusPessoa(pid) {
        this.focusPessoaId = pid || '';
        try { localStorage.setItem('kliente360-focus-pessoa', this.focusPessoaId); } catch(_) {}
      },
      get focusGroups() {
        const empty = { atrasadas: [], hoje: [], bloqueadas: [], urgentes: [] };
        const focusId = this.effectiveFocusPessoaId;
        if (!focusId) return empty;
        const myTasks = this.tasksByPessoa.get(focusId) || [];
        const mine = myTasks.filter(t => t.status !== STATUS.CONCLUIDO);
        const todayIso = new Date().toISOString().slice(0,10);
        const prioRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
        const sortPri = (a,b) => (prioRank[a.prioridade]??9) - (prioRank[b.prioridade]??9);
        const atrasadas = mine.filter(t => this.atrasada(t)).sort((a,b) => this.diasAtraso(b) - this.diasAtraso(a) || sortPri(a,b));
        const hoje = mine.filter(t => t.prazo === todayIso && !this.atrasada(t)).sort(sortPri);
        const bloqueadas = mine.filter(t => t.status === 'bloqueado').sort((a,b) => (b.statusEm||0) - (a.statusEm||0));
        const seen = new Set([...atrasadas, ...hoje, ...bloqueadas].map(t => t.id));
        const urgentes = mine
          .filter(t => (t.prioridade === 'P0' || t.prioridade === 'P1') && !seen.has(t.id))
          .sort((a,b) => sortPri(a,b) || (a.prazo || '9999-12-31').localeCompare(b.prazo || '9999-12-31'));
        return { atrasadas, hoje, bloqueadas, urgentes };
      },
      // Narrativa heurística do dia. Determinística — sem IA. Combina
      // contagens, prioridade da próxima ação, e sugestão concreta da
      // task mais crítica. Empty quando não há pessoa selecionada.
      // Retorna { headline, action, criticaId }.
      get focoNarrativa() {
        const focusId = this.effectiveFocusPessoaId;
        if (!focusId) return null;
        const g = this.focusGroups;
        const total = g.atrasadas.length + g.hoje.length + g.bloqueadas.length + g.urgentes.length;
        if (total === 0) {
          // Próxima entrega futura pra dar contexto vs ficar vazio.
          const myTasks = (this.tasksByPessoa.get(focusId) || [])
            .filter(t => t.status !== STATUS.CONCLUIDO && t.prazo);
          if (myTasks.length === 0) return { headline: 'Sem nada agendado.', action: 'Aproveite pra atualizar status ou puxar uma task do backlog.', criticaId: null };
          const proxima = myTasks.sort((a,b) => a.prazo.localeCompare(b.prazo))[0];
          const dias = Math.max(0, Math.round((new Date(proxima.prazo + 'T00:00:00').getTime() - Date.now()) / 86400000));
          return {
            headline: 'Sem nada urgente hoje.',
            action: `Próxima entrega: "${proxima.titulo}" em ${dias}d.`,
            criticaId: proxima.id,
          };
        }
        // Pega a task mais crítica como sugestão de "comece por": atrasadas (P0 → P1 → outras) > hoje (P0/P1) > bloqueadas > urgentes.
        const sugestao =
          g.atrasadas.find(t => t.prioridade === 'P0') ||
          g.atrasadas.find(t => t.prioridade === 'P1') ||
          g.atrasadas[0] ||
          g.hoje.find(t => t.prioridade === 'P0' || t.prioridade === 'P1') ||
          g.hoje[0] ||
          g.urgentes[0] ||
          g.bloqueadas[0];
        // Headline: contagens — só inclui categorias > 0.
        const parts = [];
        if (g.hoje.length)       parts.push(`<strong>${g.hoje.length}</strong> ${g.hoje.length === 1 ? 'entrega pra hoje' : 'entregas pra hoje'}`);
        if (g.atrasadas.length)  parts.push(`<strong>${g.atrasadas.length}</strong> ${g.atrasadas.length === 1 ? 'atrasada' : 'atrasadas'}`);
        if (g.bloqueadas.length) parts.push(`<strong>${g.bloqueadas.length}</strong> ${g.bloqueadas.length === 1 ? 'bloqueada' : 'bloqueadas'}`);
        if (g.urgentes.length)   parts.push(`<strong>${g.urgentes.length}</strong> ${g.urgentes.length === 1 ? 'P0/P1 ativa' : 'P0/P1 ativas'}`);
        const headline = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' e ' + parts.slice(-1);
        // Ação sugerida (1 sentença com contexto).
        let action = '';
        if (sugestao) {
          let prefixo = '';
          if (g.atrasadas.includes(sugestao)) prefixo = `Comece por (mais atrasada${sugestao.prioridade === 'P0' || sugestao.prioridade === 'P1' ? ', ' + sugestao.prioridade : ''}):`;
          else if (g.hoje.includes(sugestao)) prefixo = `Foco do dia${sugestao.prioridade ? ` (${sugestao.prioridade})` : ''}:`;
          else if (g.bloqueadas.includes(sugestao)) prefixo = `Destrave:`;
          else prefixo = `Próxima ação${sugestao.prioridade ? ` (${sugestao.prioridade})` : ''}:`;
          action = `${prefixo} "${sugestao.titulo}"`;
        }
        return { headline, action, criticaId: sugestao ? sugestao.id : null };
      },
  
      // ===================== CALENDÁRIO =====================
      calPrev() { const d = new Date(this.calCursor); d.setMonth(d.getMonth() - 1); this.calCursor = d.getTime(); this.calSelectedDate = ''; },
      calNext() { const d = new Date(this.calCursor); d.setMonth(d.getMonth() + 1); this.calCursor = d.getTime(); this.calSelectedDate = ''; },
      calToday() { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); this.calCursor = d.getTime(); this.calSelectedDate = ''; },
      toggleCalSelection(iso) {
        this.calSelectedDate = (this.calSelectedDate === iso) ? '' : iso;
      },
      get calSelectedTasks() {
        if (!this.calSelectedDate) return [];
        const cell = this.calCells.find(c => c.iso === this.calSelectedDate);
        return cell ? cell.tasks : [];
      },
      get calMonthLabel() {
        const d = new Date(this.calCursor);
        return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      },
      get calCells() {
        const cur = new Date(this.calCursor);
        const y = cur.getFullYear(), m = cur.getMonth();
        // 1º dia da semana de início (segunda) — calcula offset
        const first = new Date(y, m, 1);
        const offset = (first.getDay() + 6) % 7; // 0=seg
        const start = new Date(y, m, 1 - offset);
        const todayIso = new Date().toISOString().slice(0,10);
        // Pre-indexa tasks por prazo (respeita filtros de cliente/pessoa)
        const byPrazo = {};
        const ativeFilter = (this.f.cliente || this.f.projeto || this.f.pessoa);
        const filterTask = (t) => (!this.f.cliente || t.clienteId === this.f.cliente) && (!this.f.projeto || t.projetoId === this.f.projeto) && (!this.f.pessoa || t.pessoaId === this.f.pessoa);
        for (const t of this.tasks) {
          if (!t.prazo) continue;
          if (t.arquivadoEm) continue;
          if (ativeFilter && !filterTask(t)) continue;
          (byPrazo[t.prazo] = byPrazo[t.prazo] || []).push(t);
        }
        // Ordena por prio (P0..P3) dentro do dia
        const prioRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
        for (const k of Object.keys(byPrazo)) {
          byPrazo[k].sort((a,b) => (prioRank[a.prioridade]??9) - (prioRank[b.prioridade]??9));
        }
        const cells = [];
        for (let i = 0; i < 42; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          const iso = d.toISOString().slice(0,10);
          const dow = (d.getDay() + 6) % 7; // 0=seg, 5=sab, 6=dom
          cells.push({
            iso,
            day: d.getDate(),
            isCurMonth: d.getMonth() === m,
            isToday: iso === todayIso,
            isWeekend: dow >= 5,
            tasks: byPrazo[iso] || [],
          });
        }
        return cells;
      },
      get calStats() {
        const cells = this.calCells.filter(c => c.isCurMonth);
        let total = 0, late = 0;
        for (const c of cells) {
          for (const t of c.tasks) {
            total++;
            if (this.atrasada(t)) late++;
          }
        }
        return { total, late };
      },
    };
  }

  window.makeCalendarFocoView = makeCalendarFocoView;
})();
