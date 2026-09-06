import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { NAGLOWEK_CSP, NAGLOWEK_NONCE, nowyNonce, zbudujCsp } from "@/lib/csp";

/**
 * Proxy (dawniej middleware) robi trzy rzeczy i NIC więcej:
 * 1. przekazuje ścieżkę w nagłówku x-pathname (potrzebna przy rotacji sesji klienta),
 * 2. generuje nonce i nagłówek Content-Security-Policy dla każdej strony (SPEC rozdz. 16.6); nagłówek idzie
 *    także w żądaniu, bo stamtąd Next bierze nonce do własnych skryptów,
 * 3. dla /zespol i dla podglądu klienta oczami zespołu (/p/podglad.…) odświeża cookies sesji Supabase Auth
 *    (komponenty serwerowe nie mogą ich ustawiać).
 * Decyzje o dostępie zapadają w layoutach, akcjach i trasach, nigdy tutaj.
 */
export async function proxy(request: NextRequest) {
  const nonce = nowyNonce();
  const csp = zbudujCsp({ nonce, dev: process.env.NODE_ENV === "development", supabaseUrl: process.env.SUPABASE_URL ?? null });

  const naglowki = new Headers(request.headers);
  naglowki.set("x-pathname", request.nextUrl.pathname);
  naglowki.set(NAGLOWEK_NONCE, nonce);
  naglowki.set(NAGLOWEK_CSP, csp);
  let response = NextResponse.next({ request: { headers: naglowki } });

  const url = process.env.SUPABASE_URL;
  const klucz = process.env.SUPABASE_PUBLISHABLE_KEY;
  const sciezka = request.nextUrl.pathname;
  if ((sciezka.startsWith("/zespol") || sciezka.startsWith("/p/podglad.")) && url && klucz) {
    const supabase = createServerClient(url, klucz, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista) => {
          for (const c of lista) request.cookies.set(c.name, c.value);
          response = NextResponse.next({ request: { headers: naglowki } });
          for (const c of lista) response.cookies.set(c.name, c.value, c.options);
        },
      },
    });
    await supabase.auth.getUser();
  }

  response.headers.set(NAGLOWEK_CSP, csp);
  return response;
}

export const config = {
  // Wszystkie strony i trasy aplikacji; bez plików statycznych Nexta, API (crony, webhook) i zasobów z public/.
  matcher: ["/((?!api/|_next/static|_next/image|favicon\\.ico|fonts/|sygnet-|robots\\.txt).*)"],
};
