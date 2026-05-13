/* ============ tasks 360 · Telemetria + Export PDF ============
 * Telemetria fire-and-forget pra usage_events + exportPDF do
 * relatório executivo + chart helpers do print.
 *
 * Dependências em app() (permanecem lá):
 *   - this.currentPessoa, this.printCharts (state)
 *
 * Dependências em window:
 *   - sb (supabase-client.js)
 * ==============================================================
 */

(function () {
  'use strict';

  function makeTelemetriaExportView() {
    return {
      // ============ TELEMETRIA ============
      // Fire-and-forget pra usage_events. Nunca bloqueia UI nem mostra erro.
      // Opt-out via localStorage['kliente360-telemetry'] = 'false'.
      // Retenção 90d garantida via fn_usage_events_cleanup (server).
      _sessionId() {
        try {
          let id = sessionStorage.getItem('kliente360-session');
          if (!id) {
            id = (crypto.randomUUID && crypto.randomUUID()) ||
                 (Date.now() + '-' + Math.random().toString(36).slice(2, 10));
            sessionStorage.setItem('kliente360-session', id);
          }
          return id;
        } catch (_) { return null; }
      },
      track(event, meta) {
        if (!this.authEnabled || !this.currentPessoa) return;
        try {
          if (localStorage.getItem('kliente360-telemetry') === 'false') return;
        } catch (_) {}
        const sid = this._sessionId();
        const payload = {
          event,
          meta: meta || null,
          pessoa_id: this.currentPessoa.id,
          session_id: sid,
          app_version: APP_VERSION,
        };
        // Emite session_start uma única vez por sessão, antes do primeiro
        // evento real. Marca em sessionStorage pra não repetir no reload da
        // mesma aba/sessão.
        let sessionStartFired = false;
        try { sessionStartFired = sessionStorage.getItem('kliente360-session-tracked') === sid; } catch (_) {}
        if (!sessionStartFired && event !== 'session_start') {
          try { sessionStorage.setItem('kliente360-session-tracked', sid); } catch (_) {}
          sb.from('usage_events').insert({
            event: 'session_start',
            meta: null,
            pessoa_id: this.currentPessoa.id,
            session_id: sid,
            app_version: APP_VERSION,
          }).then(() => {}, () => {});
        }
        sb.from('usage_events').insert(payload).then(() => {}, () => {});
      },
  
      toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        if (this.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
        try { localStorage.setItem('kliente360-theme', this.theme); } catch(_) {}
        // Re-renderiza charts pra pegar nova paleta (caso esteja na aba Dashboard)
        if (this.tab === 'dash') this.$nextTick(() => this.renderCharts());
      },
      exportCSV() {
        this.exportOpen = false;
        this.track('export', { kind: 'csv', rows: this.filtered.length });
        const rows = this.filtered; // exporta o que tá filtrado na visão atual
        const head = ['Título','Cliente','Projeto','Responsável','Prioridade','Status','Esforço (h)','Prazo','Tags','Descrição','Criado em'];
        const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
        const lines = [head.map(esc).join(',')];
        for (const t of rows) {
          lines.push([
            t.titulo,
            this.nomeCliente(t.clienteId),
            this.nomeProjeto(t.projetoId),
            this.nomePessoa(t.pessoaId),
            t.prioridade,
            this.lblStatus(t.status),
            t.esforco,
            t.prazo || '',
            (t.tags || []).join(', '),
            t.descricao || '',
            t.criadoEm ? new Date(t.criadoEm).toISOString().slice(0,10) : '',
          ].map(esc).join(','));
        }
        const csv = '﻿' + lines.join('\r\n'); // BOM pra Excel reconhecer UTF-8
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kliente360-tarefas-' + new Date().toISOString().slice(0,10) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.toast('success', `${rows.length} tarefa(s) exportadas em CSV.`);
      },
  
      // ===================== EXPORT PDF (relatório executivo) =====================
      // Sempre snapshot completo — ignora filtros do app.
      get reportBacklog() {
        const ativas = this._visibleTasks.filter(t => t.status !== STATUS.CONCLUIDO);
        const prioRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
        return ativas.slice().sort((a, b) => {
          // sem prazo no topo
          if (!a.prazo && b.prazo) return -1;
          if (a.prazo && !b.prazo) return 1;
          if (a.prazo && b.prazo && a.prazo !== b.prazo) return a.prazo.localeCompare(b.prazo);
          // tie-break: prioridade asc, depois título
          const pa = prioRank[a.prioridade] ?? 9, pb = prioRank[b.prioridade] ?? 9;
          if (pa !== pb) return pa - pb;
          return (a.titulo || '').localeCompare(b.titulo || '');
        });
      },
      get reportKPIs() {
        const t = this.tasks;
        const ativas = t.filter(x => x.status !== STATUS.CONCLUIDO);
        const atrasadas = ativas.filter(x => this.atrasada(x)).length;
        const now = Date.now();
        const concl7d  = t.filter(x => x.status === STATUS.CONCLUIDO && x.statusEm && (now - x.statusEm) <= 7*86400000).length;
        const concl7dPrev = t.filter(x => x.status === STATUS.CONCLUIDO && x.statusEm && (now - x.statusEm) > 7*86400000 && (now - x.statusEm) <= 14*86400000).length;
        const horasAtivas = ativas.reduce((s, x) => s + this.effEsforco(x), 0);
        // Lead time médio (14d, criação→conclusão)
        const leads = t.filter(x => x.status === STATUS.CONCLUIDO && x.statusEm && x.criadoEm && (now - x.statusEm) <= 14*86400000)
          .map(x => (x.statusEm - x.criadoEm) / 86400000)
          .filter(d => d > 0);
        const leadsPrev = t.filter(x => x.status === STATUS.CONCLUIDO && x.statusEm && x.criadoEm && (now - x.statusEm) > 14*86400000 && (now - x.statusEm) <= 28*86400000)
          .map(x => (x.statusEm - x.criadoEm) / 86400000)
          .filter(d => d > 0);
        const lt = leads.length ? (leads.reduce((a,b) => a+b, 0) / leads.length) : null;
        const ltPrev = leadsPrev.length ? (leadsPrev.reduce((a,b) => a+b, 0) / leadsPrev.length) : null;
        // % capacidade média do time (apenas pessoas com cap declarada e tasks ativas)
        const team = this.reportTeamLoad.filter(p => p.pctCap != null);
        const capMed = team.length ? Math.round(team.reduce((s,p) => s + p.pctCap, 0) / team.length) : null;
        // Clientes em risco (vermelho + amarelo)
        const cliRisco = this.reportClientHealth.filter(c => c.sinal !== 'verde').length;
        const cliVermelho = this.reportClientHealth.filter(c => c.sinal === 'vermelho').length;
  
        const pctAtr = ativas.length ? Math.round(atrasadas / ativas.length * 100) : 0;
        const dThr = concl7d - concl7dPrev;
        const dLt = (lt != null && ltPrev != null) ? +(lt - ltPrev).toFixed(1) : null;
  
        return [
          { label: 'Ativas', value: ativas.length, foot: horasAtivas + 'h previstas' },
          { label: 'Atrasadas', value: atrasadas, danger: atrasadas > 0, foot: pctAtr + '% das ativas' },
          { label: 'Throughput · 7d', value: concl7d, foot: 'concluídas',
            delta: dThr, deltaUnit: '', deltaGood: dThr >= 0 },
          { label: 'Lead time · 14d', value: lt != null ? lt.toFixed(1) + 'd' : '—', foot: 'média criação→conclusão',
            delta: dLt, deltaUnit: 'd', deltaGood: dLt != null ? dLt <= 0 : null },
          { label: 'Capac. média', value: capMed != null ? capMed + '%' : '—', danger: capMed != null && capMed > 100, foot: capMed != null ? team.length + ' pessoas com cap.' : 'sem cap. declarada' },
          { label: 'Clientes em risco', value: cliRisco, danger: cliVermelho > 0, foot: cliVermelho + ' crítico' + (cliVermelho === 1 ? '' : 's') },
        ];
      },
  
    };
  }

  window.makeTelemetriaExportView = makeTelemetriaExportView;
})();
