/* ============ tasks 360 · adapters JS <-> DB ============
 * Mapeamento declarativo entre campos camelCase do JS e snake_case do
 * Postgres. Pure functions — sem DOM, sem Alpine, sem Supabase.
 * Carregado ANTES de app.js (e expostos em window pra uso global).
 *
 * Padrão: cada entidade tem uma constante FIELDS (array de tuplas) e
 * funções derivadas `makeFromDb` / `makeToDb`. Adicionar coluna nova =
 * 1 linha no array correspondente.
 * ========================================================
 */

(function () {
  'use strict';

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
  boolFalse:{ from: r => r === true,                     to: t => t === true,                                 default: false },
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
  // `eh_interno`: bucket interno (ex: cliente "Kliente 360" pra tasks de gestão).
  // Excluído de heurísticas de carga, do Portal e do Briefing executivo.
  // Visível apenas para viewerRole = admin. Não pode ser excluído.
  ['ehInterno',    'eh_interno',   F.boolFalse],
  ['arquivadoEm',  'arquivado_em', { from: r => r || null, default: null }],
];
const clienteFromDb = makeFromDb(CLIENTE_FIELDS);

  // Expõe em window pra app.js + tests + Alpine usarem.
  Object.assign(window, {
    F, _resolve, makeFromDb, makeToDb, makeBlank,
    TASK_FIELDS, taskFromDb, taskToDb,
    PROJETO_FIELDS, projetoFromDb,
    CLIENTE_FIELDS, clienteFromDb,
  });
})();
