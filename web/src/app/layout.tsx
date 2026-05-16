import type { Metadata } from 'next';
import { Manrope, Quicksand, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const body = Manrope({ subsets: ['latin'], variable: '--font-body' });
const brand = Quicksand({ subsets: ['latin'], variable: '--font-brand' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'tasks 360',
  description: 'Gestão de backlog · Kliente 360',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${brand.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
