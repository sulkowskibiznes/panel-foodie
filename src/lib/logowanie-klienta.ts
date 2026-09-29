/**
 * Czysta logika logowania linkiem i PIN-em albo kodem startowym (SPEC rozdz. 4.3), bez Next i bez bazy:
 * zależności wstrzykiwane, żeby test jednostkowy mógł policzyć wywołania argon2.
 *
 * Inwarianty: dokładnie JEDNA rezerwacja próby i JEDNO wywołanie `weryfikuj` na każdą próbę, także przy złym tokenie,
 * wygaszonym linku i blokadzie (zły token i zły PIN kosztują tyle samo). O blokadzie i zamrożeniu decyduje
 * rezerwacja zrobiona PRZED argon2 pod blokadą wiersza, nie odczyt linku: równoległe próby nie ominą blokady.
 */
import { czyPoprawnyFormatTokenu, hashujToken, tokenLookup } from "./auth-klient";
import { porownajStale } from "./krypto";

export type LinkDoLogowania = {
  id: string;
  client_id: string;
  contact_id: string | null;
  label: string;
  can_approve: boolean;
  token_hash: string;
  pin_hash: string;
  /** false = hash sprzed Etapu 2, bez pieprzu. */
  pin_pepper: boolean;
  /** true = w `pin_hash` jest kod startowy od zespołu: po nim klient ustawia własny PIN, bez sesji. */
  pin_temporary: boolean;
  pin_temporary_expires_at: string | null;
  pin_version: number;
  revoked_at: string | null;
  locked_until: string | null;
  frozen_at: string | null;
};

export type PowodOdmowy = "zly_format" | "zly_token" | "zly_pin" | "blokada" | "wygaszony" | "zamrozony" | "kod_wygasl";

/** Wynik rezerwacji próby (funkcja SQL zarezerwuj_probe_pinu); dla złego tokenu rezerwacja „na pusto". */
export type Rezerwacja = { dozwolona: boolean; proby: number; zamrozony: boolean };

/**
 * `ustawPin`: poprawny kod startowy; zamiast sesji pozwolenie na ustawienie własnego PIN-u. `proby`: numer
 * zarezerwowanej próby (0 bez linku), potrzebny do potwierdzenia porażki albo wyzerowania licznika po sukcesie.
 */
export type WynikLogowania =
  | { ok: true; link: LinkDoLogowania; ustawPin: boolean; proby: number }
  | { ok: false; powod: PowodOdmowy; link: LinkDoLogowania | null; proby: number };

export type ZaleznosciLogowania = {
  znajdzLink: (lookup: string) => Promise<LinkDoLogowania | null>;
  /** `null` = brak linku (zły format lub token): rezerwacja na nieistniejącym wierszu, ten sam koszt. */
  rezerwuj: (linkId: string | null) => Promise<Rezerwacja>;
  /** `zPieprzem: false` tylko dla hashy sprzed Etapu 2; hash-atrapa jest z pieprzem. */
  weryfikuj: (hashPinu: string, pin: string, zPieprzem: boolean) => Promise<boolean>;
  hashAtrapa: string;
  teraz: () => Date;
};

export async function weryfikujLogowanie(token: string, pin: string, d: ZaleznosciLogowania): Promise<WynikLogowania> {
  const formatOk = czyPoprawnyFormatTokenu(token);
  const link = formatOk ? await d.znajdzLink(tokenLookup(token)) : null;
  const tokenOk = link !== null && porownajStale(link.token_hash, hashujToken(token));

  // Rezerwacja próby przed argon2: nabija licznik i mówi, czy link nie był zablokowany ani zamrożony.
  const rez = await d.rezerwuj(tokenOk && link ? link.id : null);
  // Zawsze jedna weryfikacja argon2: przy złym tokenie na hashu-atrapie.
  const pinOk = await d.weryfikuj(tokenOk && link ? link.pin_hash : d.hashAtrapa, pin, tokenOk && link ? link.pin_pepper : true);

  if (!formatOk) return { ok: false, powod: "zly_format", link: null, proby: 0 };
  if (!tokenOk || !link) return { ok: false, powod: "zly_token", link: null, proby: 0 };
  const proby = rez.proby;
  if (link.revoked_at) return { ok: false, powod: "wygaszony", link, proby };
  if (rez.zamrozony) return { ok: false, powod: "zamrozony", link, proby };
  if (!rez.dozwolona) return { ok: false, powod: "blokada", link, proby };
  if (!pinOk) return { ok: false, powod: "zly_pin", link, proby };
  // Termin kodu sprawdzany dopiero po argon2 (ten sam czas co zły PIN); null = kod sprzed Etapu 2, bez terminu.
  if (link.pin_temporary && link.pin_temporary_expires_at && new Date(link.pin_temporary_expires_at).getTime() <= d.teraz().getTime()) {
    return { ok: false, powod: "kod_wygasl", link, proby };
  }
  return { ok: true, link, ustawPin: link.pin_temporary, proby };
}
