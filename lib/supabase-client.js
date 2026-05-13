/* ============ tasks 360 · Supabase client ============
 * Inicializa o cliente Supabase e o toggle de auth. Expostos em window
 * pra app.js usar. Carregado APÓS supabase-js (que define `window.supabase`)
 * mas pode ser antes ou depois de helpers.js/adapters.js.
 *
 * Anon key é PÚBLICA por design — segurança vem da RLS definida em
 * supabase/migrations/applied/. Service-role key NUNCA aqui.
 * =====================================================
 */

(function () {
  'use strict';

  const SUPABASE_URL      = 'https://nxtlipldmsopscpshrfd.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54dGxpcGxkbXNvcHNjcHNocmZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDQzOTcsImV4cCI6MjA5MzY4MDM5N30.4FXSioyUTidsHkhCIsq8CfoPgnbgW1rXROfCDdJcMqM';

  // Toggle pra ligar/desligar login. false = app aberto a quem
  // abrir o link (sem login). true = magic link + lista fechada.
  // Histórico de status continua sendo registrado (sem autor) qdo desligado.
  const AUTH_ENABLED = true;

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  Object.assign(window, { SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_ENABLED, sb });
})();
