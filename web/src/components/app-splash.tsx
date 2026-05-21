'use client';

/**
 * Splash overlay — Onda 0 · 4.I
 *
 * Cobre a tela enquanto o boot do DataProvider roda.
 *
 * Anti-dança: usa o MESMO PNG do apple-touch-startup-image que o iOS já
 * mostrou. Antes a gente reproduzia o layout (mark + texto) em SVG no
 * browser, e a diferença de renderização entre @resvg (backend) e WebKit
 * (frontend) causava deslocamento sub-pixel visível. Mostrando o próprio
 * PNG, o handoff iOS → React é literal pixel-match.
 *
 * Seleção do PNG: pega o mais próximo do viewport físico
 * (innerWidth × devicePixelRatio), default = iPhone 14 Pro pra SSR.
 * Tema (light/dark) lido via prefers-color-scheme.
 *
 * MIN_VISIBLE_MS garante splash visível mesmo em boot instantâneo.
 */

import { useEffect, useState } from 'react';
import { useData } from '@/lib/data-store';

const MIN_VISIBLE_MS = 900;

// Sizes precisam casar com generate-splash.mjs.
const SPLASH_SIZES = [
  { w: 750,  h: 1334 },
  { w: 828,  h: 1792 },
  { w: 1125, h: 2436 },
  { w: 1170, h: 2532 },
  { w: 1179, h: 2556 }, // iPhone 15 Pro (default SSR)
  { w: 1284, h: 2778 },
  { w: 1290, h: 2796 },
  { w: 1668, h: 2388 },
  { w: 2048, h: 2732 },
];

function pickSplashUrl(): string {
  // SSR fallback: iPhone 15 Pro light. Sobrescrito no useEffect.
  if (typeof window === 'undefined') {
    return '/assets/splash/splash-1179x2556.png';
  }
  const dpr  = window.devicePixelRatio || 2;
  const tw   = window.innerWidth  * dpr;
  const th   = window.innerHeight * dpr;
  const best = SPLASH_SIZES.reduce((b, c) => {
    const dc = Math.abs(c.w - tw) + Math.abs(c.h - th);
    const db = Math.abs(b.w - tw) + Math.abs(b.h - th);
    return dc < db ? c : b;
  }, SPLASH_SIZES[0]);
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return `/assets/splash/splash-${best.w}x${best.h}${dark ? '-dark' : ''}.png`;
}

export function AppSplash() {
  const { loading } = useData();
  const [mountTs] = useState<number>(() => Date.now());
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const [src, setSrc] = useState<string>(() => pickSplashUrl());

  useEffect(() => {
    // Recalcula com window real (caso o SSR fallback não bata com o device).
    setSrc(pickSplashUrl());
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

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100]"
      style={{
        background: 'var(--bg)',
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 250ms ease',
        pointerEvents: fadingOut ? 'none' : 'auto',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
        }}
      />
    </div>
  );
}
