import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'tasks 360',
  description: 'Gestão de backlog · Kliente 360',
  applicationName: 'tasks 360',
  manifest: '/manifest.webmanifest',
  // Apple-specific PWA meta — Next gera as meta tags certas.
  appleWebApp: {
    capable: true,
    title: 'tasks 360',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/assets/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/assets/apple-touch-icon.png', sizes: '180x180' },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // permite conteúdo atrás do notch iOS (safe-area-inset)
  themeColor: '#009900',
};

/**
 * Splash screens iOS — apple-touch-startup-image precisa ser declarada
 * por dispositivo. Tamanhos cobrem iPhone SE até iPad Pro 12.9".
 * Gerados via web/scripts/generate-splash.mjs a partir do brand mark.
 */
const APPLE_SPLASH: { src: string; mq: string }[] = [
  // iPhone SE / 8 — 750x1334 @2x portrait
  { src: '/assets/splash/splash-750x1334.png',  mq: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
  // iPhone 11 / XR — 828x1792 @2x portrait
  { src: '/assets/splash/splash-828x1792.png',  mq: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)' },
  // iPhone X / XS / 11 Pro — 1125x2436 @3x portrait
  { src: '/assets/splash/splash-1125x2436.png', mq: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)' },
  // iPhone 12 / 12 Pro / 13 / 13 Pro / 14 — 1170x2532 @3x portrait
  { src: '/assets/splash/splash-1170x2532.png', mq: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
  // iPhone 15 / 15 Pro — 1179x2556 @3x portrait
  { src: '/assets/splash/splash-1179x2556.png', mq: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' },
  // iPhone 12 Pro Max / 13 Pro Max / 14 Plus — 1284x2778 @3x portrait
  { src: '/assets/splash/splash-1284x2778.png', mq: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)' },
  // iPhone 15 Plus / 15 Pro Max — 1290x2796 @3x portrait
  { src: '/assets/splash/splash-1290x2796.png', mq: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
  // iPad 11" — 1668x2388 @2x portrait
  { src: '/assets/splash/splash-1668x2388.png', mq: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)' },
  // iPad Pro 12.9" — 2048x2732 @2x portrait
  { src: '/assets/splash/splash-2048x2732.png', mq: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)' },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`}>
      <head>
        {/* color-scheme reage ao toggle manual (.dark no <html>). Sem
            `only` agora — Auto Dark do Chrome só age quando o usuário
            também muda nosso toggle. */}
        <meta name="color-scheme" content="light dark" />
        {/* Anti-flash: aplica `dark` no <html> antes do primeiro paint
            lendo o localStorage. Sem isso a tela pisca claro → escuro
            depois da hidratação do ThemeProvider. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('kliente360-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
        {/* iOS splash screens — Next Metadata API ainda não cobre
            apple-touch-startup-image; declarados manualmente aqui. */}
        {APPLE_SPLASH.map((s) => (
          <link key={s.src} rel="apple-touch-startup-image" href={s.src} media={s.mq} />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
