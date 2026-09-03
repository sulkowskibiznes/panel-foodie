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

const KOLUMNY_CZLONKA = "id, name, email, role, active, auth_user_id";

/**
 * Członek zespołu dla użytkownika Auth: najpierw po auth_user_id, awaryjnie po e-mailu
 * (adres w Auth jest zweryfikowany kodem, więc dopasowanie po nim jest bezpieczne).
 * Brakujące albo nieaktualne powiązanie auth_user_id uzupełniamy. Nieaktywny wiersz = brak dostępu.
 */
export async function znajdzCzlonka(user: { id: string; email?: string | null }): Promise<CzlonekZespolu | null> {
  const db = supabaseSerwer();
  let { data: wiersz } = await db.from("team_members").select(KOLUMNY_CZLONKA).eq("auth_user_id", user.id).maybeSingle();
  const email = user.email?.trim().toLowerCase();
  if (!wiersz && email) {
    ({ data: wiersz } = await db.from("team_members").select(KOLUMNY_CZLONKA).eq("email", email).maybeSingle());
  }
  if (!wiersz || !wiersz.active) return null;
  if (wiersz.auth_user_id !== user.id) {
    const { error } = await db.from("team_members").update({ auth_user_id: user.id }).eq("id", wiersz.id);
    if (error) console.error("[zespol] nie udało się powiązać konta Auth z członkiem zespołu", wiersz.id, error.message);
  }
  return { id: wiersz.id, name: wiersz.name, email: wiersz.email, role: wiersz.role };
}

/** Użytkownik Supabase Auth z cookies (albo null). Jeden odczyt na żądanie. */
export const pobierzUzytkownikaAuth = cache(async () => {
  const auth = await klientAuthZespolu();
  const { data } = await auth.auth.getUser();
  return data.user;
});

export const pobierzCzlonkaZespolu = cache(async (): Promise<CzlonekZespolu | null> => {
  const user = await pobierzUzytkownikaAuth();
  if (!user) return null;
  return znajdzCzlonka(user);
});

/**
 * Brak sesji Auth: ekran logowania. Sesja Auth bez aktywnego członka zespołu (osoba dezaktywowana
 * albo konto założone poza panelem): trasa odmowy, która wylogowuje i pokazuje komunikat. Nigdy pusty panel.
 */
export async function wymagajCzlonka(): Promise<CzlonekZespolu> {
  const czlonek = await pobierzCzlonkaZespolu();
  if (czlonek) return czlonek;
  redirect((await pobierzUzytkownikaAuth()) ? "/zespol/odmowa" : "/zespol/logowanie");
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
