'use client';

/**
 * Placeholders pros ícones do header — substituídos quando os
 * respectivos blocos entrarem (4.E notif, 4.F export).
 *
 * Visual mantém o mesmo .btn-ghost btn-icon do Help/Tema pra layout
 * não saltar quando as features ligarem.
 */

import { useToastSafe } from '@/components/toast';

export function ExportIconButton() {
  const toast = useToastSafe();
  return (
    <button
      type="button"
      onClick={() => toast.info('Exportar entra no Bloco 4.F — em breve.')}
      className="btn btn-ghost btn-icon text-xs !hidden md:!inline-flex opacity-50"
      title="Exportar · 4.F"
      aria-label="Exportar"
    >
      ⤓
    </button>
  );
}

export function NotifIconButton() {
  const toast = useToastSafe();
  return (
    <button
      type="button"
      onClick={() => toast.info('Notificações entram no Bloco 4.E — em breve.')}
      className="btn btn-ghost btn-icon relative opacity-50"
      title="Notificações · 4.E"
      aria-label="Notificações"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    </button>
  );
}
