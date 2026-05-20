import type { Config } from 'tailwindcss';

/**
 * Tokens da marca Kliente 360 portados de lib/styles.css do app atual.
 * As cores referenciam CSS vars (definidas em globals.css) pra suportar
 * tema claro/escuro sem duplicar a paleta.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand)',
          dark: 'var(--brand-dark)',
          soft: 'var(--brand-soft)',
          tint: 'var(--brand-tint)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          soft: 'var(--ink-soft)',
        },
        muted: 'var(--muted)',
        line: 'var(--line)',
        bg: {
          DEFAULT: 'var(--bg)',
          elev: 'var(--bg-elev)',
        },
        charcoal: '#1f2937',
        // status / prioridade (afastados do verde da marca)
        p0: '#C8392B',
        p1: '#C77A1A',
        p2: '#2D7AA8',
        p3: '#6E7A72',
        info: '#0084E1',
      },
      fontFamily: {
        brand: ['var(--font-brand)', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
