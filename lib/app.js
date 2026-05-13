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
    window.makeBacklogKanbanView,
    window.makeCoreDataView,
  ]) {
    Object.defineProperties(base, Object.getOwnPropertyDescriptors(factory()));
  }

  return base;
}
