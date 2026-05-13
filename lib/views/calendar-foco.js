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
        const ativeFilter = (this.f.cliente || this.f.pessoa);
        const filterTask = (t) => (!this.f.cliente || t.clienteId === this.f.cliente) && (!this.f.pessoa || t.pessoaId === this.f.pessoa);
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
