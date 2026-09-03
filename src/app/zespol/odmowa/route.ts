import { NextResponse, type NextRequest } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { klientAuthZespolu } from "@/lib/auth-zespol";
import { infoZadania } from "@/lib/zadanie";

/**
 * Sesja Supabase Auth bez aktywnego wiersza w team_members (osoba dezaktywowana albo konto
 * założone poza panelem): kasujemy sesję Auth, zapisujemy próbę w audycie i pokazujemy odmowę
 * na ekranie logowania. Trasa, nie strona, bo komponent serwerowy nie może usunąć cookies.
 */
export async function GET(request: NextRequest) {
  const auth = await klientAuthZespolu();
  const { data } = await auth.auth.getUser();
  const cel = new URL("/zespol/logowanie", request.url);
  if (data.user) {
    const { ipHash, ua } = await infoZadania();
    await auth.auth.signOut();
    await zapiszAudyt({
      actor_kind: "zespol",
      actor_label: data.user.email ?? data.user.id,
      action: "zespol.logowanie_blad",
      ip_hash: ipHash,
      ua,
      meta: { powod: "brak_na_liscie", etap: "sesja" },
    });
    cel.searchParams.set("odmowa", "1");
  }
  return NextResponse.redirect(cel, 303);
}
