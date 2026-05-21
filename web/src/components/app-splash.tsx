'use client';

/**
 * Splash overlay — Onda 0 · 4.I
 *
 * Cobre a tela enquanto o boot do DataProvider roda. Layout precisa bater
 * EXATAMENTE com o apple-touch-startup-image (gerado em generate-splash.mjs)
 * pra não "dançar" quando o iOS troca o splash nativo pelo overlay React.
 *
 * Estratégia:
 *   - bg = var(--bg) (== --surface-2 == cor do body). Garante que, se o
 *     overlay desmontar antes do iOS dispensar (ou o iOS dispensar antes
 *     do overlay pintar), a cor embaixo é a mesma.
 *   - Logo renderizado via SVG inline com as MESMAS fórmulas do gerador:
 *       markSize = min*0.075, dotR = mark*0.16, offset = mark*0.34
 *       fontSize = min*0.052, gap = min*0.032
 *   - Texto também como SVG <text> (mesma técnica do gerador) pra reduzir
 *     diferença entre rendering resvg/browser.
 *
 * MIN_VISIBLE_MS garante que o splash fica visível por tempo legível
 * mesmo se o boot resolver instantâneo (cache, navegação client-side).
 */

import { useEffect, useState } from 'react';
import { useData } from '@/lib/data-store';

const MIN_VISIBLE_MS = 900;
const TEXT = 'tasks 360';

export function AppSplash() {
  const { loading } = useData();
  const [mountTs] = useState<number>(() => Date.now());
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  // Default = iPhone moderno (~390px) pra ter conteúdo no 1º paint mesmo
  // antes do useEffect rodar. Refinado no mount com window real.
  const [min, setMin] = useState<number>(390);

  useEffect(() => {
    setMin(Math.min(window.innerWidth, window.innerHeight));
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

  // Espelha o gerador (web/scripts/generate-splash.mjs)
  const markSize       = Math.round(min * 0.075);
  const dotR           = markSize * 0.16;
  const markHalfOffset = markSize * 0.34;
  const fontSize       = Math.round(min * 0.052);
  const gap            = Math.round(min * 0.032);

  // Texto: Plex Mono ≈ 0.6em por char (mesmo fator do gerador).
  const textWidth  = TEXT.length * fontSize * 0.6;
  const totalWidth = markSize + gap + textWidth;
  const svgH       = Math.max(markSize, fontSize) * 1.4;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'var(--bg)',
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 250ms ease',
        pointerEvents: fadingOut ? 'none' : 'auto',
      }}
    >
      <svg
        width={totalWidth}
        height={svgH}
        viewBox={`0 0 ${totalWidth} ${svgH}`}
        style={{ display: 'block' }}
      >
        {(() => {
          const cy = svgH / 2;
          const markCx = markSize / 2;
          const textX = markSize + gap;
          return (
            <>
              <g fill="var(--brand)">
                <circle cx={markCx}                  cy={cy - markHalfOffset} r={dotR} />
                <circle cx={markCx - markHalfOffset} cy={cy}                  r={dotR} />
                <circle cx={markCx + markHalfOffset} cy={cy}                  r={dotR} />
                <circle cx={markCx}                  cy={cy + markHalfOffset} r={dotR} />
              </g>
              <text
                x={textX}
                y={cy}
                fontFamily="var(--font-mono)"
                fontWeight={400}
                fontSize={fontSize}
                fill="var(--brand)"
                textAnchor="start"
                dominantBaseline="middle"
              >
                {TEXT}
              </text>
            </>
          );
        })()}
      </svg>
    </div>
  );
}
