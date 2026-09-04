/**
 * Podpisane, wygasające ładunki bez stanu w bazie: token podglądu klienta (impersonacja) i pozwolenie na upload.
 * Postać: base64url(JSON) + "." + HMAC-SHA256. Czysty Node, klucz z HKDF (lib/krypto.ts).
 */
import { hmacHex, porownajStale } from "@/lib/krypto";

export type Ladunek = Record<string, string | number | boolean | null>;

export function podpiszLadunek(klucz: Buffer, ladunek: Ladunek): string {
  const dane = Buffer.from(JSON.stringify(ladunek), "utf8").toString("base64url");
  return `${dane}.${hmacHex(klucz, dane)}`;
}

/** Ładunek z podpisanego tokenu albo null, gdy podpis się nie zgadza, format jest zły albo `wygasaO` minęło. */
export function odczytajLadunek<T extends Ladunek>(klucz: Buffer, token: string, teraz: Date): T | null {
  const kropka = token.lastIndexOf(".");
  if (kropka <= 0) return null;
  const dane = token.slice(0, kropka);
  const podpis = token.slice(kropka + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(dane) || !/^[0-9a-f]{64}$/.test(podpis)) return null;
  if (!porownajStale(podpis, hmacHex(klucz, dane))) return null;
  let ladunek: unknown;
  try {
    ladunek = JSON.parse(Buffer.from(dane, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!ladunek || typeof ladunek !== "object") return null;
  const wygasaO = (ladunek as { wygasaO?: unknown }).wygasaO;
  if (typeof wygasaO !== "number" || wygasaO <= teraz.getTime()) return null;
  return ladunek as T;
}
