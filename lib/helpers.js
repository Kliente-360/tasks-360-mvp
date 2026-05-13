/* ============ tasks 360 · helpers puros ============
 * Funções e constantes sem dependência de DOM, Alpine ou Supabase.
 * Carregadas ANTES do script inline em index.html (e por tests/index.html).
 * Tudo é exposto em window pra Alpine x-show/x-text usar nos mesmos símbolos.
 * ====================================================
 */

(function () {
  'use strict';

  // ============ VERSIONAMENTO ============
  // Formato: vMAJOR.MINOR.BUILD
  //   MAJOR (1 dígito):  era arquitetural. 1 = protótipo single-file.
  //                      Vira 2 quando migrar pra stack definitiva (Next.js).
  //   MINOR (2 dígitos): bloco de releases dentro da era. Bumpa em mudanças
  //                      grandes de UX/dados (ex: nova aba, novo modelo).
  //   BUILD (3 dígitos): contador de PRs mergeados em main. Bumpa em todo
  //                      merge. Forma uma linha do tempo verificável.
  //
  // BUMPAR manualmente nesse arquivo a cada merge em main. Convenção:
  //   - PR funcional/técnico/doc: BUILD += 1
  //   - Quebra de fluxo perceptível ao usuário: MINOR += 1, BUILD reseta
  //   - Saída do single-file: MAJOR = 2, MINOR = 00, BUILD = 001
  const APP_VERSION = 'v1.01.198';

  // ---------- Constantes do domínio ----------
  const STATUS = Object.freeze({
    BACKLOG: 'backlog', ANDAMENTO: 'andamento', BLOQUEADO: 'bloqueado', CONCLUIDO: 'concluido',
  });
  const ROLE = Object.freeze({ ADMIN: 'admin', INTERNO: 'interno', CLIENTE: 'cliente' });
  const TIER = Object.freeze({ ESTRATEGICO: 'estrategico', POTENCIAL: 'potencial', DESCOBERTA: 'descoberta' });
  const PRIORIDADE = Object.freeze({ P0: 'P0', P1: 'P1', P2: 'P2', P3: 'P3' });
  const SEVERIDADE = Object.freeze({ ALTA: 'alta', MEDIA: 'media', BAIXA: 'baixa' });
  const SIGNAL = Object.freeze({ VERDE: 'verde', AMARELO: 'amarelo', VERMELHO: 'vermelho' });
  const CARGA_NIVEL = Object.freeze({
    SOBRECARGA: 'sobrecarga', PRESSAO: 'pressao', OK: 'ok', FOLGA: 'folga', SEM_CAP: 'sem-cap',
  });

  // ---------- Tag / skill ----------
  // Normaliza string pra slug curto (lowercase, hífen, máx 24 chars).
  function normalizeTag(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24);
  }

  // Filtra vocabulário pelo input; ordena por startsWith depois includes;
  // exclui os já selecionados; limita a 12.
  function suggest(input, all, current) {
    const q = String(input || '').trim().toLowerCase();
    const cur = new Set(current || []);
    const filt = (all || []).filter(t => !cur.has(t));
    if (!q) return filt.slice(0, 12);
    const startsWith = filt.filter(t => t.startsWith(q));
    const contains   = filt.filter(t => !t.startsWith(q) && t.includes(q));
    return [...startsWith, ...contains].slice(0, 12);
  }

  // ---------- Data / prazo ----------
  // Formata ISO date 'YYYY-MM-DD' como 'DD/MM/YYYY'.
  function fmtDate(d) {
    if (!d) return '—';
    const [y, m, da] = d.split('-');
    return `${da}/${m}/${y}`;
  }
  function fmtDateShort(d) {
    if (!d) return '—';
    const [y, m, da] = d.split('-');
    return `${da}/${m}`;
  }

  // Task atrasada: tem prazo, não está concluída, prazo < hoje.
  // Param `today` opcional pra teste determinístico (default = hoje real).
  function atrasada(t, today) {
    if (!t || !t.prazo) return false;
    if (t.status === STATUS.CONCLUIDO) return false;
    const ref = today || new Date().toISOString().slice(0, 10);
    return t.prazo < ref;
  }

  // ---------- Carga por capacidade ----------
  // Classifica nível de carga pela % de capacidade alocada.
  // null/undefined → 'sem-cap'. >130% sobrecarga, >100% pressão, <60% folga.
  function cargaNivelFromPctCap(pctCap) {
    if (pctCap == null) return CARGA_NIVEL.SEM_CAP;
    if (pctCap > 130)   return CARGA_NIVEL.SOBRECARGA;
    if (pctCap > 100)   return CARGA_NIVEL.PRESSAO;
    if (pctCap < 60)    return CARGA_NIVEL.FOLGA;
    return CARGA_NIVEL.OK;
  }

  // ---------- Esforço efetivo ----------
  // Quando esforço não foi declarado (0), assume 4h pra capacidade/analytics.
  function effEsforco(t) {
    const e = Number(t && t.esforco) || 0;
    return e > 0 ? e : 4;
  }

  // ---------- Triagem ----------
  // Rank das subetapas pra detectar tasks "incompletas" em etapa avançada.
  // bloqueado/concluido = -1 (não aplica triagem).
  const STAGE_RANK = Object.freeze({
    backlog: 0, em_definicao: 1,
    priorizado: 2, escopo_definido: 3,
    em_desenvolvimento: 4, em_homologacao: 5, em_revisao: 6,
    pronto_producao: 7, em_implantacao: 8,
    bloqueado: -1, concluido: -1,
  });

  // Lista o que falta na task pra estar "triada". Vazio = ok.
  // Pure: usa só os campos da task + STATUS/STAGE_RANK (sem this).
  function triageFailures(t) {
    if (!t || t.status === STATUS.CONCLUIDO) return [];
    const rank = STAGE_RANK[t.subetapa] ?? 0;
    const out = [];
    if (!t.pessoaId)                          out.push('sem responsável');
    if (!t.clienteId)                         out.push('sem cliente');
    if (rank >= 2 && !t.prazo)                out.push('sem prazo');
    if (rank >= 4 && !(+t.esforco))           out.push('sem esforço');
    return out;
  }
  function needsTriage(t) { return triageFailures(t).length > 0; }

  // Calcula tamanho de task a partir do esforço efetivo.
  // <2h mini, <8h small, <24h medio, <80h grande, senão mini_projeto.
  function effTamanho(t) {
    const h = effEsforco(t);
    if (h < 2)  return 'mini';
    if (h < 8)  return 'small';
    if (h < 24) return 'medio';
    if (h < 80) return 'grande';
    return 'mini_projeto';
  }

  // ---------- Bucketing semanal (análise de capacidade 4 semanas) ----------
  // Toda análise de capacidade usa "semana ISO" começando na segunda-feira.
  // Funções abaixo são puras (today opcional pra teste determinístico).

  // ISO 'YYYY-MM-DD' da segunda-feira da semana de `d` (Date ou ISO).
  function weekStartMonday(d) {
    const dt = (d instanceof Date) ? new Date(d.getTime()) : new Date(d + 'T00:00:00');
    const day = dt.getDay();                              // 0 dom, 1 seg, ..., 6 sab
    const diff = (day === 0 ? -6 : 1 - day);              // dom volta 6 dias; resto até segunda
    dt.setDate(dt.getDate() + diff);
    return dt.toISOString().slice(0, 10);
  }

  // Soma N dias a uma ISO date.
  function addDays(iso, n) {
    const dt = new Date(iso + 'T00:00:00');
    dt.setDate(dt.getDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  // Prazo "pra análise": se task tem prazo usa, senão default = semana atual.
  // NÃO escreve no campo — só usado em agregação semanal.
  function effPrazoForAnalysis(t, today) {
    if (t && t.prazo) return t.prazo;
    const ref = today || new Date().toISOString().slice(0, 10);
    return ref;
  }

  // Índice da semana em que a task cai, contando a partir da semana atual:
  //   -1  → atrasada (segunda-feira do prazo < segunda-feira de hoje)
  //    0  → esta semana
  //    1..3 → próximas 3 semanas
  //    null → mais distante que 4 semanas (fora da janela de análise)
  // Tasks concluídas retornam null (não entram na análise prospectiva).
  function taskWeekIndex(t, today) {
    if (!t || t.status === STATUS.CONCLUIDO) return null;
    const ref = today || new Date().toISOString().slice(0, 10);
    const monRef  = weekStartMonday(ref);
    const monTask = weekStartMonday(effPrazoForAnalysis(t, ref));
    if (monTask < monRef) return -1;
    // Diff em dias / 7. Usa diff de timestamps em UTC pra evitar DST.
    const ms = new Date(monTask + 'T00:00:00Z').getTime() - new Date(monRef + 'T00:00:00Z').getTime();
    const weeks = Math.round(ms / (7 * 86400 * 1000));
    if (weeks < 0) return -1;
    if (weeks > 3) return null;
    return weeks;
  }

  // Bucketiza array de tasks em [W0, W1, W2, W3] + atrasadas.
  // Cada bucket é array de tasks. Retorna { past, w0, w1, w2, w3, far }.
  function bucketTasksByWeek(tasks, today) {
    const out = { past: [], w0: [], w1: [], w2: [], w3: [], far: [] };
    for (const t of (tasks || [])) {
      const idx = taskWeekIndex(t, today);
      if (idx === -1) out.past.push(t);
      else if (idx === 0) out.w0.push(t);
      else if (idx === 1) out.w1.push(t);
      else if (idx === 2) out.w2.push(t);
      else if (idx === 3) out.w3.push(t);
      else out.far.push(t);
    }
    return out;
  }

  // Soma de esforço efetivo num bucket de tasks.
  function sumEffEsforco(tasks) {
    return (tasks || []).reduce((acc, t) => acc + effEsforco(t), 0);
  }

  // Capacidade contratada da semana pra um projeto (depende do tipo):
  //   sustentacao → orcamento_horas / 4   (mensal contratado)
  //   projeto     → orcamento_horas       (escopo total fechado; semanal não aplica)
  //   discovery   → null (ignorado em heurística)
  //   sem tipo    → null
  function projetoCapacidadeSemana(projeto) {
    if (!projeto) return null;
    const orc = Number(projeto.orcamentoHoras) || 0;
    if (!orc) return null;
    if (projeto.tipo === 'sustentacao') return orc / 4;
    return null;  // 'projeto' usa escopo total, não semanal; 'discovery' ignora
  }

  // Expõe em window pra Alpine + tests acessarem com mesmo símbolo.
  Object.assign(window, {
    APP_VERSION,
    STATUS, ROLE, TIER, PRIORIDADE, SEVERIDADE, SIGNAL, CARGA_NIVEL, STAGE_RANK,
    normalizeTag, suggest, fmtDate, fmtDateShort, atrasada,
    cargaNivelFromPctCap, effEsforco, effTamanho,
    triageFailures, needsTriage,
    weekStartMonday, addDays, effPrazoForAnalysis,
    taskWeekIndex, bucketTasksByWeek, sumEffEsforco,
    projetoCapacidadeSemana,
  });
})();
