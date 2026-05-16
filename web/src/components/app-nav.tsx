'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';

/** Barra de navegação superior. Gating por role entra na Onda 1. */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-line bg-bg-elev px-3 py-2">
      <span className="mr-3 font-brand text-sm font-bold text-brand">tasks 360</span>
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-brand-tint font-semibold text-brand-dark'
                : 'text-ink-soft hover:bg-brand-tint',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
