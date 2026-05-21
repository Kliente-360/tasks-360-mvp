'use client';

/**
 * Splash overlay — Onda 0 · 4.I
 *
 * Cobre a tela enquanto o boot do DataProvider roda. Layout precisa bater
 * EXATAMENTE com o apple-touch-startup-image (gerado em generate-splash.mjs)
 * pra evitar "salto" quando o iOS troca o splash nativo pelo overlay React.
 *
 * Fórmulas espelham o gerador:
 *   min        = Math.min(innerWidth, innerHeight)
 *   markSize   = min * 0.075
 *   fontSize   = min * 0.052
 *   gap        = min * 0.032
 *
 * MIN_VISIBLE_MS garante continuidade visual mesmo se o boot resolver
 * instantâneo (data cache, navegação client-side).
 */

import { useEffect, useState } from 'react';
import { useData } from '@/lib/data-store';

const MIN_VISIBLE_MS = 900;

export function AppSplash() {
  const { loading } = useData();
  const [mountTs] = useState<number>(() => Date.now());
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  // Dimensões calculadas no mount — espelham o gerador de apple-touch-startup-image.
  // Renderiza zerado até o efeito rodar pra evitar mismatch SSR/client.
  const [dims, setDims] = useState<{ mark: number; font: number; gap: number } | null>(null);

  useEffect(() => {
    const min = Math.min(window.innerWidth, window.innerHeight);
    setDims({
      mark: Math.round(min * 0.075),
      font: Math.round(min * 0.052),
      gap:  Math.round(min * 0.032),
    });
  }, []);

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

  // Dot do k360-mark inline (sem .k360-mark do CSS pra controlar tamanho exato).
  // 4 dots em diamante, raio = mark * 0.16, offset do centro = mark * 0.34.
  const mark = dims?.mark ?? 32;
  const dotR = mark * 0.16;
  const off  = mark * 0.34;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'var(--surface-1)',
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 250ms ease',
        pointerEvents: fadingOut ? 'none' : 'auto',
      }}
    >
      {dims && (
        <div className="flex items-center" style={{ gap: dims.gap }}>
          {/* k360-mark via SVG pra casar pixel-perfect com o splash iOS */}
          <svg
            width={mark}
            height={mark}
            viewBox={`0 0 ${mark} ${mark}`}
            style={{ display: 'block' }}
            aria-hidden
          >
            <g fill="var(--brand)">
              <circle cx={mark / 2}       cy={mark / 2 - off} r={dotR} />
              <circle cx={mark / 2 - off} cy={mark / 2}       r={dotR} />
              <circle cx={mark / 2 + off} cy={mark / 2}       r={dotR} />
              <circle cx={mark / 2}       cy={mark / 2 + off} r={dotR} />
            </g>
          </svg>
          <div
            className="font-mono text-brand"
            style={{
              fontSize: dims.font,
              fontWeight: 400,
              lineHeight: 1,
            }}
          >
            tasks 360
          </div>
        </div>
      )}
    </div>
  );
}
