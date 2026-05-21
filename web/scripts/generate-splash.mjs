// Gera apple-touch-startup-image PNGs (1 por device iOS).
// Layout: réplica fiel da tela de loading do app (index.html linha 80):
//   fundo bg-elev branco · k360-mark (4 dots verdes em diamante) · gap · "Carregando…" em IBM Plex Mono cinza
//
// Pipeline: SVG → @resvg/resvg-js → PNG. Fontes passadas via fontBuffers (resvg
// não carrega @font-face com data URL).
//
// Pré-requisitos:
//   npm install --no-save @resvg/resvg-js
//   curl -sL "https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n5ig.ttf" -o assets/_plex-mono-400.ttf
//
// Roda com: node assets/generate-splash.mjs
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const BRAND = '#009900';
const MUTED = '#7D8185';   // --muted (mesma cor do "Carregando…" no overlay)
const BG    = '#FFFFFF';   // --bg-elev light

const FONT_PATH = new URL('./_plex-mono-400.ttf', import.meta.url);
if (!existsSync(FONT_PATH)) {
  console.error('Falta IBM Plex Mono 400. Roda:');
  console.error('  curl -sL "https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n5ig.ttf" -o assets/_plex-mono-400.ttf');
  process.exit(1);
}
const FONT_BUF = readFileSync(FONT_PATH);

function buildSvg(W, H) {
  // No overlay real: container 22px com dots 7px (CSS) em viewport ~390px.
  // Calibrado pra que o grupo (mark + texto) leia "discreto e pequeno" no splash.
  const min = Math.min(W, H);
  const markSize       = Math.round(min * 0.075);
  const dotR           = markSize * 0.16;       // dot = 32% do container
  const markHalfOffset = markSize * 0.34;       // dist do centro até cada dot
  const fontSize       = Math.round(min * 0.048);
  const gap            = Math.round(min * 0.032);

  const text       = 'Carregando…';
  // Plex Mono: char width ≈ 0.6em
  const textWidth  = text.length * fontSize * 0.6;
  const totalWidth = markSize + gap + textWidth;

  const cx     = W / 2;
  const cy     = H / 2;
  const startX = cx - totalWidth / 2;
  const markCx = startX + markSize / 2;
  const textX  = startX + markSize + gap;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <g fill="${BRAND}">
    <circle cx="${markCx}" cy="${cy - markHalfOffset}" r="${dotR}"/>
    <circle cx="${markCx - markHalfOffset}" cy="${cy}" r="${dotR}"/>
    <circle cx="${markCx + markHalfOffset}" cy="${cy}" r="${dotR}"/>
    <circle cx="${markCx}" cy="${cy + markHalfOffset}" r="${dotR}"/>
  </g>
  <text x="${textX}" y="${cy}"
        font-family="IBM Plex Mono"
        font-weight="400"
        font-size="${fontSize}"
        fill="${MUTED}"
        text-anchor="start"
        dominant-baseline="middle">${text}</text>
</svg>`;
}

function renderSplash(W, H) {
  const svg = buildSvg(W, H);
  const resvg = new Resvg(svg, {
    background: BG,
    fitTo: { mode: 'width', value: W },
    font: {
      loadSystemFonts: false,
      fontBuffers: [FONT_BUF],
      defaultFontFamily: 'IBM Plex Mono',
    },
  });
  return resvg.render().asPng();
}

const DEVICES = [
  { w: 750,  h: 1334 },
  { w: 828,  h: 1792 },
  { w: 1125, h: 2436 },
  { w: 1170, h: 2532 },
  { w: 1179, h: 2556 },
  { w: 1284, h: 2778 },
  { w: 1290, h: 2796 },
  { w: 1668, h: 2388 },
  { w: 2048, h: 2732 },
];

mkdirSync(new URL('./splash/', import.meta.url), { recursive: true });
for (const d of DEVICES) {
  const png = renderSplash(d.w, d.h);
  const path = new URL(`./splash/splash-${d.w}x${d.h}.png`, import.meta.url);
  writeFileSync(path, png);
  console.log(`✓ splash-${d.w}x${d.h}.png (${(png.length / 1024).toFixed(1)} KB)`);
}
console.log(`\nGerados ${DEVICES.length} splashes em assets/splash/`);
