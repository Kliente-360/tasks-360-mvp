// Supabase client (sb), SUPABASE_URL/KEY, AUTH_ENABLED definidos em
// lib/supabase-client.js (carregado antes; expostos em window).


// CONSTANTS (STATUS, ROLE, TIER, PRIORIDADE, SEVERIDADE, SIGNAL, CARGA_NIVEL)
// vivem em lib/helpers.js (testáveis em tests/index.html). Carregados em
// window por aquele script — disponíveis aqui e em x-show/x-text.

// Adapters JS <-> DB: F, makeFromDb/ToDb/Blank, TASK_FIELDS, taskFromDb,
// taskToDb, PROJETO_FIELDS, projetoFromDb, CLIENTE_FIELDS, clienteFromDb
// definidos em lib/adapters.js (carregado antes; expostos em window).

function app() {
  // O objeto base define todo o state + métodos que ainda vivem em app.js.
  // Views/stores extraídos são merged via Object.defineProperties pra
  // preservar getters (Object.assign os congelaria nos valores atuais).
  const base = {
    tab: 'backlog',
    cadTab: 'clientes',
    clientes: [],
    projetos: [],
    pessoas: [],
    tasks: [],
    // Cache de getters caros. Map fica fora do Proxy do Alpine, então
    // .set() não dispara reatividade. Invalidação automática via
    // assinatura barata baseada em this.tasks (length + xor de timestamps).
    _memos: new Map(),
    // Counter bumpado em mutations de pessoas/clientes/projetos pra
    // invalidar memos que dependem deles (ex: capacidade da pessoa muda
    // → reportTeamLoad refresh).
    _dataRev: 0,
    f: { q: '', cliente: '', projeto: '', pessoa: '', pri: '', complexidade: '', status: 'abertas', tag: '' },
    newTag: '',
    sortKey: 'prazo',
    sortDir: 'asc',
    sortPanelOpen: false,
    sortOptions: [
      { key: 'prazo',         label: 'Prazo' },
      { key: 'prioridade',    label: 'Prioridade' },
      { key: 'subetapa',      label: 'Etapa' },
      { key: 'esforco',       label: 'Esforço' },
      { key: 'complexidade',  label: 'Complexidade' },
      { key: 'titulo',        label: 'Título' },
      { key: 'clienteId',     label: 'Cliente' },
      { key: 'projetoId',     label: 'Projeto' },
      { key: 'pessoaId',      label: 'Responsável' },
    ],
    backlogDragId: '',
    modal: false,
    // === Autosave (modal task) ===
    // saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
    // _autosaveTimer: handle do setTimeout (debounce 800ms)
    // _autosaveSeq: sequência pra ignorar respostas stale (out-of-order writes)
    // lastSavedAt: ms epoch do último save bem-sucedido (pra renderizar "salvo · há Ns")
    // Botão Salvar do footer continua funcionando — autosave roda em paralelo.
    saveState: 'idle',
    lastSavedAt: 0,
    _autosaveTimer: null,
    _autosaveSeq: 0,
    // Aba ativa do pane direito do modal task: 'conversa' | 'historico'
    // Aba do modal task. Mobile: 'detalhes' | 'conversa' | 'historico' (3 abas
    // full-screen). Desktop: 'detalhes' é ignorado (esquerda sempre visível),
    // só alterna 'conversa'/'historico' na direita. Reset por _initialModalTab().
    modalTab: 'conversa',
    loading: true,
    refreshing: false,
    theme: (() => { try { return localStorage.getItem('kliente360-theme') || 'light'; } catch(_) { return 'light'; } })(),
    filtersOpen: false,
    toasts: [],
    renameTarget: null,
    renameValue: '',
    confirmTarget: null,
    exportOpen: false,
    userMenuOpen: false,
    authEnabled: AUTH_ENABLED,
    session: null,
    currentPessoa: null,
    loginEmail: '',
    loginSent: false,
    loginError: '',
    loginCode: '',
    loginVerifying: false,
    loginSending: false,
    loginGoogle: false,
    authBlock: '', // mensagem persistente quando o callback nega acesso (volta pra login)
    draggingId: '',
    dragOverCol: '',
    editing: { id: '', titulo: '', descricao: '', clienteId: '', projetoId: '', pessoaId: '', prioridade: 'P2', esforco: 4, prazo: '', status: 'backlog', subetapa: 'backlog', complexidade: 'media', bloqueadoPor: '', visivelCliente: true },
    editingPessoa: null,
    modalPessoa: false,
    editingCliente: null,
    modalCliente: false,
    editingProjeto: null,
    modalProjeto: false,
    showArchivedCadastros: false,
    showArchivedTasks: false,
    kanbanView: 'op', // 'op' (operacional, nível 2) | 'exec' (executiva, nível 1)
    isMobileViewport: typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
    quickAddSub: '',
    quickAddTitle: '',
    selectedIds: [],
    triagemFilter: { semResp: false, semPrazo: false, semEsforco: false },
    groupBy: '', // '' | 'pessoa' | 'cliente' | 'projeto' | 'status' | 'subetapa' | 'prioridade' | 'complexidade'
    collapsedGroups: [],
    // Calendário: mês corrente exibido (1º dia, normalizado)
    calCursor: (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.getTime(); })(),
    calSelectedDate: '', // ISO YYYY-MM-DD do dia selecionado, '' = nenhum
    // Meu foco: pessoa que está atuando (workaround enquanto auth está off)
    focusPessoaId: '',
    portalClienteId: '',  // cliente sendo visualizado no Portal (admin/interno simulam)
    portalTaskOpen: false,
    portalTask: null,
    portalTaskComments: [],
    portalNewComment: '',
    portalReplyText: '',
    // viewerRole agora é getter, derivado de currentPessoa quando auth está on.
    mobileNavOpen: false,
    helpOpen: false,
    onboardingOpen: false,
    onboardingPersona: 'analista',
    onboardingHtml: { ceo: '', gerente: '', analista: '' },
    onboardingLoading: false,
    onboardingError: '',
    _onboardingLoaded: false,
    helpHtml: '',
    helpToc: [],
    helpLoading: false,
    helpError: '',
    _helpLoaded: false,
    tabsList: [
      { key: 'foco',    label: 'Meu foco', roles: ['admin','interno'] },
      { key: 'brief',   label: 'Briefing', roles: ['admin'] },
      { key: 'triagem', label: 'Triagem',  roles: ['admin','interno'] },
      { key: 'backlog', label: 'Backlog',  roles: ['admin','interno'] },
      { key: 'kanban',  label: 'Kanban',   roles: ['admin','interno'], hideMobile: true },
      { key: 'cal',     label: 'Calendário', roles: ['admin','interno'] },
      { key: 'dash',    label: 'Dashboard', roles: ['admin','interno'] },
      { key: 'portal',  label: 'Portal cliente', roles: ['admin','interno','cliente'] },
      { key: 'cad',     label: 'Cadastros', roles: ['admin'] },
      { key: 'mvp',     label: 'Adoption',  roles: ['admin'] },
    ],
    paletteOpen: false,
    paletteQuery: '',
    paletteIndex: 0,
    shortcutsHelpOpen: false,
    _gPrefix: 0, // timestamp do último 'g' pressionado para sequência g+letter
    SUB_LABELS: {
      backlog: 'Backlog', priorizado: 'Priorizado', em_definicao: 'Em definição', escopo_definido: 'Escopo definido',
      em_desenvolvimento: 'Em desenvolvimento', em_homologacao: 'Em homologação', em_revisao: 'Em revisão',
      pronto_producao: 'Pronto p/ produção', em_implantacao: 'Em implantação',
      bloqueado: 'Bloqueado', concluido: 'Concluído',
    },
    SUB_TO_MACRO: {
      backlog: 'backlog', priorizado: 'backlog', em_definicao: 'backlog', escopo_definido: 'backlog',
      em_desenvolvimento: 'andamento', em_homologacao: 'andamento', em_revisao: 'andamento',
      pronto_producao: 'andamento', em_implantacao: 'andamento',
      bloqueado: 'bloqueado', concluido: 'concluido',
    },
    SUBS_BY_MACRO: {
      backlog:    ['backlog','priorizado','em_definicao','escopo_definido'],
      andamento:  ['em_desenvolvimento','em_homologacao','em_revisao','pronto_producao','em_implantacao'],
      bloqueado:  ['bloqueado'],
      concluido:  ['concluido'],
    },
    SUBS_FLAT: ['backlog','priorizado','em_definicao','escopo_definido','em_desenvolvimento','em_homologacao','em_revisao','pronto_producao','em_implantacao','bloqueado','concluido'],
    editingComments: [],
    editingHistory: [], // unificada: status + campos. Cada item tem `kind`
    checklistOpen: false,                // colapsado por padrão; reabre se já tiver itens (openEdit decide)
    editingAttachments: [],
    attachmentUrls: {},                  // { [attachment_id]: signedUrl } — TTL 1h
    attachmentUploading: false,
    attachmentUploadLabel: '',
    lightboxAttachment: null,
    newComment: '',
    newCommentPublico: false,
    mentionPickerFor: '',  // '' | 'newComment' | 'newReply' | 'portalNewComment' | 'portalReplyText'
    mentionPickerQuery: '',
    // Anchor + field do @ sendo digitado inline — usados pra substituir o
    // partial '@xxx' por '@FirstName' no lugar certo ao escolher.
    _mentionAnchor: null,
    _mentionField: null,
    _mentionActiveIdx: 0,
    notifications: [],
    notifPanelOpen: false,
    _notifsSubscribed: false,
    replyingToId: '',
    editingCommentId: '',
    editingCommentDraft: '',
    newReply: '',
    newCli: '',
    newProj: { nome: '', clienteId: '' },
    historyAll: [],
    taskDeps: [], // [{task_id, depende_de_id}, ...] do banco, fonte da verdade
    newDepId: '', // select de adicionar dependência no modal
    mvpComments: [],
    usageEvents: [],
    mvpLoadedAt: 0,
    charts: { clientes: null, capacidade: null, aging: null, timeline: null, throughput: null, leadtime: null, mvpVolume: null, mvpDau: null },
    printCharts: { status: null, clientes: null, throughput: null },
    reportStampDate: '',
    reportStampTime: '',

    // ===================== INIT / PERSISTÊNCIA =====================
    async init() {
      this.editing = this.blankTask();
      this.hydrateFiltersFromUrl();
      this.$watch('f', () => this.syncFiltersToUrl(), { deep: true });
      // Limpa seleção ao trocar de tab pra evitar bulk acidental cross-contexto.
      this.$watch('tab', () => { if (this.selectedIds.length) this.selectedIds = []; });
      // === Autosave watcher: debounce 800ms após mutação em editing ===
      // Só dispara quando: (a) modal aberto, (b) task já existe (id presente),
      // (c) título não está vazio. Tasks novas exigem clique no botão Salvar.
      this.$watch('editing', (next) => {
        if (!this.modal) return;
        if (!next || !next.id) return;
        if (!next.titulo || !next.titulo.trim()) return;
        this.saveState = 'dirty';
        clearTimeout(this._autosaveTimer);
        this._autosaveTimer = setTimeout(() => this.autosaveTaskNow(), 800);
      }, { deep: true });
      // Atalhos globais de teclado.
      window.addEventListener('keydown', (e) => this.handleGlobalShortcut(e));
      // Restaura "atuando como" do storage
      try { this.focusPessoaId = localStorage.getItem('kliente360-focus-pessoa') || ''; } catch(_) {}
      // Restaura cliente do Portal selecionado
      try { this.portalClienteId = localStorage.getItem('kliente360-portal-cliente') || ''; } catch(_) {}
      // Tracking de viewport pra forçar kanban executivo no mobile
      const mq = window.matchMedia('(max-width: 767px)');
      const updateMq = () => {
        this.isMobileViewport = mq.matches;
        // Redireciona se a aba ativa não está mais visível (ex.: Kanban no mobile).
        if (this.tab && !this.visibleTabs.some(t => t.key === this.tab)) {
          this.tab = (this.visibleTabs[0] && this.visibleTabs[0].key) || 'backlog';
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', updateMq);
      else if (mq.addListener) mq.addListener(updateMq);
      if (SUPABASE_URL.includes('YOUR-PROJECT')) {
        this.loading = false;
        this.toast('error', 'Supabase não configurado. Edite SUPABASE_URL e SUPABASE_ANON_KEY no index.html.', 30000);
        return;
      }

      if (AUTH_ENABLED) {
        // Auth: hidrata sessão e escuta mudanças
        const { data: { session } } = await sb.auth.getSession();
        this.session = session;
        await this.ensureCurrentPessoa(session);

        sb.auth.onAuthStateChange(async (event, sess) => {
          console.log('[auth] state change', event, sess && sess.user && sess.user.email);
          this.session = sess;
          if (event === 'SIGNED_IN') {
            this.loginSent = false;
            this.loginEmail = '';
          }
          // Evita re-resolver pessoa se a mesma já está vinculada ao userId atual
          const sameUser = sess && sess.user && this.currentPessoa && this.currentPessoa.user_id === sess.user.id;
          if (!sameUser) {
            await this.ensureCurrentPessoa(sess);
          }
          // Telemetria: login event uma vez por SIGNED_IN, depois que pessoa
          // foi resolvida (precisa do currentPessoa.id pra atribuir).
          if (event === 'SIGNED_IN' && this.currentPessoa) {
            this.track('login', { provider: (sess && sess.user && sess.user.app_metadata && sess.user.app_metadata.provider) || null });
          }
          if (this.session && this.currentPessoa && this.tasks.length === 0) {
            await this.load();
            this.subscribeRealtime();
            this.loadNotifications();
            this.subscribeNotifications();
          }
          if (event === 'SIGNED_OUT') {
            this.tasks = []; this.clientes = []; this.projetos = []; this.pessoas = [];
            this.notifications = [];
          }
        });

        if (this.session && this.currentPessoa) {
          try {
            await this.load();
            this.subscribeRealtime();
            this.loadNotifications();
            this.subscribeNotifications();
          } finally {
            this.loading = false;
          }
        } else {
          this.loading = false;
        }
      } else {
        // Auth desligada: carrega direto, sem gating
        try {
          await this.load();
          this.subscribeRealtime();
        } finally {
          this.loading = false;
        }
      }
    },
    async ensureCurrentPessoa(session) {
      if (!session || !session.user) {
        this.currentPessoa = null;
        try { localStorage.removeItem('kliente360-current-pessoa'); } catch(_) {}
        return;
      }
      const userId = session.user.id;
      const email = (session.user.email || '').trim().toLowerCase();
      const provider = (session.user.app_metadata && session.user.app_metadata.provider) || 'email';
      console.log('[auth] resolving pessoa for', { userId, email, provider });

      // Hidrata do cache primeiro pra evitar piscar tela de login em refresh
      try {
        const cached = JSON.parse(localStorage.getItem('kliente360-current-pessoa') || 'null');
        if (cached && cached.user_id === userId) {
          this.currentPessoa = cached;
        }
      } catch(_) {}

      // 1) por user_id já vinculado
      const r1 = await sb.from('pessoas').select('id, nome, email, user_id, invited_at, role, cliente_id, cliente_principal_id, cliente_secundario_id, capacidade_horas_semana,skills,senioridade').eq('user_id', userId).maybeSingle();
      if (r1.error) {
        console.error('[auth] lookup by user_id failed:', r1.error);
        this.toast('error', 'Erro ao buscar usuário: ' + r1.error.message, 8000);
        // Se temos cache, mantém; não derruba sessão por erro de rede.
        return;
      }
      console.log('[auth] by user_id →', r1.data);
      if (r1.data) {
        if (!r1.data.invited_at) {
          console.warn('[auth] pessoa encontrada mas SEM invited_at → revogada');
          this.authBlock = 'Acesso revogado. Sua pessoa existe no sistema mas o convite foi removido. Peça pro admin clicar em "convidar" novamente.';
          this.toast('error', this.authBlock, 20000);
          await sb.auth.signOut();
          this.currentPessoa = null; this.session = null;
          return;
        }
        this.currentPessoa = r1.data; this.authBlock = '';
        try { localStorage.setItem('kliente360-current-pessoa', JSON.stringify(r1.data)); } catch(_) {}
        this._redirectByRole();
        return;
      }

      // 2) por email (case-insensitive) — vincula se for primeiro login
      if (email) {
        const r2 = await sb.from('pessoas').select('id, nome, email, user_id, invited_at, role, cliente_id, cliente_principal_id, cliente_secundario_id, capacidade_horas_semana,skills,senioridade').ilike('email', email).maybeSingle();
        if (r2.error) {
          console.error('[auth] lookup by email failed:', r2.error);
          this.toast('error', 'Erro ao buscar usuário: ' + r2.error.message, 20000);
          return;
        }
        console.log('[auth] by email →', r2.data);
        if (r2.data) {
          if (!r2.data.invited_at) {
            console.warn('[auth] pessoa encontrada por email mas SEM invited_at');
            this.authBlock = `Email '${email}' está cadastrado mas não tem convite ativo. Peça pro admin clicar em "convidar" pra você no cadastro de Pessoas.`;
            this.toast('error', this.authBlock, 20000);
            await sb.auth.signOut();
            this.currentPessoa = null; this.session = null;
            return;
          }
          // Vincula user_id apenas se está vazio E ainda não há outro registro com esse user_id
          if (!r2.data.user_id) {
            const { error: upErr } = await sb.from('pessoas').update({ user_id: userId }).eq('id', r2.data.id);
            if (upErr) {
              console.error('[auth] linking user_id failed:', upErr);
              // UNIQUE violation: outra pessoa já tem esse user_id. Loga, mas segue.
            }
          } else if (r2.data.user_id !== userId) {
            console.warn('[auth] pessoa.user_id já está vinculado a outro auth user — usando mesmo assim');
          }
          this.currentPessoa = { ...r2.data, user_id: r2.data.user_id || userId };
          this.authBlock = '';
          try { localStorage.setItem('kliente360-current-pessoa', JSON.stringify(this.currentPessoa)); } catch(_) {}
          this._redirectByRole();
          return;
        }
      }

      // 3) RPC fallback — cliente recém-convidado não consegue ler pessoas
      //    via select direto (RLS exige user_id já vinculado). A função
      //    `app_link_current_user_to_pessoa` roda security definer, faz o
      //    match por email do JWT e popula user_id atomicamente.
      const rpc = await sb.rpc('app_link_current_user_to_pessoa');
      console.log('[auth] rpc link →', rpc.data, rpc.error);
      if (rpc.error) {
        console.error('[auth] rpc link failed:', rpc.error);
        this.toast('error', 'Erro ao vincular pessoa: ' + rpc.error.message, 20000);
        return;
      }
      const linked = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      if (linked) {
        if (!linked.invited_at) {
          this.authBlock = `Email '${email}' está cadastrado mas não tem convite ativo. Peça pro admin clicar em "convidar" pra você no cadastro de Pessoas.`;
          this.toast('error', this.authBlock, 20000);
          await sb.auth.signOut();
          this.currentPessoa = null; this.session = null;
          return;
        }
        this.currentPessoa = linked; this.authBlock = '';
        try { localStorage.setItem('kliente360-current-pessoa', JSON.stringify(linked)); } catch(_) {}
        this._redirectByRole();
        return;
      }

      // 4) lista fechada — nega acesso
      console.warn('[auth] no pessoa found for email', email, '→ signing out');
      this.authBlock = `Email '${email}' não está cadastrado em Pessoas. Peça pro admin te cadastrar antes (Cadastros → Pessoas → + Nova pessoa).`;
      this.toast('error', this.authBlock, 20000);
      await sb.auth.signOut();
      this.currentPessoa = null;
      this.session = null;
    },
    _redirectByRole() {
      // Se a aba ativa não é visível pro role atual, redireciona pra primeira visível.
      // Útil principalmente pra cliente que cai em "foco" (default) mas só pode ver Portal.
      if (!this.tab) return;
      const ok = this.visibleTabs.some(t => t.key === this.tab);
      if (!ok) {
        const first = this.visibleTabs[0];
        if (first) this.tab = first.key;
      }
    },
    async signInWithGoogle() {
      if (this.loginGoogle) return;
      this.loginError = '';
      this.loginGoogle = true;
      try {
        const { error } = await sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + window.location.pathname },
        });
        if (error) {
          this.loginError = 'Erro ao iniciar Google: ' + error.message;
          this.loginGoogle = false;
        }
        // Sucesso: o browser redireciona pro Google e volta. Não precisa resetar loginGoogle.
      } catch (e) {
        this.loginError = 'Erro: ' + (e.message || e);
        this.loginGoogle = false;
      }
    },
    async sendMagicLink() {
      if (this.loginSending) return; // evita duplo clique
      const email = (this.loginEmail || '').trim().toLowerCase();
      this.loginError = '';
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        this.loginError = 'Informe um email válido.';
        return;
      }
      this.loginSending = true;
      try {
        const { data: pessoa, error: pErr } = await sb
          .from('pessoas')
          .select('id, nome, invited_at')
          .ilike('email', email)
          .maybeSingle();
        if (pErr) { this.loginError = 'Erro ao validar acesso: ' + pErr.message; return; }
        if (!pessoa) { this.loginError = 'Email não está cadastrado. Peça pro admin cadastrar antes.'; return; }
        if (!pessoa.invited_at) { this.loginError = 'Email cadastrado mas sem convite ativo. Peça pro admin clicar em "convidar".'; return; }
        const { error } = await sb.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin + window.location.pathname }
        });
        if (error) { this.loginError = error.message; return; }
        this.loginSent = true;
      } finally {
        this.loginSending = false;
      }
    },
    async verifyLoginCode() {
      if (this.loginVerifying) return;
      const email = (this.loginEmail || '').trim().toLowerCase();
      const token = (this.loginCode || '').trim();
      this.loginError = '';
      if (!email) { this.loginError = 'Email perdido — recomeça.'; return; }
      if (!/^\d{6}$/.test(token)) { this.loginError = 'Código de 6 dígitos.'; return; }
      this.loginVerifying = true;
      try {
        const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
        if (error) { this.loginError = error.message; return; }
        this.loginCode = '';
        // sucesso → onAuthStateChange vai resolver currentPessoa e carregar
      } finally {
        this.loginVerifying = false;
      }
    },
    async signOut() {
      await sb.auth.signOut();
    },
    hydrateFiltersFromUrl() {
      const p = new URLSearchParams(window.location.search);
      if (p.has('q'))       this.f.q       = p.get('q') || '';
      if (p.has('cliente')) this.f.cliente = p.get('cliente') || '';
      if (p.has('projeto')) this.f.projeto = p.get('projeto') || '';
      if (p.has('pessoa'))  this.f.pessoa  = p.get('pessoa') || '';
      if (p.has('status'))  this.f.status  = p.get('status') || '';
      if (p.has('pri'))          this.f.pri          = p.get('pri') || '';
      if (p.has('complexidade')) this.f.complexidade = p.get('complexidade') || '';
      if (p.has('tag'))          this.f.tag          = p.get('tag') || '';
    },
    syncFiltersToUrl() {
      const f = this.f;
      const params = new URLSearchParams();
      if (f.q)       params.set('q', f.q);
      if (f.cliente) params.set('cliente', f.cliente);
      if (f.projeto) params.set('projeto', f.projeto);
      if (f.pessoa)  params.set('pessoa', f.pessoa);
      if (f.status !== 'abertas') params.set('status', f.status);
      if (f.pri)          params.set('pri', f.pri);
      if (f.complexidade) params.set('complexidade', f.complexidade);
      if (f.tag)          params.set('tag', f.tag);
      const qs = params.toString();
      const url = window.location.pathname + (qs ? '?' + qs : '');
      history.replaceState(null, '', url);
    },

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

    // ============ MEMOIZATION ============
    // Assinatura barata pra invalidar memos baseados em tasks.
    // Captura mudanças em quantidade + status_em/subetapa_em — campos que
    // disparam quase todas as recomputações de getter caro. Edição de
    // título/descrição não muda assinatura (e getters caros não dependem).
    get _tasksSig() {
      let s = this.tasks.length;
      for (const t of this.tasks) s = (s * 31 + (t.statusEm | 0) + (t.subetapaEm | 0)) | 0;
      return s;
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
        return true;
      });
    },
    triagemAnyFilter() {
      const f = this.triagemFilter;
      return f.semResp || f.semPrazo || f.semEsforco;
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
      // PDF executivo é só tabelas/KPIs/ações — não há charts a construir.
      this.destroyPrintCharts();
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
      const m = new Map();
      for (const t of this.tasks) m.set(t.id, t);
      return m;
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
      return this.clientes.filter(c => !c.arquivadoEm);
    },
    get projetosAtivos() {
      return this.projetos.filter(p => !p.arquivadoEm);
    },
    get clientesVisiveis() {
      return this.showArchivedCadastros ? this.clientes : this.clientesAtivos;
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

    // ===================== BACKLOG (filtros + sort) =====================
    get projetosFiltrados() {
      if (!this.f.cliente) return this.projetos;
      return this.projetosByCliente.get(this.f.cliente) || [];
    },
    // Base pra qualquer view que NUNCA deve mostrar arquivadas
    // (Kanban, Foco, Triagem, Calendário, Dashboard, Heurísticas, Briefing, Portal).
    // Backlog respeita o toggle showArchivedTasks separadamente em `filtered`.
    get _visibleTasks() {
      return this.tasks.filter(t => !t.arquivadoEm);
    },
    get filtered() {
      const f = this.f;
      const q = (f.q || '').toLowerCase().trim();
      const base = this.showArchivedTasks ? this.tasks : this._visibleTasks;
      let arr = base.filter(t => {
        if (q && !(t.titulo + ' ' + (t.descricao||'')).toLowerCase().includes(q)) return false;
        // Sentinel '__empty__' = filtrar onde o campo está vazio/null.
        if (f.cliente === '__empty__') { if (t.clienteId) return false; }
        else if (f.cliente && t.clienteId !== f.cliente) return false;
        if (f.projeto === '__empty__') { if (t.projetoId) return false; }
        else if (f.projeto && t.projetoId !== f.projeto) return false;
        if (f.pessoa === '__empty__') { if (t.pessoaId) return false; }
        else if (f.pessoa && t.pessoaId !== f.pessoa) return false;
        if (f.status === 'abertas') { if (t.status === STATUS.CONCLUIDO) return false; }
        else if (f.status && t.status !== f.status) return false;
        if (f.pri === '__empty__') { if (t.prioridade) return false; }
        else if (f.pri && t.prioridade !== f.pri) return false;
        if (f.complexidade === '__empty__') { if (t.complexidade) return false; }
        else if (f.complexidade && (t.complexidade||'media') !== f.complexidade) return false;
        if (f.tag === '__empty__') { if ((t.tags || []).length) return false; }
        else if (f.tag && !(t.tags || []).includes(f.tag)) return false;
        return true;
      });
      if (this.sortKey === 'manual') {
        // tarefas com ordem definida vêm primeiro (asc); resto cai no fim por criadoEm desc
        arr.sort((a, b) => {
          const ao = a.ordem, bo = b.ordem;
          if (ao != null && bo != null) return ao - bo;
          if (ao != null) return -1;
          if (bo != null) return 1;
          return (b.criadoEm || 0) - (a.criadoEm || 0);
        });
        return arr;
      }
      const k = this.sortKey, dir = this.sortDir === 'asc' ? 1 : -1;
      arr.sort((a,b) => {
        let av = a[k], bv = b[k];
        if (k === 'clienteId') { av = this.nomeCliente(av); bv = this.nomeCliente(bv); }
        if (k === 'projetoId') { av = this.nomeProjeto(av); bv = this.nomeProjeto(bv); }
        if (k === 'pessoaId')  { av = this.nomePessoa(av);  bv = this.nomePessoa(bv); }
        if (k === 'status') {
          const order = { andamento:0, bloqueado:1, backlog:2, concluido:3 };
          av = order[av]; bv = order[bv];
        }
        if (k === 'subetapa') {
          // Ordem natural do fluxo (não alfabética)
          const order = Object.fromEntries(this.SUBS_FLAT.map((s, i) => [s, i]));
          av = order[av] ?? 99; bv = order[bv] ?? 99;
        }
        if (k === 'prioridade') { av = +av.slice(1); bv = +bv.slice(1); }
        if (k === 'complexidade') {
          const order = { alta: 0, media: 1, baixa: 2 };
          av = order[av] ?? 1; bv = order[bv] ?? 1;
        }
        if (av == null) av = '';
        if (bv == null) bv = '';
        if (av < bv) return -1*dir;
        if (av > bv) return  1*dir;
        return 0;
      });
      return arr;
    },
    // Limite de linhas renderizadas por grupo (pagination simples no
    // backlog). Bumpa em _LIST_LIMIT_STEP via loadMoreBacklog().
    _listLimit: 100,
    _LIST_LIMIT_STEP: 100,
    loadMoreBacklog() { this._listLimit += this._LIST_LIMIT_STEP; },

    // Agrupamento de 1 nível. Retorna sempre array de grupos; se groupBy
    // estiver vazio, devolve um único grupo "todas" sem header.
    // Cada grupo é truncado em this._listLimit (mostra "carregar mais"
    // quando excede). Evita renderizar 500+ rows de uma vez.
    get groupedFiltered() {
      const lim = this._listLimit;
      const trim = (tasks) => {
        const total = tasks.length;
        if (total <= lim) return { tasks, tasksTotal: total, hasMore: false };
        return { tasks: tasks.slice(0, lim), tasksTotal: total, hasMore: true };
      };
      const arr = this.filtered;
      if (!this.groupBy) return [{ key: '__all__', label: '', isAll: true, ...trim(arr) }];
      const map = new Map();
      for (const t of arr) {
        let key, label;
        switch (this.groupBy) {
          case 'pessoa':       key = t.pessoaId  || '__none__'; label = t.pessoaId  ? this.nomePessoa(t.pessoaId)   : 'sem responsável'; break;
          case 'cliente':      key = t.clienteId || '__none__'; label = t.clienteId ? this.nomeCliente(t.clienteId) : '— sem cliente';   break;
          case 'projeto':      key = t.projetoId || '__none__'; label = t.projetoId ? this.nomeProjeto(t.projetoId) : '— sem projeto';   break;
          case 'status':       key = t.status;                  label = this.lblStatus(t.status);                   break;
          case 'subetapa':     key = t.subetapa;                label = this.lblSub(t.subetapa);                    break;
          case 'prioridade':   key = t.prioridade;              label = t.prioridade;                                break;
          case 'complexidade': key = t.complexidade || 'media'; label = this.lblComplex(t.complexidade);            break;
          default:             key = '__all__';                 label = '';                                          break;
        }
        if (!map.has(key)) map.set(key, { key, label, tasks: [] });
        map.get(key).tasks.push(t);
      }
      // Aplica trim por grupo
      const groups = Array.from(map.values()).map(g => ({ ...g, ...trim(g.tasks) }));
      // Ordenação dos grupos por tipo
      if (this.groupBy === 'prioridade') {
        const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
        groups.sort((a, b) => (order[a.key] ?? 9) - (order[b.key] ?? 9));
      } else if (this.groupBy === 'status') {
        const order = { andamento: 0, bloqueado: 1, backlog: 2, concluido: 3 };
        groups.sort((a, b) => (order[a.key] ?? 9) - (order[b.key] ?? 9));
      } else if (this.groupBy === 'subetapa') {
        const order = Object.fromEntries(this.SUBS_FLAT.map((s, i) => [s, i]));
        groups.sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99));
      } else if (this.groupBy === 'complexidade') {
        const order = { alta: 0, media: 1, baixa: 2 };
        groups.sort((a, b) => (order[a.key] ?? 9) - (order[b.key] ?? 9));
      } else {
        groups.sort((a, b) => {
          if (a.key === '__none__') return 1;
          if (b.key === '__none__') return -1;
          return (a.label || '').localeCompare(b.label || '');
        });
      }
      return groups;
    },
    toggleGroup(key) {
      const i = this.collapsedGroups.indexOf(key);
      if (i >= 0) this.collapsedGroups.splice(i, 1);
      else this.collapsedGroups.push(key);
    },
    collapseAllGroups() {
      this.collapsedGroups = this.groupedFiltered.map(g => g.key);
    },
    expandAllGroups() {
      this.collapsedGroups = [];
    },
    async setManualSort() {
      // Captura ordem atualmente visível e atribui ordem 1..N como baseline.
      // Tasks fora do filtro mantêm ordem prévia (ou null).
      const visible = this.filtered;
      const updates = [];
      visible.forEach((t, idx) => {
        const novaOrdem = idx + 1;
        if (t.ordem !== novaOrdem) {
          t.ordem = novaOrdem;
          updates.push({ id: t.id, ordem: novaOrdem });
        }
      });
      this.sortKey = 'manual';
      this.sortDir = 'asc';
      // Persiste em paralelo
      await Promise.all(updates.map(u =>
        sb.from('tasks').update({ ordem: u.ordem }).eq('id', u.id)
      ));
    },
    clearManualSort() {
      this.sortKey = 'prazo';
      this.sortDir = 'asc';
    },
    onBacklogDragStart(e, t) {
      if (this.sortKey !== 'manual') { e.preventDefault(); return; }
      this.backlogDragId = t.id;
      e.dataTransfer.effectAllowed = 'move';
    },
    onBacklogDragOver(e) {
      if (this.sortKey !== 'manual' || !this.backlogDragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    async onBacklogDrop(e, target) {
      if (this.sortKey !== 'manual') return;
      e.preventDefault();
      const draggedId = this.backlogDragId;
      this.backlogDragId = '';
      if (!draggedId || draggedId === target.id) return;
      const dragged = this.tasksById.get(draggedId);
      if (!dragged) return;
      const visible = this.filtered;
      const targetIdx  = visible.findIndex(t => t.id === target.id);
      const draggedIdx = visible.findIndex(t => t.id === draggedId);
      let nbBefore, nbAfter;
      if (draggedIdx < targetIdx) {
        nbBefore = visible[targetIdx];
        nbAfter  = visible[targetIdx + 1];
      } else {
        nbBefore = visible[targetIdx - 1];
        nbAfter  = visible[targetIdx];
      }
      const ob = nbBefore && nbBefore.id !== draggedId ? nbBefore.ordem : null;
      const oa = nbAfter  && nbAfter.id  !== draggedId ? nbAfter.ordem  : null;
      let novaOrdem;
      if (ob != null && oa != null) novaOrdem = (ob + oa) / 2;
      else if (ob != null)          novaOrdem = ob + 1;
      else if (oa != null)          novaOrdem = oa - 1;
      else                          novaOrdem = 1;
      const prevOrdem = dragged.ordem;
      dragged.ordem = novaOrdem;
      const { error } = await sb.from('tasks').update({ ordem: novaOrdem }).eq('id', draggedId);
      if (error) {
        dragged.ordem = prevOrdem;
        this.toast('error', 'Erro ao reordenar: ' + error.message);
      }
    },
    sortBy(key) {
      if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
      else { this.sortKey = key; this.sortDir = 'asc'; }
    },
    sortIcon(key) {
      if (this.sortKey !== key) return '';
      return this.sortDir === 'asc' ? '▲' : '▼';
    },
    sortLabel(key) {
      const opt = this.sortOptions.find(o => o.key === key);
      return opt ? opt.label : key;
    },
    pickSort(key) {
      // Se for a mesma chave, alterna direção. Se for outra, vai pra asc.
      if (this.sortKey === key) {
        this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortKey = key;
        this.sortDir = 'asc';
      }
      this.sortPanelOpen = false;
    },

    // ===================== KANBAN =====================
    // Mobile sempre força visão executiva (operacional com 11 colunas é
    // ruim em telas estreitas).
    get effectiveKanbanView() { return this.isMobileViewport ? 'exec' : this.kanbanView; },
    kanbanCol(status) {
      const arr = this._visibleTasks.filter(t =>
        t.status === status
        && (!this.f.cliente || t.clienteId === this.f.cliente)
        && (!this.f.pessoa  || t.pessoaId  === this.f.pessoa)
      );
      // ordem da coluna = mais recentemente entrou nesta etapa primeiro
      arr.sort((a,b) => (b.statusEm || b.criadoEm || 0) - (a.statusEm || a.criadoEm || 0));
      return arr;
    },
    kanbanColSub(sub) {
      const arr = this._visibleTasks.filter(t =>
        t.subetapa === sub
        && (!this.f.cliente || t.clienteId === this.f.cliente)
        && (!this.f.pessoa  || t.pessoaId  === this.f.pessoa)
      );
      arr.sort((a,b) => (b.subetapaEm || b.statusEm || b.criadoEm || 0) - (a.subetapaEm || a.statusEm || a.criadoEm || 0));
      return arr;
    },
    lblSub(s) { return this.SUB_LABELS[s] || s || '—'; },
    tempoNaSubetapa(t) {
      const ts = t.subetapaEm || t.statusEm;
      if (!ts) return '';
      const d = Math.floor((Date.now() - ts) / 86400000);
      if (d <= 0) return 'hoje';
      if (d === 1) return 'há 1d';
      return 'há ' + d + 'd';
    },
    async setTaskSubetapa(t, newSub) {
      if (!t || t.subetapa === newSub) return;
      const i = this.tasks.findIndex(x => x.id === t.id);
      if (i < 0) return;
      const prev = this.tasks[i];
      const newMacro = this.SUB_TO_MACRO[newSub] || prev.status;
      const macroChanged = prev.status !== newMacro;
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      // Optimistic.
      this.tasks[i] = {
        ...prev,
        subetapa: newSub,
        status: newMacro,
        subetapaEm: nowMs,
        statusEm: macroChanged ? nowMs : prev.statusEm,
      };
      const payload = { subetapa: newSub, subetapa_em: nowIso };
      if (macroChanged) payload.status_em = nowIso;
      const { error } = await sb.from('tasks').update(payload).eq('id', t.id);
      if (error) {
        this.tasks[i] = prev;
        this.toast('error', 'Erro ao mover: ' + error.message);
        return;
      }
      if (macroChanged) {
        await sb.from('task_status_history').insert({
          task_id: t.id,
          from_status: prev.status,
          to_status: newMacro,
          actor_pessoa_id: this.currentPessoa ? this.currentPessoa.id : null,
          actor_source: 'app',
          occurred_at: nowIso,
        });
      }
    },
    // ===================== BULK ACTIONS =====================
    toggleSelect(id) {
      const i = this.selectedIds.indexOf(id);
      if (i >= 0) this.selectedIds.splice(i, 1); else this.selectedIds.push(id);
    },
    toggleSelectAll() {
      const visible = this.filtered.map(t => t.id);
      const allSelected = visible.length > 0 && visible.every(id => this.selectedIds.includes(id));
      if (allSelected) this.selectedIds = this.selectedIds.filter(id => !visible.includes(id));
      else this.selectedIds = Array.from(new Set([...this.selectedIds, ...visible]));
    },
    clearSelection() { this.selectedIds = []; },
    async bulkSetSubetapa(sub) {
      if (!sub) return;
      const ids = [...this.selectedIds];
      this.track('bulk_action', { kind: 'setSubetapa', count: ids.length, value: sub });
      for (const id of ids) {
        const t = this.tasksById.get(id);
        if (t && t.subetapa !== sub) await this.setTaskSubetapa(t, sub);
      }
      this.toast('success', ids.length + ' tarefa(s) movida(s).');
    },
    async bulkSetPessoa(pid) {
      if (!pid) return;
      const target = pid === '__none__' ? null : pid;
      const ids = [...this.selectedIds];
      this.track('bulk_action', { kind: 'setPessoa', count: ids.length });
      const { error } = await sb.from('tasks').update({ pessoa_id: target }).in('id', ids);
      if (error) { this.toast('error', 'Erro: ' + error.message); return; }
      // Optimistic local update
      this.tasks = this.tasks.map(t => ids.includes(t.id) ? { ...t, pessoaId: target || '' } : t);
      this.toast('success', ids.length + ' tarefa(s) atualizada(s).');
    },
    async bulkSetPriority(p) {
      if (!p) return;
      const ids = [...this.selectedIds];
      this.track('bulk_action', { kind: 'setPriority', count: ids.length, value: p });
      const { error } = await sb.from('tasks').update({ prioridade: p }).in('id', ids);
      if (error) { this.toast('error', 'Erro: ' + error.message); return; }
      this.tasks = this.tasks.map(t => ids.includes(t.id) ? { ...t, prioridade: p } : t);
      this.toast('success', ids.length + ' tarefa(s) atualizada(s).');
    },
    async bulkSetPrazo(prazo) {
      // string vazia = limpar prazo
      const target = prazo || null;
      const ids = [...this.selectedIds];
      if (!ids.length) return;
      this.track('bulk_action', { kind: 'setPrazo', count: ids.length });
      const { error } = await sb.from('tasks').update({ prazo: target }).in('id', ids);
      if (error) { this.toast('error', 'Erro: ' + error.message); return; }
      this.tasks = this.tasks.map(t => ids.includes(t.id) ? { ...t, prazo: target || '' } : t);
      this.toast('success', ids.length + ' tarefa(s) atualizada(s).');
    },
    async bulkSetEsforco(val) {
      const num = val === '' || val == null ? null : Number(val);
      if (num != null && !(num >= 0)) { this.toast('error', 'Esforço inválido.'); return; }
      const ids = [...this.selectedIds];
      if (!ids.length) return;
      this.track('bulk_action', { kind: 'setEsforco', count: ids.length, value: num });
      const { error } = await sb.from('tasks').update({ esforco: num }).in('id', ids);
      if (error) { this.toast('error', 'Erro: ' + error.message); return; }
      this.tasks = this.tasks.map(t => ids.includes(t.id) ? { ...t, esforco: num ?? 0 } : t);
      this.toast('success', ids.length + ' tarefa(s) atualizada(s).');
    },
    // Select all aplicado às tarefas atualmente visíveis na Triagem (após filtro).
    toggleSelectAllTriagem() {
      const visible = this.triagemTasksFiltered.map(t => t.id);
      const allSelected = visible.length > 0 && visible.every(id => this.selectedIds.includes(id));
      if (allSelected) this.selectedIds = this.selectedIds.filter(id => !visible.includes(id));
      else this.selectedIds = Array.from(new Set([...this.selectedIds, ...visible]));
    },
    bulkDelete() {
      const n = this.selectedIds.length;
      if (!n) return;
      this.askConfirm('Excluir ' + n + ' tarefa(s)? Esta ação não pode ser desfeita.', async () => {
        const ids = [...this.selectedIds];
        this.track('bulk_action', { kind: 'delete', count: ids.length });
        // Best-effort: limpa storage dos anexos antes do cascade DB.
        try {
          const { data: atts } = await sb.from('task_attachments').select('storage_path').in('task_id', ids);
          const paths = (atts || []).map(a => a.storage_path).filter(Boolean);
          if (paths.length) await sb.storage.from('task-attachments').remove(paths);
        } catch (_) {}
        const { error } = await sb.from('tasks').delete().in('id', ids);
        if (error) { this.toast('error', 'Erro: ' + error.message); return; }
        this.tasks = this.tasks.filter(t => !ids.includes(t.id));
        this.selectedIds = [];
        this.toast('success', n + ' tarefa(s) excluída(s).');
      });
    },

    openQuickAdd(sub) {
      this.quickAddSub = sub;
      this.quickAddTitle = '';
      this.$nextTick(() => {
        const el = document.getElementById('quickAdd-' + sub);
        if (el) el.focus();
      });
    },
    closeQuickAdd() {
      this.quickAddSub = '';
      this.quickAddTitle = '';
    },
    async quickAddSubmit(sub) {
      const t = (this.quickAddTitle || '').trim();
      if (!t) { this.toast('error', 'Digite um título.'); return; }
      const macro = this.SUB_TO_MACRO[sub] || 'backlog';
      const nowIso = new Date().toISOString();
      const payload = {
        titulo: t, descricao: '',
        cliente_id: null, projeto_id: null, pessoa_id: null,
        prioridade: 'P2', esforco: 4, complexidade: 'media',
        prazo: null, status: macro, subetapa: sub,
        tags: [], status_em: nowIso, subetapa_em: nowIso,
      };
      this.quickAddTitle = '';
      const { data, error } = await sb.from('tasks').insert(payload).select('*').single();
      if (error) { this.toast('error', 'Erro ao criar: ' + error.message); return; }
      if (data && !this.tasks.some(x => x.id === data.id)) {
        this.tasks = [taskFromDb(data), ...this.tasks];
      }
      if (data) {
        await sb.from('task_status_history').insert({
          task_id: data.id, from_status: null, to_status: data.status,
          actor_pessoa_id: this.currentPessoa ? this.currentPessoa.id : null,
          actor_source: 'app', occurred_at: nowIso,
        });
      }
      this.toast('success', 'Tarefa criada.');
      // Mantém o quick-add aberto pra criação contínua na mesma coluna.
      this.$nextTick(() => {
        const el = document.getElementById('quickAdd-' + sub);
        if (el) el.focus();
      });
    },
    async onDropSub(ev, sub) {
      const id = ev.dataTransfer.getData('text/plain') || this.draggingId;
      this.dragOverCol = '';
      this.draggingId = '';
      if (!id) return;
      const t = this.tasksById.get(id);
      if (t) await this.setTaskSubetapa(t, sub);
    },
    async setTaskStatus(t, newStatus) {
      if (!t || t.status === newStatus) return;
      const i = this.tasks.findIndex(x => x.id === t.id);
      if (i < 0) return;
      // Optimistic: muda local imediatamente pra UI ser instantânea.
      const prev = this.tasks[i];
      const nowMs = Date.now();
      this.tasks[i] = { ...prev, status: newStatus, statusEm: nowMs };
      // Persiste em background. Realtime cuida de propagar a outras sessões.
      const occurredIso = new Date(nowMs).toISOString();
      const { error } = await sb.from('tasks')
        .update({ status: newStatus, status_em: occurredIso })
        .eq('id', t.id);
      if (error) {
        // Reverte
        this.tasks[i] = prev;
        this.toast('error', 'Erro ao mover: ' + error.message);
        return;
      }
      // Log do histórico (não-bloqueante)
      await sb.from('task_status_history').insert({
        task_id: t.id,
        from_status: prev.status,
        to_status: newStatus,
        actor_pessoa_id: this.currentPessoa ? this.currentPessoa.id : null,
        actor_source: 'app',
        occurred_at: occurredIso,
      });
    },
    async moveTask(t, dir) {
      const order = ['backlog', 'andamento', 'bloqueado', 'concluido'];
      const i = order.indexOf(t.status);
      const ni = i + dir;
      if (ni < 0 || ni >= order.length) return;
      await this.setTaskStatus(t, order[ni]);
    },
    onDragStart(ev, t) {
      this.draggingId = t.id;
      ev.dataTransfer.setData('text/plain', t.id);
      ev.dataTransfer.effectAllowed = 'move';
    },
    async onDrop(ev, col) {
      const id = ev.dataTransfer.getData('text/plain') || this.draggingId;
      this.dragOverCol = '';
      this.draggingId = '';
      if (!id) return;
      const t = this.tasksById.get(id);
      if (t) await this.setTaskStatus(t, col);
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
    get atrasadasList() {
      return this.dashTasks.filter(t => this.atrasada(t)).sort((a,b) => this.diasAtraso(b) - this.diasAtraso(a)).slice(0, 8);
    },
    // Lead time / cycle time / throughput baseado em task_status_history.
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
        const concluido  = entries.find(e => e.to_status === STATUS.CONCLUIDO);
        const andamento  = entries.find(e => e.to_status === 'andamento');
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

  // === Mixin de views/stores extraídos pra outros arquivos ===
  // Object.defineProperties + getOwnPropertyDescriptors preserva getters
  // (que Object.assign achata em valores). Ordem não importa — não há
  // colisões entre mixins. Cada mixin define seu próprio namespace.
  for (const factory of [
    window.makePortalView,
    window.makeBriefingView,
    window.makeCalendarFocoView,
    window.makeUtilitiesView,
    window.makeAnexosView,
    window.makeNotificationsView,
    window.makeCadastrosView,
    window.makeTaskModalView,
    window.makeAdoptionView,
    window.makeChartsView,
  ]) {
    Object.defineProperties(base, Object.getOwnPropertyDescriptors(factory()));
  }

  return base;
}
