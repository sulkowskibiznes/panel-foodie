/**
 * Czysta logika logowania linkiem i PIN-em (SPEC rozdz. 4.3), bez Next i bez bazy:
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
  revoked_at: string | null;
  locked_until: string | null;
};

export type PowodOdmowy = "zly_format" | "zly_token" | "zly_pin" | "blokada" | "wygaszony";

export type WynikLogowania =
  | { ok: true; link: LinkDoLogowania }
  | { ok: false; powod: PowodOdmowy; link: LinkDoLogowania | null };

export type ZaleznosciLogowania = {
  znajdzLink: (lookup: string) => Promise<LinkDoLogowania | null>;
  weryfikuj: (hashPinu: string, pin: string) => Promise<boolean>;
  hashAtrapa: string;
  teraz: () => Date;
};

export async function weryfikujLogowanie(token: string, pin: string, d: ZaleznosciLogowania): Promise<WynikLogowania> {
  const formatOk = czyPoprawnyFormatTokenu(token);
  const link = formatOk ? await d.znajdzLink(tokenLookup(token)) : null;
  const tokenOk = link !== null && porownajStale(link.token_hash, hashujToken(token));

  // Zawsze jedna weryfikacja argon2: przy złym tokenie na hashu-atrapie.
  const pinOk = await d.weryfikuj(tokenOk && link ? link.pin_hash : d.hashAtrapa, pin);

  if (!formatOk) return { ok: false, powod: "zly_format", link: null };
  if (!tokenOk || !link) return { ok: false, powod: "zly_token", link: null };
  if (link.revoked_at) return { ok: false, powod: "wygaszony", link };
  if (link.locked_until && new Date(link.locked_until).getTime() > d.teraz().getTime()) {
    return { ok: false, powod: "blokada", link };
  }
  if (!pinOk) return { ok: false, powod: "zly_pin", link };
  return { ok: true, link };
}
