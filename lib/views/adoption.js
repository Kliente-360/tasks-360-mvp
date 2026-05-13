/* ============ tasks 360 · Adoption (Dados MVP + Telemetria features) ============
 * Carregamento e analytics de usage_events + comments pra aba Adoption.
 *
 * Dependências em app() (permanecem lá):
 *   - this.usageEvents, this.usageComments (state)
 *   - this.dashTasks, this.tasks, this.pessoas
 *   - this.toast
 *
 * Dependências em window:
 *   - sb (supabase-client.js), STATUS
 * ===========================================================================
 */

(function () {
  'use strict';

  function makeAdoptionView() {
    return {
      // ====== Dados MVP ======
      async loadMvpDados() {
        // Carrega comments do app + usage_events em janela longa pra
        // alimentar Volume 12 semanas e cohorts. Comments 60d, eventos 90d.
        const since60 = new Date(Date.now() - 60 * 86400000).toISOString();
        const since90 = new Date(Date.now() - 90 * 86400000).toISOString();
        const [cm, ev] = await Promise.all([
          sb.from('task_comments')
            .select('id, author, author_pessoa_id, criado_em, external_source, parent_id')
            .gte('criado_em', since60)
            .order('criado_em', { ascending: false })
            .limit(10000),
          sb.from('usage_events')
            .select('id, ts, pessoa_id, event, meta, session_id')
            .gte('ts', since90)
            .order('ts', { ascending: false })
            .limit(50000),
        ]);
        if (cm.error) { this.toast('error', 'Erro ao carregar dados MVP: ' + cm.error.message); return; }
        this.mvpComments = cm.data || [];
        this.usageEvents = ev.error ? [] : (ev.data || []);
        this.mvpLoadedAt = Date.now();
        this.$nextTick(() => this.renderMvpCharts());
      },
      // Eventos do app só (exclui SF) pra medir adoção interna real.
      _mvpEvents(days) {
        const cutoff = Date.now() - days * 86400000;
        const events = [];
        for (const h of this.historyAll) {
          const ts = new Date(h.occurred_at).getTime();
          if (ts < cutoff) continue;
          if (h.actor_source && h.actor_source !== 'app') continue;
          events.push({ dia: h.occurred_at.slice(0, 10), pid: h.actor_pessoa_id, kind: 'status' });
        }
        for (const c of this.mvpComments) {
          const ts = new Date(c.criado_em).getTime();
          if (ts < cutoff) continue;
          if (c.external_source) continue;
          events.push({ dia: c.criado_em.slice(0, 10), pid: c.author_pessoa_id, kind: c.parent_id ? 'reply' : 'comment' });
        }
        return events;
      },
      get mvpVolume30d() {
        // Array de {dia, eventos} pros últimos 30 dias, em ordem cronológica.
        const events = this._mvpEvents(30);
        const map = new Map();
        for (let i = 29; i >= 0; i--) {
          const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
          map.set(d.toISOString().slice(0, 10), 0);
        }
        for (const e of events) if (map.has(e.dia)) map.set(e.dia, map.get(e.dia) + 1);
        return Array.from(map, ([dia, eventos]) => ({ dia, eventos }));
      },
      get mvpDau14d() {
        const events = this._mvpEvents(14);
        const map = new Map();
        for (let i = 13; i >= 0; i--) {
          const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
          map.set(d.toISOString().slice(0, 10), new Set());
        }
        for (const e of events) {
          if (!e.pid) continue;
          if (map.has(e.dia)) map.get(e.dia).add(e.pid);
        }
        return Array.from(map, ([dia, set]) => ({ dia, pessoas: set.size }));
      },
      get mvpStickiness14d() {
        const events = this._mvpEvents(14);
        const byPid = new Map();
        for (const e of events) {
          if (!e.pid) continue;
          if (!byPid.has(e.pid)) byPid.set(e.pid, new Set());
          byPid.get(e.pid).add(e.dia);
        }
        const out = [];
        for (const [pid, dias] of byPid) {
          const p = this.pessoasById.get(pid);
          out.push({ pid, nome: (p && p.nome) || '—', email: (p && p.email) || '', dias_ativos: dias.size });
        }
        return out.sort((a, b) => b.dias_ativos - a.dias_ativos);
      },
      get mvpTotals() {
        const events = this._mvpEvents(30);
        const totalSemPessoa = events.filter(e => !e.pid).length;
        const totalComPessoa = events.filter(e => e.pid).length;
        const last7 = this._mvpEvents(7);
        const last1 = this._mvpEvents(1);
        return {
          eventos30d: events.length,
          eventos7d: last7.length,
          eventos1d: last1.length,
          anonimos30d: totalSemPessoa,
          atribuidos30d: totalComPessoa,
          pessoasAtivas14d: this.mvpStickiness14d.length,
        };
      },
  
      // ============ TELEMETRIA · features ============
      // Top features por contagem (30d). Limita a 20 pra caber em chart.
      get usageTopFeatures() {
        const counts = new Map();
        for (const e of this.usageEvents) counts.set(e.event, (counts.get(e.event) || 0) + 1);
        return Array.from(counts.entries())
          .map(([event, count]) => ({ event, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20);
      },
      // Tendência: features com crescimento/declínio entre últimos 15d e 15-30d.
      get usageTendencia() {
        const cutMid = Date.now() - 15 * 86400000;
        const a = new Map(), b = new Map(); // recente vs anterior
        for (const e of this.usageEvents) {
          const t = new Date(e.ts).getTime();
          const m = t >= cutMid ? a : b;
          m.set(e.event, (m.get(e.event) || 0) + 1);
        }
        const keys = new Set([...a.keys(), ...b.keys()]);
        const out = [];
        for (const k of keys) {
          const recent = a.get(k) || 0;
          const prev = b.get(k) || 0;
          if (recent + prev < 5) continue; // ignora ruído
          const delta = prev === 0 ? 100 : Math.round((recent - prev) / prev * 100);
          out.push({ event: k, recent, prev, delta });
        }
        return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 10);
      },
      // Features órfãs: <1 uso por usuário ativo por semana (candidatas a deprecar).
      get usageOrfas() {
        const pessoasAtivas = this.mvpStickiness14d.length || 1;
        const limite = pessoasAtivas * 4; // 4 semanas em 30d
        // Eventos esperados a registrar (whitelist conhecida)
        const tracked = [
          'tab_open', 'palette_open', 'palette_select', 'export', 'help_open',
          'onboarding_open', 'task_create', 'task_edit', 'comment_post', 'bulk_action',
        ];
        const counts = new Map(tracked.map(k => [k, 0]));
        for (const e of this.usageEvents) {
          if (counts.has(e.event)) counts.set(e.event, counts.get(e.event) + 1);
        }
        return Array.from(counts.entries())
          .map(([event, count]) => ({ event, count, limite }))
          .filter(x => x.count < x.limite)
          .sort((a, b) => a.count - b.count);
      },
      // Únicos: usuários únicos com qualquer evento últimos 7d/30d.
      get usageDauWau() {
        const cut7 = Date.now() - 7 * 86400000;
        const cut30 = Date.now() - 30 * 86400000;
        const s7 = new Set(), s30 = new Set();
        for (const e of this.usageEvents) {
          if (!e.pessoa_id) continue;
          const t = new Date(e.ts).getTime();
          if (t >= cut7) s7.add(e.pessoa_id);
          if (t >= cut30) s30.add(e.pessoa_id);
        }
        return { dau7: s7.size, wau30: s30.size };
      },
      // Breakdown de tab_open: quais tabs são mais visitadas.
      get usageTabBreakdown() {
        const counts = new Map();
        for (const e of this.usageEvents) {
          if (e.event !== 'tab_open' || !e.meta) continue;
          const tab = e.meta.tab;
          if (!tab) continue;
          counts.set(tab, (counts.get(tab) || 0) + 1);
        }
        return Array.from(counts.entries())
          .map(([tab, count]) => ({ tab, count }))
          .sort((a, b) => b.count - a.count);
      },
      // Adoção por pessoa: agregação ao nível usuário pra ver quem usa o quê.
      // Acende sinais de baixa adoção (linha vermelha = silencioso há +7d).
      // Se houver adoptionFilter ativo (role/senioridade/cliente principal),
      // só inclui as pessoas que casam — propaga pra classificação e alertas.
      get usagePorPessoa() {
        const now = Date.now();
        const cut7 = now - 7 * 86400000;
        const cut30 = now - 30 * 86400000;
        const filteredIds = this._adoptionFilteredPessoaIds();
        // Agrega por pessoa
        const acc = new Map();
        for (const e of this.usageEvents) {
          if (!e.pessoa_id) continue;
          if (filteredIds && !filteredIds.has(e.pessoa_id)) continue;
          const ts = new Date(e.ts).getTime();
          if (ts < cut30) continue;
          let r = acc.get(e.pessoa_id);
          if (!r) {
            r = { pessoaId: e.pessoa_id, total: 0, last: 0, dias: new Set(), logins: 0, sessions: new Set(), features: new Map() };
            acc.set(e.pessoa_id, r);
          }
          r.total++;
          if (ts > r.last) r.last = ts;
          r.dias.add(new Date(ts).toISOString().slice(0, 10));
          if (e.event === 'login') r.logins++;
          if (e.session_id) r.sessions.add(e.session_id);
          r.features.set(e.event, (r.features.get(e.event) || 0) + 1);
        }
        // Inclui pessoas cadastradas sem eventos (silenciosas)
        for (const p of this.pessoas) {
          if (p.role === ROLE.CLIENTE) continue;
          if (filteredIds && !filteredIds.has(p.id)) continue;
          if (!acc.has(p.id)) {
            acc.set(p.id, { pessoaId: p.id, total: 0, last: 0, dias: new Set(), logins: 0, sessions: new Set(), features: new Map() });
          }
        }
        const out = [];
        for (const [pid, r] of acc) {
          const p = this.pessoasById.get(pid);
          if (!p || p.role === ROLE.CLIENTE) continue;
          const top3 = Array.from(r.features.entries())
            .sort((a, b) => b[1] - a[1]).slice(0, 3)
            .map(([k, v]) => `${k}(${v})`).join(' · ');
          const silencioso7d = r.last === 0 || r.last < cut7;
          out.push({
            pessoaId: pid,
            nome: p.nome,
            senioridade: p.senioridade || '',
            total: r.total,
            dias_ativos: r.dias.size,
            sessions: r.sessions.size,
            logins: r.logins,
            ultima_atividade: r.last ? new Date(r.last).toISOString() : null,
            ultimo_dias: r.last ? Math.floor((now - r.last) / 86400000) : null,
            top3,
            silencioso7d,
          });
        }
        // Ordena: silenciosos (mais críticos) primeiro, depois por total desc
        return out.sort((a, b) => {
          if (a.silencioso7d !== b.silencioso7d) return a.silencioso7d ? -1 : 1;
          return b.total - a.total;
        });
      },
      // Pessoas que NÃO geraram nenhum evento em 7d. Subset de usagePorPessoa.
      get usuariosSilenciosos() {
        return this.usagePorPessoa.filter(r => r.silencioso7d);
      },
      // Adoção por feature: % de pessoas únicas que usaram cada feature
      // (largura do uso, não só profundidade). Complementa usageTopFeatures.
      get featureAdocao() {
        const internos = this.pessoas.filter(p => p.role !== ROLE.CLIENTE).length || 1;
        const byEvent = new Map();
        for (const e of this.usageEvents) {
          if (!e.pessoa_id) continue;
          if (!byEvent.has(e.event)) byEvent.set(e.event, new Set());
          byEvent.get(e.event).add(e.pessoa_id);
        }
        return Array.from(byEvent.entries())
          .map(([event, set]) => ({
            event,
            pessoas: set.size,
            pct: Math.round((set.size / internos) * 100),
          }))
          .sort((a, b) => b.pct - a.pct);
      },

      // ============ Adoption v2 · classificações + alertas + narrativa ============
      // Janela utility: retorna eventos entre [now-daysFrom, now-daysTo) dias atrás.
      _usageInWindow(daysFrom, daysTo = 0) {
        const now = Date.now();
        const ini = now - daysFrom * 86400000;
        const fim = now - daysTo * 86400000;
        return this.usageEvents.filter(e => {
          const ts = new Date(e.ts).getTime();
          return ts >= ini && ts < fim;
        });
      },

      // Δ esta semana (7d) vs semana anterior (7-14d atrás). Insumo do banner.
      get usageWeekDeltas() {
        const w0 = this._usageInWindow(7, 0);
        const w1 = this._usageInWindow(14, 7);
        const pessoasInternas = new Set();
        const internoIds = new Set(this.pessoas.filter(p => p.role !== ROLE.CLIENTE).map(p => p.id));
        const countDistinct = (arr) => {
          const s = new Set();
          for (const e of arr) if (e.pessoa_id && internoIds.has(e.pessoa_id)) s.add(e.pessoa_id);
          return s.size;
        };
        const countSessions = (arr) => {
          const s = new Set();
          for (const e of arr) if (e.session_id) s.add(e.session_id);
          return s.size;
        };
        const internosOnly = (arr) => arr.filter(e => e.pessoa_id && internoIds.has(e.pessoa_id));
        const ev0 = internosOnly(w0).length, ev1 = internosOnly(w1).length;
        const ps0 = countDistinct(w0), ps1 = countDistinct(w1);
        const ss0 = countSessions(w0), ss1 = countSessions(w1);
        const pct = (a, b) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round((a - b) / b * 100));
        return {
          eventos:        { atual: ev0, prev: ev1, delta: ev0 - ev1, pct: pct(ev0, ev1) },
          pessoasAtivas:  { atual: ps0, prev: ps1, delta: ps0 - ps1, pct: pct(ps0, ps1) },
          sessions:       { atual: ss0, prev: ss1, delta: ss0 - ss1, pct: pct(ss0, ss1) },
        };
      },

      // Δ mês corrente vs anterior pra macro view.
      get usageMonthDelta() {
        const m0 = this._usageInWindow(30, 0).length;
        const m1 = this._usageInWindow(60, 30).length;
        const pct = m1 === 0 ? (m0 > 0 ? 100 : 0) : Math.round((m0 - m1) / m1 * 100);
        return { atual: m0, prev: m1, delta: m0 - m1, pct };
      },

      // Classificação por pessoa (interna). Top 25% volume = Power.
      // Categorias: 'power' | 'regular' | 'light' | 'silenciosa' | 'nunca' | 'novo'
      get usagePessoaClassificada() {
        const base = this.usagePorPessoa;
        if (!base.length) return [];
        const eventos = base.map(r => r.total).filter(n => n > 0).sort((a, b) => b - a);
        // Top quartil
        const idxQ1 = Math.max(0, Math.floor(eventos.length * 0.25) - 1);
        const limitePower = eventos[idxQ1] || Infinity;
        const now = Date.now();
        const cut7 = now - 7 * 86400000;
        const cut14d_iso = new Date(now - 14 * 86400000).toISOString();
        return base.map(r => {
          const p = this.pessoasById.get(r.pessoaId);
          const invitedAt = p && p.invited_at;
          const invited14dPlus = invitedAt && invitedAt < cut14d_iso;
          let kind, sev;
          if (r.total === 0) {
            // Nunca usou no período. Se convite >14d e nunca usou = caso crítico
            if (invited14dPlus) { kind = 'nunca'; sev = 'alta'; }
            else { kind = 'novo'; sev = 'baixa'; }
          } else if (r.silencioso7d) { kind = 'silenciosa'; sev = 'media'; }
          else if (r.total >= limitePower && r.dias_ativos >= 12) { kind = 'power'; sev = 'positivo'; }
          else if (r.dias_ativos >= 6) { kind = 'regular'; sev = 'ok'; }
          else { kind = 'light'; sev = 'baixa'; }
          return { ...r, kind, sev };
        });
      },

      // Classificação de features (visão whitelist + emergentes).
      // 'core' (≥70% pessoas E uso semanal médio) | 'healthy' (40-70%) |
      // 'niche' (10-40%) | 'em-queda' (Δ<-30% vs sem ant) | 'orfa' (<10%)
      get usageFeaturesClassificadas() {
        const internos = this.pessoas.filter(p => p.role !== ROLE.CLIENTE).length || 1;
        const ad = this.featureAdocao;
        // Δ por feature vs semana anterior
        const w0 = this._usageInWindow(7, 0);
        const w1 = this._usageInWindow(14, 7);
        const count = (arr) => { const m = new Map(); for (const e of arr) m.set(e.event, (m.get(e.event)||0)+1); return m; };
        const c0 = count(w0), c1 = count(w1);
        return ad.map(r => {
          const v0 = c0.get(r.event) || 0;
          const v1 = c1.get(r.event) || 0;
          const delta = v1 === 0 ? (v0 > 0 ? 100 : 0) : Math.round((v0 - v1) / v1 * 100);
          let kind;
          // Em-queda tem prioridade alta se for feature core/healthy
          if (delta < -30 && v0 + v1 >= 10) kind = 'em-queda';
          else if (r.pct >= 70) kind = 'core';
          else if (r.pct >= 40) kind = 'healthy';
          else if (r.pct >= 10) kind = 'niche';
          else kind = 'orfa';
          return { ...r, v7: v0, v7Prev: v1, delta, kind };
        });
      },

      // Alertas A1-A10 derivados. Top 5 por severidade.
      get usageAlertas() {
        const out = [];
        const pess = this.usagePessoaClassificada;
        const feats = this.usageFeaturesClassificadas;
        const weeks = this.usageWeekDeltas;
        // A1: Power user em queda forte
        for (const p of pess) {
          if ((p.kind === 'silenciosa' || p.kind === 'light') && p.total >= 5) {
            const w = this._usageInWindow(7, 0).filter(e => e.pessoa_id === p.pessoaId).length;
            const w1 = this._usageInWindow(14, 7).filter(e => e.pessoa_id === p.pessoaId).length;
            if (w1 >= 5 && w < w1 * 0.5) {
              out.push({ severity: 'alta', kind: 'queda_pessoa', titulo: `${p.nome} em queda forte`, detalhe: `${w1} → ${w} eventos (-${Math.round((w1 - w)/w1*100)}%)` });
            }
          }
        }
        // A2: Pessoa nunca logou (>14d desde convite)
        for (const p of pess) {
          if (p.kind === 'nunca') {
            out.push({ severity: 'alta', kind: 'nunca_logou', titulo: `${p.nome} nunca usou`, detalhe: `convidado há +14d, sem nenhum evento` });
          }
        }
        // A3: Silenciosa
        for (const p of pess) {
          if (p.kind === 'silenciosa') {
            out.push({ severity: 'media', kind: 'silenciosa', titulo: `${p.nome} silenciosa há ${p.ultimo_dias || '?'} dias`, detalhe: `tinha histórico ativo` });
          }
        }
        // A5: Feature em colapso
        for (const f of feats) {
          if (f.kind === 'em-queda' && f.v7Prev >= 10) {
            out.push({ severity: 'alta', kind: 'feature_colapso', titulo: `${f.event} em colapso`, detalhe: `${f.v7Prev} → ${f.v7} eventos (${f.delta}%)` });
          }
        }
        // A6: Feature emergente
        for (const f of feats) {
          if (f.delta >= 200 && f.v7 >= 5) {
            out.push({ severity: 'positivo', kind: 'feature_emerge', titulo: `${f.event} emergente`, detalhe: `+${f.delta}% vs sem ant` });
          }
        }
        // A8: Adoption geral em queda
        if (weeks.eventos.prev >= 50 && weeks.eventos.pct <= -30) {
          out.push({ severity: 'alta', kind: 'macro_queda', titulo: `Adoption geral caindo`, detalhe: `${weeks.eventos.prev} → ${weeks.eventos.atual} eventos esta sem (${weeks.eventos.pct}%)` });
        }
        // A9: Pico positivo
        if (weeks.eventos.prev >= 20 && weeks.eventos.pct >= 50) {
          out.push({ severity: 'positivo', kind: 'macro_pico', titulo: `Adoption em alta`, detalhe: `+${weeks.eventos.pct}% vs sem ant` });
        }
        // A10: Engajamento parcial (pessoa ativa mas usa <3 features distintas)
        for (const p of pess) {
          if (p.kind === 'regular' || p.kind === 'power') {
            const distinct = new Set();
            for (const e of this.usageEvents) {
              if (e.pessoa_id === p.pessoaId) distinct.add(e.event);
            }
            if (distinct.size < 3) {
              out.push({ severity: 'baixa', kind: 'engaj_parcial', titulo: `${p.nome} usa só ${distinct.size} feature(s)`, detalhe: `ativa mas concentrada` });
            }
          }
        }
        // Ordena: alta → positivo → media → baixa, limitado a 8
        const sevRank = { alta: 0, positivo: 1, media: 2, baixa: 3 };
        out.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
        return out.slice(0, 8);
      },

      // ============ Adoption v2 · visualizações ============
      // Heatmap pessoa × dia (28 dias). Cor por intensidade de eventos.
      get usageHeatmap28d() {
        const days = 28;
        const today = new Date(); today.setHours(0,0,0,0);
        const cells = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(today); d.setDate(d.getDate() - i);
          cells.push(d.toISOString().slice(0,10));
        }
        // Por pessoa: { pessoaId, nome, dailyCounts: [n,n,...] (28 items) }
        const internoIds = new Set(this.pessoas.filter(p => p.role !== ROLE.CLIENTE).map(p => p.id));
        const byPessoa = new Map();
        for (const pid of internoIds) {
          byPessoa.set(pid, Array(days).fill(0));
        }
        const dayIndex = new Map(cells.map((iso, i) => [iso, i]));
        for (const e of this.usageEvents) {
          if (!e.pessoa_id || !internoIds.has(e.pessoa_id)) continue;
          const iso = e.ts.slice(0, 10);
          const idx = dayIndex.get(iso);
          if (idx == null) continue;
          const arr = byPessoa.get(e.pessoa_id);
          if (arr) arr[idx]++;
        }
        const out = [];
        for (const [pid, daily] of byPessoa) {
          const total = daily.reduce((a,b) => a+b, 0);
          if (total === 0) continue;  // não mostra quem nunca usou no heatmap
          const p = this.pessoasById.get(pid);
          if (!p) continue;
          out.push({ pessoaId: pid, nome: p.nome, daily, total });
        }
        out.sort((a, b) => b.total - a.total);
        return { dias: cells, pessoas: out };
      },

      // Volume semanal (12 semanas). Bar chart pra ler tendência macro.
      get usageVolume12Sem() {
        const weeks = [];
        const now = Date.now();
        for (let i = 11; i >= 0; i--) {
          const fim = now - i * 7 * 86400000;
          const ini = fim - 7 * 86400000;
          let count = 0;
          for (const e of this.usageEvents) {
            const ts = new Date(e.ts).getTime();
            if (ts >= ini && ts < fim) count++;
          }
          const labelDate = new Date(ini);
          const label = String(labelDate.getDate()).padStart(2,'0') + '/' + String(labelDate.getMonth()+1).padStart(2,'0');
          weeks.push({ label, count });
        }
        const max = Math.max(1, ...weeks.map(w => w.count));
        return { weeks, max };
      },

      // Sparklines por feature (top 10). Cada feature: [n diários, 28d]
      get usageFeatureSparklines() {
        const days = 28;
        const today = new Date(); today.setHours(0,0,0,0);
        const cells = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(today); d.setDate(d.getDate() - i);
          cells.push(d.toISOString().slice(0,10));
        }
        const dayIndex = new Map(cells.map((iso, i) => [iso, i]));
        const internoIds = new Set(this.pessoas.filter(p => p.role !== ROLE.CLIENTE).map(p => p.id));
        const byEvent = new Map();
        for (const e of this.usageEvents) {
          if (!e.pessoa_id || !internoIds.has(e.pessoa_id)) continue;
          const idx = dayIndex.get(e.ts.slice(0,10));
          if (idx == null) continue;
          if (!byEvent.has(e.event)) byEvent.set(e.event, Array(days).fill(0));
          byEvent.get(e.event)[idx]++;
        }
        const out = [];
        for (const [event, daily] of byEvent) {
          const total = daily.reduce((a,b) => a+b, 0);
          if (total < 3) continue;  // ignora eventos com volume muito baixo
          const max = Math.max(1, ...daily);
          out.push({ event, daily, total, max });
        }
        return out.sort((a,b) => b.total - a.total).slice(0, 10);
      },

      // ============ Adoption v2 · segmentação + Portal cliente ============
      // Retorna ids de pessoas internas que passam pelo filtro de segmentação.
      // null = pessoa internas todas (sem filtro). Set = subset filtrado.
      _adoptionFilteredPessoaIds() {
        const f = this.adoptionFilter || {};
        const hasFilter = !!(f.role || f.senioridade || f.clientePrincipalId);
        if (!hasFilter) return null;
        const ids = new Set();
        for (const p of this.pessoas) {
          if (p.role === ROLE.CLIENTE) continue;
          if (f.role && p.role !== f.role) continue;
          if (f.senioridade && (p.senioridade || '') !== f.senioridade) continue;
          if (f.clientePrincipalId && (p.cliente_principal_id || '') !== f.clientePrincipalId) continue;
          ids.add(p.id);
        }
        return ids;
      },

      // True se há ao menos 1 filtro de segmentação aplicado.
      adoptionAnyFilter() {
        const f = this.adoptionFilter || {};
        return !!(f.role || f.senioridade || f.clientePrincipalId);
      },

      // Versão filtrada do banner narrativo. Útil quando há segmentação.
      get usageNarrativeFiltered() {
        const ids = this._adoptionFilteredPessoaIds();
        if (!ids) return null;
        return ids.size + ' pessoa(s) no filtro selecionado';
      },

      // ============ Portal cliente adoption ============
      // Dedicada à role=cliente. Janela 30d.
      get portalClienteAdoption() {
        const now = Date.now();
        const cut30 = now - 30 * 86400000;
        const cut7  = now - 7  * 86400000;
        const cliPessoaIds = new Set(this.pessoas.filter(p => p.role === ROLE.CLIENTE).map(p => p.id));
        if (cliPessoaIds.size === 0) return null;
        // Agrega por pessoa cliente
        const acc = new Map();
        for (const e of this.usageEvents) {
          if (!e.pessoa_id || !cliPessoaIds.has(e.pessoa_id)) continue;
          const ts = new Date(e.ts).getTime();
          if (ts < cut30) continue;
          let r = acc.get(e.pessoa_id);
          if (!r) {
            r = { pessoaId: e.pessoa_id, total: 0, last: 0, dias: new Set(), sessions: new Set(), features: new Map() };
            acc.set(e.pessoa_id, r);
          }
          r.total++;
          if (ts > r.last) r.last = ts;
          r.dias.add(new Date(ts).toISOString().slice(0, 10));
          if (e.session_id) r.sessions.add(e.session_id);
          r.features.set(e.event, (r.features.get(e.event) || 0) + 1);
        }
        // Inclui clientes cadastrados sem eventos
        for (const pid of cliPessoaIds) {
          if (!acc.has(pid)) {
            acc.set(pid, { pessoaId: pid, total: 0, last: 0, dias: new Set(), sessions: new Set(), features: new Map() });
          }
        }
        const out = [];
        for (const [pid, r] of acc) {
          const p = this.pessoasById.get(pid);
          if (!p) continue;
          const top3 = Array.from(r.features.entries())
            .sort((a, b) => b[1] - a[1]).slice(0, 3)
            .map(([k, v]) => `${k}(${v})`).join(' · ');
          const ultimo_dias = r.last ? Math.floor((now - r.last) / 86400000) : null;
          const silencioso7d = r.last === 0 || r.last < cut7;
          out.push({
            pessoaId: pid, nome: p.nome, email: p.email || '',
            cliente_nome: this.nomeCliente(p.cliente_id),
            total: r.total, dias_ativos: r.dias.size, sessions: r.sessions.size,
            ultimo_dias, silencioso7d, top3,
          });
        }
        return out.sort((a, b) => {
          if (a.silencioso7d !== b.silencioso7d) return a.silencioso7d ? 1 : -1;
          return b.total - a.total;
        });
      },

      // Totais agregados pra cards do bloco Portal.
      get portalClienteTotals() {
        const arr = this.portalClienteAdoption || [];
        const ativos7d = arr.filter(r => !r.silencioso7d).length;
        const total = arr.length;
        const eventos30d = arr.reduce((s, r) => s + r.total, 0);
        const nunca = arr.filter(r => r.total === 0).length;
        return { ativos7d, total, eventos30d, nunca };
      },

      // Banner narrativo (top da aba). 1 frase com o essencial.
      get usageNarrativeHeadline() {
        const w = this.usageWeekDeltas;
        const pess = this.usagePessoaClassificada;
        const silenciosas = pess.filter(p => p.kind === 'silenciosa').length;
        const nunca = pess.filter(p => p.kind === 'nunca').length;
        const power = pess.filter(p => p.kind === 'power').length;
        const partes = [];
        const dir = w.eventos.pct === 0 ? '=' : (w.eventos.pct > 0 ? '↑' : '↓');
        partes.push(`${w.eventos.atual} eventos esta sem (${dir}${w.eventos.pct >= 0 ? '+' : ''}${w.eventos.pct}% vs sem ant)`);
        partes.push(`${w.pessoasAtivas.atual} pessoa(s) ativa(s)`);
        if (power > 0) partes.push(`${power} power user(s)`);
        if (silenciosas > 0) partes.push(`${silenciosas} silenciosa(s)`);
        if (nunca > 0) partes.push(`${nunca} nunca usou`);
        return partes.join(' · ');
      },
      renderMvpCharts() {
        if (typeof Chart === 'undefined') return;
        const v = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const brand = v('--brand'), brandDark = v('--brand-dark'), muted = v('--muted'), inkSoft = v('--ink-soft'), line = v('--line');
        const baseOpts = {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: v('--bg-elev'), titleColor: v('--ink'), bodyColor: v('--ink-soft'), borderColor: v('--line'), borderWidth: 1, padding: 8, displayColors: false } },
        };
        // _upsertChart cuida do reuse/destroy.
  
        const fmtDay = (iso) => {
          const d = new Date(iso + 'T00:00:00');
          return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
        };
  
        const vol = this.mvpVolume30d;
        const ctxV = document.getElementById('chartMvpVolume');
        if (ctxV) {
          this._upsertChart('mvpVolume', ctxV, {
            type: 'bar',
            data: { labels: vol.map(d => fmtDay(d.dia)), datasets: [{ data: vol.map(d => d.eventos), backgroundColor: brand, borderRadius: 3, maxBarThickness: 16 }] },
            options: { ...baseOpts,
              scales: {
                x: { grid: { display: false }, ticks: { color: muted, font: { family: 'IBM Plex Mono', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, border: { display: false } },
                y: { grid: { color: line }, ticks: { color: inkSoft, font: { family: 'IBM Plex Mono', size: 10 }, stepSize: 1, precision: 0 }, border: { display: false } }
              }
            }
          });
        }
  
        const dau = this.mvpDau14d;
        const ctxD = document.getElementById('chartMvpDau');
        if (ctxD) {
          this._upsertChart('mvpDau', ctxD, {
            type: 'bar',
            data: { labels: dau.map(d => fmtDay(d.dia)), datasets: [{ data: dau.map(d => d.pessoas), backgroundColor: dau.map((_, i) => i === dau.length - 1 ? brandDark : brand), borderRadius: 3, maxBarThickness: 24 }] },
            options: { ...baseOpts,
              scales: {
                x: { grid: { display: false }, ticks: { color: muted, font: { family: 'IBM Plex Mono', size: 10 } }, border: { display: false } },
                y: { grid: { color: line }, ticks: { color: inkSoft, font: { family: 'IBM Plex Mono', size: 10 }, stepSize: 1, precision: 0 }, border: { display: false } }
              }
            }
          });
        }
      },
  
      // Heurísticas pré-IA — Onda A. Detector determinístico (sem LLM).
      // Retorna lista ordenada de alertas pra mostrar no banner do Dashboard.
      get heuristicAlerts() {
        // Inclui taskDeps e pessoas no sig porque algumas heurísticas leem.
        const sig = this._tasksSig + ':' + this.pessoas.length + ':' + (this.taskDeps && this.taskDeps.length || 0) + ':' + this._dataRev;
        return this._memo('heuristicAlerts', sig, () => this._computeHeuristicAlerts());
      },
      _computeHeuristicAlerts() {
        const out = [];
        const now = Date.now();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString().slice(0, 10);
        const in10Iso = new Date(today.getTime() + 10 * 86400000).toISOString().slice(0, 10);
        const in14Iso = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  
        // Maps de referência (1 passada cada, reused dentro do loop)
        const tierByCli      = this.clientesById;        // já cacheado
        const pessoaById     = this.pessoasById;         // já cacheado
        const projetoById    = this.projetosById;        // já cacheado
        const taskById       = this.tasksById;           // já cacheado
  
        // Buckets pra cada heurística — uma única varredura sobre ativas.
        const bGrandes = [];
        const cargaPorPessoa = new Map();    // pessoaId → horas
        const bAtrasEstr = [];
        const cliCountAtrasEstr = new Map(); // clienteId → n
        const bBloqLongos = [];
        const bSlaIminente = [];
        const bJuniorComplex = [];
        const bReabertas = [];
        const bBloqDep = [];
        const bEstimFurada = [];
  
        for (const t of this.tasks) {
          if (t.status === STATUS.CONCLUIDO) continue;
          if (t.arquivadoEm) continue;
  
          const sz = this.effTamanho(t);
          const isGrande = (sz === 'grande' || sz === 'mini_projeto');
  
          // 1. grande/mini-projeto em backlog com prazo ≤10d
          if (isGrande && t.subetapa === 'backlog' &&
              t.prazo && t.prazo >= todayIso && t.prazo <= in10Iso) {
            bGrandes.push(t);
          }
  
          // 2. carga por pessoa (acumula horas)
          if (t.pessoaId) {
            cargaPorPessoa.set(t.pessoaId, (cargaPorPessoa.get(t.pessoaId) || 0) + this.effEsforco(t));
          }
  
          // 3. atrasada em cliente estratégico
          if (this.atrasada(t)) {
            const cli = tierByCli.get(t.clienteId);
            if (cli && cli.tier === TIER.ESTRATEGICO) {
              bAtrasEstr.push(t);
              const n = cliCountAtrasEstr.get(t.clienteId) || 0;
              cliCountAtrasEstr.set(t.clienteId, n + 1);
            }
          }
  
          // 4. bloqueio aguardando cliente há +5d
          if (t.subetapa === 'bloqueado' && t.bloqueadoPor === 'cliente' && this.agingDays(t) >= 5) {
            bBloqLongos.push(t);
          }
  
          // 5. SLA iminente (proj com sla_entrega_dias)
          const proj = t.projetoId ? projetoById.get(t.projetoId) : null;
          if (proj && proj.slaEntregaDias && t.criadoEm) {
            const aging = (now - t.criadoEm) / 86400000;
            if (aging >= proj.slaEntregaDias * 0.8 && aging < proj.slaEntregaDias * 1.2) {
              bSlaIminente.push(t);
            }
          }
  
          // 6. junior + complexidade alta
          if (t.complexidade === 'alta' && t.pessoaId) {
            const p = pessoaById.get(t.pessoaId);
            if (p && p.senioridade === 'junior') bJuniorComplex.push(t);
          }
  
          // 7. reaberturas crônicas
          if ((t.reopenCount || 0) >= 2) bReabertas.push(t);
  
          // 8. bloqueio por dependência aberta com prazo ≤14d
          if (t.subetapa === 'backlog' && t.prazo && t.prazo <= in14Iso) {
            const deps = this._depsByTask.get(t.id);
            if (deps && deps.some(depId => {
              const dep = taskById.get(depId);
              return dep && dep.status !== STATUS.CONCLUIDO;
            })) {
              bBloqDep.push(t);
            }
          }
  
          // 9. estimativa furada (tempo real > 1.5x esforço)
          if (t.tempoRealHoras != null && t.esforco > 0 && t.tempoRealHoras > t.esforco * 1.5) {
            bEstimFurada.push(t);
          }
        }
  
        // Análise semanal de capacidade (4 semanas) — alimenta H11..H15.
        // Substitui o antigo "sobrecarga global" (somava todo backlog aberto)
        // por análise granular por semana, usando prazo como bucket.
        const weekly = this.weeklyCapacityAnalysis;
        const semanaLabel = (w) => w === 0 ? 'esta semana' : (w === 1 ? 'próxima' : `em ${w} semanas`);
  
        // H15 · Pessoa sobrecarga semanal (granular)
        const overloadByWeek = [[], [], [], []];   // w → pessoas sobrecarregadas naquela semana
        for (const p of weekly.pessoas) {
          p.weeks.forEach((wk, idx) => {
            if (wk.nivel === 'sobrecarga' || wk.nivel === 'pressao') {
              overloadByWeek[idx].push({ pessoaId: p.pessoaId, nome: p.nome, pctCap: wk.pctCap, hours: wk.hours, cap: p.capacidade });
            }
          });
        }
  
        // Constrói alertas a partir dos buckets
        const push = (cond, alert) => { if (cond) out.push(alert); };
  
        push(bGrandes.length, {
          severity: 'alta', kind: 'grande-sem-inicio',
          titulo: `${bGrandes.length} tarefa(s) grande(s) sem início e prazo a ≤10 dias`,
          detalhe: 'Iniciar agora ou redimensionar. Tarefas grandes/mini-projeto demandam buffer.',
          taskIds: bGrandes.map(t => t.id),
        });
  
        // H15 alertas (uma entrada por semana com sobrecarga, severidade decai pra futuro)
        overloadByWeek.forEach((pessoas, idx) => {
          if (!pessoas.length) return;
          pessoas.sort((a, b) => b.pctCap - a.pctCap);
          out.push({
            severity: idx === 0 ? 'alta' : 'media',
            kind: 'sobrecarga-semana',
            titulo: `${pessoas.length} pessoa(s) acima da capacidade ${semanaLabel(idx)}`,
            detalhe: pessoas.slice(0, 3).map(p => `${p.nome.split(' ')[0]} ${p.pctCap}%`).join(' · ') + (pessoas.length > 3 ? ` · +${pessoas.length - 3}` : ''),
            pessoaIds: pessoas.map(p => p.pessoaId),
            weekIdx: idx,
          });
        });
  
        // H11 · Sustentação estourando capacidade semanal
        const sustEstourando = weekly.sustentacoes.filter(s => s.estourando);
        if (sustEstourando.length) {
          const detalhe = sustEstourando.slice(0, 3).map(s => {
            const wk = s.weeks.findIndex(w => w.pctCap > 100);
            return `${s.nome} · ${semanaLabel(wk)} ${s.weeks[wk].pctCap}%`;
          }).join(' · ');
          out.push({
            severity: 'alta', kind: 'sustentacao-estourando',
            titulo: `${sustEstourando.length} sustentação(ões) estourando contrato em alguma semana`,
            detalhe, projetoIds: sustEstourando.map(s => s.projetoId),
          });
        }
  
        // H12 · Sustentação ociosa 2+ semanas consecutivas
        const sustOciosa = weekly.sustentacoes.filter(s => s.ociosaFlag && !s.estourando);
        if (sustOciosa.length) {
          out.push({
            severity: 'media', kind: 'sustentacao-ociosa',
            titulo: `${sustOciosa.length} sustentação(ões) com capacidade ociosa por 2+ semanas`,
            detalhe: sustOciosa.slice(0, 3).map(s => s.nome).join(' · '),
            projetoIds: sustOciosa.map(s => s.projetoId),
          });
        }
  
        // H13 · Projeto fechado estourando escopo (>110% comprometido)
        const projEstourando = weekly.projetosFechados.filter(p => p.estourado);
        if (projEstourando.length) {
          out.push({
            severity: 'alta', kind: 'projeto-estourando-escopo',
            titulo: `${projEstourando.length} projeto(s) com escopo estourado (>110%)`,
            detalhe: projEstourando.slice(0, 3).map(p => `${p.nome} ${p.pctEsgotamento}%`).join(' · '),
            projetoIds: projEstourando.map(p => p.projetoId),
          });
        }
  
        // H14 · Projeto fechado em risco de estouro (90-110%)
        const projRisco = weekly.projetosFechados.filter(p => p.risco);
        if (projRisco.length) {
          out.push({
            severity: 'media', kind: 'projeto-risco-estouro',
            titulo: `${projRisco.length} projeto(s) em risco de estourar escopo (90-110%)`,
            detalhe: projRisco.slice(0, 3).map(p => `${p.nome} ${p.pctEsgotamento}%`).join(' · '),
            projetoIds: projRisco.map(p => p.projetoId),
          });
        }
  
        if (bAtrasEstr.length) {
          const detalhe = Array.from(cliCountAtrasEstr.entries())
            .map(([cid, q]) => `${this.nomeCliente(cid)}: ${q}`).join(' · ');
          out.push({
            severity: 'alta', kind: 'tier-estrategico-atrasado',
            titulo: `${bAtrasEstr.length} tarefa(s) atrasada(s) em cliente(s) estratégico(s)`,
            detalhe, taskIds: bAtrasEstr.map(t => t.id),
          });
        }
  
        push(bBloqLongos.length, {
          severity: 'media', kind: 'bloqueio-cliente-longo',
          titulo: `${bBloqLongos.length} tarefa(s) aguardando cliente há +5 dias`,
          detalhe: 'Escalação direta com sponsor recomendada.',
          taskIds: bBloqLongos.map(t => t.id),
        });
        push(bSlaIminente.length, {
          severity: 'media', kind: 'sla-iminente',
          titulo: `${bSlaIminente.length} tarefa(s) próximas do SLA contratado`,
          detalhe: 'Verificar entrega em projetos com SLA configurado.',
          taskIds: bSlaIminente.map(t => t.id),
        });
        push(bJuniorComplex.length, {
          severity: 'media', kind: 'junior-complexidade-alta',
          titulo: `${bJuniorComplex.length} tarefa(s) de complexidade alta atribuída(s) a júnior`,
          detalhe: 'Considerar par com sênior, mentoria ou redistribuição.',
          taskIds: bJuniorComplex.map(t => t.id),
        });
        push(bReabertas.length, {
          severity: 'media', kind: 'reaberturas-cronicas',
          titulo: `${bReabertas.length} tarefa(s) reabertas 2+ vezes`,
          detalhe: 'Investigar critério de "concluído" ou qualidade de entrega.',
          taskIds: bReabertas.map(t => t.id),
        });
        push(bBloqDep.length, {
          severity: 'alta', kind: 'bloqueio-dependencia',
          titulo: `${bBloqDep.length} tarefa(s) com dependência aberta e prazo ≤14d`,
          detalhe: 'Iniciar a dependente ou renegociar prazo da posterior.',
          taskIds: bBloqDep.map(t => t.id),
        });
        push(bEstimFurada.length, {
          severity: 'media', kind: 'estimativa-furada',
          titulo: `${bEstimFurada.length} tarefa(s) com tempo real >1.5x do estimado`,
          detalhe: 'Calibrar estimativa pra próxima similar; entender o gap.',
          taskIds: bEstimFurada.map(t => t.id),
        });
  
        // 10. Triagem represada — tasks com responsável/cliente/prazo/esforço
        // faltando conforme etapa. Reusa o memo de triagemTasks via getter.
        const triagem = this.triagemTasks;
        if (triagem.length) {
          // Conta por critério mais comum pra detalhe
          const counters = { 'sem responsável': 0, 'sem cliente': 0, 'sem prazo': 0, 'sem esforço': 0 };
          for (const t of triagem) for (const f of t._failures) counters[f] = (counters[f] || 0) + 1;
          const detalhe = Object.entries(counters)
            .filter(([_, n]) => n > 0)
            .map(([k, n]) => `${n} ${k}`).join(' · ');
          out.push({
            severity: triagem.length >= 10 ? 'alta' : 'media',
            kind: 'triagem-represada',
            titulo: `${triagem.length} tarefa(s) precisando de triagem`,
            detalhe,
            taskIds: triagem.map(t => t.id),
          });
        }
  
        const sevRank = { alta: 0, media: 1, baixa: 2 };
        out.sort((a, b) => (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9));
        return out;
      },
      get throughputSemanas() {
        // últimas 8 semanas (seg-dom), ordem: mais antiga → atual
        const completed = this._completedWithTimes;
        const out = [];
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const offsetSeg = (now.getDay() + 6) % 7;
        const monday = new Date(now); monday.setDate(now.getDate() - offsetSeg);
        for (let i = 7; i >= 0; i--) {
          const start = new Date(monday); start.setDate(monday.getDate() - i * 7);
          const end   = new Date(start);  end.setDate(start.getDate() + 7);
          const count = completed.filter(c => {
            const t = new Date(c.completedAt);
            return t >= start && t < end;
          }).length;
          out.push({
            label: start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            count,
          });
        }
        return out;
      },
      get calendarWeeks() {
        const today = new Date(); today.setHours(0,0,0,0);
        // Janela: semana passada + atual + 4 à frente = 6 semanas
        const todayWd = (today.getDay() + 6) % 7; // segunda = 0
        const gridStart = new Date(today);
        gridStart.setDate(today.getDate() - todayWd - 7); // segunda da semana passada
        const counts = new Map();
        this.dashTasks.filter(t => t.status !== STATUS.CONCLUIDO).forEach(t => {
          if (!t.prazo) return;
          counts.set(t.prazo, (counts.get(t.prazo) || 0) + 1);
        });
        const weeks = [];
        const cursor = new Date(gridStart);
        for (let w = 0; w < 6; w++) {
          const week = [];
          for (let i = 0; i < 7; i++) {
            const iso = cursor.getFullYear() + '-' +
                        String(cursor.getMonth()+1).padStart(2,'0') + '-' +
                        String(cursor.getDate()).padStart(2,'0');
            const isToday = cursor.getTime() === today.getTime();
            const isPast  = cursor < today;
            const count = counts.get(iso) || 0;
            let level = 0;
            if (count > 0) {
              if (isPast)        level = 4; // atrasada
              else if (count >= 5) level = 3;
              else if (count >= 3) level = 2;
              else                 level = 1;
            }
            week.push({ iso, num: cursor.getDate(), isToday, isPast, count, level });
            cursor.setDate(cursor.getDate() + 1);
          }
          weeks.push(week);
        }
        return weeks;
      },
      get bloqList() {
        return this.dashTasks.filter(t => t.status === 'bloqueado').sort((a,b) => {
          const o = { P0:0,P1:1,P2:2,P3:3 };
          return o[a.prioridade] - o[b.prioridade];
        }).slice(0, 8);
      },
  
      // Saúde por pessoa — semáforo determinístico operacional.
      // Inspirado em saudeProjetos mas sem expor cadastral (capacidade,
      // senioridade). Só métricas derivadas das tasks ativas.
      // verde: nada urgente · âmbar: atenção · vermelho: ação imediata.
      get saudePessoas() {
        const ativas = this.dashTasks.filter(t => t.status !== STATUS.CONCLUIDO);
        const porPes = new Map();
        for (const t of ativas) {
          if (!t.pessoaId) continue;
          if (!porPes.has(t.pessoaId)) porPes.set(t.pessoaId, []);
          porPes.get(t.pessoaId).push(t);
        }
        const out = [];
        for (const p of this.pessoas) {
          if (p.role === ROLE.CLIENTE) continue;
          const tasks = porPes.get(p.id) || [];
          if (!tasks.length) continue;
          const atrasadas  = tasks.filter(t => this.atrasada(t)).length;
          const aguardCli  = tasks.filter(t => t.subetapa === 'bloqueado' && t.bloqueadoPor === 'cliente').length;
          const bloqInt    = tasks.filter(t => t.subetapa === 'bloqueado' && t.bloqueadoPor !== 'cliente').length;
          const stale      = tasks.filter(t => this.agingLevel(t) === 'stale').length;
          const warn       = tasks.filter(t => this.agingLevel(t) === 'warn').length;
          const horas      = tasks.reduce((s, t) => s + this.effEsforco(t), 0);
          let status = 'verde';
          if (atrasadas > 0 || stale > 0) status = 'vermelho';
          else if (aguardCli > 0 || bloqInt > 0 || warn > 0) status = 'ambar';
          out.push({
            id: p.id,
            nome: p.nome,
            total: tasks.length,
            horas,
            atrasadas, aguardCli, bloqInt, stale,
            status,
          });
        }
        const ord = { vermelho: 0, ambar: 1, verde: 2 };
        return out.sort((a,b) =>
          ord[a.status] - ord[b.status]
          || b.atrasadas - a.atrasadas
          || b.horas - a.horas
        );
      },
  
      // Saúde por projeto — semáforo determinístico baseado em
      // atrasadas, bloqueios longos, SLA e volume aberto.
      // verde: nada urgente · âmbar: atenção · vermelho: ação imediata.
      get saudeProjetos() {
        const now = Date.now();
        const ativas = this.dashTasks.filter(t => t.status !== STATUS.CONCLUIDO);
        const porProj = new Map();
        for (const t of ativas) {
          if (!t.projetoId) continue;
          if (!porProj.has(t.projetoId)) porProj.set(t.projetoId, []);
          porProj.get(t.projetoId).push(t);
        }
        const out = [];
        for (const proj of this.projetosAtivos) {
          const tasks = porProj.get(proj.id) || [];
          if (!tasks.length) continue;
          const atrasadas  = tasks.filter(t => this.atrasada(t)).length;
          const bloqLongo  = tasks.filter(t => t.status === 'bloqueado' && this.agingDays(t) >= 5).length;
          const aguardCli  = tasks.filter(t => t.subetapa === 'bloqueado' && t.bloqueadoPor === 'cliente').length;
          const slaQuase   = proj.slaEntregaDias ? tasks.filter(t => {
            if (!t.criadoEm) return false;
            const aging = (now - t.criadoEm) / 86400000;
            return aging >= proj.slaEntregaDias * 0.8;
          }).length : 0;
          let status = 'verde';
          if (atrasadas > 0 || bloqLongo > 0 || slaQuase > 0) status = 'vermelho';
          else if (aguardCli > 0 || tasks.some(t => this.agingLevel(t) === 'warn')) status = 'ambar';
          out.push({
            id: proj.id,
            nome: proj.nome,
            cliente: this.nomeCliente(proj.clienteId),
            total: tasks.length,
            atrasadas, bloqLongo, aguardCli, slaQuase,
            status,
          });
        }
        const ord = { vermelho: 0, ambar: 1, verde: 2 };
        return out.sort((a,b) => ord[a.status] - ord[b.status] || b.atrasadas - a.atrasadas || b.total - a.total);
      },
  
      // Tarefas bloqueadas aguardando cliente — ordenadas por aging desc.
      get aguardandoClienteList() {
        return this.dashTasks
          .filter(t => t.status !== STATUS.CONCLUIDO && t.subetapa === 'bloqueado' && t.bloqueadoPor === 'cliente')
          .sort((a,b) => this.agingDays(b) - this.agingDays(a))
          .slice(0, 8);
      },
  
    };
  }

  window.makeAdoptionView = makeAdoptionView;
})();
