import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (dawniej middleware) robi dwie rzeczy i NIC więcej:
 * 1. przekazuje ścieżkę w nagłówku x-pathname (potrzebna przy rotacji sesji klienta),
 * 2. dla /zespol odświeża cookies sesji Supabase Auth (komponenty serwerowe nie mogą ich ustawiać).
 * Decyzje o dostępie zapadają w layoutach, akcjach i trasach, nigdy tutaj.
 */
export async function proxy(request: NextRequest) {
  const naglowki = new Headers(request.headers);
  naglowki.set("x-pathname", request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: naglowki } });

  const url = process.env.SUPABASE_URL;
  const klucz = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (request.nextUrl.pathname.startsWith("/zespol") && url && klucz) {
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

  return response;
}

export const config = {
  matcher: ["/p/:path*", "/zespol/:path*"],
};
