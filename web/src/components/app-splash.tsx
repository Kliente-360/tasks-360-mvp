'use client';

/**
 * Splash overlay — Onda 0 · 4.I (refinamento)
 *
 * Layout idêntico ao apple-touch-startup-image (k360-mark + "tasks 360"
 * em mono, brand verde, centralizado). Cobre a tela enquanto o boot do
 * DataProvider roda. Mínimo de 600ms garantido pra dar continuidade com
 * o splash do iOS — se o boot fechar antes, espera completar o min.
 *
 * Some com fade-out pra suavizar a transição.
 */

import { useEffect, useState } from 'react';
import { useData } from '@/lib/data-store';

const MIN_VISIBLE_MS = 900;

export function AppSplash() {
  const { loading } = useData();
  // Tempo desde mount — usado pra garantir minDelay mesmo se o boot
  // resolver instantâneo (data cache, navegação client-side).
  const [mountTs] = useState<number>(() => Date.now());
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (loading) return;
    const elapsed = Date.now() - mountTs;
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const fadeId = setTimeout(() => setFadingOut(true), delay);
    const hideId = setTimeout(() => setVisible(false), delay + 250);
    return () => {
      clearTimeout(fadeId);
      clearTimeout(hideId);
    };
  }, [loading, mountTs]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'var(--surface-1)', // branco em light, escuro em dark — bate com splash iOS
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 250ms ease',
        pointerEvents: fadingOut ? 'none' : 'auto',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="k360-mark" style={{ width: 28, height: 28 }}>
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="font-mono font-medium text-[22px] text-brand">tasks 360</div>
      </div>
    </div>
  );
}
