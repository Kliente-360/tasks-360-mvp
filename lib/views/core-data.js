/* ============ tasks 360 · Core data (memoization + reports + helpers + indices + stats) ============
 * Camada de getters caros memoizados, índices O(1) para lookups,
 * helpers de exibição, triagem, e stats agregados do dashboard.
 *
 * Tudo aqui é "core" — usado por views/* via this.*. Por isso é o
 * primeiro mixin a ser composto em app() (na ordem, vem antes das
 * views que dependem dele — mas Object.defineProperties não força
 * ordem, todos resolvem em runtime via this proxy).
 *
 * Dependências em app() (permanecem lá):
 *   - this.tasks, this.clientes, this.projetos, this.pessoas (state)
 *   - this.f (filters), this._memos (LRU cache)
 *
 * Dependências em window:
 *   - STATUS, ROLE, cargaNivelFromPctCap, effEsforco, triageFailures
 * ==================================================================
 */

(function () {
  'use strict';

  function makeCoreDataView() {
    return {
      // ============ MEMOIZATION ============
      // Assinatura O(1) pra invalidar memos baseados em tasks. Combina
      // quantidade de tasks + `_dataRev` (contador bumpado explicitamente
      // por `_touchTasks()` em TODA mutação de this.tasks — edição, drag,
      // bulk, arquivamento, realtime). Antes esse getter varria task por
      // task (statusEm/subetapaEm) a cada acesso; agora é custo constante.
      // Invariante: qualquer código que muta this.tasks DEVE chamar
      // _touchTasks() logo após, senão memos ficam stale.
      get _tasksSig() {
        return (this.tasks.length * 1000003 + (this._dataRev | 0)) | 0;
      },
      // Invalida memos dependentes de tasks. Chamado internamente pelos
      // helpers de mutação abaixo — preferir os helpers a mexer em
      // this.tasks direto, pra nunca esquecer a invalidação.
      _touchTasks() {
        this._dataRev = (this._dataRev | 0) + 1;
      },

      // ============ MUTAÇÃO DE TASKS (fonte única) ============
      // Todo código que altera this.tasks DEVE passar por estes helpers.
      // Eles reatribuem o array (reatividade Alpine confiável) e invalidam
      // os memos via _touchTasks(). Mexer em this.tasks[i] / .splice direto
      // é proibido — deixa memo stale e a tabela pode não re-renderizar.

      // Aplica `changes` (objeto parcial) à task de id `id`.
      // Retorna a task ANTERIOR (pra revert) ou null se não encontrada.
      _patchTask(id, changes) {
        const i = this.tasks.findIndex(t => t.id === id);
        if (i < 0) return null;
        const prev = this.tasks[i];
        this.tasks = this.tasks.map((t, idx) => idx === i ? { ...prev, ...changes } : t);
        this._touchTasks();
        return prev;
      },
      // Substitui a task de id `id` pelo objeto completo `taskObj`.
      // Usado em revert e ao sincronizar com a versão canônica do banco.
      _replaceTask(id, taskObj) {
        const i = this.tasks.findIndex(t => t.id === id);
        if (i < 0) return;
        this.tasks = this.tasks.map((t, idx) => idx === i ? taskObj : t);
        this._touchTasks();
      },
      // Insere `taskObj` (no topo) ou substitui se já existir pelo id.
      _upsertTask(taskObj) {
        if (!taskObj || !taskObj.id) return;
        const i = this.tasks.findIndex(t => t.id === taskObj.id);
        if (i >= 0) this.tasks = this.tasks.map((t, idx) => idx === i ? taskObj : t);
        else        this.tasks = [taskObj, ...this.tasks];
        this._touchTasks();
      },
      // Aplica `changes` (objeto parcial) a todas as tasks cujo id está
      // em `ids` (array ou Set). Para bulk actions.
      _patchTasks(ids, changes) {
        const idSet = ids instanceof Set ? ids : new Set(ids);
        if (!idSet.size) return;
        this.tasks = this.tasks.map(t => idSet.has(t.id) ? { ...t, ...changes } : t);
        this._touchTasks();
      },
      // Remove a task por id. Retorna a task removida (pra revert) ou null.
      _removeTask(id) {
        const i = this.tasks.findIndex(t => t.id === id);
        if (i < 0) return null;
        const removed = this.tasks[i];
        this.tasks = this.tasks.filter(t => t.id !== id);
        this._touchTasks();
        return removed;
      },
      // Remove várias tasks por id (array ou Set).
      _removeTasks(ids) {
        const idSet = ids instanceof Set ? ids : new Set(ids);
        if (!idSet.size) return;
        this.tasks = this.tasks.filter(t => !idSet.has(t.id));
        this._touchTasks();
      },
      // Substitui o array inteiro de tasks (loads, refetch).
      _setAllTasks(arr) {
        this.tasks = Array.isArray(arr) ? arr : [];
        this._touchTasks();
      },
      // LRU: limita memos a 50 entries pra não inflar memória em sessão longa.
      // Map preserva ordem de inserção; reinsere ao hit pra "renovar" position.
      _MEMO_MAX: 50,
      _memo(key, sig, fn) {
        const c = this._memos.get(key);
        if (c && c.sig === sig) {
          // hit: move pra fim (LRU)
          this._memos.delete(key);
          this._memos.set(key, c);
          return c.value;
        }
        const value = fn();
        this._memos.set(key, { sig, value });
        if (this._memos.size > this._MEMO_MAX) {
          const oldest = this._memos.keys().next().value;
          this._memos.delete(oldest);
        }
        return value;
      },
  
  
      // Eficiência da operação (bloco esquerdo da página executiva)
      get reportEfficiency() {
        const t = this.tasks;
        const ativas = t.filter(x => x.status !== STATUS.CONCLUIDO);
        const now = Date.now();
        const fmt = (v) => (v > 0 ? '+' : '') + v;
        // 1. % entrega no prazo (concluídas últimos 30d)
        const concl30d = t.filter(x => x.status === STATUS.CONCLUIDO && x.statusEm && (now - x.statusEm) <= 30*86400000);
        const noPrazo = concl30d.filter(x => x.prazo && x.statusEm && new Date(x.prazo + 'T23:59:59').getTime() >= x.statusEm).length;
        const pctNoPrazo = concl30d.length ? Math.round(noPrazo / concl30d.length * 100) : null;
        // 2. Taxa de reabertura (% de tasks ativas com reopen_count >= 1)
        const reabertas = ativas.filter(x => (x.reopenCount || 0) >= 1).length;
        const pctReab = ativas.length ? Math.round(reabertas / ativas.length * 100) : 0;
        // 3. % aguardando cliente (de ativas)
        const aguardCli = ativas.filter(x => x.subetapa === 'bloqueado' && x.bloqueadoPor === 'cliente').length;
        const pctAguard = ativas.length ? Math.round(aguardCli / ativas.length * 100) : 0;
        // 4. % bloqueadas internamente
        const bloqInt = ativas.filter(x => x.subetapa === 'bloqueado' && x.bloqueadoPor !== 'cliente').length;
        const pctBloq = ativas.length ? Math.round(bloqInt / ativas.length * 100) : 0;
        // 5. % sem prazo (qualidade do backlog)
        const semPrazo = ativas.filter(x => !x.prazo).length;
        const pctSemPrazo = ativas.length ? Math.round(semPrazo / ativas.length * 100) : 0;
        // 6. Aging médio das ativas (dias)
        const agings = ativas.map(x => this.agingDays(x)).filter(d => d > 0);
        const agingMed = agings.length ? Math.round(agings.reduce((a,b) => a+b, 0) / agings.length) : 0;
  
        return [
          { label: 'Entrega no prazo (30d)', value: pctNoPrazo != null ? pctNoPrazo + '%' : '—',
            good: pctNoPrazo != null && pctNoPrazo >= 80, danger: pctNoPrazo != null && pctNoPrazo < 60 },
          { label: 'Taxa de reabertura', value: pctReab + '% (' + reabertas + ')',
            danger: pctReab > 15, good: pctReab === 0 },
          { label: 'Aguardando cliente', value: pctAguard + '% (' + aguardCli + ')',
            danger: pctAguard > 30 },
          { label: 'Bloqueadas internas', value: pctBloq + '% (' + bloqInt + ')',
            danger: pctBloq > 15 },
          { label: 'Sem prazo definido', value: pctSemPrazo + '% (' + semPrazo + ')',
            danger: pctSemPrazo > 30 },
          { label: 'Aging médio (ativas)', value: agingMed + 'd',
            danger: agingMed > 14 },
        ];
      },
  
      // Pontos de atenção condensados (heurísticas + clientes críticos + sobrecarga)
      get reportActions() {
        const out = [];
        const seen = new Set();
        // 1. Heurísticas (top severidade alta primeiro)
        const sevRank = { alta: 0, media: 1, baixa: 2 };
        const heur = (this.heuristicAlerts || []).slice().sort((a,b) =>
          (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9)
        );
        for (const h of heur) {
          const key = 'h:' + h.kind;
          if (seen.has(key)) continue; seen.add(key);
          const tag = h.severity === 'alta' ? 'crítico' : (h.severity === 'media' ? 'atenção' : 'aviso');
          const sev = h.severity === 'alta' ? 'danger' : (h.severity === 'media' ? 'warn' : 'info');
          out.push({ severity: sev, tag, titulo: h.titulo });
        }
        // 2. Clientes críticos
        for (const c of this.reportClientHealth) {
          if (c.sinal !== 'vermelho') continue;
          const key = 'cv:' + c.id;
          if (seen.has(key)) continue; seen.add(key);
          out.push({ severity: 'danger', tag: 'cliente', titulo: c.nome + ' · ' + c.sinalReason });
        }
        // 3. Sobrecarga (>130% capacidade ou >50h sem cap declarada)
        for (const p of this.reportTeamLoad) {
          if (p.cargaNivel !== 'sobrecarga') continue;
          const key = 'sob:' + p.id;
          if (seen.has(key)) continue; seen.add(key);
          const detalhe = p.pctCap != null ? (p.pctCap + '% capacidade') : (p.horas + 'h alocadas');
          out.push({ severity: 'danger', tag: 'time', titulo: p.nome + ' · ' + detalhe });
        }
        // Limita a 8 pra caber na página
        return out.slice(0, 8);
      },
  
      // Clientes (versão executiva): adiciona tier + % orçamento de horas
      get reportClientesExec() {
        const baseHealth = this.reportClientHealth;
        const ativas = this._visibleTasks.filter(t => t.status !== STATUS.CONCLUIDO);
        const out = [];
        for (const h of baseHealth) {
          const cli = this.clientesById.get(h.id) || {};
          // Buckets cliente — O(1) lookup via Map em vez de filter linear.
          const cliTasks = this.tasksByCliente.get(h.id) || [];
          const projsCli = this.projetosByCliente.get(h.id) || [];
          const orcTotal = projsCli.reduce((s, p) => s + (Number(p.orcamentoHoras) || 0), 0);
          let horas = 0, horasConc = 0;
          for (const t of cliTasks) {
            if (t.status === STATUS.CONCLUIDO) horasConc += Number(t.tempoRealHoras) || this.effEsforco(t) || 0;
            else if (t.status !== STATUS.CONCLUIDO) horas += this.effEsforco(t);
          }
          const horasConsumidas = horas + horasConc;
          const pctOrc = orcTotal > 0 ? Math.round(horasConsumidas / orcTotal * 100) : null;
          out.push({
            ...h,
            tier: cli.tier || '',
            horas,
            orcTotal,
            pctOrc,
          });
        }
        // Ordena por: sinal pior primeiro, depois tier (estratégico > potencial > descoberta > vazio), depois mais horas
        const sinalRank = { vermelho: 0, amarelo: 1, verde: 2 };
        const tierRank = { estrategico: 0, 'estratégico': 0, potencial: 1, descoberta: 2 };
        out.sort((a,b) => {
          const ds = (sinalRank[a.sinal] ?? 9) - (sinalRank[b.sinal] ?? 9); if (ds) return ds;
          const dt = (tierRank[(a.tier || '').toLowerCase()] ?? 9) - (tierRank[(b.tier || '').toLowerCase()] ?? 9); if (dt) return dt;
          return b.horas - a.horas;
        });
        return out.slice(0, 10);
      },
  
      // Top do time pra cabe na página (8 pessoas)
      get reportTeamCompact() {
        return this.reportTeamLoad.slice(0, 8);
      },
  
      // ============ TRIAGEM ============
      // Tasks que precisam de triagem (sem responsável/cliente/prazo/esforço
      // conforme etapa). Memoizado pra não recalcular em todo render.
      get triagemTasks() {
        return this._memo('triagemTasks', this._tasksSig, () => {
          const out = [];
          for (const t of this.tasks) {
            if (t.arquivadoEm) continue;
            const failures = triageFailures(t);
            if (failures.length === 0) continue;
            out.push({ ...t, _failures: failures, _failCount: failures.length });
          }
          // Mais críticas primeiro (mais critérios falhando)
          out.sort((a, b) => b._failCount - a._failCount || (a.criadoEm || 0) - (b.criadoEm || 0));
          return out;
        });
      },
      get triagemTasksFiltered() {
        const f = this.triagemFilter;
        return this.triagemTasks.filter(t => {
          if (f.semResp    && !t._failures.includes('sem responsável')) return false;
          if (f.semPrazo   && !t._failures.includes('sem prazo'))       return false;
          if (f.semEsforco && !t._failures.includes('sem esforço'))     return false;
          if (f.origem === 'ia'     && !t.criadoPorIa)                  return false;
          if (f.origem === 'humano' &&  t.criadoPorIa)                  return false;
          return true;
        });
      },
      triagemAnyFilter() {
        const f = this.triagemFilter;
        return f.semResp || f.semPrazo || f.semEsforco || !!f.origem;
      },
  
      async exportPDF() {
        this.exportOpen = false;
        this.track('export', { kind: 'pdf' });
        const now = new Date();
        this.reportStampDate = String(now.getDate()).padStart(2,'0') + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' + now.getFullYear();
        this.reportStampTime = 'gerado às ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
        // Espera o DOM renderizar com os dados, depois constrói os charts.
        await this.$nextTick();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        this.buildPrintCharts();
        // Aguarda Chart.js terminar o primeiro paint.
        await new Promise(r => setTimeout(r, 120));
        const cleanup = () => {
          this.destroyPrintCharts();
          window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        window.print();
        // Fallback caso o navegador não dispare afterprint (raro).
        setTimeout(() => { this.destroyPrintCharts(); }, 4000);
      },
      buildPrintCharts() {
        // Renderiza charts da pág 8 do Resumo Executivo (throughput trend + lead time por cliente).
        this.destroyPrintCharts();
        if (typeof Chart === 'undefined') return;
        const muted = '#666', line = '#e5e5e5', brand = '#009900', brandDark = '#007A00';
        const baseOpts = {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
        };
        // Throughput trend 8 semanas
        const thrCanvas = document.getElementById('memoChartThroughput');
        if (thrCanvas && this.throughputSemanas) {
          const data = this.throughputSemanas;
          this.printCharts.throughput = new Chart(thrCanvas, {
            type: 'bar',
            data: {
              labels: data.map(d => d.label),
              datasets: [{
                data: data.map(d => d.count),
                backgroundColor: data.map((_, i) => i === data.length - 1 ? brandDark : brand),
                borderRadius: 2, maxBarThickness: 16,
              }]
            },
            options: { ...baseOpts,
              scales: {
                x: { grid: { display: false }, ticks: { color: muted, font: { size: 9 }, maxRotation: 0 }, border: { display: false } },
                y: { grid: { color: line }, ticks: { color: muted, font: { size: 9 }, stepSize: 1, precision: 0 }, border: { display: false } }
              }
            }
          });
        }
        // Lead time por cliente
        const leadCanvas = document.getElementById('memoChartLeadTime');
        if (leadCanvas && this.leadTimePorCliente && this.leadTimePorCliente.length > 0) {
          const data = this.leadTimePorCliente.slice(0, 8);
          this.printCharts.leadTime = new Chart(leadCanvas, {
            type: 'bar',
            data: {
              labels: data.map(d => d.cliente),
              datasets: [{
                data: data.map(d => d.leadDays),
                backgroundColor: brand,
                borderRadius: 2, maxBarThickness: 12,
              }]
            },
            options: { ...baseOpts, indexAxis: 'y',
              scales: {
                x: { grid: { color: line }, ticks: { color: muted, font: { size: 9 } }, border: { display: false } },
                y: { grid: { display: false }, ticks: { color: muted, font: { size: 9 } }, border: { display: false } }
              }
            }
          });
        }
      },
      destroyPrintCharts() {
        Object.keys(this.printCharts).forEach(k => {
          if (this.printCharts[k]) { try { this.printCharts[k].destroy(); } catch(_) {} this.printCharts[k] = null; }
        });
      },
  
      // ===================== HELPERS =====================
      blankTask() {
        // Gera a partir do TASK_FIELDS (single source of truth) + `dependencias`
        // que vive em tabela separada, não tem mapeamento direto de coluna.
        return makeBlank(TASK_FIELDS, { dependencias: [] });
      },
      normalizeTag(s) { return normalizeTag(s); },
      addTag() {
        const t = this.normalizeTag(this.newTag);
        if (!t) { this.newTag = ''; return; }
        this.editing.tags = this.editing.tags || [];
        if (!this.editing.tags.includes(t)) this.editing.tags.push(t);
        this.newTag = '';
      },
      removeTag(t) {
        this.editing.tags = (this.editing.tags || []).filter(x => x !== t);
      },
      get allTags() {
        const s = new Set();
        for (const t of this.tasks) for (const tag of (t.tags || [])) s.add(tag);
        return Array.from(s).sort();
      },
      get allSkills() {
        const s = new Set();
        for (const p of this.pessoas) for (const sk of (p.skills || [])) s.add(sk);
        return Array.from(s).sort();
      },
      // Filtra um vocabulário (allTags / allSkills) pelo input atual,
      // exclui os já adicionados, e limita a 12 sugestões.
      suggest(input, all, current) { return suggest(input, all, current); },
      addExistingTag(t) {
        this.editing.tags = this.editing.tags || [];
        if (!this.editing.tags.includes(t)) this.editing.tags.push(t);
        this.newTag = '';
        this.$nextTick(() => this.$refs.tagInput && this.$refs.tagInput.focus());
      },
      addSkill() {
        if (!this.editingPessoa) return;
        const s = this.normalizeTag(this.editingPessoa._skillsInput || '');
        if (!s) { this.editingPessoa._skillsInput = ''; return; }
        this.editingPessoa.skills = this.editingPessoa.skills || [];
        if (!this.editingPessoa.skills.includes(s)) this.editingPessoa.skills.push(s);
        this.editingPessoa._skillsInput = '';
      },
      addExistingSkill(s) {
        if (!this.editingPessoa) return;
        this.editingPessoa.skills = this.editingPessoa.skills || [];
        if (!this.editingPessoa.skills.includes(s)) this.editingPessoa.skills.push(s);
        this.editingPessoa._skillsInput = '';
        this.$nextTick(() => this.$refs.skillInput && this.$refs.skillInput.focus());
      },
      removeSkill(s) {
        if (!this.editingPessoa) return;
        this.editingPessoa.skills = (this.editingPessoa.skills || []).filter(x => x !== s);
      },
      // ============ Índices O(1) pra lookups (evita .find linear) ============
      // Reconstroem só quando a coleção referenciada muda.
      get pessoasById() {
        const m = new Map();
        for (const p of this.pessoas) m.set(p.id, p);
        return m;
      },
      get clientesById() {
        const m = new Map();
        for (const c of this.clientes) m.set(c.id, c);
        return m;
      },
      get projetosById() {
        const m = new Map();
        for (const p of this.projetos) m.set(p.id, p);
        return m;
      },
      get tasksById() {
        // Memoizado: reconstruir o Map a cada acesso era O(n) e este getter
        // é chamado em vários caminhos quentes (lookups por id).
        return this._memo('tasksById', this._tasksSig, () => {
          const m = new Map();
          for (const t of this.tasks) m.set(t.id, t);
          return m;
        });
      },
      // Buckets cross-entity. Reconstroem quando tasks muda (length+sig); memoizados
      // pra evitar O(n) por getter caro que itera "tasks de um cliente/pessoa".
      get tasksByCliente() {
        // Buckets excluem arquivadas — usados por dashboards/heurísticas/briefing.
        // Quem precisa de arquivadas (e.g., backlog com toggle) usa this.tasks direto.
        return this._memo('tasksByCliente', this._tasksSig, () => {
          const m = new Map();
          for (const t of this.tasks) {
            if (t.arquivadoEm) continue;
            if (!t.clienteId) continue;
            let arr = m.get(t.clienteId);
            if (!arr) { arr = []; m.set(t.clienteId, arr); }
            arr.push(t);
          }
          return m;
        });
      },
      get tasksByPessoa() {
        return this._memo('tasksByPessoa', this._tasksSig, () => {
          const m = new Map();
          for (const t of this.tasks) {
            if (t.arquivadoEm) continue;
            if (!t.pessoaId) continue;
            let arr = m.get(t.pessoaId);
            if (!arr) { arr = []; m.set(t.pessoaId, arr); }
            arr.push(t);
          }
          return m;
        });
      },
      get projetosByCliente() {
        const m = new Map();
        for (const p of this.projetos) {
          if (!p.clienteId) continue;
          let arr = m.get(p.clienteId);
          if (!arr) { arr = []; m.set(p.clienteId, arr); }
          arr.push(p);
        }
        return m;
      },
      nomeCliente(id) { const c = this.clientesById.get(id); return (c && c.nome) || '—'; },
      nomeProjeto(id) { const p = this.projetosById.get(id); return (p && p.nome) || '—'; },
      nomePessoa(id)  { const p = this.pessoasById.get(id);  return (p && p.nome) || '—'; },
      // effEsforco / effTamanho — delegam pros puros em lib/helpers.js
      // (testáveis). Mantemos como métodos pra preservar `this.X` calls.
      effEsforco(t) { return effEsforco(t); },
      effTamanho(t) { return effTamanho(t); },
      lblComplex(c) {
        return ({ alta: 'Alta', media: 'Média', baixa: 'Baixa' })[c] || 'Média';
      },
      lblStatus(s) {
        return ({ backlog: 'Backlog', andamento: 'Em andamento', bloqueado: 'Bloqueado', concluido: 'Concluído' })[s] || s;
      },
      lblField(f) {
        return ({
          prazo: 'prazo', esforco: 'esforço', prioridade: 'prioridade',
          complexidade: 'complexidade', pessoa: 'responsável', subetapa: 'etapa',
          tipo_trabalho: 'tipo de trabalho', tempo_real_horas: 'tempo real',
          bloqueado_por: 'bloqueado por',
        })[f] || f;
      },
      // Formata valor de mudança baseado no campo. UUIDs viram nome.
      // Datas viram dd/mm/yyyy. Status enums viram label.
      fmtFieldValue(field, v) {
        if (v == null || v === '') return '∅';
        if (field === 'prazo') return this.fmtDate(v);
        if (field === 'pessoa') return this.nomePessoa(v);
        if (field === 'prioridade') return v;
        if (field === 'complexidade') return this.lblComplex(v);
        if (field === 'subetapa') return this.lblSub ? this.lblSub(v) : v;
        if (field === 'esforco' || field === 'tempo_real_horas') return v + 'h';
        return String(v);
      },
      // Helpers de data + atrasada — delegam pros puros em lib/helpers.js.
      fmtDate(d) { return fmtDate(d); },
      fmtDateShort(d) { return fmtDateShort(d); },
      atrasada(t) { return atrasada(t); },
      diasAtraso(t) {
        if (!t.prazo) return 0;
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const prazo = new Date(t.prazo + 'T00:00:00');
        return Math.floor((hoje - prazo) / 86400000);
      },
      tempoNaEtapa(t) {
        if (!t.statusEm) return '';
        const ms = Date.now() - t.statusEm;
        const d = Math.floor(ms / 86400000);
        if (d <= 0) return 'hoje';
        if (d === 1) return 'há 1d';
        return 'há ' + d + 'd';
      },
      agingDays(t) {
        if (!t.statusEm) return 0;
        return Math.floor((Date.now() - t.statusEm) / 86400000);
      },
      // Limites por status pra sinalizar represa.
      // [warn, stale]: a partir de warn fica laranja; stale, vermelho.
      agingLevel(t) {
        if (!t || t.status === STATUS.CONCLUIDO) return 'fresh';
        const thr = {
          andamento: [7, 14],
          bloqueado: [3, 7],
          backlog:   [30, 60],
        }[t.status];
        if (!thr) return 'fresh';
        const d = this.agingDays(t);
        if (d >= thr[1]) return 'stale';
        if (d >= thr[0]) return 'warn';
        return 'fresh';
      },
      projetosDoCliente(cid) {
        const ativos = this.projetosAtivos;
        if (!cid) return ativos;
        return ativos.filter(p => p.clienteId === cid);
      },
      get _depsByTask() {
        const m = new Map();
        for (const d of this.taskDeps) {
          if (!m.has(d.task_id)) m.set(d.task_id, []);
          m.get(d.task_id).push(d.depende_de_id);
        }
        return m;
      },
      getDependencias(taskId) {
        return this._depsByTask.get(taskId) || [];
      },
      nomeTask(id) {
        const t = this.tasksById.get(id);
        return t ? t.titulo : '(removida)';
      },
      statusTask(id) {
        const t = this.tasksById.get(id);
        return t ? t.status : '';
      },
      get clientesAtivos() {
        // Clientes internos (ex: "Kliente 360" bucket de gestão) só pra admin.
        const isAdmin = this.viewerRole === ROLE.ADMIN;
        return this.clientes.filter(c => !c.arquivadoEm && (isAdmin || !c.ehInterno));
      },
      // Pessoas que NÃO são clientes externos — usado no select "atuando como"
      // do Meu Foco (admin não simula um cliente externo).
      get pessoasNaoCliente() {
        return this.pessoas.filter(p => p.role !== ROLE.CLIENTE);
      },
      // Apenas clientes externos (sem bucket interno) — usado em contextos onde
      // mesmo admin não deve ver o bucket interno (Portal switcher, briefing
      // executivo, dashboards de saúde por cliente).
      get clientesAtivosExternos() {
        return this.clientes.filter(c => !c.arquivadoEm && !c.ehInterno);
      },
      // Tasks visíveis (não-arquivadas) excluindo bucket interno — base das
      // heurísticas de carga/sobrecarga pra não inflar capacidade com tarefas
      // de gestão (cliente "Kliente 360" interno).
      get _visibleTasksExternas() {
        const base = this._visibleTasks;
        const internosIds = new Set(this.clientes.filter(c => c.ehInterno).map(c => c.id));
        if (internosIds.size === 0) return base;
        return base.filter(t => !internosIds.has(t.clienteId));
      },
      get projetosAtivos() {
        return this.projetos.filter(p => !p.arquivadoEm);
      },
      get clientesVisiveis() {
        return this.showArchivedCadastros ? this.clientes : this.clientesAtivos;
      },
      // Clientes ativos externos sem domínios cadastrados. Pendência de
      // config pra automação Cowork/Apps Script identificar pelo email
      // dos participantes. Exclui arquivados e bucket interno.
      get clientesSemDominio() {
        return this.clientes.filter(c =>
          !c.arquivadoEm && !c.ehInterno && (!c.dominios || c.dominios.length === 0)
        );
      },
      get projetosVisiveis() {
        return this.showArchivedCadastros ? this.projetos : this.projetosAtivos;
      },
      contarTarefasCliente(id)  {
        const arr = this.tasksByCliente.get(id) || [];
        let n = 0;
        for (const t of arr) if (t.status !== STATUS.CONCLUIDO) n++;
        return n;
      },
      contarProjetosCliente(id) { return (this.projetosByCliente.get(id) || []).length; },
      contarTarefasProjeto(id)  { return this._visibleTasks.filter(t => t.projetoId === id && t.status !== STATUS.CONCLUIDO).length; },
      contarTarefasPessoa(id)   {
        const arr = this.tasksByPessoa.get(id) || [];
        let n = 0;
        for (const t of arr) if (t.status !== STATUS.CONCLUIDO) n++;
        return n;
      },
  
      // ===================== STATS =====================
      get dashTasks() {
        return this._visibleTasks.filter(t =>
          (!this.f.cliente || t.clienteId === this.f.cliente)
          && (!this.f.pessoa || t.pessoaId === this.f.pessoa)
        );
      },
      get activeFiltersCount() {
        let n = 0;
        if (this.f.cliente)      n++;
        if (this.f.projeto)      n++;
        if (this.f.pessoa)       n++;
        if (this.f.pri)          n++;
        if (this.f.complexidade) n++;
        if (this.f.status && this.f.status !== 'abertas') n++;
        if (this.f.origem)       n++;
        return n;
      },
      clearFilters() {
        this.f.q = '';
        this.f.cliente = '';
        this.f.projeto = '';
        this.f.pessoa = '';
        this.f.pri = '';
        this.f.complexidade = '';
        this.f.status = 'abertas';
        this.f.tag = '';
        this.f.origem = '';
        // Re-renderiza charts caso esteja na aba dashboard (filtros de cliente/pessoa afetam).
        if (this.tab === 'dash') this.$nextTick(() => this.renderCharts());
      },
      get stats() {
        const ativas = this.dashTasks.filter(t => t.status !== STATUS.CONCLUIDO);
        const andamento = ativas.filter(t => t.status === 'andamento');
        const backlog   = ativas.filter(t => t.status === 'backlog');
        const bloqueado = ativas.filter(t => t.status === 'bloqueado');
        const sum = arr => arr.reduce((a,b) => a + this.effEsforco(b), 0);
        return {
          andamento: andamento.length,
          andamentoH: sum(andamento),
          backlog: backlog.length,
          backlogH: sum(backlog),
          bloqueado: bloqueado.length,
          atrasadas: ativas.filter(t => this.atrasada(t)).length,
        };
      },
      // Total de tasks abertas (não concluídas, não arquivadas) — independente
      // dos filtros do Backlog. Inclui cliente interno (admin vê tasks de gestão
      // no Backlog). Mesmo critério do `filtered` sem nenhum filter aplicado.
      get backlogTotalAbertas() {
        return this._visibleTasks.filter(t => t.status !== STATUS.CONCLUIDO).length;
      },
      // Cards de stats da aba Backlog (desktop) — RESPEITAM filtros aplicados.
      // 5 contagens: total · backlog · em andamento · bloqueadas · atrasadas.
      get backlogCards() {
        const arr = this.filtered;
        return {
          total:     arr.length,
          backlog:   arr.filter(t => t.status === 'backlog').length,
          andamento: arr.filter(t => t.status === 'andamento').length,
          bloqueadas:arr.filter(t => t.status === 'bloqueado').length,
          atrasadas: arr.filter(t => this.atrasada(t)).length,
        };
      },
      get atrasadasList() {
        return this.dashTasks.filter(t => this.atrasada(t)).sort((a,b) => this.diasAtraso(b) - this.diasAtraso(a)).slice(0, 8);
      },
      // Lead time / cycle time / throughput baseado em task_field_history (field='status').
      // Respeita filtro de cliente/pessoa via dashTasks.
      get _completedWithTimes() {
        // Map task → entries asc, mas só pra tasks visíveis no escopo do dashboard
        const validIds = new Set(this.dashTasks.map(t => t.id));
        const byTask = new Map();
        for (const h of this.historyAll) {
          if (!validIds.has(h.task_id)) continue;
          if (!byTask.has(h.task_id)) byTask.set(h.task_id, []);
          byTask.get(h.task_id).push(h);
        }
        const out = [];
        for (const [taskId, entries] of byTask.entries()) {
          entries.sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
          const created    = entries[0];
          const concluido  = entries.find(e => e.to_value === STATUS.CONCLUIDO);
          const andamento  = entries.find(e => e.to_value === 'andamento');
          if (!concluido) continue;
          const leadDays  = (new Date(concluido.occurred_at) - new Date(created.occurred_at)) / 86400000;
          const cycleDays = andamento ? (new Date(concluido.occurred_at) - new Date(andamento.occurred_at)) / 86400000 : null;
          out.push({ taskId, completedAt: concluido.occurred_at, leadDays, cycleDays });
        }
        return out;
      },
      get kpiVelocity() {
        const now = Date.now();
        const completed = this._completedWithTimes;
        const within = ms => completed.filter(c => now - new Date(c.completedAt).getTime() <= ms);
        const last7  = within(7  * 86400000);
        const last30 = within(30 * 86400000);
        const avg = arr => arr.length ? Math.round(arr.reduce((a,b) => a+b, 0) / arr.length * 10) / 10 : 0;
        return {
          throughput7d:  last7.length,
          throughput30d: last30.length,
          leadTime:  avg(last30.map(c => c.leadDays)),
          cycleTime: avg(last30.filter(c => c.cycleDays != null).map(c => c.cycleDays)),
        };
      },
      // Indicadores de Velocidade · Dashboard hero v2 (substitui 4 KPI cards
      // "soltos" por hero com sinal + conclusão heurística — mesmo padrão visual
      // do Adoption hero pra consistência cross-aba).
      // 4 KPIs: Throughput W1 (com Δ vs sem ant), Lead time, Cycle time, % no prazo (NEW).
      // Sinal 'sem-dado' (cinza) quando histórico insuficiente — diferente de vermelho.
      get dashboardVelocityIndicators() {
        const v = this.kpiVelocity;
        const cut7  = Date.now() - 7 * 86400000;
        const cut14 = Date.now() - 14 * 86400000;
        const cut30 = Date.now() - 30 * 86400000;

        // Throughput sem ant (7-13d) pra delta absoluto
        const completedAnt = this._completedWithTimes.filter(c => {
          const ts = new Date(c.completedAt).getTime();
          return ts >= cut14 && ts < cut7;
        }).length;
        const deltaThroughput = v.throughput7d - completedAnt;
        const deltaTxt = deltaThroughput > 0 ? `↑ +${deltaThroughput} vs sem ant` :
                         deltaThroughput < 0 ? `↓ ${deltaThroughput} vs sem ant` :
                         '= vs sem ant';

        // % no prazo (30d): das concluídas com prazo, % com data_conclusao ≤ prazo
        const taskById = new Map(this.tasks.map(t => [t.id, t]));
        const completed30 = this._completedWithTimes.filter(c =>
          new Date(c.completedAt).getTime() >= cut30
        );
        const completedComPrazo = completed30.filter(c => {
          const t = taskById.get(c.taskId);
          return t && t.prazo;
        });
        const completedNoPrazo = completedComPrazo.filter(c => {
          const t = taskById.get(c.taskId);
          return new Date(c.completedAt).toISOString().slice(0, 10) <= t.prazo;
        }).length;
        const pctPrazo = completedComPrazo.length > 0
          ? Math.round((completedNoPrazo / completedComPrazo.length) * 100)
          : null;

        // Sinais. 'sem-dado' (neutro) quando não há base — não conta nem como verde nem como vermelho.
        const sigThroughput = v.throughput7d >= 8 ? 'verde' : (v.throughput7d >= 4 ? 'amarelo' : 'vermelho');
        const sigLead = !v.leadTime ? 'sem-dado' : (v.leadTime <= 7 ? 'verde' : (v.leadTime <= 14 ? 'amarelo' : 'vermelho'));
        const sigCycle = !v.cycleTime ? 'sem-dado' : (v.cycleTime <= 4 ? 'verde' : (v.cycleTime <= 8 ? 'amarelo' : 'vermelho'));
        const sigPrazo = pctPrazo == null ? 'sem-dado' : (pctPrazo >= 80 ? 'verde' : (pctPrazo >= 60 ? 'amarelo' : 'vermelho'));

        const cards = [
          {
            key: 'throughput',
            label: 'Throughput W1',
            value: v.throughput7d,
            sig: sigThroughput,
            metaText: 'meta ≥ 8/sem',
            detalhe: deltaTxt,
            help: 'Tasks concluídas na última semana com Δ vs semana anterior. Calibrar meta com histórico do time.',
          },
          {
            key: 'lead',
            label: 'Lead time',
            value: v.leadTime ? v.leadTime + 'd' : '—',
            sig: sigLead,
            metaText: 'meta ≤ 7d',
            detalhe: 'criação → concluído · 30d',
            help: 'Tempo médio total da task (criação até conclusão). Inclui filas — cresce quando há bottleneck.',
          },
          {
            key: 'cycle',
            label: 'Cycle time',
            value: v.cycleTime ? v.cycleTime + 'd' : '—',
            sig: sigCycle,
            metaText: 'meta ≤ 4d',
            detalhe: 'andamento → concluído · 30d',
            help: 'Tempo médio em fase ativa (excluindo backlog). Mede velocidade real de execução.',
          },
          {
            key: 'prazo',
            label: '% no prazo',
            value: pctPrazo == null ? '—' : pctPrazo + '%',
            sig: sigPrazo,
            metaText: 'meta ≥ 80%',
            detalhe: pctPrazo == null
              ? 'sem entregas com prazo · 30d'
              : `${completedNoPrazo}/${completedComPrazo.length} entregas com prazo · 30d`,
            help: 'Das tasks concluídas com prazo definido, % que fechou no dia ou antes. Mede previsibilidade e qualidade da estimativa.',
          },
        ];

        // Conclusão heurística agregadora — só conta cards com dado real (ignora sem-dado).
        const verdes = cards.filter(c => c.sig === 'verde').length;
        const amarelos = cards.filter(c => c.sig === 'amarelo').length;
        const vermelhos = cards.filter(c => c.sig === 'vermelho').length;
        const semDado = cards.filter(c => c.sig === 'sem-dado').length;
        const avaliados = cards.length - semDado;

        let conclusao = '';
        let conclusaoSeveridade = 'verde';
        if (avaliados === 0) {
          conclusao = 'Sem histórico suficiente pra avaliar velocidade. Aguarde algumas conclusões pra ver os indicadores.';
          conclusaoSeveridade = 'sem-dado';
        } else if (verdes === avaliados) {
          conclusao = `Todos os ${avaliados} indicadores avaliáveis verdes. Operação rodando bem.`;
          conclusaoSeveridade = 'verde';
        } else if (vermelhos === 0) {
          const fraca = cards.find(c => c.sig === 'amarelo');
          conclusao = `${verdes} de ${avaliados} verdes. Foco em "${fraca.label}" — meta ${fraca.metaText.replace('meta ', '')}.`;
          conclusaoSeveridade = 'amarelo';
        } else {
          const critica = cards.find(c => c.sig === 'vermelho');
          conclusao = `${vermelhos} indicador(es) crítico(s). Prioridade: "${critica.label}" (${critica.value}, ${critica.metaText.replace('meta ', '')}). Investigar gargalo.`;
          conclusaoSeveridade = 'vermelho';
        }

        return { cards, conclusao, conclusaoSeveridade, verdes, amarelos, vermelhos, semDado };
      },
      // Lead time médio por cliente (últimos 90 dias). Insumo da visão #2
      // do §10. Só inclui cliente com 1+ task concluída no período.
      get leadTimePorCliente() {
        const now = Date.now();
        const cutoff = 90 * 86400000;
        const taskById = new Map(this.tasks.map(t => [t.id, t]));
        const buckets = new Map(); // cliente nome → [leadDays...]
        for (const c of this._completedWithTimes) {
          if (now - new Date(c.completedAt).getTime() > cutoff) continue;
          const t = taskById.get(c.taskId);
          if (!t) continue;
          const nome = this.nomeCliente(t.clienteId);
          if (!buckets.has(nome)) buckets.set(nome, []);
          buckets.get(nome).push(c.leadDays);
        }
        const out = [];
        for (const [nome, arr] of buckets.entries()) {
          const avg = arr.reduce((a,b) => a+b, 0) / arr.length;
          out.push({ cliente: nome, leadDays: Math.round(avg * 10) / 10, count: arr.length });
        }
        return out.sort((a,b) => b.leadDays - a.leadDays);
      },
    };
  }

  window.makeCoreDataView = makeCoreDataView;
})();
