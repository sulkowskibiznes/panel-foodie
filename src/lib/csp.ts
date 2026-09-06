/**
 * Content-Security-Policy (SPEC rozdz. 16.6): skrypty wyłącznie własne i z nonce (zero `unsafe-inline`
 * dla skryptów), `frame-ancestors 'none'`, obrazy, wideo i połączenia tylko do własnego adresu i do
 * Storage Supabase (signed URL i PUT z przeglądarki). Czysty moduł: buduje nagłówek, nic nie czyta z Next.
 *
 * Nonce generuje proxy dla każdego żądania; Next dokleja go do własnych skryptów i skryptów hydratacji, gdy
 * widzi go w nagłówku `Content-Security-Policy` ŻĄDANIA (stąd proxy ustawia nagłówek po obu stronach).
 * Style inline zostają dozwolone: komponenty podglądów ustawiają proporcje i szerokości paska postępu
 * atrybutem `style`, a SPEC wymaga zakazu `unsafe-inline` tylko dla skryptów.
 */
export type OpcjeCsp = {
  nonce: string;
  /** Tryb deweloperski: React potrzebuje `unsafe-eval` (odtwarzanie stosów błędów), HMR łączy się po WebSocket. */
  dev: boolean;
  /** Adres projektu Supabase (signed URL do plików, PUT uploadu z przeglądarki). Null = tylko własny adres. */
  supabaseUrl: string | null;
};

export const NAGLOWEK_CSP = "Content-Security-Policy";
export const NAGLOWEK_NONCE = "x-nonce";

/** Origin (schemat + host + port) z adresu; niepoprawny adres pomijamy zamiast psuć nagłówek. */
export function originZAdresu(adres: string | null | undefined): string | null {
  if (!adres) return null;
  try {
    return new URL(adres).origin;
  } catch {
    return null;
  }
}

/** Nonce: 16 bajtów losowych w base64 (Web Crypto, dostępne w proxy i w Node). */
export function nowyNonce(): string {
  const bajty = new Uint8Array(16);
  crypto.getRandomValues(bajty);
  let binarnie = "";
  for (const b of bajty) binarnie += String.fromCharCode(b);
  return btoa(binarnie);
}

export function zbudujCsp(o: OpcjeCsp): string {
  const supabase = originZAdresu(o.supabaseUrl);
  const zdalne = supabase ? ` ${supabase}` : "";
  // W trybie deweloperskim `'self'` nie zawsze obejmuje ws:// (HMR), więc dopisujemy jawnie.
  const websockety = o.dev ? " ws://localhost:* ws://127.0.0.1:*" : "";
  const dyrektywy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${o.nonce}' 'strict-dynamic'${o.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data:${zdalne}`,
    `media-src 'self' blob:${zdalne}`,
    `connect-src 'self'${zdalne}${websockety}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
  ];
  if (!o.dev) dyrektywy.push("upgrade-insecure-requests");
  return dyrektywy.join("; ");
}

/** Wartość `script-src` z nagłówka (do testów i diagnostyki). */
export function dyrektywa(csp: string, nazwa: string): string | null {
  const znaleziona = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${nazwa} `) || d === nazwa);
  return znaleziona ? znaleziona.slice(nazwa.length).trim() : null;
}
