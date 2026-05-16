import { redirect } from 'next/navigation';

// Raiz redireciona pra primeira aba. Gating por role (admin → briefing,
// interno → foco, cliente → portal) entra na Onda 1 com o auth real.
export default function Home() {
  redirect('/foco');
}
