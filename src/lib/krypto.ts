/**
 * Prymitywy kryptograficzne panelu. Czysty Node, bez zależności od React,
 * żeby seed i testy mogły importować ten moduł. NIGDY nie importuj go w komponencie klienckim.
 *
 * Z jednego SESSION_SECRET wyprowadzamy (HKDF) niezależne klucze:
 * - cookie:  HMAC podpisu cookie sesji klienta,
 * - token:   AES-256-GCM dla access_links.token_enc („Kopiuj dostęp"),
 * - ip:      pieprz do hashowania adresów IP w audycie i limitach,
 * - podglad: podpis tokenu „Zobacz jak klient" (faza 3),
 * - upload:  podpis pozwolenia na upload pliku do Storage (faza 3),
 * - import:  podpis adresów miniatur z Dysku na ekranie mapowania (faza 4).
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export type CelKlucza = "cookie" | "token" | "ip" | "podglad" | "upload" | "import";

const SOL_HKDF = "panel-foodie";
const DLUGOSC_KLUCZA = 32;
const DLUGOSC_IV = 12;
const DLUGOSC_TAGU = 16;
const PREFIKS_SZYFROGRAMU = "v1.";

const pamiecKluczy = new Map<string, Buffer>();

export function wyprowadzKlucz(sekret: string, cel: CelKlucza): Buffer {
  if (sekret.length < 32) {
    throw new Error("SESSION_SECRET musi mieć co najmniej 32 znaki (openssl rand -hex 32)");
  }
  const id = `${cel}:${sha256Hex(sekret)}`;
  const zapamietany = pamiecKluczy.get(id);
  if (zapamietany) return zapamietany;
  const klucz = Buffer.from(
    hkdfSync("sha256", sekret, SOL_HKDF, `panel-foodie:${cel}`, DLUGOSC_KLUCZA),
  );
  pamiecKluczy.set(id, klucz);
  return klucz;
}

export function sha256Hex(dane: string | Buffer): string {
  return createHash("sha256").update(dane).digest("hex");
}

export function hmacHex(klucz: Buffer, dane: string): string {
  return createHmac("sha256", klucz).update(dane).digest("hex");
}

/** Porównanie w stałym czasie. Różne długości też kosztują tyle samo co porównanie. */
export function porownajStale(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** AES-256-GCM. Wynik: "v1." + base64url(iv | tag | szyfrogram). */
export function zaszyfruj(klucz: Buffer, jawny: string): string {
  const iv = randomBytes(DLUGOSC_IV);
  const szyfr = createCipheriv("aes-256-gcm", klucz, iv);
  const szyfrogram = Buffer.concat([szyfr.update(jawny, "utf8"), szyfr.final()]);
  const tag = szyfr.getAuthTag();
  return PREFIKS_SZYFROGRAMU + Buffer.concat([iv, tag, szyfrogram]).toString("base64url");
}

export function odszyfruj(klucz: Buffer, zaszyfrowane: string): string {
  if (!zaszyfrowane.startsWith(PREFIKS_SZYFROGRAMU)) {
    throw new Error("Nieznany format szyfrogramu");
  }
  const dane = Buffer.from(zaszyfrowane.slice(PREFIKS_SZYFROGRAMU.length), "base64url");
  if (dane.length < DLUGOSC_IV + DLUGOSC_TAGU) {
    throw new Error("Szyfrogram jest za krótki");
  }
  const iv = dane.subarray(0, DLUGOSC_IV);
  const tag = dane.subarray(DLUGOSC_IV, DLUGOSC_IV + DLUGOSC_TAGU);
  const szyfrogram = dane.subarray(DLUGOSC_IV + DLUGOSC_TAGU);
  const deszyfr = createDecipheriv("aes-256-gcm", klucz, iv);
  deszyfr.setAuthTag(tag);
  return Buffer.concat([deszyfr.update(szyfrogram), deszyfr.final()]).toString("utf8");
}

/** Hash IP z pieprzem: w audycie i limitach nigdy nie trzymamy IP w jawnej postaci. */
export function hashujIp(kluczIp: Buffer, ip: string): string {
  return hmacHex(kluczIp, ip.trim());
}
