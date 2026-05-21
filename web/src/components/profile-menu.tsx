'use client';

/**
 * Profile menu — Onda 0 · 4.A
 *
 * Avatar com inicial do nome no canto direito do header. Click abre
 * dropdown com:
 *   - "logado como" / nome / email
 *   - Cadastros (admin) — moveu pra cá pq sai da tab bar
 *   - Onboarding (placeholder, vem no 4.C)
 *   - Tema (placeholder, vem no 4.D)
 *   - Ajuda / Manual (placeholder, vem no 4.B)
 *   - Exportar CSV / PDF (placeholders, vem no 4.F)
 *   - Sair (auth.signOut + redirect via middleware)
 *
 * Cada placeholder fica desabilitado com tooltip "em breve" pra o
 * usuário ver onde a feature vai morar quando entrar.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useData } from '@/lib/data-store';
import { createClient } from '@/lib/supabase/client';
import { NAV } from '@/lib/nav';
import { HelpMenuItem } from '@/components/help-modal';
import { OnboardingMenuItem } from '@/components/onboarding-modal';

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { currentPessoa, viewerRole } = useData();
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!sbRef.current) sbRef.current = createClient();
  const sb = sbRef.current;

  // Fecha ao clicar fora — usa um overlay invisível.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const initial = (currentPessoa?.nome ?? '?').charAt(0).toUpperCase();
  const isAdmin = viewerRole === 'admin';
  const isCliente = viewerRole === 'cliente';

  const signOut = async () => {
    await sb.auth.signOut();
    setOpen(false);
    router.replace('/login');
  };

  const profileItems = NAV.filter((n) => n.inProfileMenu && n.roles.includes(viewerRole ?? 'interno'));

  return (
    <div className="relative">
      <button
        type="button"
        className="btn btn-ghost btn-icon text-xs"
        onClick={() => setOpen((v) => !v)}
        title={currentPessoa?.nome ?? 'Conta'}
        aria-label="Conta"
        aria-expanded={open}
      >
        <span className="w-6 h-6 rounded-full bg-brand-soft text-brand font-brand font-semibold text-xs flex items-center justify-center">
          {initial}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="fixed md:absolute top-14 md:top-full right-3 md:right-0 mt-0 md:mt-1 bg-elev border border-line rounded-md shadow-xl py-2 w-[260px] max-w-[calc(100vw-24px)] md:w-[260px] z-40"
          >
            <div className="px-3 py-1 text-xs text-muted">logado como</div>
            <div className="px-3 pb-1 text-sm font-medium text-ink truncate">
              {currentPessoa?.nome ?? '—'}
            </div>
            <div className="px-3 pb-2 text-[11px] text-muted font-mono truncate">
              {currentPessoa?.email ?? ''}
            </div>

            {/* Itens mobile-only — exportar (no desktop fica no header
                como ícone separado, vem no 4.F). Por ora, placeholders. */}
            {!isCliente && (
              <>
                <div className="border-t border-line my-1" />
                <MenuItem disabled label="Exportar CSV" hint="em breve · 4.F" />
                <MenuItem disabled label="Exportar PDF" hint="em breve · 4.F" />
              </>
            )}

            <div className="border-t border-line my-1" />
            <MenuItem
              disabled
              label="Tema"
              hint="em breve · 4.D"
              right={<span className="text-muted text-xs whitespace-nowrap">claro</span>}
            />
            {/* Mobile only: no desktop o trigger é o ícone "?" do header. */}
            <div className="md:hidden">
              <HelpMenuItem onClick={() => setOpen(false)} />
            </div>

            {!isCliente && (
              <>
                <div className="border-t border-line my-1" />
                {profileItems.map((item) => (
                  <MenuButton
                    key={item.href}
                    label={item.label}
                    onClick={() => {
                      setOpen(false);
                      router.push(item.href);
                    }}
                  />
                ))}
                {isAdmin && <OnboardingMenuItem onClick={() => setOpen(false)} />}
              </>
            )}

            <div className="border-t border-line my-1" />
            <button
              type="button"
              className="block w-full text-left px-3 py-2 text-sm hover:bg-brand-tint"
              onClick={signOut}
            >
              sair
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-brand-tint"
    >
      <span>{label}</span>
    </button>
  );
}

function MenuItem({
  label,
  hint,
  right,
  disabled,
}: {
  label: string;
  hint?: string;
  right?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-sm ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-brand-tint cursor-pointer'
      }`}
      title={disabled ? hint : undefined}
    >
      <span>{label}</span>
      {right ?? (hint && <span className="text-muted text-xs whitespace-nowrap">{hint}</span>)}
    </div>
  );
}
