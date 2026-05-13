// ====== Supabase ======
// Anon key é PÚBLICA por design (segurança vem da RLS, definida em
// supabase/schema.sql). Service-role key NUNCA aqui.
const SUPABASE_URL      = 'https://nxtlipldmsopscpshrfd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54dGxpcGxkbXNvcHNjcHNocmZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDQzOTcsImV4cCI6MjA5MzY4MDM5N30.4FXSioyUTidsHkhCIsq8CfoPgnbgW1rXROfCDdJcMqM';

// Toggle pra ligar/desligar login. false = app aberto a quem
// abrir o link (sem login). true = magic link + lista fechada.
// Histórico de status continua sendo registrado (sem autor) qdo desligado.
const AUTH_ENABLED = true;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// CONSTANTS (STATUS, ROLE, TIER, PRIORIDADE, SEVERIDADE, SIGNAL, CARGA_NIVEL)
// vivem em lib/helpers.js (testáveis em tests/index.html). Carregados em
// window por aquele script — disponíveis aqui e em x-show/x-text.

// ============ Field map declarativo: fonte única de verdade pra
// mapeamento JS <-> DB. Cada entrada: [jsName, dbName, type, opts?].
// `type` define from/to/default; `opts.blank` override pro blank().
// `opts.from` / `opts.to` permitem override pontual sem clonar o tipo.
// Campos sem `to` (ex: date) são read-only do banco. ============
const F = {
  raw:      { from: r => r,                              to: t => t,                                          default: '' },
  string:   { from: r => r || '',                        to: t => t || '',                                    default: '' },
  fkNull:   { from: r => r || '',                        to: t => t || null,                                  default: '' },
  num:      { from: r => Number(r) || 0,                 to: t => Number(t) || 0,                             default: 0 },
  numNull:  { from: r => r == null ? null : +r,          to: t => (t == null || t === '') ? null : +t,        default: null },
  boolTrue: { from: r => r !== false,                    to: t => t !== false,                                default: true },
  arr:      { from: r => Array.isArray(r) ? r : [],      to: t => Array.isArray(t) ? t : [],                  default: [] },
  date:     { from: r => r ? new Date(r).getTime() : 0 /* readonly */,                                        default: 0 },
};

function _resolve(field) {
  const [js, db, type, opts = {}] = field;
  return {
    js, db, opts,
    from: opts.from || type.from,
    to:   opts.to   !== undefined ? opts.to : type.to,
    default: 'blank' in opts ? opts.blank : ('default' in type ? type.default : ''),
  };
}
function makeFromDb(fields) {
  const fs = fields.map(_resolve);
  return (r) => {
    const out = {};
    for (const f of fs) out[f.js] = f.from ? f.from(r[f.db]) : r[f.db];
    return out;
  };
}
function makeToDb(fields, postBuild) {
  const fs = fields.map(_resolve);
  return (t) => {
    const out = {};
    for (const f of fs) {
      if (!f.to) continue;
      const v = f.to(t[f.js]);
      // undefined = "não tocar essa coluna" (ex: descricao lazy não carregada).
      if (v === undefined) continue;
      out[f.db] = v;
    }
    if (postBuild) postBuild(t, out);
    return out;
  };
}
function makeBlank(fields, overrides = {}) {
  const fs = fields.map(_resolve);
  const out = {};
  for (const f of fs) {
    out[f.js] = Array.isArray(f.default) ? [...f.default] : f.default;
  }
  return Object.assign(out, overrides);
}

const TASK_FIELDS = [
  ['id',              'id',                F.raw,    { to: null /* gerado pelo banco no insert */ }],
  ['titulo',          'titulo',            F.string],
  // descricao é lazy: column projection no boot exclui ela; preserva
  // `undefined` quando não selecionada (openEdit detecta e carrega).
  // taskToDb também devolve undefined → makeToDb pula a coluna no save
  // (evita zerar descricao em DB quando user salva sem ter aberto modal).
  ['descricao',       'descricao',         F.string, {
    from: r => r === undefined ? undefined : (r || ''),
    to:   t => t === undefined ? undefined : (t || ''),
  }],
  ['clienteId',       'cliente_id',        F.fkNull],
  ['projetoId',       'projeto_id',        F.fkNull],
  ['pessoaId',        'pessoa_id',         F.fkNull],
  ['prioridade',      'prioridade',        F.raw,    { blank: 'P2' }],
  ['esforco',         'esforco',           F.num,    { blank: 4 }],
  ['complexidade',    'complexidade',      F.string, { from: r => r || 'media', to: t => t || 'media', blank: 'media' }],
  ['prazo',           'prazo',             F.fkNull],
  ['status',          'status',            F.raw,    { blank: 'backlog' }],
  ['subetapa',        'subetapa',          F.string, { from: r => r || 'backlog', to: t => t || 'backlog', blank: 'backlog' }],
  ['bloqueadoPor',    'bloqueado_por',     F.fkNull],
  ['visivelCliente',  'visivel_cliente',   F.boolTrue],
  ['criadoEm',        'criado_em',         F.date],
  ['statusEm',        'status_em',         F.date],
  ['subetapaEm',      'subetapa_em',       F.date],
  ['ordem',           'ordem',             F.numNull, { to: null /* nunca persiste via toDb; só via update direto */ }],
  ['tags',            'tags',              F.arr],
  ['checklist',       'checklist',         F.arr],
  ['reopenCount',     'reopen_count',      F.num,    { to: null /* gerado pelo trigger */ }],
  ['tipoTrabalho',    'tipo_trabalho',     F.fkNull],
  ['tempoRealHoras',  'tempo_real_horas',  F.numNull, { blank: '' }],
  ['externalSource',  'external_source',   F.fkNull],
  ['externalId',      'external_id',       F.fkNull],
  ['arquivadoEm',     'arquivado_em',      { from: r => r || null, to: t => t || null, default: null }],
];

const taskFromDb = makeFromDb(TASK_FIELDS);
const taskToDb   = makeToDb(TASK_FIELDS, (t, out) => {
  // Auto-classifica external_source como 'salesforce' quando ID externo
  // foi preenchido manualmente sem source explícito.
  if (!t.externalSource && t.externalId) out.external_source = 'salesforce';
});

const PROJETO_FIELDS = [
  ['id',                'id',                  F.raw],
  ['nome',              'nome',                F.string],
  ['clienteId',         'cliente_id',          F.fkNull],
  ['slaRespostaHoras',  'sla_resposta_horas',  F.numNull],
  ['slaEntregaDias',    'sla_entrega_dias',    F.numNull],
  ['orcamentoHoras',    'orcamento_horas',     F.numNull],
  ['tipo',              'tipo',                F.string],
  ['arquivadoEm',       'arquivado_em',        { from: r => r || null, default: null }],
];
const projetoFromDb = makeFromDb(PROJETO_FIELDS);

const CLIENTE_FIELDS = [
  ['id',           'id',           F.raw],
  ['nome',         'nome',         F.string],
  ['tier',         'tier',         F.string],
  ['arquivadoEm',  'arquivado_em', { from: r => r || null, default: null }],
];
const clienteFromDb = makeFromDb(CLIENTE_FIELDS);

