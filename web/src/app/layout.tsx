import type { Metadata } from 'next';
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
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`}>
      <head>
        {/* `only light` bloqueia Auto Dark Mode do Chrome + Dark Reader.
            Next Metadata API só aceita os valores canônicos (light/dark/etc),
            então o "only" entra via meta tag explícita. */}
        <meta name="color-scheme" content="only light" />
      </head>
      <body>{children}</body>
    </html>
  );
}
