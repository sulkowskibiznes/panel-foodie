import "server-only";
import { cookies } from "next/headers";
import { after } from "next/server";
import { DNI_KODU_STARTOWEGO, generujKodStartowy, hashujPin, hashujToken } from "@/lib/auth-klient";
import { zapiszAudyt } from "@/lib/audyt";
import { copy } from "@/lib/copy";
import { env } from "@/lib/env";
import { porownajStale, wyprowadzKlucz } from "@/lib/krypto";
import { potwierdzNieudanaProbePinu, type WynikNieudanejProby } from "@/lib/limity";
import { dodajDoOutbox } from "@/lib/outbox";
import { odczytajLadunek, podpiszLadunek } from "@/lib/podpis";
import { supabaseSerwer } from "@/lib/supabase/server";
import type { ZdarzenieOutbox } from "@/lib/zdarzenia";

/**
 * Własny PIN klienta (Etap 2 planu domknięcia, SPEC rozdz. 4.2): kod startowy od zespołu → pozwolenie w podpisanym
 * cookie (15 min) → klient ustawia własny PIN → sesja. Zapis PIN-u zawsze przez funkcję SQL `ustaw_pin_klienta`
 * z porównaniem wersji (kod jednorazowy, bez wyścigów z resetem). Alarmy blokad i zamrożenia po odpowiedzi (`after`).
 */
const PRODUKCJA = process.env.NODE_ENV === "production";
export const NAZWA_COOKIE_POZWOLENIA = PRODUKCJA ? "__Host-fm_pin" : "fm_pin";
const MS_POZWOLENIA = 15 * 60 * 1000;
const MS_KODU = DNI_KODU_STARTOWEGO * 24 * 60 * 60 * 1000;

function kluczPozwolenia(): Buffer {
  return wyprowadzKlucz(env().SESSION_SECRET, "ustaw-pin");
}

type LadunekPozwolenia = { cel: "ustaw-pin"; linkId: string; wersja: number; zapamietaj: boolean; tokenHash: string; wygasaO: number };

/** Po poprawnym kodzie startowym: zamiast sesji pozwolenie na ustawienie własnego PIN-u, związane z linkiem i wersją PIN-u. */
export async function ustawPozwolenieNaPin(token: string, link: { id: string; pin_version: number }, zapamietaj: boolean): Promise<void> {
  const ladunek: LadunekPozwolenia = { cel: "ustaw-pin", linkId: link.id, wersja: link.pin_version, zapamietaj, tokenHash: hashujToken(token), wygasaO: Date.now() + MS_POZWOLENIA };
  (await cookies()).set(NAZWA_COOKIE_POZWOLENIA, podpiszLadunek(kluczPozwolenia(), ladunek), {
    httpOnly: true,
    secure: PRODUKCJA,
    sameSite: "strict",
    path: "/",
    maxAge: MS_POZWOLENIA / 1000,
  });
}

export async function usunPozwolenieNaPin(): Promise<void> {
  (await cookies()).delete(NAZWA_COOKIE_POZWOLENIA);
}

export type LinkDoUstawieniaPinu = { id: string; client_id: string; contact_id: string | null; label: string; pin_hash: string; pin_pepper: boolean; pin_version: number };

/**
 * Pozwolenie z cookie, sprawdzone od nowa przy każdym użyciu: podpis i termin, token z adresu = token z pozwolenia
 * = token linku, link żywy, niezamrożony, nadal z kodem startowym i w tej samej wersji PIN-u. Dane linku wyłącznie
 * stąd: token z ciała akcji służy tylko do porównania (argumenty akcji nie są szyfrowane).
 */
export async function odczytajPozwolenieNaPin(token: string): Promise<{ link: LinkDoUstawieniaPinu; zapamietaj: boolean } | null> {
  const wartosc = (await cookies()).get(NAZWA_COOKIE_POZWOLENIA)?.value;
  if (!wartosc) return null;
  const p = odczytajLadunek<LadunekPozwolenia>(kluczPozwolenia(), wartosc, new Date());
  if (!p || p.cel !== "ustaw-pin" || typeof p.linkId !== "string" || typeof p.wersja !== "number" || typeof p.tokenHash !== "string") return null;
  const tokenHash = hashujToken(token);
  if (!porownajStale(p.tokenHash, tokenHash)) return null;
  const { data: link } = await supabaseSerwer()
    .from("access_links")
    .select("id, client_id, contact_id, label, token_hash, pin_hash, pin_pepper, pin_version, pin_temporary, revoked_at, frozen_at")
    .eq("id", p.linkId)
    .maybeSingle();
  if (!link || !porownajStale(link.token_hash, tokenHash)) return null;
  if (link.revoked_at || link.frozen_at || !link.pin_temporary || link.pin_version !== p.wersja) return null;
  return {
    link: { id: link.id, client_id: link.client_id, contact_id: link.contact_id, label: link.label, pin_hash: link.pin_hash, pin_pepper: link.pin_pepper, pin_version: link.pin_version },
    zapamietaj: p.zapamietaj === true,
  };
}

