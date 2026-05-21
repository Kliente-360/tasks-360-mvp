'use client';

/**
 * Placeholders pros ícones do header — Export ainda placeholder até 4.F.
 * Notif virou componente próprio (notif-bell.tsx) no 4.E.
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
