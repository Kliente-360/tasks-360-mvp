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
  const APP_VERSION = 'v1.01.164';

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

  // Expõe em window pra Alpine + tests acessarem com mesmo símbolo.
  Object.assign(window, {
    APP_VERSION,
    STATUS, ROLE, TIER, PRIORIDADE, SEVERIDADE, SIGNAL, CARGA_NIVEL, STAGE_RANK,
    normalizeTag, suggest, fmtDate, fmtDateShort, atrasada,
    cargaNivelFromPctCap, effEsforco, effTamanho,
    triageFailures, needsTriage,
  });
})();