/** Własny PIN klienta (już po `walidujPinKlienta`). Zwraca nową wersję PIN-u albo null, gdy ktoś był szybszy (CAS). */
export async function zapiszPinKlienta(linkId: string, wersja: number, pin: string): Promise<number | null> {
  const { data, error } = await supabaseSerwer().rpc("ustaw_pin_klienta", { p_link: linkId, p_wersja: wersja, p_hash: await hashujPin(pin), p_tymczasowy: false });
  if (error) throw new Error(`ustaw_pin_klienta: ${error.message}`);
  return data ?? null;
}

/**
 * Nowy kod startowy od zespołu (utworzenie linku go nie używa, reset tak): 6 cyfr z crypto.randomBytes, ważny 7 dni,
 * odmraża link, zeruje blokady, podbija wersję PIN-u (sesje linku przestają działać). Null = link wygaszony.
 */
export async function wydajKodStartowy(linkId: string): Promise<{ kod: string; wersja: number } | null> {
  for (let proba = 0; proba < 3; proba++) {
    const { data: link } = await supabaseSerwer().from("access_links").select("pin_version, revoked_at").eq("id", linkId).maybeSingle();
    if (!link || link.revoked_at) return null;
    const kod = generujKodStartowy();
    const { data, error } = await supabaseSerwer().rpc("ustaw_pin_klienta", {
      p_link: linkId,
      p_wersja: link.pin_version,
      p_hash: await hashujPin(kod),
      p_tymczasowy: true,
      p_wygasa: new Date(Date.now() + MS_KODU).toISOString(),
    });
    if (error) throw new Error(`ustaw_pin_klienta: ${error.message}`);
    if (data !== null && data !== undefined) return { kod, wersja: data };
    // wersja zmieniła się w międzyczasie (klient ustawił PIN albo drugi reset): ponów z nową wersją
  }
  return null;
}

export function terminNowegoKodu(teraz = Date.now()): string {
  return new Date(teraz + MS_KODU).toISOString();
}

type LinkZdarzenia = { id: string; client_id: string; label: string };

/** Zdarzenie dostępu w kształcie z rozdz. 15 (slug, nazwa i kanał Slack klienta), żeby Zapier trafił na właściwy kanał. */
export async function zdarzenieDostepu(event: Extract<ZdarzenieOutbox, "bezpieczenstwo.blokada" | "bezpieczenstwo.link_zamrozony" | "klient.pin_ustawiony" | "klient.pin_zmieniony">, link: LinkZdarzenia, dodatkowe: Record<string, unknown> = {}): Promise<void> {
  const { data: klient } = await supabaseSerwer().from("clients").select("slug, name, slack_channel").eq("id", link.client_id).maybeSingle();
  const baza = env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const summary = copy.zdarzenia.dostep[event].replace("{osoba}", link.label).replace("{klient}", klient?.name ?? "");
  await dodajDoOutbox(event, {
    event,
    client_id: link.client_id,
    client_slug: klient?.slug ?? "",
    client_name: klient?.name ?? "",
    slack_channel: klient?.slack_channel ?? null,
    actor: link.label,
    access_link_id: link.id,
    url: `${baza}/zespol/klienci/${klient?.slug ?? ""}/dostep`,
    summary,
    ...dodatkowe,
  });
}

/**
 * Potwierdzona porażka zarezerwowanej próby PIN-u (logowanie albo „Zmień PIN"): licznik i blokady nabiła już
 * rezerwacja; tu alarm 24 h (tylko próba nr 10) i zamrożenie linku, audyt i outbox po odpowiedzi (`after`), żeby
 * ścieżki z alarmem i bez trwały tyle samo. `idDoLicznika` dla złego tokenu to identyfikator nieistniejący.
 */
export async function odnotujPorazkePinu(link: LinkZdarzenia | null, idDoLicznika: string, proby: number, ipHash: string): Promise<WynikNieudanejProby> {
  const proba = await potwierdzNieudanaProbePinu(idDoLicznika, proby);
  if (link && (proba.blokada24h || proba.zamrozony)) {
    after(async () => {
      if (proba.blokada24h) {
        await zapiszAudyt({ actor_kind: "system", action: "klient.blokada_24h", entity: "access_link", entity_id: link.id, client_id: link.client_id, ip_hash: ipHash });
        await zdarzenieDostepu("bezpieczenstwo.blokada", link, { proby: proba.proby, do: proba.zablokowanyDo });
      }
      if (proba.zamrozony) {
        await zapiszAudyt({ actor_kind: "system", action: "klient.link_zamrozony", entity: "access_link", entity_id: link.id, client_id: link.client_id, ip_hash: ipHash });
        await zdarzenieDostepu("bezpieczenstwo.link_zamrozony", link);
      }
    });
  }
  return proba;
}
