// Gera apple-touch-startup-image PNGs (1 por device iOS).
// Layout: fundo branco + 4 dots verdes em diamante (mark) + "tasks 360" em IBM Plex Sans 600.
// Pipeline: SVG (vetor) → resvg → PNG. Fonte IBM Plex Sans baixada do Google Fonts e
// embutida como base64 no SVG (resvg não busca recursos de rede).
//
// Pré-requisitos:
//   npm install --no-save @resvg/resvg-js
//   curl -sL "https://fonts.gstatic.com/s/ibmplexsans/v23/...600.ttf" -o assets/_plex-600.ttf
//
// Roda com: node assets/generate-splash.mjs
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const BRAND = '#009900';
const FONT_PATH = new URL('./_plex-600.ttf', import.meta.url);
if (!existsSync(FONT_PATH)) {
  console.error('Falta a fonte. Roda:');
  console.error('  curl -sL "https://fonts.gstatic.com/s/ibmplexsans/v23/zYXGKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1swZSAXcomDVmadSDNF5zAA.ttf" -o assets/_plex-600.ttf');
  process.exit(1);
}
const FONT_B64 = readFileSync(FONT_PATH).toString('base64');

function buildSvg(W, H) {
  const cx = W / 2;
  // logo um pouco acima do centro pra dar peso visual ao texto
  const cy = H / 2 - Math.min(W, H) * 0.06;
  const distance = Math.min(W, H) * 0.085;
  const dotRadius = Math.min(W, H) * 0.034;

  // Texto: tamanho ~3.8% do menor lado
  const fontSize = Math.round(Math.min(W, H) * 0.038);
  const textY = cy + distance + dotRadius + Math.min(W, H) * 0.08;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      @font-face {
        font-family: 'IBM Plex Sans';
        font-weight: 600;
        font-style: normal;
        src: url('data:font/ttf;base64,${FONT_B64}') format('truetype');
      }
    </style>
  </defs>
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <g fill="${BRAND}">
    <circle cx="${cx}" cy="${cy - distance}" r="${dotRadius}"/>
    <circle cx="${cx - distance}" cy="${cy}" r="${dotRadius}"/>
    <circle cx="${cx + distance}" cy="${cy}" r="${dotRadius}"/>
    <circle cx="${cx}" cy="${cy + distance}" r="${dotRadius}"/>
  </g>
  <text x="${cx}" y="${textY}"
        font-family="IBM Plex Sans"
        font-weight="600"
        font-size="${fontSize}"
        fill="#0F1A14"
        text-anchor="middle"
        letter-spacing="-0.01em">tasks 360</text>
</svg>`;
}

function renderSplash(W, H) {
  const svg = buildSvg(W, H);
  const resvg = new Resvg(svg, {
    background: 'rgba(255,255,255,1)',
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

// ---- Device list (portrait apenas; manifest define orientation=portrait) ----
const DEVICES = [
  { w: 750,  h: 1334 },        // iPhone SE 2/3, 6/7/8
  { w: 828,  h: 1792 },        // iPhone XR, 11
  { w: 1125, h: 2436 },        // iPhone X, XS, 11 Pro, 12/13 mini
  { w: 1170, h: 2532 },        // iPhone 12, 13, 14
  { w: 1179, h: 2556 },        // iPhone 14 Pro, 15
  { w: 1284, h: 2778 },        // iPhone 12/13 Pro Max, 14 Plus
  { w: 1290, h: 2796 },        // iPhone 14 Pro Max, 15 Pro Max
  { w: 1668, h: 2388 },        // iPad Pro 11"
  { w: 2048, h: 2732 },        // iPad Pro 12.9"
];

mkdirSync(new URL('./splash/', import.meta.url), { recursive: true });
for (const d of DEVICES) {
  const png = renderSplash(d.w, d.h);
  const path = new URL(`./splash/splash-${d.w}x${d.h}.png`, import.meta.url);
  writeFileSync(path, png);
  console.log(`✓ splash-${d.w}x${d.h}.png (${(png.length / 1024).toFixed(1)} KB)`);
}
console.log(`\nGerados ${DEVICES.length} splashes em assets/splash/`);