function app() {
  return {
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
    // ===================== NOTIFICATIONS =====================
    get unreadNotifications() {
      return this.notifications.filter(n => !n.read_at);
    },
    get unreadCount() { return this.unreadNotifications.length; },
    async loadNotifications() {
      if (!this.currentPessoa) { this.notifications = []; return; }
      const { data, error } = await sb
        .from('notifications')
        .select('id, recipient_pessoa_id, kind, payload, source_task_id, source_comment_id, criado_em, read_at')
        .eq('recipient_pessoa_id', this.currentPessoa.id)
        .order('criado_em', { ascending: false })
        .limit(50);
      if (error) { console.error('[notif] load failed:', error); return; }
      this.notifications = data || [];
    },
    subscribeNotifications() {
      if (this._notifsSubscribed || !this.currentPessoa) return;
      this._notifsSubscribed = true;
      sb.channel('notif-' + this.currentPessoa.id)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `recipient_pessoa_id=eq.${this.currentPessoa.id}`,
        }, (payload) => {
          const n = payload.new;
          this.notifications = [n, ...this.notifications].slice(0, 50);
          // Toast leve apenas como sinal — UX silenciosa
          this.toast('info', this.notifSummary(n), 6000);
        })
        .subscribe();
    },
    notifSummary(n) {
      const p = n.payload || {};
      const who = p.author || 'alguém';
      switch (n.kind) {
        case 'mention':            return `${who} te mencionou em uma tarefa`;
        case 'assigned':           return `${who} te atribuiu a uma tarefa`;
        case 'comment_on_my_task': return `${who} comentou em uma tarefa sua`;
        case 'cliente_respondeu':  return `Cliente respondeu em uma tarefa sua`;
        default:                   return 'nova notificação';
      }
    },
    async openNotification(n) {
      // Marca como lida e abre a task referenciada (se houver).
      await this.markNotificationRead(n.id);
      this.notifPanelOpen = false;
      if (n.source_task_id) {
        const t = this.tasksById.get(n.source_task_id);
        if (t) this.openEdit(t);
      }
    },
    async markNotificationRead(id) {
      const i = this.notifications.findIndex(n => n.id === id);
      if (i < 0) return;
      const prev = this.notifications[i];
      if (prev.read_at) return;
      const nowIso = new Date().toISOString();
      this.notifications[i] = { ...prev, read_at: nowIso };
      const { error } = await sb.from('notifications').update({ read_at: nowIso }).eq('id', id);
      if (error) { this.notifications[i] = prev; }
    },
    async markAllNotificationsRead() {
      const ids = this.unreadNotifications.map(n => n.id);
      if (!ids.length) return;
      const nowIso = new Date().toISOString();
      this.notifications = this.notifications.map(n => n.read_at ? n : { ...n, read_at: nowIso });
      await sb.from('notifications').update({ read_at: nowIso }).in('id', ids);
    },
    // ----- helpers pra criar notificações -----
    async _notifyMentions(taskId, commentId, body) {
      if (!this.currentPessoa || !body) return;
      const re = /@([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]*)/g;
      const found = new Set();
      let m;
      while ((m = re.exec(body)) !== null) found.add(m[1]);
      if (!found.size) return;
      const recipients = this.pessoas
        .filter(p => p.role !== ROLE.CLIENTE)
        .filter(p => found.has((p.nome || '').split(/\s+/)[0]))
        // self-mention é permitido (uso pra lembrete/auto-controle)
        .map(p => p.id);
      if (!recipients.length) return;
      const rows = recipients.map(rid => ({
        recipient_pessoa_id: rid,
        kind: 'mention',
        payload: { author: this.currentPessoa.nome, task_id: taskId, comment_id: commentId },
        source_task_id: taskId,
        source_comment_id: commentId,
      }));
      await sb.from('notifications').insert(rows);
    },
    async _notifyAssignment(taskId, newPessoaId, oldPessoaId) {
      if (!newPessoaId || newPessoaId === oldPessoaId) return;
      if (this.currentPessoa && newPessoaId === this.currentPessoa.id) return; // self-assign não notifica
      await sb.from('notifications').insert({
        recipient_pessoa_id: newPessoaId,
        kind: 'assigned',
        payload: { author: this.currentPessoa ? this.currentPessoa.nome : 'app', task_id: taskId },
        source_task_id: taskId,
      });
    },
    async _notifyCommentOnTaskOwner(taskId, commentId, body, ownerPessoaId) {
      if (!ownerPessoaId) return;
      if (this.currentPessoa && ownerPessoaId === this.currentPessoa.id) return; // próprio dono comentando
      await sb.from('notifications').insert({
        recipient_pessoa_id: ownerPessoaId,
        kind: 'comment_on_my_task',
        payload: { author: this.currentPessoa ? this.currentPessoa.nome : 'app', task_id: taskId, comment_id: commentId, preview: (body || '').slice(0, 80) },
        source_task_id: taskId,
        source_comment_id: commentId,
      });
    },
    async _notifyClienteRespondeu(taskId, commentId, body, ownerPessoaId) {
      if (!ownerPessoaId) return;
      await sb.from('notifications').insert({
        recipient_pessoa_id: ownerPessoaId,
        kind: 'cliente_respondeu',
        payload: { task_id: taskId, comment_id: commentId, preview: (body || '').slice(0, 80) },
        source_task_id: taskId,
        source_comment_id: commentId,
      });
    },

    subscribeRealtime() {
      // Idempotente: se já assinou, não tenta de novo.
      // Sem isso, segundas chamadas (init + onAuthStateChange) crashavam
      // com "cannot add postgres_changes callbacks ... after subscribe()".
      if (this._realtimeSubscribed) return;
      this._realtimeSubscribed = true;
      // Qualquer alteração nas tabelas → refetch da afetada.
      // Pré-requisito: rodar supabase/realtime.sql + api_patch_comments.sql.
      sb.channel('kliente360-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks'    }, () => this.refreshTasks())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => this.refreshClientes())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projetos' }, () => this.refreshProjetos())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pessoas'  }, () => this.refreshPessoas())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, (payload) => {
          const tid = (payload.new && payload.new.task_id) || (payload.old && payload.old.task_id);
          if (this.modal && this.editing.id && this.editing.id === tid) this.loadComments(this.editing.id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_status_history' }, (payload) => {
          const tid = (payload.new && payload.new.task_id) || (payload.old && payload.old.task_id);
          if (this.modal && this.editing.id && this.editing.id === tid) this.loadHistory(this.editing.id);
          if (payload.eventType === 'INSERT' && payload.new) {
            this.historyAll = [payload.new, ...this.historyAll];
          } else if (payload.eventType === 'DELETE' && payload.old) {
            this.historyAll = this.historyAll.filter(h => h.id !== payload.old.id);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_field_history' }, (payload) => {
          const tid = (payload.new && payload.new.task_id) || (payload.old && payload.old.task_id);
          if (this.modal && this.editing.id && this.editing.id === tid) this.loadHistory(this.editing.id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_attachments' }, (payload) => {
          const tid = (payload.new && payload.new.task_id) || (payload.old && payload.old.task_id);
          if (this.modal && this.editing.id && this.editing.id === tid) this.loadAttachments(this.editing.id);
        })
        .subscribe();
    },
    async loadComments(taskId) {
      if (!taskId) { this.editingComments = []; return; }
      const { data, error } = await sb.from('task_comments')
        .select('id, parent_id, author, author_external_id, author_pessoa_id, body, posted_em, criado_em, edited_em, external_source, external_id, visivel_cliente, from_cliente')
        .eq('task_id', taskId)
        .order('posted_em', { ascending: true, nullsFirst: true })
        .order('criado_em', { ascending: true });
      if (!error) this.editingComments = data || [];
    },

    // ===================== CHECKLIST =====================
    addChecklistItem(at) {
      if (!Array.isArray(this.editing.checklist)) this.editing.checklist = [];
      const item = { id: 'cli-' + Math.random().toString(36).slice(2, 9), body: '', done: false };
      const idx = (typeof at === 'number') ? at : this.editing.checklist.length;
      this.editing.checklist.splice(idx, 0, item);
      this.$nextTick(() => {
        const inputs = document.querySelectorAll('.tmodal input[placeholder="mini-task…"]');
        const el = inputs[idx];
        if (el) el.focus();
      });
    },
    removeChecklistItem(idx) {
      if (!Array.isArray(this.editing.checklist)) return;
      this.editing.checklist.splice(idx, 1);
    },
    toggleChecklistItem(idx) {
      if (!Array.isArray(this.editing.checklist)) return;
      const item = this.editing.checklist[idx];
      if (!item) return;
      this.editing.checklist[idx] = { ...item, done: !item.done };
    },
    updateChecklistBody(idx, value) {
      if (!Array.isArray(this.editing.checklist)) return;
      const item = this.editing.checklist[idx];
      if (!item) return;
      this.editing.checklist[idx] = { ...item, body: value };
    },

    // ===================== ANEXOS =====================
    async loadAttachments(taskId) {
      if (!taskId) { this.editingAttachments = []; this.attachmentUrls = {}; return; }
      const { data, error } = await sb.from('task_attachments')
        .select('id, task_id, storage_path, mime, size_bytes, width, height, author_pessoa_id, criado_em')
        .eq('task_id', taskId)
        .order('criado_em', { ascending: false });
      if (error) return;
      this.editingAttachments = data || [];
      this._refreshAttachmentUrls();
    },
    async _refreshAttachmentUrls() {
      const paths = this.editingAttachments.map(a => a.storage_path);
      if (!paths.length) { this.attachmentUrls = {}; return; }
      const { data, error } = await sb.storage.from('task-attachments').createSignedUrls(paths, 3600);
      if (error || !data) return;
      const map = {};
      data.forEach((row, idx) => {
        const a = this.editingAttachments[idx];
        if (a && row && row.signedUrl) map[a.id] = row.signedUrl;
      });
      this.attachmentUrls = map;
    },
    _canDeleteAttachment(a) {
      if (!a || !a.id) return false;
      if (this.viewerRole === ROLE.ADMIN) return true;
      return !!(this.currentPessoa && a.author_pessoa_id === this.currentPessoa.id);
    },
    fmtBytes(n) {
      const b = Number(n) || 0;
      if (b < 1024) return b + ' B';
      if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
      return (b / (1024 * 1024)).toFixed(1) + ' MB';
    },
    openLightbox(a) { this.lightboxAttachment = a; },
    onModalPaste(ev) {
      if (!this.modal || !this.editing.id) return;
      const items = ev && ev.clipboardData && ev.clipboardData.files;
      if (!items || !items.length) return;
      const imgs = Array.from(items).filter(f => f && /^image\/(png|jpe?g|webp)$/i.test(f.type));
      if (!imgs.length) return;
      ev.preventDefault();
      // Upload sequencial (1 imagem por vez é o caso normal de paste).
      (async () => {
        for (const f of imgs) {
          await this._uploadAttachment(f);
        }
        if (this.modalTab !== 'anexos') {
          this.toast('success', imgs.length === 1 ? 'Anexo adicionado.' : imgs.length + ' anexos adicionados.');
        }
      })();
    },
    async _uploadAttachment(file) {
      const taskId = this.editing && this.editing.id;
      if (!taskId) return;
      this.attachmentUploading = true;
      this.attachmentUploadLabel = 'processando…';
      try {
        const processed = await this._downscaleImage(file, 1600, 0.85);
        if (!processed) { this.toast('error', 'Falha ao processar imagem.'); return; }
        if (processed.blob.size > 2 * 1024 * 1024) {
          this.toast('error', 'Imagem ainda acima de 2MB após compressão. Tente um print menor.');
          return;
        }
        this.attachmentUploadLabel = 'enviando…';
        const ext = processed.blob.type === 'image/png' ? 'png' : (processed.blob.type === 'image/webp' ? 'webp' : 'jpg');
        const objId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        const path = `${taskId}/${objId}.${ext}`;
        const { error: upErr } = await sb.storage.from('task-attachments').upload(path, processed.blob, {
          contentType: processed.blob.type,
          upsert: false,
        });
        if (upErr) { this.toast('error', 'Erro no upload: ' + upErr.message); return; }
        const authorPessoaId = (this.currentPessoa && this.currentPessoa.id) || null;
        const { data, error: insErr } = await sb.from('task_attachments').insert({
          task_id: taskId,
          storage_path: path,
          mime: processed.blob.type,
          size_bytes: processed.blob.size,
          width: processed.width,
          height: processed.height,
          author_pessoa_id: authorPessoaId,
        }).select('id, task_id, storage_path, mime, size_bytes, width, height, author_pessoa_id, criado_em').single();
        if (insErr) {
          await sb.storage.from('task-attachments').remove([path]);
          this.toast('error', 'Erro ao registrar anexo: ' + insErr.message);
          return;
        }
        this.editingAttachments = [data, ...this.editingAttachments];
        this._refreshAttachmentUrls();
        this.track('attachment_upload', { size: processed.blob.size, mime: processed.blob.type });
      } finally {
        this.attachmentUploading = false;
        this.attachmentUploadLabel = '';
      }
    },
    _downscaleImage(file, maxDim, quality) {
      // Lê o file, desenha em canvas redimensionado, exporta JPEG (ou PNG se input PNG c/ transparência).
      return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.round(img.width * ratio);
          const h = Math.round(img.height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          // PNG só preserva se o input era PNG e pequeno (transparência preservada); senão JPEG.
          const outType = (file.type === 'image/png' && file.size < 800 * 1024) ? 'image/png' : 'image/jpeg';
          canvas.toBlob((blob) => {
            if (!blob) { resolve(null); return; }
            resolve({ blob, width: w, height: h });
          }, outType, quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
    },
    deleteAttachment(a) {
      if (!this._canDeleteAttachment(a)) return;
      this.askConfirm('Excluir este anexo?', async () => {
        const i = this.editingAttachments.findIndex(x => x.id === a.id);
        const prev = i >= 0 ? this.editingAttachments[i] : null;
        if (i >= 0) this.editingAttachments.splice(i, 1);
        if (this.lightboxAttachment && this.lightboxAttachment.id === a.id) this.lightboxAttachment = null;
        const { error: delErr } = await sb.from('task_attachments').delete().eq('id', a.id);
        if (delErr) {
          if (prev) this.editingAttachments.splice(i, 0, prev);
          this.toast('error', 'Erro ao excluir: ' + delErr.message);
          return;
        }
        // Tenta limpar o storage object (best-effort; órfão é OK pois cron pega).
        sb.storage.from('task-attachments').remove([a.storage_path]).catch(() => {});
        this.track('attachment_delete', {});
      });
    },
    repliesOf(parentId) {
      return this.editingComments.filter(c => c.parent_id === parentId);
    },
    portalRepliesOf(parentId) {
      return this.portalTaskComments.filter(c => c.parent_id === parentId);
    },
    get portalTopLevelComments() {
      return this.portalTaskComments.filter(c => !c.parent_id);
    },
    get topLevelComments() {
      // top-level: parent_id null. Mais recente primeiro.
      return this.editingComments
        .filter(c => !c.parent_id)
        .slice()
        .sort((a, b) => {
          const ta = new Date(a.posted_em || a.criado_em).getTime();
          const tb = new Date(b.posted_em || b.criado_em).getTime();
          return tb - ta;
        });
    },
    startReply(parentId) {
      this.replyingToId = parentId;
      this.newReply = '';
      this.$nextTick(() => {
        const el = document.querySelector(`[data-reply-input="${parentId}"]`);
        if (el) el.focus();
      });
    },
    cancelReply() {
      this.replyingToId = '';
      this.newReply = '';
    },
    async postReply(parentId) {
      const body = (this.newReply || '').trim();
      if (!body || !this.editing.id || !parentId) return;
      const author = (this.currentPessoa && this.currentPessoa.nome) || 'app';
      const authorPessoaId = (this.currentPessoa && this.currentPessoa.id) || null;
      // Herda visibilidade do parent: se o cliente perguntou (visivel_cliente=true),
      // a resposta também precisa aparecer pro cliente. Senão fica interna.
      const parent = this.editingComments.find(x => x.id === parentId);
      const visivel = !!(parent && parent.visivel_cliente);
      const tempId = 'tmp-' + Math.random().toString(36).slice(2, 8);
      const optimistic = {
        id: tempId, parent_id: parentId, author, body,
        author_pessoa_id: authorPessoaId,
        external_source: null, posted_em: null,
        criado_em: new Date().toISOString(),
        visivel_cliente: visivel, from_cliente: false,
      };
      this.editingComments = [...this.editingComments, optimistic];
      this.newReply = '';
      this.replyingToId = '';
      const { data, error } = await sb.from('task_comments')
        .insert({ task_id: this.editing.id, parent_id: parentId, author, body, author_pessoa_id: authorPessoaId, visivel_cliente: visivel, from_cliente: false })
        .select('id, parent_id, author, body, author_pessoa_id, external_source, posted_em, criado_em, visivel_cliente, from_cliente')
        .single();
      if (error) {
        this.editingComments = this.editingComments.filter(c => c.id !== tempId);
        this.newReply = body;
        this.replyingToId = parentId;
        this.toast('error', 'Erro ao responder: ' + error.message);
        return;
      }
      this.editingComments = this.editingComments.map(c => c.id === tempId ? data : c);
      this.track('comment_reply', { has_mention: /@/.test(body) });
      // Notificações: @mentions no corpo da resposta (mesmo parser do postComment).
      try {
        await this._notifyMentions(this.editing.id, data.id, body);
      } catch (e) { console.warn('[notif] postReply notify failed:', e); }
    },
    fmtPostedEm(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const yy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2,'0');
      const mi = String(d.getMinutes()).padStart(2,'0');
      return `${dd}/${mm}/${yy} ${hh}:${mi}`;
    },
    // Converte HTML rich text (vindo do Salesforce Chatter) em texto plano,
    // preservando quebras de linha. Comments com HTML viram texto legível;
    // comments já em plain text passam intactos.
    stripHtml(s) {
      if (!s) return '';
      const str = String(s);
      // Curto-circuito: sem qualquer tag, retorna como veio.
      if (!/<[a-z!\/]/i.test(str)) return str;
      const tmp = document.createElement('div');
      tmp.innerHTML = str
        .replace(/<\/p\s*>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/li\s*>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/(div|h[1-6]|tr)\s*>/gi, '\n');
      // textContent strips remaining tags + decodifica entidades (&amp; etc.)
      return (tmp.textContent || '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
    },
    // Renderiza body de comment como HTML seguro: strip de tags, escape, e
    // realça @firstname que bate com pessoa cadastrada (interno/admin).
    renderCommentBody(body) {
      const plain = this.stripHtml(body);
      const escaped = plain
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const firstNames = new Set(
        this.pessoas
          .filter(p => p.role !== ROLE.CLIENTE)
          .map(p => (p.nome || '').split(/\s+/)[0])
          .filter(Boolean)
      );
      // @palavra (com acentos): se bate first name, vira span destacado.
      return escaped.replace(/@([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]*)/g, (m, name) => {
        return firstNames.has(name) ? `<span class="mention">@${name}</span>` : m;
      });
    },
    // Detecta @\w* sendo digitado no textarea e abre o picker com a query
    // que veio direto do texto (sem precisar clicar no botão "@ mencionar").
    // Salva o anchor (posição do @) pra substituir o partial certinho ao
    // escolher uma pessoa via appendMention.
    onMentionInput(field, ev) {
      const txt = this[field] || '';
      const caret = (ev && ev.target && typeof ev.target.selectionStart === 'number') ? ev.target.selectionStart : txt.length;
      const before = txt.slice(0, caret);
      // Pega último token tipo "@xxx" se estiver no fim e sem whitespace dentro.
      const m = before.match(/(?:^|\s)@([A-Za-zÀ-ÿ0-9-]*)$/);
      if (m) {
        this._mentionAnchor = caret - m[1].length - 1; // posição do '@'
        this._mentionField = field;
        this.mentionPickerQuery = m[1];
        this.mentionPickerFor = field;
        this._mentionActiveIdx = 0;
      } else if (this.mentionPickerFor === field) {
        this.mentionPickerFor = '';
        this._mentionAnchor = null;
      }
    },
    appendMention(field, firstName) {
      const txt = this[field] || '';
      const insert = '@' + firstName + ' ';
      let newCaret;
      // Fluxo inline: substitui '@partial' no anchor por '@FirstName '.
      if (this._mentionAnchor != null && this._mentionField === field) {
        const anchor = this._mentionAnchor;
        const rest = txt.slice(anchor).replace(/^@[A-Za-zÀ-ÿ0-9-]*/, insert);
        this[field] = txt.slice(0, anchor) + rest;
        newCaret = anchor + insert.length;
      } else {
        // Fluxo botão: concatena no fim.
        const sep = txt && !txt.endsWith(' ') && !txt.endsWith('\n') ? ' ' : '';
        this[field] = txt + sep + insert;
        newCaret = (this[field] || '').length;
      }
      this.mentionPickerFor = '';
      this.mentionPickerQuery = '';
      this._mentionAnchor = null;
      this._mentionField = null;
      this._mentionActiveIdx = 0;
      this._focusComposer(field, newCaret);
    },
    // Devolve foco pro textarea após pick e posiciona o caret depois do nome.
    _focusComposer(field, caret) {
      this.$nextTick(() => {
        let el = null;
        if (field === 'newComment') el = this.$refs.newCommentTa;
        else if (field === 'newReply' && this.replyingToId) {
          el = document.querySelector('[data-reply-input="' + this.replyingToId + '"]');
        }
        if (!el) return;
        el.focus();
        if (typeof caret === 'number') {
          try { el.setSelectionRange(caret, caret); } catch (_) {}
        }
      });
    },
    // Navegação por teclado no picker (chamado pelas textareas).
    _mentionMove(delta) {
      const list = this.mentionablePessoas(this.mentionPickerQuery);
      if (!list.length) return;
      const len = list.length;
      this._mentionActiveIdx = ((this._mentionActiveIdx || 0) + delta + len) % len;
    },
    // Permissão: autor (mesma pessoa logada) ou admin pode excluir.
    // Comentários do Salesforce (external_source) ficam não-deletáveis pra
    // não criar dessync com a fonte externa.
    _canDeleteComment(c) {
      if (!c || !c.id || c.external_source) return false;
      if (this.viewerRole === ROLE.ADMIN) return true;
      return !!(this.currentPessoa && c.author_pessoa_id === this.currentPessoa.id);
    },
    // Edit é mais restrito que delete: só o próprio autor (admin não edita texto alheio).
    _canEditCommentBody(c) {
      if (!c || !c.id || c.external_source || c.from_cliente) return false;
      return !!(this.currentPessoa && c.author_pessoa_id === this.currentPessoa.id);
    },
    startEditComment(c) {
      if (!this._canEditCommentBody(c)) return;
      this.editingCommentId = c.id;
      this.editingCommentDraft = c.body || '';
      this.$nextTick(() => {
        const el = document.querySelector('[data-edit-comment="' + c.id + '"]');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
    },
    cancelEditComment() {
      this.editingCommentId = '';
      this.editingCommentDraft = '';
    },
    async saveEditComment(c) {
      if (!c || !this._canEditCommentBody(c)) return;
      const body = (this.editingCommentDraft || '').trim();
      if (!body) { this.toast('error', 'Comentário não pode ficar vazio.'); return; }
      if (body === (c.body || '').trim()) { this.cancelEditComment(); return; }
      const i = this.editingComments.findIndex(x => x.id === c.id);
      if (i < 0) return;
      const prev = this.editingComments[i];
      const nowIso = new Date().toISOString();
      this.editingComments[i] = { ...prev, body, edited_em: nowIso };
      this.cancelEditComment();
      const { error } = await sb.from('task_comments').update({ body, edited_em: nowIso }).eq('id', c.id);
      if (error) {
        this.editingComments[i] = prev;
        this.toast('error', 'Erro ao salvar: ' + error.message);
        return;
      }
      this.track('comment_edit', { is_reply: !!prev.parent_id });
    },
    // Mesma regra do delete: autor ou admin. SF/cliente fica imutável.
    _canEditCommentVisivel(c) {
      if (!c || !c.id || c.external_source || c.from_cliente) return false;
      if (this.viewerRole === ROLE.ADMIN) return true;
      return !!(this.currentPessoa && c.author_pessoa_id === this.currentPessoa.id);
    },
    async toggleCommentVisivel(c) {
      if (!this._canEditCommentVisivel(c)) return;
      const prev = !!c.visivel_cliente;
      const next = !prev;
      // Optimistic: atualiza o objeto local (Alpine reativo) antes do DB.
      const i = this.editingComments.findIndex(x => x.id === c.id);
      if (i < 0) return;
      this.editingComments[i] = { ...this.editingComments[i], visivel_cliente: next };
      const { error } = await sb.from('task_comments').update({ visivel_cliente: next }).eq('id', c.id);
      if (error) {
        this.editingComments[i] = { ...this.editingComments[i], visivel_cliente: prev };
        this.toast('error', 'Erro ao alterar visibilidade: ' + error.message);
        return;
      }
      this.track('comment_visivel_toggle', { to: next });
    },
    deleteComment(c) {
      if (!c || !c.id) return;
      const isReply = !!c.parent_id;
      const msg = isReply ? 'Excluir esta resposta?' : 'Excluir este comentário (e suas respostas)?';
      this.askConfirm(msg, async () => {
        const id = c.id;
        const idsToRemove = new Set([id]);
        if (!isReply) {
          // top-level: remove cascade dos replies otimisticamente
          this.editingComments.filter(x => x.parent_id === id).forEach(x => idsToRemove.add(x.id));
        }
        const prev = this.editingComments;
        this.editingComments = prev.filter(x => !idsToRemove.has(x.id));
        // Top-level: apaga replies antes (defensivo caso schema não tenha
        // ON DELETE CASCADE no parent_id).
        if (!isReply) {
          const replyIds = [...idsToRemove].filter(x => x !== id);
          if (replyIds.length) await sb.from('task_comments').delete().in('id', replyIds);
        }
        const { error } = await sb.from('task_comments').delete().eq('id', id);
        if (error) {
          this.editingComments = prev;
          this.toast('error', 'Erro ao excluir: ' + error.message);
          return;
        }
        this.track('comment_delete', { is_reply: isReply });
        this.toast('success', isReply ? 'Resposta excluída.' : 'Comentário excluído.');
      });
    },
    _mentionPickActive(field) {
      const list = this.mentionablePessoas(this.mentionPickerQuery);
      const p = list[this._mentionActiveIdx || 0];
      if (!p) return;
      this.appendMention(field, (p.nome || '').split(' ')[0]);
    },
    mentionablePessoas(query) {
      const q = (query || '').toLowerCase();
      return this.pessoas
        .filter(p => p.role !== ROLE.CLIENTE)
        .filter(p => !q || (p.nome || '').toLowerCase().includes(q))
        .slice(0, 8);
    },
    async refreshFromLogo() {
      if (this.refreshing) return;
      this.refreshing = true;
      // Garante que o pulse seja visível mesmo se a rede vier rápido (UX).
      const minDelay = new Promise(r => setTimeout(r, 700));
      try {
        await Promise.all([this.load(), minDelay]);
      } finally {
        this.refreshing = false;
      }
    },
    // Janela de tasks concluídas carregadas por default (em dias).
    // Tasks concluídas há mais tempo só vêm via loadOlderConcluidas().
    TASKS_CONCLUIDAS_WINDOW_DAYS: 90,
    historicoCompletoCarregado: false,

    _tasksWindowCutoff() {
      const d = new Date();
      d.setDate(d.getDate() - this.TASKS_CONCLUIDAS_WINDOW_DAYS);
      return d.toISOString();
    },
    // Colunas leves carregadas no boot. `descricao` (pode ser markdown
    // longo) fica off-list e é puxada lazy quando o modal abre.
    _TASK_LIGHT_COLS: 'id,titulo,cliente_id,projeto_id,pessoa_id,prioridade,esforco,complexidade,prazo,status,subetapa,bloqueado_por,visivel_cliente,criado_em,status_em,subetapa_em,ordem,tags,checklist,reopen_count,tipo_trabalho,tempo_real_horas,external_source,external_id,arquivado_em',
    _buildTasksQuery(extra) {
      // Default: todas não-concluídas + concluídas dos últimos N dias.
      // status_em é setado pelo banco quando muda status; concluídas sem
      // status_em (cenário improvável) entram pelo OR de status.
      const cutoff = this._tasksWindowCutoff();
      let q = sb.from('tasks').select(this._TASK_LIGHT_COLS)
        .or(`status.neq.concluido,status_em.gte.${cutoff}`)
        .order('criado_em', { ascending: false });
      if (extra) q = extra(q);
      return q;
    },
    async load() {
      // Bifurca: cliente externo carrega apenas dados próprios (menos
      // queries, menos campos sensíveis no payload). Staff (admin/interno)
      // continua com loadFull. RLS no banco bloqueia tentativas cross-tenant,
      // este split é defesa em profundidade + redução de payload.
      if (this.currentPessoa && this.currentPessoa.role === ROLE.CLIENTE) {
        return this._loadPortal();
      }
      return this._loadFull();
    },
    async _loadFull() {
      try {
        const [c, p, ps, t, h, td] = await Promise.all([
          sb.from('clientes').select('id,nome,tier,arquivado_em').order('nome'),
          sb.from('projetos').select('id,nome,cliente_id,sla_resposta_horas,sla_entrega_dias,orcamento_horas,tipo,arquivado_em').order('nome'),
          sb.from('pessoas').select('id,nome,email,user_id,invited_at,role,cliente_id,cliente_principal_id,cliente_secundario_id,capacidade_horas_semana,skills,senioridade').order('nome'),
          this._buildTasksQuery(),
          sb.from('task_status_history')
            .select('task_id, from_status, to_status, actor_pessoa_id, actor_source, occurred_at')
            .gte('occurred_at', this._tasksWindowCutoff())
            .order('occurred_at', { ascending: false }),
          sb.from('task_dependencies').select('task_id, depende_de_id'),
        ]);
        const err = c.error || p.error || ps.error || t.error || h.error || td.error;
        if (err) throw err;
        this.clientes = c.data.map(clienteFromDb);
        this.projetos = p.data.map(projetoFromDb);
        this.pessoas  = ps.data;
        this.tasks    = t.data.map(taskFromDb);
        this.historyAll = h.data || [];
        this.taskDeps = td.data || [];
        this.historicoCompletoCarregado = false;
      } catch (e) {
        console.error('Falha ao carregar do Supabase', e);
        this.toast('error', 'Falha ao carregar: ' + (e.message || e));
      }
    },
    async _loadPortal() {
      // Cliente externo: payload mínimo, sem campos sensíveis.
      // - pessoas: somente a própria linha (a RLS já bloqueia o resto;
      //   selecionamos só os campos que o Portal usa pra nomes de contato)
      // - clientes: só o cliente vinculado
      // - projetos: só do cliente vinculado, sem orçamento/SLA contratados
      // - tasks: visíveis do cliente; query e taskFromDb compat
      // - history e deps: não usados no Portal — não carrega
      const cid = this.currentPessoa && this.currentPessoa.cliente_id;
      if (!cid) {
        this.clientes = []; this.projetos = []; this.pessoas = [];
        this.tasks = []; this.historyAll = []; this.taskDeps = [];
        return;
      }
      try {
        const [c, p, ps, t] = await Promise.all([
          sb.from('clientes').select('id,nome,tier,arquivado_em').eq('id', cid),
          sb.from('projetos').select('id,nome,cliente_id,tipo,arquivado_em').eq('cliente_id', cid).order('nome'),
          // RLS limita a própria linha. Não pedimos skills/senioridade/
          // capacidade/cliente_principal/secundario.
          sb.from('pessoas').select('id,nome,email,user_id,invited_at,role,cliente_id').order('nome'),
          sb.from('tasks').select(this._TASK_LIGHT_COLS)
            .eq('cliente_id', cid)
            .eq('visivel_cliente', true)
            .order('criado_em', { ascending: false }),
        ]);
        const err = c.error || p.error || ps.error || t.error;
        if (err) throw err;
        this.clientes = (c.data || []).map(clienteFromDb);
        this.projetos = (p.data || []).map(projetoFromDb);
        this.pessoas  = ps.data || [];
        this.tasks    = (t.data || []).map(taskFromDb);
        this.historyAll = [];
        this.taskDeps = [];
        this.historicoCompletoCarregado = true;  // não há janela de "mais antigo" no portal
      } catch (e) {
        console.error('Falha ao carregar portal do cliente', e);
        this.toast('error', 'Falha ao carregar: ' + (e.message || e));
      }
    },
    async refreshTasks() {
      // Mantém o filtro de janela se ainda não pediu histórico completo.
      const q = this.historicoCompletoCarregado
        ? sb.from('tasks').select(this._TASK_LIGHT_COLS).order('criado_em', { ascending: false })
        : this._buildTasksQuery();
      const { data, error } = await q;
      if (!error) this.tasks = data.map(taskFromDb);
    },
    // Sob demanda: puxa concluídas antigas. Idempotente — mescla pelo id.
    async loadOlderConcluidas() {
      if (this.historicoCompletoCarregado) {
        this.toast('info', 'Histórico completo já carregado.');
        return;
      }
      const cutoff = this._tasksWindowCutoff();
      const { data, error } = await sb.from('tasks').select(this._TASK_LIGHT_COLS)
        .eq('status', 'concluido')
        .lt('status_em', cutoff)
        .order('status_em', { ascending: false });
      if (error) { this.toast('error', 'Erro ao carregar histórico: ' + error.message); return; }
      const older = (data || []).map(taskFromDb);
      const existing = new Set(this.tasks.map(t => t.id));
      this.tasks = [...this.tasks, ...older.filter(t => !existing.has(t.id))];
      this.historicoCompletoCarregado = true;
      this.toast('success', `+${older.length} tarefa(s) concluída(s) antigas carregadas.`);
    },
    async refreshClientes() {
      const { data, error } = await sb.from('clientes').select('id,nome,tier,arquivado_em').order('nome');
      if (!error) this.clientes = data.map(clienteFromDb);
    },
    async refreshProjetos() {
      const { data, error } = await sb.from('projetos').select('id,nome,cliente_id,sla_resposta_horas,sla_entrega_dias,orcamento_horas,tipo,arquivado_em').order('nome');
      if (!error) this.projetos = data.map(projetoFromDb);
    },
    async refreshPessoas() {
      const { data, error } = await sb.from('pessoas').select('id,nome,email,user_id,invited_at,role,cliente_id,cliente_principal_id,cliente_secundario_id,capacidade_horas_semana,skills,senioridade').order('nome');
      if (!error) this.pessoas = data;
    },
    async convidarPessoa(p) {
      if (!p.email) {
        this.toast('error', `${p.nome} não tem email cadastrado. Edite no banco ou recadastre.`);
        return;
      }
      // 1) Marca como convidada (libera acesso futuro mesmo se o email falhar agora)
      const nowIso = new Date().toISOString();
      const { error: upErr } = await sb.from('pessoas').update({ invited_at: nowIso }).eq('id', p.id);
      if (upErr) { this.toast('error', 'Erro ao marcar convite: ' + upErr.message); return; }
      const i = this.pessoas.findIndex(x => x.id === p.id);
      if (i >= 0) this.pessoas[i] = { ...this.pessoas[i], invited_at: nowIso };
      // 2) Dispara magic link
      const { error } = await sb.auth.signInWithOtp({
        email: p.email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname }
      });
      if (error) {
        this.toast('error', 'Convite marcado, mas falha ao enviar email: ' + error.message);
        return;
      }
      this.toast('success', `Convite enviado para ${p.email}`);
    },
    async ativarPessoa(p) {
      // Pra interno/admin: só marca invited_at (login é via Google, não precisa magic link).
      if (!p.email) {
        this.toast('error', `${p.nome} não tem email. Edite a pessoa antes de ativar.`);
        return;
      }
      const nowIso = new Date().toISOString();
      const i = this.pessoas.findIndex(x => x.id === p.id);
      const prev = i >= 0 ? this.pessoas[i] : null;
      if (i >= 0) this.pessoas[i] = { ...prev, invited_at: nowIso };
      const { error } = await sb.from('pessoas').update({ invited_at: nowIso }).eq('id', p.id);
      if (error) {
        if (prev) this.pessoas[i] = prev;
        this.toast('error', 'Erro ao ativar: ' + error.message);
        return;
      }
      this.toast('success', `${p.nome} ativada. Já pode entrar com Google.`);
    },
    desconvidarPessoa(p) {
      this.askConfirm(
        `Revogar acesso de ${p.nome}? Sessão ativa dele expira no próximo refresh do browser dele.`,
        async () => {
          const i = this.pessoas.findIndex(x => x.id === p.id);
          const prev = i >= 0 ? this.pessoas[i] : null;
          if (i >= 0) this.pessoas[i] = { ...prev, invited_at: null };
          const { error } = await sb.from('pessoas').update({ invited_at: null }).eq('id', p.id);
          if (error) {
            if (prev) this.pessoas[i] = prev;
            this.toast('error', 'Erro ao revogar: ' + error.message);
            return;
          }
          this.toast('success', `Acesso de ${p.nome} revogado.`);
        },
        { label: 'revogar' }
      );
    },
    askConfirm(msg, action, opts) {
      this.confirmTarget = { msg, action, label: (opts && opts.label) || 'excluir', danger: !(opts && opts.danger === false) };
    },
    runConfirm() {
      const t = this.confirmTarget;
      this.confirmTarget = null;
      if (t && typeof t.action === 'function') t.action();
    },
    toast(kind, msg, ms) {
      const id = Math.random().toString(36).slice(2, 9);
      this.toasts.push({ id, kind, msg });
      setTimeout(() => this.dismissToast(id), ms || (kind === 'error' ? 6000 : 3500));
    },
    dismissToast(id) { this.toasts = this.toasts.filter(t => t.id !== id); },

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

    // ===================== BRIEFING EXECUTIVO =====================
    get briefingDate() {
      const d = new Date();
      const dias = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
      return dias[d.getDay()] + ', ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
    },
    get briefingHeadline() {
      const cRisco = this.briefingClientesRisco.length;
      const tRisco = this.briefingTimeRisco.length;
      if (cRisco === 0 && tRisco === 0) return 'Nada crítico. Operação fluindo.';
      const parts = [];
      if (cRisco) parts.push(cRisco + ' cliente' + (cRisco === 1 ? '' : 's') + ' em risco');
      if (tRisco) parts.push(tRisco + ' pessoa' + (tRisco === 1 ? '' : 's') + ' precisando de conversa');
      return parts.join(' · ');
    },
    get briefingClientesRisco() {
      // Reutiliza reportClientesExec mas amplifica motivo + ação sugerida
      return this.reportClientesExec.filter(c => c.sinal !== 'verde').map(c => {
        let motivo = c.sinalReason;
        let acao = '';
        if (c.sinal === 'vermelho' && c.atrasadas > 0) {
          motivo = c.atrasadas + ' task' + (c.atrasadas === 1 ? '' : 's') + ' atrasada' + (c.atrasadas === 1 ? '' : 's');
          acao = 'Conversar hoje sobre prazo';
        } else if (c.sinal === 'vermelho' && c.bloqAguard > 0) {
          motivo = c.bloqAguard + ' task aguardando cliente há +5 dias';
          acao = 'Cobrar resposta hoje';
        } else if (c.sinal === 'amarelo' && c.bloqAguard > 0) {
          motivo = c.bloqAguard + ' task aguardando cliente';
          acao = 'Cobrar resposta esta semana';
        } else if (c.sinal === 'amarelo' && c.atrasadas > 0) {
          motivo = c.atrasadas + ' task atrasada';
          acao = 'Alinhar prazo';
        }
        // Sobreescreve com aviso de orçamento se for grave
        if (c.pctOrc != null && c.pctOrc > 100) {
          motivo = motivo + ' · orçamento de horas estourado (' + c.pctOrc + '%)';
          acao = 'Renegociar escopo ou cobrar adicional';
        }
        return { ...c, motivo, acao };
      });
    },
    get briefingTimeRisco() {
      return this.reportTeamLoad.filter(p => p.cargaNivel === 'sobrecarga' || p.cargaNivel === 'pressao').map(p => {
        let acao = '';
        if (p.cargaNivel === 'sobrecarga' && p.atrasadas > 0) {
          acao = 'Redistribuir tasks hoje; risco de burnout';
        } else if (p.cargaNivel === 'sobrecarga') {
          acao = 'Redistribuir antes que comece a atrasar';
        } else if (p.cargaNivel === 'pressao' && p.atrasadas > 0) {
          acao = 'Aliviar carga; já está atrasando';
        } else {
          acao = 'Monitorar; não dar mais task nova';
        }
        return { ...p, acao };
      });
    },
    get briefingTendencia() {
      // 4 indicadores chave com delta vs período anterior
      const t = this.tasks;
      const now = Date.now();
      // Throughput 7d
      const c7 = t.filter(x => x.status === STATUS.CONCLUIDO && x.statusEm && (now - x.statusEm) <= 7*86400000).length;
      const c7p = t.filter(x => x.status === STATUS.CONCLUIDO && x.statusEm && (now - x.statusEm) > 7*86400000 && (now - x.statusEm) <= 14*86400000).length;
      // Lead time 14d
      const lead = (from, to) => {
        const arr = t.filter(x => x.status === STATUS.CONCLUIDO && x.statusEm && x.criadoEm && (now - x.statusEm) > from && (now - x.statusEm) <= to)
          .map(x => (x.statusEm - x.criadoEm) / 86400000).filter(d => d > 0);
        return arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : null;
      };
      const lt = lead(0, 14*86400000);
      const ltP = lead(14*86400000, 28*86400000);
      // % atrasadas das ativas
      const ativas = t.filter(x => x.status !== STATUS.CONCLUIDO);
      const pctAtr = ativas.length ? Math.round(ativas.filter(x => this.atrasada(x)).length / ativas.length * 100) : 0;
      // Capacidade média
      const team = this.reportTeamLoad.filter(p => p.pctCap != null);
      const capMed = team.length ? Math.round(team.reduce((s,p) => s + p.pctCap, 0) / team.length) : null;

      const dThr = c7 - c7p;
      const dLt = (lt != null && ltP != null) ? +(lt - ltP).toFixed(1) : null;

      return [
        {
          label: 'Throughput · 7d', value: c7,
          deltaText: dThr === 0 ? '= estável' : (dThr > 0 ? '↑ +' + dThr + ' vs sem ant' : '↓ ' + dThr + ' vs sem ant'),
          deltaGood: dThr === 0 ? null : dThr > 0,
        },
        {
          label: 'Lead time · 14d', value: lt != null ? lt.toFixed(1) + 'd' : '—',
          deltaText: dLt == null ? '—' : (dLt === 0 ? '= estável' : (dLt < 0 ? '↓ ' + Math.abs(dLt) + 'd (melhor)' : '↑ +' + dLt + 'd (pior)')),
          deltaGood: dLt == null ? null : (dLt === 0 ? null : dLt < 0),
        },
        {
          label: '% atrasadas', value: pctAtr + '%',
          danger: pctAtr > 20,
          deltaText: pctAtr > 20 ? 'crítico' : (pctAtr > 10 ? 'atenção' : 'saudável'),
          deltaGood: pctAtr <= 10,
        },
        {
          label: 'Capac. média', value: capMed != null ? capMed + '%' : '—',
          danger: capMed != null && capMed > 100,
          deltaText: capMed == null ? '—' : (capMed > 100 ? 'time sobrecarregado' : (capMed < 60 ? 'time com folga' : 'saudável')),
          deltaGood: capMed == null ? null : (capMed >= 60 && capMed <= 100),
        },
      ];
    },
    get briefingNarrativa() {
      const t = this.briefingTendencia;
      const [thr, lt, atr, cap] = t;
      const bons = t.filter(x => x.deltaGood === true).length;
      const ruins = t.filter(x => x.deltaGood === false).length;
      let tom = 'estável';
      if (bons >= 3) tom = 'melhorando';
      else if (ruins >= 3) tom = 'piorando';
      else if (ruins > bons) tom = 'preocupante';
      else if (bons > ruins) tom = 'levemente melhor';
      return 'Operação ' + tom + '. Throughput de ' + thr.value + ' tarefa(s) na última semana, lead time médio de ' + lt.value + ', ' + atr.value + ' das ativas atrasadas, time em ' + cap.value + ' de capacidade média.';
    },
    get briefingCapacidade() {
      const team = this.reportTeamLoad;
      const teamCap = team.filter(p => p.capacidade > 0);
      const alocado = team.reduce((s, p) => s + p.horas, 0);
      const capacidade = teamCap.reduce((s, p) => s + p.capacidade, 0);
      const utilizacao = capacidade > 0 ? Math.round(alocado / capacidade * 100) : 0;
      let nivel = 'ok', label = 'saudável', rec = '';
      const sobrecarga = team.filter(p => p.cargaNivel === 'sobrecarga').length;
      const folga = team.filter(p => p.cargaNivel === 'folga').length;
      if (utilizacao > 100 || sobrecarga >= 2) {
        nivel = 'alta'; label = 'time pressionado';
        rec = 'Time está sistemicamente sobrecarregado. ' +
              (sobrecarga >= 2 ? sobrecarga + ' pessoa(s) em sobrecarga crítica. ' : '') +
              'Decisão: contratar mais 1 pessoa, despriorizar projeto não-estratégico, ou cobrar prazo mais largo dos clientes.';
      } else if (utilizacao < 60 && folga >= Math.ceil(team.length * 0.4)) {
        nivel = 'baixa'; label = 'time com folga';
        rec = 'Time tem capacidade ociosa. ' + folga + ' pessoa(s) abaixo de 60% de uso. ' +
              'Decisão: puxar mais venda, antecipar entregas, ou (se persistente por 3+ semanas) avaliar headcount.';
      } else {
        nivel = 'ok'; label = 'capacidade equilibrada';
        rec = 'Capacidade do time bem dimensionada pra demanda atual. Manter rota; reavaliar se entrar projeto novo.';
      }
      return {
        alocado, capacidade, utilizacao,
        pessoasComCap: teamCap.length,
        utilizacaoNivel: nivel,
        utilizacaoLabel: label,
        recomendacao: rec,
      };
    },
    abrirFiltroCliente(cid) {
      this.tab = 'backlog';
      if (this.f) this.f.cliente = cid;
      this.$nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    },


    get reportRisks() {
      const out = [];
      const ativas = this._visibleTasks.filter(t => t.status !== STATUS.CONCLUIDO);
      const atrasadas = ativas.filter(t => this.atrasada(t));
      if (atrasadas.length) {
        const porCli = {};
        atrasadas.forEach(t => { const n = this.nomeCliente(t.clienteId); porCli[n] = (porCli[n]||0)+1; });
        const top = Object.entries(porCli).sort((a,b) => b[1]-a[1])[0];
        out.push(atrasadas.length + ' tarefa(s) atrasada(s) — concentração em ' + top[0] + ' (' + top[1] + ').');
      }
      const blqStale = ativas.filter(t => t.status === 'bloqueado' && this.agingDays(t) >= 5);
      if (blqStale.length) {
        out.push(blqStale.length + ' tarefa(s) bloqueada(s) há +5 dias — desbloqueio prioritário.');
      }
      const stale = ativas.filter(t => this.agingLevel(t) === 'stale' && t.status !== 'bloqueado');
      if (stale.length) {
        out.push(stale.length + ' tarefa(s) paradas além do limite saudável (aging crítico).');
      }
      const semResp = ativas.filter(t => !t.pessoaId).length;
      if (semResp) out.push(semResp + ' tarefa(s) sem responsável definido.');
      const semPrazo = ativas.filter(t => !t.prazo).length;
      if (semPrazo >= 5) out.push(semPrazo + ' tarefa(s) ativas sem prazo — risco de fila invisível.');
      return out;
    },
    // Saúde por cliente (página 3 do report).
    get reportClientHealth() {
      return this._memo('reportClientHealth', this._tasksSig + ':' + this.clientes.length + ':' + this._dataRev, () => this._computeReportClientHealth());
    },
    _computeReportClientHealth() {
      const now = Date.now();
      const cutoff14 = now - 14 * 86400000;
      const cutoff28 = now - 28 * 86400000;
      const out = [];
      const tasksByCli = this.tasksByCliente; // bucket O(1)
      for (const c of this.clientes) {
        const allTasks = tasksByCli.get(c.id) || [];
        if (allTasks.length === 0) continue;
        const ativas = allTasks.filter(t => t.status !== STATUS.CONCLUIDO);
        const atrasadas = ativas.filter(t => this.atrasada(t));
        const bloqAguard = ativas.filter(t => t.subetapa === 'bloqueado' && t.bloqueadoPor === 'cliente');
        const bloqAguardStale = bloqAguard.filter(t => this.agingDays(t) >= 5).length;
        const entregues14d     = allTasks.filter(t => t.status === STATUS.CONCLUIDO && t.statusEm && t.statusEm >= cutoff14).length;
        const entregues14dPrev = allTasks.filter(t => t.status === STATUS.CONCLUIDO && t.statusEm && t.statusEm >= cutoff28 && t.statusEm < cutoff14).length;
        const delta = entregues14d - entregues14dPrev;
        // SLA médio: criação → conclusão das entregues nos últimos 14d
        const leads = allTasks
          .filter(t => t.status === STATUS.CONCLUIDO && t.statusEm && t.statusEm >= cutoff14 && t.criadoEm)
          .map(t => (t.statusEm - t.criadoEm) / 86400000)
          .filter(d => d > 0);
        const slaMedio = leads.length ? leads.reduce((a,b) => a+b, 0) / leads.length : null;
        // Sinal semafórico
        let sinal = 'verde', sinalReason = 'tudo no prazo';
        const pctAtrasadas = ativas.length ? atrasadas.length / ativas.length : 0;
        if (pctAtrasadas > 0.30 || bloqAguardStale > 0) {
          sinal = 'vermelho';
          sinalReason = pctAtrasadas > 0.30 ? `${Math.round(pctAtrasadas*100)}% das ativas atrasadas` : 'bloqueio com cliente há +5d';
        } else if (atrasadas.length > 0 || bloqAguard.length > 0) {
          sinal = 'amarelo';
          sinalReason = atrasadas.length > 0 ? `${atrasadas.length} atrasada(s)` : 'aguardando cliente';
        }
        out.push({
          id: c.id, nome: c.nome,
          ativas: ativas.length,
          atrasadas: atrasadas.length,
          bloqAguard: bloqAguard.length,
          entregues14d, delta,
          slaMedio,
          sinal, sinalReason,
        });
      }
      const sinalRank = { vermelho: 0, amarelo: 1, verde: 2 };
      out.sort((a,b) => (sinalRank[a.sinal] - sinalRank[b.sinal]) || (b.ativas - a.ativas));
      return out;
    },
    // Top pendentes críticos (página 3).
    get reportTopPendentes() {
      const ativas = this._visibleTasks.filter(t => t.status !== STATUS.CONCLUIDO);
      const score = (t) => {
        // Score maior = mais crítico
        let s = 0;
        if (this.atrasada(t)) s += 1000 + this.diasAtraso(t) * 5;
        if (t.subetapa === 'bloqueado' && t.bloqueadoPor === 'cliente') s += 500 + this.agingDays(t) * 3;
        if (t.subetapa === 'bloqueado' && t.bloqueadoPor !== 'cliente') s += 300 + this.agingDays(t) * 2;
        if (this.agingLevel(t) === 'stale') s += 200;
        // Boost por prioridade
        if (t.prioridade === 'P0') s += 200;
        else if (t.prioridade === 'P1') s += 100;
        return s;
      };
      const candidatos = ativas
        .map(t => ({ t, s: score(t) }))
        .filter(x => x.s > 0)
        .sort((a,b) => b.s - a.s)
        .slice(0, 10)
        .map(x => x.t);
      return candidatos;
    },
    // Carga por pessoa (página 3).
    get reportTeamLoad() {
      return this._memo('reportTeamLoad', this._tasksSig + ':' + this.pessoas.length + ':' + this._dataRev, () => this._computeReportTeamLoad());
    },
    _computeReportTeamLoad() {
      const map = new Map();
      for (const p of this.pessoas) {
        if (p.role === ROLE.CLIENTE) continue; // não inclui clientes externos
        map.set(p.id, {
          id: p.id, nome: p.nome,
          senioridade: p.senioridade || '',
          capacidade: Number(p.capacidade_horas_semana) || 0,
          tasks: 0, horas: 0, atrasadas: 0, horasAtrasadas: 0
        });
      }
      const ativas = this._visibleTasks.filter(t => t.status !== STATUS.CONCLUIDO);
      for (const t of ativas) {
        if (!t.pessoaId) continue;
        const e = map.get(t.pessoaId);
        if (!e) continue;
        e.tasks++;
        const h = this.effEsforco(t);
        e.horas += h;
        if (this.atrasada(t)) {
          e.atrasadas++;
          e.horasAtrasadas += h;
        }
      }
      const arr = Array.from(map.values()).filter(x => x.tasks > 0);
      const maxHoras = Math.max(1, ...arr.map(x => x.horas));
      arr.forEach(x => {
        x.barLate = Math.round((x.horasAtrasadas / maxHoras) * 100);
        x.barOk   = Math.round(((x.horas - x.horasAtrasadas) / maxHoras) * 100);
        x.pctCap  = x.capacidade > 0 ? Math.round((x.horas / x.capacidade) * 100) : null;
        // Faixas: <60% folga, 60-100% saudável, 100-130% pressão, >130% sobrecarga
        x.cargaNivel = x.pctCap == null ? 'sem-cap'
                     : x.pctCap > 130 ? 'sobrecarga'
                     : x.pctCap > 100 ? 'pressao'
                     : x.pctCap < 60  ? 'folga'
                     : 'ok';
        // Fallback antigo (sem capacidade declarada)
        x.sobrecarga = x.pctCap != null ? x.pctCap > 130 : x.horas > 50;
        x.subutilizada = x.pctCap != null ? x.pctCap < 60 : x.horas < 20;
      });
      arr.sort((a,b) => b.horas - a.horas);
      return arr;
    },
    // ============ ANÁLISE SEMANAL DE CAPACIDADE (4 semanas) ============
    // Agrega tasks abertas em 4 buckets (semana atual + 3 próximas) por pessoa
    // e por projeto (sustentação e fechado). Tasks atrasadas puxam pra W0.
    // Defaults pra análise: prazo vazio → semana atual; esforço 0 → 4h.
    // Não escreve nada no banco — só agrega pra heurística e Briefing.
    get weeklyCapacityAnalysis() {
      const sig = this._tasksSig + ':' + this.pessoas.length + ':' + this.projetos.length + ':' + this._dataRev;
      return this._memo('weeklyCapacityAnalysis', sig, () => this._computeWeeklyCapacityAnalysis());
    },
    _computeWeeklyCapacityAnalysis() {
      const today = new Date().toISOString().slice(0, 10);
      const ativas = this._visibleTasks.filter(t => t.status !== STATUS.CONCLUIDO && !t.arquivadoEm);

      // ---- Pessoa × semana ----
      const pessoaWeekly = new Map();   // pessoaId → [w0, w1, w2, w3]
      for (const p of this.pessoas) {
        if (p.role === ROLE.CLIENTE) continue;
        pessoaWeekly.set(p.id, [0, 0, 0, 0]);
      }
      for (const t of ativas) {
        if (!t.pessoaId) continue;
        const arr = pessoaWeekly.get(t.pessoaId);
        if (!arr) continue;
        const idx = taskWeekIndex(t, today);
        if (idx === -1) arr[0] += effEsforco(t);                  // atrasada puxa pra W0
        else if (idx !== null) arr[idx] += effEsforco(t);
      }
      const pessoasResult = [];
      for (const p of this.pessoas) {
        if (p.role === ROLE.CLIENTE) continue;
        const hours = pessoaWeekly.get(p.id) || [0,0,0,0];
        const cap = +p.capacidade_horas_semana || 0;
        const weeks = hours.map(h => {
          const pctCap = cap > 0 ? Math.round((h / cap) * 100) : null;
          return { hours: h, pctCap, nivel: cargaNivelFromPctCap(pctCap) };
        });
        const anyOverload = weeks.some(w => w.nivel === 'sobrecarga' || w.nivel === 'pressao');
        pessoasResult.push({ pessoaId: p.id, nome: p.nome, capacidade: cap, weeks, anyOverload });
      }
      pessoasResult.sort((a,b) => {
        // sobrecarga primeiro, depois maior pico de pctCap
        const peakA = Math.max(...a.weeks.map(w => w.pctCap ?? -1));
        const peakB = Math.max(...b.weeks.map(w => w.pctCap ?? -1));
        return peakB - peakA;
      });

      // ---- Projeto sustentação × semana ----
      const sustWeekly = new Map();
      for (const proj of this.projetos) {
        if (proj.arquivadoEm) continue;
        if (proj.tipo !== 'sustentacao') continue;
        if (!(+proj.orcamentoHoras > 0)) continue;
        sustWeekly.set(proj.id, [0,0,0,0]);
      }
      for (const t of ativas) {
        if (!t.projetoId) continue;
        const arr = sustWeekly.get(t.projetoId);
        if (!arr) continue;
        const idx = taskWeekIndex(t, today);
        if (idx === -1) arr[0] += effEsforco(t);
        else if (idx !== null) arr[idx] += effEsforco(t);
      }
      const sustentacoesResult = [];
      for (const proj of this.projetos) {
        if (proj.arquivadoEm) continue;
        if (proj.tipo !== 'sustentacao') continue;
        const orcMensal = +proj.orcamentoHoras || 0;
        if (!(orcMensal > 0)) continue;
        const capSem = orcMensal / 4;
        const hours = sustWeekly.get(proj.id) || [0,0,0,0];
        const weeks = hours.map(h => {
          const pctCap = Math.round((h / capSem) * 100);
          return { hours: h, pctCap, nivel: cargaNivelFromPctCap(pctCap) };
        });
        // Ociosa: 2+ semanas consecutivas <50% utilização
        let ociosaStreak = 0, ociosaFlag = false;
        for (const w of weeks) {
          if (w.pctCap < 50) { ociosaStreak++; if (ociosaStreak >= 2) ociosaFlag = true; }
          else ociosaStreak = 0;
        }
        const estourando = weeks.some(w => w.pctCap > 100);
        sustentacoesResult.push({
          projetoId: proj.id, nome: proj.nome, clienteId: proj.clienteId,
          capSemanal: capSem, orcMensal, weeks, estourando, ociosaFlag,
        });
      }
      sustentacoesResult.sort((a,b) => {
        const sevA = a.estourando ? 2 : (a.ociosaFlag ? 1 : 0);
        const sevB = b.estourando ? 2 : (b.ociosaFlag ? 1 : 0);
        return sevB - sevA;
      });

      // ---- Projeto fechado × escopo total ----
      const projetosFechadosResult = [];
      for (const proj of this.projetos) {
        if (proj.arquivadoEm) continue;
        if (proj.tipo !== 'projeto') continue;
        const orcTotal = +proj.orcamentoHoras || 0;
        if (!(orcTotal > 0)) continue;
        let usado = 0, comprometido = 0, countTasks = 0;
        for (const t of this.tasks) {
          if (t.projetoId !== proj.id) continue;
          if (t.arquivadoEm) continue;
          countTasks++;
          if (t.status === STATUS.CONCLUIDO) {
            usado += +t.tempoRealHoras || effEsforco(t);
          } else {
            comprometido += effEsforco(t);
          }
        }
        const total = usado + comprometido;
        const pctEsgotamento = Math.round((total / orcTotal) * 100);
        projetosFechadosResult.push({
          projetoId: proj.id, nome: proj.nome, clienteId: proj.clienteId,
          orcTotal, usado, comprometido, total, pctEsgotamento, countTasks,
          estourado: pctEsgotamento > 110,
          risco: pctEsgotamento >= 90 && pctEsgotamento <= 110,
        });
      }
      projetosFechadosResult.sort((a,b) => b.pctEsgotamento - a.pctEsgotamento);

      return { pessoas: pessoasResult, sustentacoes: sustentacoesResult, projetosFechados: projetosFechadosResult };
    },

    // Sugestões de redistribuição baseadas em capacidade semanal (Onda D+).
    // Detecção ESTRITA: emite hit somente quando, numa semana W:
    //   1. pessoa P está em pressão/sobrecarga (>100% cap)
    //   2. projeto sustentação Q está em pressão/sobrecarga (>100% cap mensal/4)
    //   3. P concentra ≥40% do esforço dela em W naquele Q (correlação forte)
    // Estratégia única: realocar pra match de `cliente_principal_id`
    // (preferido) ou `cliente_secundario_id` do projeto.
    // Apresentação: só listar + abrir task (sem auto-apply).
    get weeklyRedistSuggestions() {
      const sig = this._tasksSig + ':' + this.pessoas.length + ':' + this.projetos.length + ':' + this._dataRev;
      return this._memo('weeklyRedistSuggestions', sig, () => this._computeWeeklyRedistSuggestions());
    },
    _computeWeeklyRedistSuggestions() {
      const today = new Date().toISOString().slice(0, 10);
      const wca = this.weeklyCapacityAnalysis;
      if (!wca.pessoas.length || !wca.sustentacoes.length) return [];

      const ativas = this._visibleTasks.filter(t => t.status !== STATUS.CONCLUIDO && !t.arquivadoEm);

      // Index tasks por (pessoa, semana). Atrasadas vão pra W0 (mesma regra da agregação).
      const tasksByPessoaWeek = new Map();
      for (const p of this.pessoas) {
        if (p.role === ROLE.CLIENTE) continue;
        tasksByPessoaWeek.set(p.id, [[],[],[],[]]);
      }
      for (const t of ativas) {
        if (!t.pessoaId) continue;
        const arr = tasksByPessoaWeek.get(t.pessoaId);
        if (!arr) continue;
        const idx = taskWeekIndex(t, today);
        const bucket = (idx === -1) ? 0 : idx;
        if (bucket >= 0 && bucket <= 3) arr[bucket].push(t);
      }

      const sustById = new Map(wca.sustentacoes.map(s => [s.projetoId, s]));
      const wcaPessoaById = new Map(wca.pessoas.map(p => [p.pessoaId, p]));
      const PRIO_RANK = { P0: 0, P1: 1, P2: 2, P3: 3 };
      const SEV_RANK = { sobrecarga: 2, pressao: 1, ok: 0, folga: 0, sem_cap: 0 };

      // 1) Detectar hits
      const hits = [];
      for (const pInfo of wca.pessoas) {
        if (!pInfo.anyOverload) continue;
        for (let w = 0; w <= 3; w++) {
          const wk = pInfo.weeks[w];
          if (wk.nivel !== 'sobrecarga' && wk.nivel !== 'pressao') continue;
          if (wk.hours <= 0) continue;

          const tasksW = (tasksByPessoaWeek.get(pInfo.pessoaId) || [[],[],[],[]])[w];
          if (!tasksW.length) continue;

          // agrupa esforço por projeto
          const horasPorProjeto = new Map();
          for (const t of tasksW) {
            if (!t.projetoId) continue;
            horasPorProjeto.set(t.projetoId, (horasPorProjeto.get(t.projetoId) || 0) + effEsforco(t));
          }

          for (const [projId, horas] of horasPorProjeto) {
            const concentracao = horas / wk.hours;
            if (concentracao < 0.40) continue;
            const sust = sustById.get(projId);
            if (!sust) continue;                                  // só sustentação tem ciclo semanal
            const projWk = sust.weeks[w];
            if (projWk.nivel !== 'sobrecarga' && projWk.nivel !== 'pressao') continue;

            // tasks redistribuíveis: dessa pessoa, nesse projeto, nessa semana, sem P0
            const redistribuiveis = tasksW
              .filter(t => t.projetoId === projId && t.prioridade !== 'P0')
              .sort((a, b) => (PRIO_RANK[b.prioridade] ?? 4) - (PRIO_RANK[a.prioridade] ?? 4));
            if (!redistribuiveis.length) continue;

            hits.push({
              pessoaId: pInfo.pessoaId,
              pessoaNome: pInfo.nome,
              pessoaPct: wk.pctCap,
              pessoaNivel: wk.nivel,
              weekIdx: w,
              projetoId: projId,
              projetoNome: sust.nome,
              clienteId: sust.clienteId,
              horasPessoaNoProjeto: horas,
              concentracao: Math.round(concentracao * 100),
              projetoPct: projWk.pctCap,
              tasksCandidatas: redistribuiveis,
            });
          }
        }
      }

      // 2) Gerar sugestão por hit (1 task realocada por hit)
      const result = [];
      for (const hit of hits) {
        // candidatos: outras pessoas internas com cliente principal/sec = clienteId do projeto, com folga em W
        const candidatos = [];
        for (const cand of this.pessoas) {
          if (cand.id === hit.pessoaId) continue;
          if (cand.role === ROLE.CLIENTE) continue;
          const matchPri = cand.cliente_principal_id === hit.clienteId;
          const matchSec = cand.cliente_secundario_id === hit.clienteId;
          if (!matchPri && !matchSec) continue;
          const candWca = wcaPessoaById.get(cand.id);
          if (!candWca) continue;
          const candWk = candWca.weeks[hit.weekIdx];
          if (candWk.pctCap == null) continue;                    // sem cap declarada — pula
          if (candWk.pctCap >= 80) continue;                      // não tem folga
          candidatos.push({ pessoa: cand, wca: candWca, week: candWk, matchScore: matchPri ? 2 : 1 });
        }
        candidatos.sort((a, b) => {
          if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
          return a.week.pctCap - b.week.pctCap;
        });

        // tenta cada task em ordem (menor prioridade primeiro), achar candidato que não estoura
        let suggestion = null;
        for (const t of hit.tasksCandidatas) {
          const esf = effEsforco(t);
          for (const c of candidatos) {
            const cap = c.wca.capacidade;
            if (!(cap > 0)) continue;
            const newPct = Math.round(((c.week.hours + esf) / cap) * 100);
            if (newPct > 100) continue;                           // anti-otimização míope
            suggestion = { hit, task: t, candidate: c, newPctCandidate: newPct, reason: 'ok' };
            break;
          }
          if (suggestion) break;
        }
        if (!suggestion) {
          // sem candidato viável — emite hit como "analisar manualmente"
          suggestion = { hit, task: hit.tasksCandidatas[0], candidate: null, newPctCandidate: null,
                         reason: candidatos.length === 0 ? 'no-match' : 'no-fit' };
        }
        result.push(suggestion);
      }

      // 3) Ordena: weekIdx ASC (mais urgente primeiro), severidade DESC, depois pct DESC
      result.sort((a, b) => {
        if (a.hit.weekIdx !== b.hit.weekIdx) return a.hit.weekIdx - b.hit.weekIdx;
        const sevDiff = SEV_RANK[b.hit.pessoaNivel] - SEV_RANK[a.hit.pessoaNivel];
        if (sevDiff !== 0) return sevDiff;
        return b.hit.pessoaPct - a.hit.pessoaPct;
      });

      return result.slice(0, 5);
    },

    // Sugestões de redistribuição (página 2). Heurística simples:
    // pra cada pessoa sobrecarregada (>50h), buscar 2-3 tasks dela
    // (atrasadas / P0 / P1) que poderiam ser passadas pra alguém
    // disponível (<20h e mesmo papel interno).
    get reportRedistSuggestions() {
      const team = this.reportTeamLoad;
      const sobrecarregados = team.filter(p => p.sobrecarga);
      const disponiveis     = team.filter(p => p.subutilizada).sort((a,b) => a.horas - b.horas);
      if (sobrecarregados.length === 0 || disponiveis.length === 0) return [];
      const prioRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
      const out = [];
      let dispIdx = 0;
      for (const sobre of sobrecarregados) {
        // Top 3 tasks transferíveis dessa pessoa
        const candidatos = this.tasks
          .filter(t => t.pessoaId === sobre.id && t.status !== STATUS.CONCLUIDO)
          .sort((a,b) => {
            const sa = (this.atrasada(a) ? 0 : 1) + (prioRank[a.prioridade] ?? 9) * 0.1;
            const sb = (this.atrasada(b) ? 0 : 1) + (prioRank[b.prioridade] ?? 9) * 0.1;
            return sa - sb;
          })
          .slice(0, 3);
        for (const t of candidatos) {
          if (dispIdx >= disponiveis.length) break;
          const dest = disponiveis[dispIdx];
          const tag = this.atrasada(t) ? 'atrasada' : t.prioridade;
          const h = this.effEsforco(t);
          out.push(
            `Passar "${t.titulo.slice(0, 60)}${t.titulo.length>60?'…':''}" (${tag}, ${h}h) ` +
            `de ${sobre.nome.split(' ')[0]} (${sobre.horas}h) pra ${dest.nome.split(' ')[0]} (${dest.horas}h).`
          );
          dest.horas += h; // simulação local
          if (dest.horas >= 30) dispIdx++; // se ficou ocupado, próximo
        }
        if (out.length >= 5) break; // limite de sugestões por relatório
      }
      return out.slice(0, 5);
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
        { id: 'act-mvp',    kind: 'ir pra', label: 'Adoption',            hint: 'métricas de uso',                action: () => { this.tab = 'mvp'; this.loadMvpDados(); } },
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
      );
    },
    goToTab(key) {
      const prev = this.tab;
      this.tab = key;
      if (key === 'dash') this.$nextTick(() => this.renderCharts());
      if (key === 'mvp')  this.loadMvpDados();
      if (key !== prev) this.track('tab_open', { tab: key, from: prev });
    },

    // ===================== PORTAL DO CLIENTE =====================
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
    // Métricas agregadas pro cliente externo. Filtra rigorosamente
    // só o que é visível ao cliente (visivelCliente !== false).
    // NUNCA expõe: capacidade interna, sobrecarga, orçamento contratado,
    // skills/senioridade do time, tipo_trabalho técnico, reopen_count,
    // tempo_real_horas, esforço estimado.
    get portalMetrics() {
      const arr = this.portalTasks;
      const now = Date.now();
      const monthMs = 30 * 86400000;

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

    // Alertas amigáveis pro cliente (público, sem jargão interno).
    // Apenas o que faz sentido o cliente saber/agir.
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
      // 3. Mês corrente com pico positivo (acima da média semestre + 30%)
      if (m.mesAtual > 0 && m.mediaSemestre > 0 && m.mesAtual >= m.mediaSemestre * 1.3) {
        out.push({
          severity: 'positivo',
          icon: '↑',
          titulo: 'Mês forte: ' + m.mesAtual + ' entregas até agora',
          detalhe: 'Acima da média dos últimos 6 meses (' + m.mediaSemestre.toFixed(1) + ').',
        });
      }
      // 4. Streak de queda (mes atual = 0 e mes anterior > 0 e ainda tem ativas) — alerta amigável
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
      // do portal atual E é marcada como visível. RLS já bloqueia no
      // banco, este guard evita race conditions (ex: task chegando
      // via realtime antes de filtragem).
      if (!t || t.clienteId !== this.effectivePortalClienteId || t.visivelCliente === false || t.arquivadoEm) {
        return;
      }
      this.portalTask = t;
      this.portalTaskOpen = true;
      this.portalNewComment = '';
      this.portalReplyText = '';
      // Reuse loadComments by setting editing.id temporarily — avoid that, fetch direct
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
      // Notifica responsável da task que cliente comentou
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
      // Linha do tempo simplificada e humanizada
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

    // ===================== MEU FOCO =====================
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
    // ====== Dados MVP ======
    async loadMvpDados() {
      // Carrega comments do app dos últimos 60 dias (com author_pessoa_id)
      const since60 = new Date(Date.now() - 60 * 86400000).toISOString();
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const [cm, ev] = await Promise.all([
        sb.from('task_comments')
          .select('id, author, author_pessoa_id, criado_em, external_source, parent_id')
          .gte('criado_em', since60)
          .order('criado_em', { ascending: false })
          .limit(10000),
        sb.from('usage_events')
          .select('id, ts, pessoa_id, event, meta, session_id')
          .gte('ts', since30)
          .order('ts', { ascending: false })
          .limit(20000),
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
    get usagePorPessoa() {
      const now = Date.now();
      const cut7 = now - 7 * 86400000;
      const cut30 = now - 30 * 86400000;
      // Agrega por pessoa
      const acc = new Map();
      for (const e of this.usageEvents) {
        if (!e.pessoa_id) continue;
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

    // ===================== CHARTS =====================
    // Tema central — paleta + opções base padronizadas. Todos os
    // gráficos do dashboard partem daqui pra ter mesma fonte, grid,
    // tooltip e cores semânticas.
    chartTheme() {
      const css = getComputedStyle(document.documentElement);
      const v = (n) => css.getPropertyValue(n).trim();
      const palette = {
        brand: v('--brand'), brandDark: v('--brand-dark'),
        danger: v('--p0'), warn: v('--p1'), info: v('--p2'), neutral: v('--p3'),
        ink: v('--ink'), inkSoft: v('--ink-soft'), muted: v('--muted'),
        line: v('--line'), bgElev: v('--bg-elev'),
      };
      const fontBrand = 'IBM Plex Sans';
      const fontMono  = 'IBM Plex Mono';
      const baseOpts = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: palette.ink, titleColor: palette.bgElev, bodyColor: palette.bgElev,
            padding: 10,
            titleFont: { family: fontBrand, size: 12, weight: 600 },
            bodyFont:  { family: fontMono,  size: 11 },
            displayColors: false,
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: palette.muted,   font: { family: fontMono, size: 11 } }, border: { display: false } },
          y: { grid: { color: palette.line }, ticks: { color: palette.inkSoft, font: { family: fontMono, size: 11 } }, border: { display: false } }
        }
      };
      return { palette, fontBrand, fontMono, baseOpts };
    },

    // Reusa instância de Chart.js quando possível. Trocar dados via
    // .update() é ~10x mais rápido que destruir e recriar o canvas.
    // Funciona enquanto o type não muda (todos charts são fixos no app).
    _upsertChart(key, ctx, config) {
      const existing = this.charts[key];
      if (existing && existing.canvas === ctx) {
        existing.data = config.data;
        existing.options = config.options;
        existing.update('none'); // sem animação no refresh
        return existing;
      }
      // Canvas diferente (DOM remontado via x-if) ou primeiro render: cria.
      if (existing) { try { existing.destroy(); } catch(_){} }
      this.charts[key] = new Chart(ctx, config);
      return this.charts[key];
    },

    renderCharts() {
      const ativas = this.dashTasks.filter(t => t.status !== STATUS.CONCLUIDO);
      const theme = this.chartTheme();
      const { palette, baseOpts } = theme;

      // por cliente
      const porCliente = {};
      this.clientes.forEach(c => porCliente[c.nome] = 0);
      ativas.forEach(t => {
        const n = this.nomeCliente(t.clienteId);
        porCliente[n] = (porCliente[n] || 0) + this.effEsforco(t);
      });
      const cliEntries = Object.entries(porCliente).filter(([_,v]) => v > 0).sort((a,b) => b[1] - a[1]);

      // entregas — próximas 8 semanas (1ª barra = atrasadas)
      const startOfWeek = (d) => {
        const dt = new Date(d); dt.setHours(0,0,0,0);
        const diff = (dt.getDay() + 6) % 7;
        dt.setDate(dt.getDate() - diff);
        return dt;
      };
      const fmtSem = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      const hojeWk = startOfWeek(new Date());
      const semanas = [];
      for (let i = 0; i < 5; i++) {
        const ini = new Date(hojeWk); ini.setDate(ini.getDate() + i*7);
        const fim = new Date(ini); fim.setDate(fim.getDate() + 7);
        semanas.push({ ini, fim, label: fmtSem(ini), horas: 0, count: 0 });
      }
      let atrasadasH = 0, atrasadasN = 0;
      ativas.forEach(t => {
        if (!t.prazo) return;
        const prazo = new Date(t.prazo + 'T00:00:00');
        const h = this.effEsforco(t);
        if (prazo < hojeWk) { atrasadasH += h; atrasadasN++; return; }
        const wk = semanas.find(s => prazo >= s.ini && prazo < s.fim);
        if (wk) { wk.horas += h; wk.count++; }
      });
      const tlLabels = ['Atrasadas', ...semanas.map(s => s.label)];
      const tlData   = [atrasadasH, ...semanas.map(s => s.horas)];
      const tlCounts = [atrasadasN, ...semanas.map(s => s.count)];

      // _upsertChart reusa instâncias do mesmo canvas; cria/destroi
      // só quando o ctx muda (ex: x-if remontou o DOM).

      const horizBarOpts = {
        ...baseOpts, indexAxis: 'y',
        scales: {
          x: { ...baseOpts.scales.x, beginAtZero: true },
          y: { ...baseOpts.scales.y, grid: { display: false } },
        },
        plugins: {
          ...baseOpts.plugins,
          tooltip: {
            ...baseOpts.plugins.tooltip,
            callbacks: { label: (c) => c.parsed.x + 'h' }
          }
        }
      };

      const ctxC = document.getElementById('chartClientes');
      if (ctxC) {
        this._upsertChart('clientes', ctxC, {
          type: 'bar',
          data: {
            labels: cliEntries.map(e => e[0]),
            datasets: [{ data: cliEntries.map(e => e[1]), backgroundColor: palette.brand, borderRadius: 4, barThickness: 22 }]
          },
          options: horizBarOpts,
        });
      }

      // Carga por pessoa — operacional, sem expor cadastral.
      // Soma horas em ativas, destacando horas em tasks atrasadas.
      const cargaRows = [];
      const cargaMap = new Map();   // pessoaId → { horas, horasAtrasadas }
      for (const t of ativas) {
        if (!t.pessoaId) continue;
        let r = cargaMap.get(t.pessoaId);
        if (!r) { r = { horas: 0, horasAtrasadas: 0 }; cargaMap.set(t.pessoaId, r); }
        const h = this.effEsforco(t);
        r.horas += h;
        if (this.atrasada(t)) r.horasAtrasadas += h;
      }
      for (const p of this.pessoas) {
        if (p.role === ROLE.CLIENTE) continue;
        const r = cargaMap.get(p.id);
        if (!r || r.horas === 0) continue;
        cargaRows.push({ nome: p.nome, horas: r.horas, horasAtrasadas: r.horasAtrasadas });
      }
      cargaRows.sort((a, b) => b.horas - a.horas);
      const ctxCarga = document.getElementById('chartCargaPessoa');
      if (ctxCarga && cargaRows.length) {
        this._upsertChart('cargaPessoa', ctxCarga, {
          type: 'bar',
          data: {
            labels: cargaRows.map(r => r.nome),
            datasets: [
              {
                label: 'Horas no prazo',
                data: cargaRows.map(r => Math.max(0, r.horas - r.horasAtrasadas)),
                backgroundColor: palette.brand,
                borderRadius: { topLeft: 4, bottomLeft: 4 },
                barThickness: 22,
                stack: 's',
              },
              {
                label: 'Horas em atrasadas',
                data: cargaRows.map(r => r.horasAtrasadas),
                backgroundColor: palette.danger,
                borderRadius: { topRight: 4, bottomRight: 4 },
                barThickness: 22,
                stack: 's',
              },
            ],
          },
          options: {
            ...baseOpts, indexAxis: 'y',
            scales: {
              x: { ...baseOpts.scales.x, beginAtZero: true, ticks: { ...baseOpts.scales.x.ticks, callback: (v) => v + 'h' } },
              y: { ...baseOpts.scales.y, grid: { display: false }, stacked: true },
            },
            plugins: {
              ...baseOpts.plugins,
              tooltip: {
                ...baseOpts.plugins.tooltip,
                callbacks: {
                  title: (items) => cargaRows[items[0].dataIndex].nome,
                  label: (c) => {
                    const r = cargaRows[c.dataIndex];
                    if (c.datasetIndex === 1 && r.horasAtrasadas > 0) return `Atrasadas: ${r.horasAtrasadas}h`;
                    if (c.datasetIndex === 0) return `Total: ${r.horas}h`;
                    return '';
                  },
                },
              },
            },
          },
        });
      }

      const ts = this.throughputSemanas;
      const ctxTh = document.getElementById('chartThroughput');
      if (ctxTh) {
        this._upsertChart('throughput', ctxTh, {
          type: 'bar',
          data: {
            labels: ts.map(s => s.label),
            datasets: [{
              data: ts.map(s => s.count),
              backgroundColor: ts.map((_, i) => i === ts.length - 1 ? palette.brandDark : palette.brand),
              borderRadius: 4, maxBarThickness: 36,
            }]
          },
          options: {
            ...baseOpts,
            plugins: {
              ...baseOpts.plugins,
              tooltip: {
                ...baseOpts.plugins.tooltip,
                callbacks: {
                  title: (items) => 'Semana de ' + ts[items[0].dataIndex].label,
                  label: (c) => c.parsed.y + ' tarefa(s) concluída(s)',
                }
              }
            },
            scales: {
              x: baseOpts.scales.x,
              y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, stepSize: 1, precision: 0 } }
            }
          }
        });
      }

      const ctxT = document.getElementById('chartTimeline');
      if (ctxT) {
        this._upsertChart('timeline', ctxT, {
          type: 'bar',
          data: {
            labels: tlLabels,
            datasets: [{
              data: tlData,
              backgroundColor: tlLabels.map((_,i) => i === 0 ? palette.danger : palette.brand),
              borderRadius: 4, maxBarThickness: 36,
            }]
          },
          options: {
            ...baseOpts,
            plugins: {
              ...baseOpts.plugins,
              tooltip: {
                ...baseOpts.plugins.tooltip,
                callbacks: {
                  title: (items) => {
                    const i = items[0].dataIndex;
                    if (i === 0) return 'Atrasadas';
                    const s = semanas[i-1];
                    const fim = new Date(s.fim); fim.setDate(fim.getDate()-1);
                    return 'Semana de ' + fmtSem(s.ini) + ' a ' + fmtSem(fim);
                  },
                  label: (c) => tlCounts[c.dataIndex] + ' tarefa(s) · ' + c.parsed.y + 'h',
                }
              }
            },
            scales: {
              x: baseOpts.scales.x,
              y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: (v) => v + 'h' } }
            }
          }
        });
      }

      const ltRows = this.leadTimePorCliente;
      const ctxLT = document.getElementById('chartLeadTime');
      if (ctxLT && ltRows.length) {
        this._upsertChart('leadtime', ctxLT, {
          type: 'bar',
          data: {
            labels: ltRows.map(r => r.cliente),
            datasets: [{
              data: ltRows.map(r => r.leadDays),
              backgroundColor: palette.info,
              borderRadius: 4, barThickness: 22,
            }]
          },
          options: {
            ...horizBarOpts,
            plugins: {
              ...baseOpts.plugins,
              tooltip: {
                ...baseOpts.plugins.tooltip,
                callbacks: {
                  title: (items) => ltRows[items[0].dataIndex].cliente,
                  label: (c) => {
                    const r = ltRows[c.dataIndex];
                    return `${r.leadDays}d · ${r.count} tarefa(s)`;
                  }
                }
              }
            },
            scales: {
              ...horizBarOpts.scales,
              x: { ...horizBarOpts.scales.x, ticks: { ...baseOpts.scales.x.ticks, callback: (v) => v + 'd' } },
            }
          }
        });
      }

    },

    // ===================== MODAL TAREFA =====================
    openNew() {
      this.editing = this.blankTask();
      this.editing.checklist = [];
      this.checklistOpen = false;
      this.editingCommentId = '';
      this.editingCommentDraft = '';
      this.editingComments = [];
      this.editingHistory = [];
      this.editingAttachments = [];
      this.attachmentUrls = {};
      this.newComment = '';
      this.replyingToId = '';
      this.newReply = '';
      this.newDepId = '';
      this.modal = true;
      this.$nextTick(() => this.$refs.tituloInput && this.$refs.tituloInput.focus());
    },
    openEdit(t) {
      this.editing = JSON.parse(JSON.stringify(t));
      this.editing.tempoRealHoras = this.editing.tempoRealHoras == null ? '' : this.editing.tempoRealHoras;
      this.editing.dependencias = [...this.getDependencias(t.id)];
      if (!Array.isArray(this.editing.checklist)) this.editing.checklist = [];
      this.checklistOpen = this.editing.checklist.length > 0;
      this.editingCommentId = '';
      this.editingCommentDraft = '';
      this.newDepId = '';
      this.editingComments = [];
      this.editingHistory = [];
      this.editingAttachments = [];
      this.attachmentUrls = {};
      this.newComment = '';
      this.replyingToId = '';
      this.newReply = '';
      // Autosave: reseta estado ao abrir. Watcher inicial dispara um "dirty" falso porque
      // editing muda inteiro — supressamos limpando o timer logo após o tick.
      this.saveState = 'saved';
      this.lastSavedAt = Date.now();
      this.modalTab = this.isMobileViewport ? 'detalhes' : 'conversa';
      clearTimeout(this._autosaveTimer);
      this.$nextTick(() => { clearTimeout(this._autosaveTimer); this.saveState = 'saved'; });
      this.modal = true;
      this.loadComments(t.id);
      this.loadHistory(t.id);
      this.loadAttachments(t.id);
      // Lazy: descricao não vem no boot (column projection). Puxa só agora.
      if (this.editing.descricao === undefined) this.loadDescricao(t.id);
    },
    async loadDescricao(taskId) {
      const { data, error } = await sb.from('tasks').select('descricao').eq('id', taskId).single();
      if (error) return;
      const desc = (data && data.descricao) || '';
      // Atualiza editing se ainda for a mesma task; e patcha this.tasks cache.
      if (this.editing && this.editing.id === taskId) this.editing.descricao = desc;
      const cached = this.tasksById.get(taskId);
      if (cached) cached.descricao = desc;
    },
    async postComment() {
      const body = (this.newComment || '').trim();
      if (!body || !this.editing.id) return;
      this.track('comment_post', { public: !!this.newCommentPublico, has_mention: /@/.test(body) });
      const author = (this.currentPessoa && this.currentPessoa.nome) || 'app';
      const authorPessoaId = (this.currentPessoa && this.currentPessoa.id) || null;
      const visivel = !!this.newCommentPublico;
      const tempId = 'tmp-' + Math.random().toString(36).slice(2, 8);
      const optimistic = {
        id: tempId, author, body,
        author_pessoa_id: authorPessoaId,
        external_source: null, posted_em: null,
        criado_em: new Date().toISOString(),
        visivel_cliente: visivel, from_cliente: false,
      };
      this.editingComments = [optimistic, ...this.editingComments];
      this.newComment = '';
      const { data, error } = await sb.from('task_comments')
        .insert({ task_id: this.editing.id, author, body, author_pessoa_id: authorPessoaId, visivel_cliente: visivel, from_cliente: false })
        .select('id, author, body, author_pessoa_id, external_source, posted_em, criado_em, visivel_cliente, from_cliente')
        .single();
      if (error) {
        this.editingComments = this.editingComments.filter(c => c.id !== tempId);
        this.newComment = body;
        this.toast('error', 'Erro ao comentar: ' + error.message);
        return;
      }
      // Substitui temp pelo registro real (realtime também trariam, mas evita duplicar visual)
      this.editingComments = this.editingComments.map(c => c.id === tempId ? data : c);
      // Notificações: mentions + dono da task (se outro)
      try {
        await this._notifyMentions(this.editing.id, data.id, body);
        const owner = this.editing.pessoaId;
        if (owner) await this._notifyCommentOnTaskOwner(this.editing.id, data.id, body, owner);
      } catch (e) { console.warn('[notif] postComment notify failed:', e); }
    },
    async loadHistory(taskId) {
      if (!taskId) { this.editingHistory = []; return; }
      const [s, f] = await Promise.all([
        sb.from('task_status_history')
          .select('id, from_status, to_status, actor_pessoa_id, actor_source, occurred_at')
          .eq('task_id', taskId),
        sb.from('task_field_history')
          .select('id, field, from_value, to_value, actor_pessoa_id, actor_source, occurred_at')
          .eq('task_id', taskId),
      ]);
      const status = (s.data || []).map(r => ({ ...r, kind: 'status' }));
      const fields = (f.data || []).map(r => ({ ...r, kind: 'field' }));
      this.editingHistory = [...status, ...fields].sort(
        (a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)
      );
    },
    // === Autosave silencioso ===
    // Roda em paralelo ao saveTask() do botão. NÃO fecha modal, NÃO toasta sucesso,
    // só atualiza o indicador. Reaproveita saveTask({ silent: true }).
    async autosaveTaskNow() {
      if (!this.modal) return;
      if (!this.editing || !this.editing.id) return;
      if (!this.editing.titulo || !this.editing.titulo.trim()) return;
      const seq = ++this._autosaveSeq;
      this.saveState = 'saving';
      try {
        await this.saveTask({ silent: true });
        // Ignora resposta stale (outra mutação já disparou save)
        if (seq !== this._autosaveSeq) return;
        this.saveState = 'saved';
        this.lastSavedAt = Date.now();
      } catch (err) {
        if (seq !== this._autosaveSeq) return;
        this.saveState = 'error';
        console.warn('[autosave] falhou:', err);
      }
    },
    // String "salvo · há Ns" para o indicador. Reativa via lastSavedAt + tick implícito do Alpine.
    autosaveLabel() {
      if (this.saveState === 'saving') return 'salvando…';
      if (this.saveState === 'dirty')  return 'editando…';
      if (this.saveState === 'error')  return 'falhou · tentar de novo';
      if (this.saveState === 'saved' && this.lastSavedAt) {
        const s = Math.max(0, Math.round((Date.now() - this.lastSavedAt) / 1000));
        if (s < 3)   return 'salvo · agora';
        if (s < 60)  return 'salvo · há ' + s + 's';
        const m = Math.round(s / 60);
        return 'salvo · há ' + m + 'min';
      }
      return 'autosave ativo';
    },
    async saveTask(opts) {
      const silent = !!(opts && opts.silent);
      const e = this.editing;
      if (!e.titulo || !e.titulo.trim()) {
        if (!silent) this.toast('error', 'Dê um título à tarefa.');
        return;
      }
      this.track(e.id ? 'task_edit' : 'task_create', { subetapa: e.subetapa, prioridade: e.prioridade });
      e.titulo = e.titulo.trim();
      e.esforco = +e.esforco || 0;
      // Status (macro) é derivado da subetapa.
      e.subetapa = e.subetapa || 'backlog';
      e.status = this.SUB_TO_MACRO[e.subetapa] || 'backlog';
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const payload = taskToDb(e);

      if (e.id) {
        // Optimistic update: aplica local antes do round-trip.
        const i = this.tasks.findIndex(t => t.id === e.id);
        const prev = i >= 0 ? this.tasks[i] : null;
        const subChanged    = prev && prev.subetapa !== e.subetapa;
        const statusChanged = prev && prev.status   !== e.status;
        if (i >= 0) {
          if (subChanged)    payload.subetapa_em = nowIso;
          if (statusChanged) payload.status_em   = nowIso;
          this.tasks[i] = {
            ...prev,
            titulo: e.titulo, descricao: e.descricao || '',
            clienteId: e.clienteId, projetoId: e.projetoId, pessoaId: e.pessoaId,
            prioridade: e.prioridade, esforco: +e.esforco || 0,
            prazo: e.prazo || '', status: e.status, subetapa: e.subetapa,
            complexidade: e.complexidade || 'media',
            bloqueadoPor: e.subetapa === 'bloqueado' ? (e.bloqueadoPor || '') : '',
            visivelCliente: e.visivelCliente !== false,
            tags: Array.isArray(e.tags) ? [...e.tags] : [],
            checklist: Array.isArray(e.checklist) ? JSON.parse(JSON.stringify(e.checklist)) : [],
            tipoTrabalho: e.tipoTrabalho || '',
            tempoRealHoras: e.tempoRealHoras === '' || e.tempoRealHoras == null ? null : +e.tempoRealHoras,
            statusEm:   statusChanged ? nowMs : prev.statusEm,
            subetapaEm: subChanged    ? nowMs : prev.subetapaEm,
          };
        }
        // Autosave: NÃO fecha modal. Botão Salvar mantém comportamento antigo (fecha).
        if (!silent) this.modal = false;
        const { error } = await sb.from('tasks').update(payload).eq('id', e.id);
        if (error) {
          if (prev) this.tasks[i] = prev;
          if (!silent) this.toast('error', 'Erro ao salvar: ' + error.message);
          else throw new Error(error.message);
          return;
        }
        if (statusChanged) {
          await sb.from('task_status_history').insert({
            task_id: e.id, from_status: prev.status, to_status: e.status,
            actor_pessoa_id: this.currentPessoa ? this.currentPessoa.id : null,
            actor_source: 'app', occurred_at: nowIso,
          });
        }
        // Loga mudanças de campos não-status (prazo, esforço etc).
        await this._logFieldChanges(e.id, prev, e, nowIso);
        // Notifica novo responsável (assignment)
        try {
          if (prev && prev.pessoaId !== e.pessoaId) {
            await this._notifyAssignment(e.id, e.pessoaId, prev.pessoaId);
          }
        } catch (err) { console.warn('[notif] assignment notify failed:', err); }
        // Sincroniza dependências (diff vs prev)
        await this._syncDependencias(e.id, e.dependencias || []);
      } else {
        // Insert
        payload.status_em = nowIso;
        payload.subetapa_em = nowIso;
        if (!silent) this.modal = false;
        const { data, error } = await sb.from('tasks').insert(payload).select('*').single();
        if (error) {
          if (!silent) this.toast('error', 'Erro ao criar: ' + error.message);
          else throw new Error(error.message);
          return;
        }
        if (data && !this.tasks.some(t => t.id === data.id)) {
          this.tasks = [taskFromDb(data), ...this.tasks];
        }
        // Primeira entrada do histórico: criação
        if (data) {
          await sb.from('task_status_history').insert({
            task_id: data.id, from_status: null, to_status: data.status,
            actor_pessoa_id: this.currentPessoa ? this.currentPessoa.id : null,
            actor_source: 'app', occurred_at: nowIso,
          });
          await this._syncDependencias(data.id, e.dependencias || []);
        }
      }
    },
    // Compara prev vs next e insere uma row em task_field_history pra
    // cada campo rastreado que mudou. Status fica fora (já logado em
    // task_status_history).
    async _logFieldChanges(taskId, prev, next, nowIso) {
      if (!taskId || !prev || !next) return;
      const norm = (v) => v === '' || v == null ? null : String(v);
      const TRACKED = [
        ['prazo',          'prazo',           v => v || null],
        ['esforco',        'esforco',         v => v == null ? null : String(v)],
        ['prioridade',     'prioridade',      v => v || null],
        ['complexidade',   'complexidade',    v => v || null],
        ['pessoaId',       'pessoa',          v => v || null],
        ['subetapa',       'subetapa',        v => v || null],
        ['tipoTrabalho',   'tipo_trabalho',   v => v || null],
        ['tempoRealHoras', 'tempo_real_horas',v => v == null ? null : String(v)],
        ['bloqueadoPor',   'bloqueado_por',   v => v || null],
      ];
      const rows = [];
      const actor = this.currentPessoa ? this.currentPessoa.id : null;
      for (const [key, field, fmt] of TRACKED) {
        const fromV = fmt(prev[key]);
        const toV   = fmt(next[key]);
        if (norm(fromV) === norm(toV)) continue;
        rows.push({
          task_id: taskId, field,
          from_value: fromV, to_value: toV,
          actor_pessoa_id: actor, actor_source: 'app', occurred_at: nowIso,
        });
      }
      if (!rows.length) return;
      const { error } = await sb.from('task_field_history').insert(rows);
      if (error) console.warn('[history] field log failed:', error);
    },
    async _syncDependencias(taskId, dependeDeIds) {
      const wanted = new Set(dependeDeIds.filter(Boolean));
      const current = new Set(this.getDependencias(taskId));
      const toAdd = [...wanted].filter(id => !current.has(id));
      const toDel = [...current].filter(id => !wanted.has(id));
      if (toAdd.length) {
        const rows = toAdd.map(depende_de_id => ({ task_id: taskId, depende_de_id }));
        const { error } = await sb.from('task_dependencies').insert(rows);
        if (error) { this.toast('error', 'Erro ao salvar dependências: ' + error.message); return; }
      }
      for (const depId of toDel) {
        const { error } = await sb.from('task_dependencies').delete()
          .eq('task_id', taskId).eq('depende_de_id', depId);
        if (error) { this.toast('error', 'Erro ao remover dependência: ' + error.message); return; }
      }
      if (toAdd.length || toDel.length) {
        // Recarrega taskDeps pra refletir o estado novo
        const { data, error } = await sb.from('task_dependencies').select('task_id, depende_de_id');
        if (!error) this.taskDeps = data || [];
      }
    },
    addDependencia() {
      const id = this.newDepId;
      if (!id) return;
      if (this.editing.id && id === this.editing.id) {
        this.toast('error', 'Tarefa não pode depender de si mesma.');
        this.newDepId = '';
        return;
      }
      this.editing.dependencias = this.editing.dependencias || [];
      if (!this.editing.dependencias.includes(id)) {
        this.editing.dependencias.push(id);
      }
      this.newDepId = '';
    },
    removeDependencia(id) {
      this.editing.dependencias = (this.editing.dependencias || []).filter(d => d !== id);
    },
    get _candidatesDependencia() {
      // Candidatos: tasks do mesmo cliente, exceto a própria e as já dependentes.
      const e = this.editing;
      if (!e) return [];
      const already = new Set(e.dependencias || []);
      return this._visibleTasks.filter(t =>
        t.id !== e.id &&
        !already.has(t.id) &&
        t.status !== STATUS.CONCLUIDO &&
        (!e.clienteId || t.clienteId === e.clienteId)
      );
    },
    async _purgeTaskStorage(id) {
      // Best-effort: lista anexos e tenta apagar do storage antes do DB cascade limpar as rows.
      // Se falhar, o cron cleanup-attachments pega os órfãos depois.
      try {
        const { data } = await sb.from('task_attachments').select('storage_path').eq('task_id', id);
        const paths = (data || []).map(a => a.storage_path).filter(Boolean);
        if (paths.length) await sb.storage.from('task-attachments').remove(paths);
      } catch (_) {}
    },
    deleteTask() {
      this.askConfirm('Excluir esta tarefa? Esta ação não pode ser desfeita.', async () => {
        const id = this.editing.id;
        const i = this.tasks.findIndex(t => t.id === id);
        const prev = i >= 0 ? this.tasks[i] : null;
        if (i >= 0) this.tasks.splice(i, 1);
        this.modal = false;
        await this._purgeTaskStorage(id);
        const { error } = await sb.from('tasks').delete().eq('id', id);
        if (error) {
          if (prev) this.tasks.splice(i, 0, prev);
          this.toast('error', 'Erro ao excluir: ' + error.message);
        }
      });
    },
    deleteTaskById(id) {
      const t = this.tasksById.get(id);
      if (!t) return;
      this.askConfirm(`Excluir "${t.titulo}"?`, async () => {
        const i = this.tasks.findIndex(x => x.id === id);
        const prev = this.tasks[i];
        this.tasks.splice(i, 1);
        await this._purgeTaskStorage(id);
        const { error } = await sb.from('tasks').delete().eq('id', id);
        if (error) {
          this.tasks.splice(i, 0, prev);
          this.toast('error', 'Erro ao excluir: ' + error.message);
        }
      });
    },

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
      if (!e || !e.id) return;
      const nome = (e.nome || '').trim();
      if (!nome) { this.toast('error', 'Nome obrigatório.'); return; }
      const payload = { nome, tier: e.tier || null };
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
      if (!e || !e.id) return;
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
