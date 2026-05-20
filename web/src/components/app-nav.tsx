'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { useData } from '@/lib/data-store';

const APP_VERSION = 'v1.02.098';

/** Barra de navegação superior — espelha o header do app Alpine. */
export function AppNav() {
  const pathname = usePathname();
  const { refreshAll, loading } = useData();

  return (
    <header
      className="bg-elev border-b border-line sticky top-0 z-40"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Top row: logo + actions */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-3">
        {/* Logo · click dispara refetch (mesmo gesto do app Alpine). */}
        <button
          type="button"
          onClick={() => refreshAll()}
          className="flex items-center gap-3 min-w-0 text-left hover:opacity-80 transition-opacity"
          title="Recarregar dados"
          aria-label="Recarregar dados"
        >
          <div className="k360-mark">
            <span /><span /><span /><span />
          </div>
          <div className="leading-none min-w-0 text-left">
            <div className="font-brand text-[18px] md:text-[22px] font-semibold text-brand">
              tasks 360{loading ? ' …' : ''}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted mt-1 truncate font-mono">
              {APP_VERSION}
            </div>
          </div>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-px h-6 bg-line mx-1 md:mx-2 hidden md:block" />
          <Link
            href="/backlog"
            className="btn btn-primary btn-fixed-w text-xs hidden md:inline-flex"
          >
            + task
          </Link>
        </div>
      </div>

      {/* Desktop: tab row */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 tabs-row hidden md:flex">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('tab', active && 'active')}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Mobile: current tab label */}
      <div className="md:hidden border-t border-line">
        <div className="px-4 py-3 font-brand font-semibold text-sm text-ink">
          {NAV.find((n) => pathname.startsWith(n.href))?.label ?? 'tasks 360'}
        </div>
      </div>
    </header>
  );
}
