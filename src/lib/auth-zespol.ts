import "server-only";
import { createServerClient } from "@supabase/ssr";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { cache } from "react";
import { czyDozwolonyAdres } from "@/lib/allowlista";
import { env } from "@/lib/env";
import { supabaseSerwer } from "@/lib/supabase/server";
import { maUprawnienie, WIDZI_WSZYSTKICH_KLIENTOW, type Poziom, type Rola, type Zasob } from "@/lib/uprawnienia";

/**
 * Logowanie zespołu: Supabase Auth (e-mail OTP) kluczem publishable WYŁĄCZNIE do Auth.
 * Dane nadal idą kluczem secret po stronie serwera (SPEC rozdz. 16.1).
 */
export async function klientAuthZespolu() {
  const store = await cookies();
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try {
          for (const c of lista) store.set(c.name, c.value, c.options);
        } catch {
          // Komponent serwerowy nie może ustawiać cookies; odświeżanie robi proxy.ts i akcje.
        }
      },
    },
  });
}

export type CzlonekZespolu = { id: string; name: string; email: string; role: Rola };

/** Członek zespołu dla użytkownika Auth: po auth_user_id, awaryjnie po e-mailu (z uzupełnieniem powiązania). */
export async function znajdzCzlonka(user: { id: string; email?: string | null }): Promise<CzlonekZespolu | null> {
  const email = user.email?.toLowerCase();
  const db = supabaseSerwer();
  const zapytanie = db.from("team_members").select("id, name, email, role, active, auth_user_id");
  const { data: wiersz } = await (email ? zapytanie.or(`auth_user_id.eq.${user.id},email.eq.${email}`) : zapytanie.eq("auth_user_id", user.id))
    .limit(1)
    .maybeSingle();
  if (!wiersz || !wiersz.active) return null;
  if (!wiersz.auth_user_id) {
    await db.from("team_members").update({ auth_user_id: user.id }).eq("id", wiersz.id);
  }
  return { id: wiersz.id, name: wiersz.name, email: wiersz.email, role: wiersz.role };
}

export const pobierzCzlonkaZespolu = cache(async (): Promise<CzlonekZespolu | null> => {
  const auth = await klientAuthZespolu();
  const { data } = await auth.auth.getUser();
  if (!data.user) return null;
  return znajdzCzlonka(data.user);
});

export async function wymagajCzlonka(): Promise<CzlonekZespolu> {
  const czlonek = await pobierzCzlonkaZespolu();
  if (!czlonek) redirect("/zespol/logowanie");
  return czlonek;
}

/** Filtr wstępny (env) + prawdziwa lista (team_members.active). Nie ujawniamy, który warunek nie przeszedł. */
export async function czyMozeSieZalogowac(email: string): Promise<boolean> {
  if (!czyDozwolonyAdres(email, env().TEAM_EMAIL_ALLOWLIST)) return false;
  const { data } = await supabaseSerwer()
    .from("team_members")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .eq("active", true)
    .maybeSingle();
  return !!data;
}

/** Widoczność klienta dla członka zespołu: admin i sales widzą wszystkich, reszta tylko przypisanych. */
export async function czyWidziKlienta(czlonek: CzlonekZespolu, clientId: string): Promise<boolean> {
  if (WIDZI_WSZYSTKICH_KLIENTOW.includes(czlonek.role)) return true;
  const db = supabaseSerwer();
  const [{ data: przypisanie }, { data: klient }] = await Promise.all([
    db.from("client_assignments").select("client_id").eq("client_id", clientId).eq("team_member_id", czlonek.id).maybeSingle(),
    db.from("clients").select("id").eq("id", clientId).eq("opiekun_id", czlonek.id).maybeSingle(),
  ]);
  return !!przypisanie || !!klient;
}

/** Brak dostępu do klienta = 404, jak w panelu klienta: nie potwierdzamy istnienia. */
export async function assertTeamClientAccess(czlonek: CzlonekZespolu, clientId: string | null | undefined): Promise<void> {
  if (!clientId || !(await czyWidziKlienta(czlonek, clientId))) notFound();
}

export function wymagajUprawnienia(czlonek: CzlonekZespolu, zasob: Zasob, minimum: Exclude<Poziom, "brak">): void {
  if (!maUprawnienie(czlonek.role, zasob, minimum)) notFound();
}
