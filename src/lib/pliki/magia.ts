/**
 * Rozpoznawanie plików po magic bytes i limity wagi (SPEC rozdz. 13.4, 16 pkt 11). Czysta logika:
 * używa jej finalizacja uploadu po stronie serwera i testy jednostkowe. Rozszerzenie nazwy nic nie znaczy.
 */
export type RodzajPliku = "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "video/mp4" | "video/quicktime";

export const MB = 1024 * 1024;
export const MAKS_BAJTOW_OBRAZU = 25 * MB;
export const MAKS_BAJTOW_WIDEO = 300 * MB;
export const OSTRZEZENIE_BAJTOW_WIDEO = 150 * MB;
/** Tyle bajtów wystarczy do rozpoznania każdego z obsługiwanych formatów. */
export const BAJTOW_MAGII = 16;

export const ROZSZERZENIA: Record<RodzajPliku, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export const RODZAJE_PLIKOW = Object.keys(ROZSZERZENIA) as RodzajPliku[];

export function czyRodzajPliku(mime: string): mime is RodzajPliku {
  return (RODZAJE_PLIKOW as string[]).includes(mime);
}

export function czyObraz(rodzaj: RodzajPliku): boolean {
  return rodzaj.startsWith("image/");
}

export function limitBajtow(rodzaj: RodzajPliku): number {
  return czyObraz(rodzaj) ? MAKS_BAJTOW_OBRAZU : MAKS_BAJTOW_WIDEO;
}

const ascii = (b: Uint8Array, od: number, dl: number) => String.fromCharCode(...b.subarray(od, od + dl));

const MARKI_HEIC = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);
const MARKI_MP4 = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "mp4v", "M4V ", "M4A ", "dash", "MSNV", "f4v ", "3gp4", "3gp5"]);

/** Rodzaj pliku z pierwszych bajtów albo null, gdy to nie jest żaden z obsługiwanych formatów. */
export function rozpoznajMagie(bajty: Uint8Array): RodzajPliku | null {
  if (bajty.length < 12) return null;
  if (bajty[0] === 0xff && bajty[1] === 0xd8 && bajty[2] === 0xff) return "image/jpeg";
  if (bajty[0] === 0x89 && ascii(bajty, 1, 3) === "PNG" && bajty[4] === 0x0d && bajty[5] === 0x0a && bajty[6] === 0x1a && bajty[7] === 0x0a) return "image/png";
  if (ascii(bajty, 0, 4) === "RIFF" && ascii(bajty, 8, 4) === "WEBP") return "image/webp";
  if (ascii(bajty, 4, 4) === "ftyp") {
    const marka = ascii(bajty, 8, 4);
    if (MARKI_HEIC.has(marka)) return "image/heic";
    if (marka === "qt  ") return "video/quicktime";
    if (MARKI_MP4.has(marka)) return "video/mp4";
    return null;
  }
  return null;
}

export type WynikSprawdzenia =
  | { ok: true; rodzaj: RodzajPliku; ostrzezenie: "duzeWideo" | null }
  | { ok: false; powod: "nieobslugiwany" | "zaDuzy" | "niezgodnyZDeklaracja"; rodzaj: RodzajPliku | null; limit?: number };

/**
 * Plik przechodzi, gdy magic bytes wskazują obsługiwany format, zadeklarowany typ (z przeglądarki) to ten sam
 * rodzaj mediów (obraz albo wideo) i waga mieści się w limicie. Wideo powyżej 150 MB dostaje ostrzeżenie.
 */
export function sprawdzPlik(p: { bajtyPoczatku: Uint8Array; bytes: number; zadeklarowanyMime: string }): WynikSprawdzenia {
  const rodzaj = rozpoznajMagie(p.bajtyPoczatku);
  if (!rodzaj) return { ok: false, powod: "nieobslugiwany", rodzaj: null };
  const deklaracjaObraz = p.zadeklarowanyMime.startsWith("image/");
  const deklaracjaWideo = p.zadeklarowanyMime.startsWith("video/");
  if ((deklaracjaObraz && !czyObraz(rodzaj)) || (deklaracjaWideo && czyObraz(rodzaj))) return { ok: false, powod: "niezgodnyZDeklaracja", rodzaj };
  const limit = limitBajtow(rodzaj);
  if (p.bytes > limit) return { ok: false, powod: "zaDuzy", rodzaj, limit };
  return { ok: true, rodzaj, ostrzezenie: !czyObraz(rodzaj) && p.bytes > OSTRZEZENIE_BAJTOW_WIDEO ? "duzeWideo" : null };
}

export function formatujMB(bajty: number): string {
  return `${Math.round((bajty / MB) * 10) / 10} MB`;
}
