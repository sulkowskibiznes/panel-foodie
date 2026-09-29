/**
 * Czysta logika logowania linkiem i PIN-em albo kodem startowym (SPEC rozdz. 4.3), bez Next i bez bazy:
 * zależności wstrzykiwane, żeby test jednostkowy mógł policzyć wywołania argon2.
 *
 * Inwariant: dokładnie JEDNO wywołanie `weryfikuj` na każdą próbę, także przy złym tokenie,
 * wygaszonym linku i blokadzie. Dzięki temu zły token i zły PIN kosztują tyle samo czasu.
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

/** `ustawPin`: poprawny kod startowy; zamiast sesji pozwolenie na ustawienie własnego PIN-u. */
export type WynikLogowania =
  | { ok: true; link: LinkDoLogowania; ustawPin: boolean }
  | { ok: false; powod: PowodOdmowy; link: LinkDoLogowania | null };

export type ZaleznosciLogowania = {
  znajdzLink: (lookup: string) => Promise<LinkDoLogowania | null>;
  /** `zPieprzem: false` tylko dla hashy sprzed Etapu 2; hash-atrapa jest z pieprzem. */
  weryfikuj: (hashPinu: string, pin: string, zPieprzem: boolean) => Promise<boolean>;
  hashAtrapa: string;
  teraz: () => Date;
};

export async function weryfikujLogowanie(token: string, pin: string, d: ZaleznosciLogowania): Promise<WynikLogowania> {
  const formatOk = czyPoprawnyFormatTokenu(token);
  const link = formatOk ? await d.znajdzLink(tokenLookup(token)) : null;
  const tokenOk = link !== null && porownajStale(link.token_hash, hashujToken(token));

  // Zawsze jedna weryfikacja argon2: przy złym tokenie na hashu-atrapie.
  const pinOk = await d.weryfikuj(tokenOk && link ? link.pin_hash : d.hashAtrapa, pin, tokenOk && link ? link.pin_pepper : true);

  if (!formatOk) return { ok: false, powod: "zly_format", link: null };
  if (!tokenOk || !link) return { ok: false, powod: "zly_token", link: null };
  if (link.revoked_at) return { ok: false, powod: "wygaszony", link };
  if (link.frozen_at) return { ok: false, powod: "zamrozony", link };
  const teraz = d.teraz().getTime();
  if (link.locked_until && new Date(link.locked_until).getTime() > teraz) {
    return { ok: false, powod: "blokada", link };
  }
  if (!pinOk) return { ok: false, powod: "zly_pin", link };
  // Termin kodu sprawdzany dopiero po argon2 (ten sam czas co zły PIN); null = kod sprzed Etapu 2, bez terminu.
  if (link.pin_temporary && link.pin_temporary_expires_at && new Date(link.pin_temporary_expires_at).getTime() <= teraz) {
    return { ok: false, powod: "kod_wygasl", link };
  }
  return { ok: true, link, ustawPin: link.pin_temporary };
}
