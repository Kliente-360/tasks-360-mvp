/**
 * Middleware de auth: mantém a sessão Supabase fresca a cada request
 * (refresh do token) e expõe o cookie atualizado pro Server. Padrão
 * recomendado pelo @supabase/ssr em App Router.
 *
 * Gating por role (admin/interno/cliente) e redirect de login entram
 * na Onda 1 — aqui só o refresh de sessão.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Toca a sessão pra disparar o refresh do token quando necessário.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Roda em tudo menos assets estáticos.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
