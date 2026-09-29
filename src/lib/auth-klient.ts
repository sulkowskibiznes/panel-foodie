/**
 * Tokeny linków, kody startowe i PIN-y klienta (SPEC rozdz. 4).
 *
 * Zasada 5 z CLAUDE.md: tokeny i kody startowe pochodzą WYŁĄCZNIE z crypto.randomBytes. Testy przekazują
 * własny generator z ustalonym ziarnem przez parametr `losuj`. Własny PIN klienta (Etap 2 planu domknięcia)
 * wpisuje klient: przechodzi przez `walidujPinKlienta` i od razu trafia do `hashujPin` (argon2id z pieprzem).
 *
 * Czysty Node (bez `server-only`), żeby seed i testy mogły importować ten moduł.
 * NIGDY nie importuj go w komponencie klienckim.
 */
import { createHmac, randomBytes } from "node:crypto";
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

/** Kod startowy od zespołu: 6 cyfr z crypto.randomBytes, jednorazowy, ważny 7 dni (Etap 2 planu domknięcia). */
export const DNI_KODU_STARTOWEGO = 7;

export function generujKodStartowy(losuj: Losuj = randomBytes): string {
  return generujPin("pin6", losuj);
}

/**
 * Pieprz z `PIN_PEPPER` (osobny od SESSION_SECRET, tylko w zmiennych środowiska): PIN 4-6 cyfr ma najwyżej milion
 * wartości, więc sam argon2 z kopii bazy da się przejść offline. HMAC kluczem spoza bazy zamyka tę drogę.
 */
export function pieprzZSrodowiska(): string {
  const pieprz = process.env.PIN_PEPPER;
  if (!pieprz || pieprz.length < 32) throw new Error("PIN_PEPPER: co najmniej 32 znaki (openssl rand -hex 32), osobno od SESSION_SECRET. Sprawdź .env.local wg .env.example.");
  return pieprz;
}

function zPieprzem(pin: string, pieprz: string): string {
  return createHmac("sha256", pieprz).update(pin, "utf8").digest("hex");
}

export async function hashujPin(pin: string, pieprz: string = pieprzZSrodowiska()): Promise<string> {
  return hash(zPieprzem(pin, pieprz), PARAMETRY_ARGON2);
}

/** `pieprz: null` = hash sprzed Etapu 2 (`access_links.pin_pepper = false`), weryfikowany bez HMAC. Zawsze jedno argon2. */
export async function weryfikujPin(hashPinu: string, pin: string, pieprz: string | null = pieprzZSrodowiska()): Promise<boolean> {
  try {
    return await verify(hashPinu, pieprz === null ? pin : zPieprzem(pin, pieprz), PARAMETRY_ARGON2);
  } catch {
    return false;
  }
}

export const PIN_KLIENTA_MIN = 4;
export const PIN_KLIENTA_MAX = 6;

export type PowodOdrzuceniaPinu = "format" | "slaby";

/**
 * Popularne PIN-y, których nie łapią reguły niżej (układ klawiatury, symbole, ciągi co dwa). Wszystko, co jest
 * powtórzeniem, ciągiem, blokiem, podwojeniem, rokiem albo datą, odrzucają reguły, nie ta lista.
 */
const POPULARNE_PINY = new Set([
  "0001", "0007", "0852", "0963", "1000", "1004", "1024", "1357", "1379", "1470", "1478", "1590", "2468", "2580", "3690",
  "4826", "5683", "6969", "7410", "7531", "7896", "8520", "8642", "9510", "9731",
  "13579", "24680", "12321",
  "100200", "102030", "123321", "135790", "142536", "147258", "147852", "159357", "159753", "159951", "246810", "258369",
  "271828", "314159", "456123", "741852", "753951", "789456", "852456", "963852", "987456",
]);

function czyDzienMiesiac(dzien: number, miesiac: number): boolean {
  const dni = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return miesiac >= 1 && miesiac <= 12 && dzien >= 1 && dzien <= (dni[miesiac - 1] ?? 0);
}

/** Każdy krok o +1 albo o -1 (z przejściem 9→0 i 0→9): 1234, 7890, 8901, 3210, 654321. */
function czyCiag(pin: string): boolean {
  const cyfry = [...pin].map(Number);
  const kroki = cyfry.slice(1).map((c, i) => (c - (cyfry[i] ?? 0) + 10) % 10);
  return kroki.every((k) => k === 1) || kroki.every((k) => k === 9);
}

/** Powtarzający się blok: 1111, 1212, 12121, 121212, 123123. */
function czyBlok(pin: string): boolean {
  for (let okres = 1; okres * 2 <= pin.length; okres++) {
    if ([...pin].every((c, i) => i < okres || c === pin[i - okres])) return true;
  }
  return false;
}

/** Podwojenia: 1122, 112233, 445566. */
function czyPodwojenia(pin: string): boolean {
  if (pin.length % 2 !== 0) return false;
  for (let i = 0; i < pin.length; i += 2) if (pin[i] !== pin[i + 1]) return false;
  return true;
}

/** Rok 1940-2039, data DDMM i MMDD (4 cyfry), DDMMRR i MMDDRR (6 cyfr). */
function czyDataLubRok(pin: string): boolean {
  const n = (od: number, ile: number) => Number(pin.slice(od, od + ile));
  if (pin.length === 4) {
    const rok = Number(pin);
    return (rok >= 1940 && rok <= 2039) || czyDzienMiesiac(n(0, 2), n(2, 2)) || czyDzienMiesiac(n(2, 2), n(0, 2));
  }
  if (pin.length === 6) return czyDzienMiesiac(n(0, 2), n(2, 2)) || czyDzienMiesiac(n(2, 2), n(0, 2));
  return false;
}

/**
 * Polityka własnego PIN-u klienta (decyzja Szymona 2026-09-29: 4 do 6 cyfr). Odrzuca PIN-y, które da się zgadnąć
 * w kilku próbach, zanim zadziała blokada: powtórzenia, ciągi, bloki, podwojenia, lata, daty i popularne PIN-y.
 */
export function walidujPinKlienta(pin: string): { ok: true } | { ok: false; powod: PowodOdrzuceniaPinu } {
  if (!new RegExp(`^\\d{${PIN_KLIENTA_MIN},${PIN_KLIENTA_MAX}}$`).test(pin)) return { ok: false, powod: "format" };
  if (czyBlok(pin) || czyCiag(pin) || czyPodwojenia(pin) || czyDataLubRok(pin) || POPULARNE_PINY.has(pin)) return { ok: false, powod: "slaby" };
  return { ok: true };
}

let atrapa: Promise<string> | undefined;

/**
 * Hash-atrapa do ścieżki „zły token": argon2 weryfikuje PIN na nim, żeby odpowiedź kosztowała
 * tyle samo czasu, co przy prawdziwym linku. Losowa wartość, liczona raz na proces.
 */
export function hashAtrapa(): Promise<string> {
  atrapa ??= hashujPin(randomBytes(16).toString("hex"));
  return atrapa;
}
