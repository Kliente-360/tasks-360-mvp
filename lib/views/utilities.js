/* ============ tasks 360 · utilities ============
 * Atalhos de teclado, Command Palette, Ajuda/Manual, Onboarding,
 * Navegação (viewerRole, visibleTabs, goToTab). Sections pequenas
 * agrupadas pra evitar muitos arquivos.
 *
 * Dependências em app() (permanecem lá):
 *   - this.tab, this.modal, this.paletteOpen, this.helpOpen, this.onboardingOpen
 *   - this.track, this.renderCharts, this.loadMvpDados
 *   - this.authEnabled, this.currentPessoa, this.tabsList
 *
 * Dependências em window:
 *   - ROLE (helpers.js)
 *   - marked.js (CDN)
 * ============================================================
 */

(function () {
  'use strict';

  function makeUtilitiesView() {
    return {
      // ===================== ATALHOS DE TECLADO =====================
      handleGlobalShortcut(e) {
        const tag = (e.target && e.target.tagName) || '';
        const isTyping = ['INPUT','TEXTAREA','SELECT'].includes(tag) || (e.target && e.target.isContentEditable);
        // Cmd/Ctrl+K — sempre disponível
        if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
          e.preventDefault();
          if (this.paletteOpen) this.closePalette(); else this.openPalette();
          return;
        }
        // Esc é tratado pelos componentes (modal, palette etc)
        if (e.key === 'Escape') {
          if (this.shortcutsHelpOpen) { this.shortcutsHelpOpen = false; return; }
          return;
        }
        if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;
        // Atalhos de uma letra
        const k = e.key;
        // Sequência "g + letra" pra navegar abas
        if (k === 'g') { this._gPrefix = Date.now(); return; }
        const inGSeq = this._gPrefix && (Date.now() - this._gPrefix) < 1500;
        if (inGSeq) {
          this._gPrefix = 0;
          const map = { f: 'foco', b: 'backlog', k: 'kanban', l: 'cal', d: 'dash', c: 'cad', a: 'mvp' };
          if (map[k]) {
            e.preventDefault();
            this.tab = map[k];
            if (k === 'd') this.$nextTick(() => this.renderCharts());
            if (k === 'a') this.loadMvpDados();
            return;
          }
        }
        if (k === 'n') { e.preventDefault(); this.openNew(); return; }
        if (k === '/') {
          e.preventDefault();
          if (this.tab === 'backlog') {
            // foca a busca do backlog
            const inp = document.querySelector('input[placeholder="Buscar título…"]');
            if (inp) inp.focus();
          } else {
            this.openPalette();
          }
          return;
        }
        if (k === '?') { e.preventDefault(); this.shortcutsHelpOpen = !this.shortcutsHelpOpen; return; }
      },
  
      // ===================== COMMAND PALETTE =====================
      openPalette() {
        this.paletteOpen = true;
        this.paletteQuery = '';
        this.paletteIndex = 0;
        this.$nextTick(() => {
          const el = document.getElementById('paletteInput');
          if (el) el.focus();
        });
        this.track('palette_open');
      },
      closePalette() {
        this.paletteOpen = false;
        this.paletteQuery = '';
        this.paletteIndex = 0;
      },
      get paletteResults() {
        const q = (this.paletteQuery || '').toLowerCase().trim();
        const out = [];
        // Tasks
        const tlimit = q ? 30 : 8;
        const taskMatches = this.tasks
          .filter(t => !q || (t.titulo || '').toLowerCase().includes(q) || (t.descricao || '').toLowerCase().includes(q))
          .slice(0, tlimit);
        for (const t of taskMatches) {
          out.push({
            id: 'task-' + t.id, kind: 'tarefa', label: t.titulo,
            hint: this.nomeCliente(t.clienteId) + ' · ' + this.nomeProjeto(t.projetoId) + ' · ' + this.lblStatus(t.status),
            action: () => { this.openEdit(t); this.tab = 'backlog'; },
          });
        }
        // Clientes
        for (const c of this.clientes) {
          if (!q || c.nome.toLowerCase().includes(q)) {
            out.push({
              id: 'cli-' + c.id, kind: 'cliente', label: c.nome,
              hint: 'filtrar backlog por este cliente',
              action: () => { this.f.cliente = c.id; this.tab = 'backlog'; },
            });
          }
        }
        // Projetos
        for (const p of this.projetos) {
          if (!q || p.nome.toLowerCase().includes(q)) {
            out.push({
              id: 'proj-' + p.id, kind: 'projeto', label: p.nome,
              hint: this.nomeCliente(p.clienteId) + ' · filtrar backlog',
              action: () => { this.f.cliente = p.clienteId; this.f.projeto = p.id; this.tab = 'backlog'; },
            });
          }
        }
        // Pessoas
        for (const p of this.pessoas) {
          if (!q || p.nome.toLowerCase().includes(q)) {
            out.push({
              id: 'pes-' + p.id, kind: 'pessoa', label: p.nome,
              hint: 'filtrar backlog por responsável',
              action: () => { this.f.pessoa = p.id; this.tab = 'backlog'; },
            });
          }
        }
        // Ações
        const actions = [
          { id: 'act-new',    kind: 'ação', label: 'Nova tarefa',           hint: 'abrir formulário de criação',   action: () => this.openNew() },
          { id: 'act-foco',   kind: 'ir pra', label: 'Meu foco',            hint: 'urgências do dia',               action: () => this.tab = 'foco' },
          { id: 'act-back',   kind: 'ir pra', label: 'Backlog',             hint: 'tabela de tarefas',              action: () => this.tab = 'backlog' },
          { id: 'act-kan',    kind: 'ir pra', label: 'Kanban',              hint: 'colunas operacional/executiva',  action: () => this.tab = 'kanban' },
          { id: 'act-cal',    kind: 'ir pra', label: 'Calendário',          hint: 'tarefas por prazo',              action: () => this.tab = 'cal' },
          { id: 'act-dash',   kind: 'ir pra', label: 'Dashboard',           hint: 'KPIs e charts',                  action: () => { this.tab = 'dash'; this.$nextTick(() => this.renderCharts()); } },
          { id: 'act-cad',    kind: 'ir pra', label: 'Cadastros',           hint: 'clientes · projetos · pessoas',  action: () => this.tab = 'cad' },
          { id: 'act-mvp',    kind: 'ir pra', label: 'Adoção',              hint: 'métricas de uso',                action: () => { this.tab = 'mvp'; this.loadMvpDados(); } },
          { id: 'act-pdf',    kind: 'export', label: 'Exportar PDF (relatório executivo)', hint: 'snapshot completo', action: () => this.exportPDF() },
          { id: 'act-csv',    kind: 'export', label: 'Exportar CSV (visão atual)',         hint: 'pra Excel',         action: () => this.exportCSV() },
          { id: 'act-clear',  kind: 'ação', label: 'Limpar filtros',        hint: 'reseta busca, cliente, etc.',    action: () => this.clearFilters() },
          { id: 'act-theme',  kind: 'ação', label: 'Alternar tema',         hint: 'claro / escuro',                 action: () => this.toggleTheme() },
          { id: 'act-reload', kind: 'ação', label: 'Recarregar dados',      hint: 'busca tudo do Supabase',         action: () => this.refreshFromLogo() },
          { id: 'act-hist',   kind: 'ação', label: 'Carregar histórico completo', hint: 'tarefas concluídas antigas (>90d)', action: () => this.loadOlderConcluidas() },
          { id: 'act-manual', kind: 'ação', label: 'Manual da ferramenta',  hint: 'como usar · HOWTO completo',     action: () => this.openHelp() },
          { id: 'act-help',   kind: 'ação', label: 'Atalhos de teclado',    hint: 'ver lista completa',             action: () => this.shortcutsHelpOpen = true },
        ];
        for (const a of actions) {
          const hay = (a.label + ' ' + (a.hint || '')).toLowerCase();
          if (!q || hay.includes(q)) out.push(a);
        }
        return out.slice(0, 50);
      },
      paletteSelect(item) {
        if (!item || !item.action) return;
        const fn = item.action;
        this.track('palette_select', { id: item.id, kind: item.kind, label: item.label });
        this.closePalette();
        this.$nextTick(() => fn());
      },
  
      // ===================== AJUDA / MANUAL =====================
      async openHelp() {
        this.helpOpen = true;
        this.track('help_open');
        // Cliente externo recebe documento dedicado (HOWTO_CLIENTE), com
        // tom amigável e foco no Portal. Staff (admin/interno) continua
        // com o manual interno completo.
        const isCliente = this.viewerRole === ROLE.CLIENTE;
        const helpFile = isCliente ? 'HOWTO_CLIENTE.md' : 'HOWTO.md';
        // Invalida cache se trocamos de role no mesmo browser
        if (this._helpLoaded === helpFile) return;
        this.helpLoading = true; this.helpError = '';
        try {
          const r = await fetch(helpFile, { cache: 'no-cache' });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const md = await r.text();
          // Remove o título/subtítulo top-of-file pra não duplicar com o header do overlay
          const cleaned = md
            .replace(/^#\s+tasks 360 — manual do usuário[\s\S]*?\n---\s*\n/m, '')
            .replace(/^#\s+Portal Kliente 360[\s\S]*?\n---\s*\n/m, '')
            .trim();
          const tmp = document.createElement('div');
          tmp.innerHTML = marked.parse(cleaned, { gfm: true });
          const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
          const toc = [];
          const used = new Set();
          tmp.querySelectorAll('h1, h2').forEach(h => {
            let id = slug(h.textContent || '');
            if (!id) return;
            let n = 1; const base = id; while (used.has(id)) { id = base + '-' + (++n); }
            used.add(id);
            h.id = id;
            toc.push({ id, text: h.textContent, depth: parseInt(h.tagName[1]) });
          });
          this.helpHtml = tmp.innerHTML;
          this.helpToc = toc;
          this._helpLoaded = helpFile;
        } catch (e) {
          this.helpError = (e && e.message) || 'erro desconhecido';
        } finally {
          this.helpLoading = false;
        }
      },
      closeHelp() { this.helpOpen = false; },
  
      // ===================== ONBOARDING (3 perspectivas) =====================
      async openOnboarding() {
        // default por role: admin → CEO, interno → analista, cliente → analista
        const role = this.viewerRole;
        this.onboardingPersona = role === ROLE.ADMIN ? 'ceo' : 'analista';
        this.track('onboarding_open', { persona: this.onboardingPersona });
        this.onboardingOpen = true;
        if (this._onboardingLoaded) return;
        this.onboardingLoading = true; this.onboardingError = '';
        try {
          const r = await fetch('ONBOARDING.md', { cache: 'no-cache' });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const md = await r.text();
          // Remove preâmbulo (título top + blockquote inicial até a primeira H1 de persona)
          const cleaned = md.replace(/^[\s\S]*?(?=^# CEO)/m, '').trim();
          // Splita em 3 blocos por '# CEO', '# Gerente', '# Analista'
          const parts = cleaned.split(/^---\s*$\s*(?=^# (?:CEO|Gerente|Analista))/m);
          const map = { ceo: '', gerente: '', analista: '' };
          for (const part of parts) {
            const head = part.match(/^# (CEO|Gerente|Analista)/m);
            if (!head) continue;
            const key = head[1].toLowerCase().startsWith('c') ? 'ceo'
                      : head[1].toLowerCase().startsWith('g') ? 'gerente'
                      : 'analista';
            // Tira o trailer de outras personas se grudou
            const block = part.split(/^---\s*$/m)[0];
            map[key] = marked.parse(block, { gfm: true });
          }
          this.onboardingHtml = map;
          this._onboardingLoaded = true;
        } catch (e) {
          this.onboardingError = (e && e.message) || 'erro desconhecido';
        } finally {
          this.onboardingLoading = false;
        }
      },
      closeOnboarding() { this.onboardingOpen = false; },
      setOnboardingPersona(p) {
        this.onboardingPersona = p;
        this.$nextTick(() => {
          const el = document.getElementById('onboardingScroll');
          if (el) el.scrollTop = 0;
        });
      },
      scrollHelpTo(id) {
        const root = document.getElementById('helpScroll');
        const el = root && root.querySelector('#' + CSS.escape(id));
        if (el && root) root.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' });
      },
  
      // ===================== NAVEGAÇÃO =====================
      tabLabel(key) {
        const t = this.tabsList.find(x => x.key === key);
        return t ? t.label : key;
      },
      // Derivado de currentPessoa quando auth on; default 'admin' (auth off ou pré-login).
      get viewerRole() {
        if (!this.authEnabled) return 'admin';
        return (this.currentPessoa && this.currentPessoa.role) || 'admin';
      },
      // Pessoa que o "Meu foco" mostra. Admin pode simular via selector;
      // interno usa o próprio currentPessoa automaticamente.
      get effectiveFocusPessoaId() {
        if (this.viewerRole === ROLE.ADMIN || !this.authEnabled) return this.focusPessoaId;
        return (this.currentPessoa && this.currentPessoa.id) || '';
      },
      // Cliente visualizado no Portal. Cliente real usa o cliente_id da própria pessoa
      // (sem opção de simular). Admin/interno simulam via selector.
      get effectivePortalClienteId() {
        if (this.viewerRole === ROLE.CLIENTE) return (this.currentPessoa && this.currentPessoa.cliente_id) || '';
        return this.portalClienteId;
      },
      get visibleTabs() {
        return this.tabsList.filter(t =>
          (!t.roles || t.roles.includes(this.viewerRole))
          && !(t.hideMobile && this.isMobileViewport)
          && !t.inProfileMenu
        );
      },
      goToTab(key) {
        const prev = this.tab;
        this.tab = key;
        if (key === 'dash') this.$nextTick(() => this.renderCharts());
        if (key === 'mvp')  this.loadMvpDados();
        if (key !== prev) this.track('tab_open', { tab: key, from: prev });
      },
    };
  }

  window.makeUtilitiesView = makeUtilitiesView;
})();
