/**
 * Abas do app. Espelha o tabsList de lib/app.js do app atual.
 * `onda` indica em qual onda do rebuild a tela é portada de verdade.
 */
export type NavItem = {
  href: string;
  label: string;
  roles: ReadonlyArray<'admin' | 'interno' | 'cliente'>;
  onda: number;
  /** Esconde a tab no mobile (mantida no desktop). Espelha hideMobile do tabsList Alpine. */
  hideMobile?: boolean;
};

export const NAV: ReadonlyArray<NavItem> = [
  { href: '/foco',       label: 'Meu foco',      roles: ['admin', 'interno'],          onda: 1 },
  { href: '/briefing',   label: 'Briefing',      roles: ['admin'],                     onda: 3 },
  { href: '/triagem',    label: 'Triagem',       roles: ['admin'],                     onda: 1 },
  { href: '/backlog',    label: 'Backlog',       roles: ['admin', 'interno'],          onda: 1 },
  // Kanban escondido no mobile: 11 colunas operacionais não cabem em viewport
  // estreito e a executiva é melhor servida pelo /backlog mobile.
  { href: '/kanban',     label: 'Kanban',        roles: ['admin', 'interno'],          onda: 1, hideMobile: true },
  { href: '/calendario', label: 'Calendário',    roles: ['admin', 'interno'],          onda: 1 },
  { href: '/dashboard',  label: 'Dashboard',     roles: ['admin', 'interno'],          onda: 3 },
  { href: '/portal',     label: 'Portal cliente', roles: ['admin', 'interno', 'cliente'], onda: 2 },
  { href: '/cadastros',  label: 'Cadastros',     roles: ['admin'],                     onda: 1 },
  { href: '/adocao',     label: 'Adoção',        roles: ['admin'],                     onda: 4 },
] as const;
