import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { hashujToken } from "@/lib/auth-klient";
import { env } from "@/lib/env";
import { hmacHex, porownajStale, sha256Hex, wyprowadzKlucz } from "@/lib/krypto";
import { supabaseSerwer } from "@/lib/supabase/server";

/**
 * Sesja klienta (SPEC rozdz. 4.2, 16.5): cookie __Host- w produkcji, 30 dni przesuwnie,
 * rotacja tokenu raz na 24 h z 2-minutową łaską dla równoległych żądań.
 * W bazie tylko sha256 tokenu; cookie = token.hmac, żeby sfałszowane cookie odpadało bez zapytania.
 */
const PRODUKCJA = process.env.NODE_ENV === "production";
export const NAZWA_COOKIE_SESJI = PRODUKCJA ? "__Host-fm_sesja" : "fm_sesja";
const DNI_SESJI = 30;
const MS_SESJI = DNI_SESJI * 24 * 60 * 60 * 1000;
const MS_ROTACJI = 24 * 60 * 60 * 1000;
const MS_LASKI = 2 * 60 * 1000;
const MS_ODSWIEZENIA_AKTYWNOSCI = 60 * 60 * 1000;

export type SesjaKlienta = {
  sesjaId: string;
  linkId: string;
  clientId: string;
  contactId: string | null;
  label: string;
  canApprove: boolean;
  wymagaRotacji: boolean;
};

function kluczCookie() {
  return wyprowadzKlucz(env().SESSION_SECRET, "cookie");
}

function zbudujWartoscCookie(token: string): string {
  return `${token}.${hmacHex(kluczCookie(), token)}`;
}

/** Zwraca token z cookie albo null, gdy cookie nie ma albo podpis się nie zgadza. */
export function odczytajTokenZCookie(wartosc: string | undefined): string | null {
  if (!wartosc) return null;
  const kropka = wartosc.lastIndexOf(".");
  if (kropka <= 0) return null;
  const token = wartosc.slice(0, kropka);
  const podpis = wartosc.slice(kropka + 1);
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token) || !/^[0-9a-f]{64}$/.test(podpis)) return null;
  return porownajStale(podpis, hmacHex(kluczCookie(), token)) ? token : null;
}

async function ustawCookie(token: string, zapamietaj: boolean): Promise<void> {
  const store = await cookies();
  store.set(NAZWA_COOKIE_SESJI, zbudujWartoscCookie(token), {
    httpOnly: true,
    secure: PRODUKCJA,
    sameSite: "lax",
    path: "/",
    ...(zapamietaj ? { maxAge: DNI_SESJI * 24 * 60 * 60 } : {}),
  });
}

function nowyToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function utworzSesje(linkId: string, opcje: { zapamietaj: boolean; ipHash: string; uaHash: string }): Promise<string> {
  const token = nowyToken();
  const { data, error } = await supabaseSerwer()
    .from("client_sessions")
    .insert({
      access_link_id: linkId,
      session_hash: sha256Hex(token),
      ip_hash: opcje.ipHash,
      ua_hash: opcje.uaHash,
      expires_at: new Date(Date.now() + MS_SESJI).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`utworzSesje: ${error?.message ?? "brak wiersza"}`);
  await ustawCookie(token, opcje.zapamietaj);
  return data.id;
}

type WierszSesji = {
  id: string;
  access_link_id: string;
  session_hash: string;
  previous_session_hash: string | null;
  rotated_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
  access_links: {
    client_id: string;
    contact_id: string | null;
    label: string;
    can_approve: boolean;
    token_hash: string;
    revoked_at: string | null;
  } | null;
};

async function znajdzSesje(token: string): Promise<{ wiersz: WierszSesji; przezPoprzedni: boolean } | null> {
  const h = sha256Hex(token);
  const { data, error } = await supabaseSerwer()
    .from("client_sessions")
    .select(
      "id, access_link_id, session_hash, previous_session_hash, rotated_at, last_seen_at, expires_at, revoked_at, access_links(client_id, contact_id, label, can_approve, token_hash, revoked_at)",
    )
    .or(`session_hash.eq.${h},previous_session_hash.eq.${h}`)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const wiersz = data as unknown as WierszSesji;
  const przezPoprzedni = wiersz.session_hash !== h;
  return { wiersz, przezPoprzedni };
}

function czySesjaZywa(w: WierszSesji, przezPoprzedni: boolean, teraz: number): boolean {
  if (w.revoked_at) return false;
  if (new Date(w.expires_at).getTime() <= teraz) return false;
  if (!w.access_links || w.access_links.revoked_at) return false;
  if (przezPoprzedni && teraz - new Date(w.rotated_at).getTime() > MS_LASKI) return false;
  return true;
}

/**
 * Sesja bieżącego żądania dla tokenu linku z adresu. Cookie sesji musi należeć do linku z URL:
 * inaczej pokazujemy ekran PIN dla tego linku (nie ujawniamy niczego o żadnym z nich).
 */
export const pobierzSesjeKlienta = cache(async (tokenZUrl: string): Promise<SesjaKlienta | null> => {
  const store = await cookies();
  const token = odczytajTokenZCookie(store.get(NAZWA_COOKIE_SESJI)?.value);
  if (!token) return null;
  const znaleziona = await znajdzSesje(token);
  if (!znaleziona) return null;
  const { wiersz, przezPoprzedni } = znaleziona;
  const teraz = Date.now();
  if (!czySesjaZywa(wiersz, przezPoprzedni, teraz) || !wiersz.access_links) return null;
  if (!porownajStale(wiersz.access_links.token_hash, hashujToken(tokenZUrl))) return null;

  // Przesuwne 30 dni: odświeżamy aktywność najwyżej raz na godzinę (bez zapisu przy każdym żądaniu).
  if (teraz - new Date(wiersz.last_seen_at).getTime() > MS_ODSWIEZENIA_AKTYWNOSCI) {
    await supabaseSerwer()
      .from("client_sessions")
      .update({ last_seen_at: new Date(teraz).toISOString(), expires_at: new Date(teraz + MS_SESJI).toISOString() })
      .eq("id", wiersz.id);
  }

  return {
    sesjaId: wiersz.id,
    linkId: wiersz.access_link_id,
    clientId: wiersz.access_links.client_id,
    contactId: wiersz.access_links.contact_id,
    label: wiersz.access_links.label,
    canApprove: wiersz.access_links.can_approve,
    wymagaRotacji: !przezPoprzedni && teraz - new Date(wiersz.rotated_at).getTime() > MS_ROTACJI,
  };
});

/** Rotacja tokenu sesji (tylko w Route Handlerze, bo ustawia cookie). Zwraca false, gdy sesji nie ma. */
export async function rotujSesje(tokenZUrl: string): Promise<boolean> {
  const store = await cookies();
  const stary = odczytajTokenZCookie(store.get(NAZWA_COOKIE_SESJI)?.value);
  if (!stary) return false;
  const znaleziona = await znajdzSesje(stary);
  if (!znaleziona) return false;
  const { wiersz, przezPoprzedni } = znaleziona;
  const teraz = Date.now();
  if (!czySesjaZywa(wiersz, przezPoprzedni, teraz) || !wiersz.access_links) return false;
  if (!porownajStale(wiersz.access_links.token_hash, hashujToken(tokenZUrl))) return false;
  if (przezPoprzedni) return true; // równoległe żądanie już zrotowało; stary token działa jeszcze 2 min

  const nowy = nowyToken();
  const { error } = await supabaseSerwer()
    .from("client_sessions")
    .update({
      previous_session_hash: wiersz.session_hash,
      session_hash: sha256Hex(nowy),
      rotated_at: new Date(teraz).toISOString(),
      last_seen_at: new Date(teraz).toISOString(),
      expires_at: new Date(teraz + MS_SESJI).toISOString(),
    })
    .eq("id", wiersz.id);
  if (error) throw new Error(`rotujSesje: ${error.message}`);
  await ustawCookie(nowy, true);
  return true;
}

/** Wylogowanie bieżącego urządzenia. */
export async function zakonczSesje(): Promise<{ linkId: string; clientId: string } | null> {
  const store = await cookies();
  const token = odczytajTokenZCookie(store.get(NAZWA_COOKIE_SESJI)?.value);
  store.delete(NAZWA_COOKIE_SESJI);
  if (!token) return null;
  const znaleziona = await znajdzSesje(token);
  if (!znaleziona) return null;
  await supabaseSerwer().from("client_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", znaleziona.wiersz.id);
  return { linkId: znaleziona.wiersz.access_link_id, clientId: znaleziona.wiersz.access_links?.client_id ?? "" };
}

/** Wszystkie urządzenia linku (reset PIN-u, wygaszenie, „Wyloguj wszystkie urządzenia"). */
export async function uniewaznijSesjeLinku(linkId: string): Promise<number> {
  const { data, error } = await supabaseSerwer()
    .from("client_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("access_link_id", linkId)
    .is("revoked_at", null)
    .select("id");
  if (error) throw new Error(`uniewaznijSesjeLinku: ${error.message}`);
  return data?.length ?? 0;
}
