/**
 * Tokeny linków i PIN-y klienta (SPEC rozdz. 4). Sesje dochodzą w fazie 1.
 *
 * Zasada 5 z CLAUDE.md: wartości tokenów i PIN-ów pochodzą WYŁĄCZNIE z crypto.randomBytes.
 * Testy przekazują własny generator z ustalonym ziarnem przez parametr `losuj`; nikt nigdy
 * nie wpisuje tokenu ani PIN-u ręcznie, także w seedzie.
 *
 * Czysty Node (bez `server-only`), żeby seed i testy mogły importować ten moduł.
 * NIGDY nie importuj go w komponencie klienckim.
 */
import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { sha256Hex } from "./krypto";

/** Źródło losowości: n bajtów. Domyślnie crypto.randomBytes. */
export type Losuj = (n: number) => Buffer;

export const BAJTY_TOKENU = 16; // 128 bitów → 32 znaki hex
export const DLUGOSC_LOOKUP = 8;
export const DLUGOSC_PIN: Record<RodzajPinu, number> = { pin4: 4, pin6: 6, haslo: 10 };

export type RodzajPinu = "pin4" | "pin6" | "haslo";

/**
 * Parametry wg zaleceń OWASP (19 MiB, 2 iteracje, 1 wątek). Algorytm: argon2id, domyślny
 * w @node-rs/argon2 (const enum Algorithm jest niedostępny przy isolatedModules);
 * test jednostkowy sprawdza prefiks $argon2id$ w hashu.
 */
export const PARAMETRY_ARGON2 = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function generujToken(losuj: Losuj = randomBytes): string {
  return losuj(BAJTY_TOKENU).toString("hex");
}

export function tokenLookup(token: string): string {
  return token.slice(0, DLUGOSC_LOOKUP);
}

export function hashujToken(token: string): string {
  return sha256Hex(token);
}

export function czyPoprawnyFormatTokenu(token: string): boolean {
  return /^[0-9a-f]{32}$/.test(token);
}

const ALFABET_HASLA = "abcdefghjkmnpqrstuvwxyz23456789"; // bez 0/O, 1/l/i

/**
 * PIN z cyfr losowanych bez błędu modulo: bajt jest odrzucany, gdy przekracza 249,
 * więc każda cyfra 0-9 ma dokładnie 25/250 szans.
 */
export function generujPin(rodzaj: RodzajPinu, losuj: Losuj = randomBytes): string {
  const dlugosc = DLUGOSC_PIN[rodzaj];
  if (rodzaj === "haslo") return generujCiag(ALFABET_HASLA, dlugosc, losuj);
  let pin = "";
  while (pin.length < dlugosc) {
    const bajty = losuj(dlugosc);
    for (const bajt of bajty) {
      if (pin.length >= dlugosc) break;
      if (bajt < 250) pin += String(bajt % 10);
    }
  }
  return pin;
}

function generujCiag(alfabet: string, dlugosc: number, losuj: Losuj): string {
  const granica = Math.floor(256 / alfabet.length) * alfabet.length;
  let wynik = "";
  while (wynik.length < dlugosc) {
    const bajty = losuj(dlugosc);
    for (const bajt of bajty) {
      if (wynik.length >= dlugosc) break;
      if (bajt < granica) wynik += alfabet[bajt % alfabet.length];
    }
  }
  return wynik;
}

export async function hashujPin(pin: string): Promise<string> {
  return hash(pin, PARAMETRY_ARGON2);
}

export async function weryfikujPin(hashPinu: string, pin: string): Promise<boolean> {
  try {
    return await verify(hashPinu, pin, PARAMETRY_ARGON2);
  } catch {
    return false;
  }
}
