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
      </head>
      <body>{children}</body>
    </html>
  );
}
