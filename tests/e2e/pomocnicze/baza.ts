import { config as dotenv } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { generujPin, generujToken, hashujPin, hashujToken, tokenLookup, type Losuj } from "../../../src/lib/auth-klient";
import { wyprowadzKlucz, zaszyfruj } from "../../../src/lib/krypto";
import { losujZZiarnem } from "../../pomocnicze/losowosc";

dotenv({ path: ".env.local" });

function sql() {
  const url = process.env.E2E_DB_URL;
  if (!url) throw new Error("Brak E2E_DB_URL (ustawia go global-setup).");
  return postgres(url, { max: 1 });
}

let licznik = 0;
function losowosc(): Losuj {
  const ziarno = Number(process.env.E2E_SEED ?? 1) + Number(process.env.TEST_WORKER_INDEX ?? 0) * 100_003 + ++licznik * 7919;
  return losujZZiarnem(ziarno);
}

async function zBaza<T>(fn: (s: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const s = sql();
  try {
    return await fn(s);
  } finally {
    await s.end();
  }
}

export type LinkTestowy = { id: string; token: string; pin: string; clientId: string; label: string };

/** Link testowy dla klienta z seedu. Token i PIN z generatorów z ustalonym ziarnem, hashe jak w aplikacji. */
export async function utworzLinkTestowy(slug: string, opcje: { label?: string; canApprove?: boolean } = {}): Promise<LinkTestowy> {
  const losuj = losowosc();
  const token = generujToken(losuj);
  const pin = generujPin("pin4", losuj);
  const sekret = process.env.SESSION_SECRET;
  if (!sekret) throw new Error("Brak SESSION_SECRET w .env.local");
  const tokenEnc = zaszyfruj(wyprowadzKlucz(sekret, "token"), token);
  const pinHash = await hashujPin(pin);
  const label = opcje.label ?? `Test E2E ${token.slice(0, 6)}`;
  return zBaza(async (s) => {
    const [klient] = await s<{ id: string }[]>`select id from public.clients where slug = ${slug}`;
    if (!klient) throw new Error(`Brak klienta ${slug} w bazie testowej`);
    const [link] = await s<{ id: string }[]>`
      insert into public.access_links (client_id, label, token_lookup, token_hash, token_enc, pin_hash, pin_kind, can_approve)
      values (${klient.id}, ${label}, ${tokenLookup(token)}, ${hashujToken(token)}, ${tokenEnc}, ${pinHash}, 'pin4', ${opcje.canApprove ?? true})
      returning id`;
    if (!link) throw new Error("Nie udało się utworzyć linku testowego");
    return { id: link.id, token, pin, clientId: klient.id, label };
  });
}

export async function usunLinkTestowy(id: string): Promise<void> {
  await zBaza((s) => s`delete from public.access_links where id = ${id}`);
}

export function nieistniejacyToken(): string {
  return generujToken(losowosc());
}

export async function stanLinku(id: string) {
  return zBaza(async (s) => {
    const [w] = await s<{ failed_attempts: number; locked_until: string | null; revoked_at: string | null }[]>`
      select failed_attempts, locked_until, revoked_at from public.access_links where id = ${id}`;
    return w ?? null;
  });
}

export async function aktywneSesje(linkId: string): Promise<number> {
  return zBaza(async (s) => {
    const [w] = await s<{ n: number }[]>`select count(*)::int as n from public.client_sessions where access_link_id = ${linkId} and revoked_at is null`;
    return w?.n ?? 0;
  });
}

/** Cofnięcie sesji linku w czasie (kryterium 3: sesja po 24 h). */
export async function przesunSesjeWczas(linkId: string, godziny: number): Promise<void> {
  await zBaza(
    (s) => s`
      update public.client_sessions
      set created_at = created_at - make_interval(hours => ${godziny}),
          rotated_at = rotated_at - make_interval(hours => ${godziny}),
          last_seen_at = last_seen_at - make_interval(hours => ${godziny})
      where access_link_id = ${linkId}`,
  );
}

export async function rotatedAt(linkId: string): Promise<string | null> {
  return zBaza(async (s) => {
    const [w] = await s<{ rotated_at: string }[]>`select rotated_at from public.client_sessions where access_link_id = ${linkId} and revoked_at is null order by created_at desc limit 1`;
    return w?.rotated_at ?? null;
  });
}

/** Limit na IP jest współdzielony przez wszystkie testy z localhost; czyścimy go przed każdym testem. */
export async function wyczyscLimity(): Promise<void> {
  await zBaza((s) => s`delete from public.rate_limits where key like 'pin:ip:%' or key like 'otp:ip:%'`);
}

export async function pakietKlienta(slug: string): Promise<string> {
  return zBaza(async (s) => {
    const [w] = await s<{ id: string }[]>`
      select p.id from public.packages p join public.clients c on c.id = p.client_id where c.slug = ${slug} order by p.created_at limit 1`;
    if (!w) throw new Error(`Brak pakietu klienta ${slug}`);
    return w.id;
  });
}

export async function zasobKlienta(slug: string): Promise<string> {
  return zBaza(async (s) => {
    const [w] = await s<{ id: string }[]>`
      select a.id from public.item_assets a
      join public.package_items i on i.id = a.item_id
      join public.packages p on p.id = i.package_id
      join public.clients c on c.id = p.client_id
      where c.slug = ${slug} order by a.created_at limit 1`;
    if (!w) throw new Error(`Brak pliku klienta ${slug}`);
    return w.id;
  });
}

/** Klient admina Auth lokalnego stacku (tylko testy: tworzenie i sprzątanie kont zespołu). */
function adminAuth() {
  const url = process.env.E2E_API_URL;
  const key = process.env.E2E_SECRET_KEY;
  if (!url || !key) throw new Error("Brak E2E_API_URL / E2E_SECRET_KEY (ustawia je global-setup).");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export type CzlonekTestowy = { id: string; authUserId: string; email: string };

/** Członek zespołu na potrzeby jednego testu: konto Auth + aktywny wiersz team_members. Sprzątaj przez usunCzlonkaTestowego. */
export async function utworzCzlonkaTestowego(email: string, role = "content_creator"): Promise<CzlonekTestowy> {
  const auth = adminAuth();
  await zBaza((s) => s`delete from public.team_members where lower(email) = lower(${email})`);
  let authUserId: string | undefined;
  const utworzony = await auth.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name: "Test E2E" } });
  if (!utworzony.error && utworzony.data.user) authUserId = utworzony.data.user.id;
  else {
    const lista = await auth.auth.admin.listUsers({ perPage: 1000 });
    authUserId = lista.data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  }
  if (!authUserId) throw new Error(`Nie udało się założyć konta Auth ${email}: ${utworzony.error?.message ?? "nieznany błąd"}`);
  const id = await zBaza(async (s) => {
    const [w] = await s<{ id: string }[]>`
      insert into public.team_members (auth_user_id, name, email, role, active)
      values (${authUserId}, 'Test E2E', ${email.toLowerCase()}, ${role}::public.team_role, true)
      returning id`;
    if (!w) throw new Error("Nie udało się utworzyć członka testowego");
    return w.id;
  });
  return { id, authUserId, email: email.toLowerCase() };
}

export async function ustawAktywnosc(id: string, active: boolean): Promise<void> {
  await zBaza((s) => s`update public.team_members set active = ${active} where id = ${id}`);
}

export async function usunCzlonkaTestowego(c: CzlonekTestowy): Promise<void> {
  await zBaza((s) => s`delete from public.team_members where id = ${c.id}`);
  await adminAuth().auth.admin.deleteUser(c.authUserId);
}
