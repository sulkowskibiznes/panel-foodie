import type { Database } from "@/lib/db-types";

/** Macierz zasób × rola z SPEC rozdz. 2. Jedno miejsce; zmiana roli = zmiana tutaj. */
export type Rola = Database["public"]["Enums"]["team_role"];
export type Zasob = "klienci" | "materialy" | "kampanie" | "harmonogram" | "raporty" | "faktury" | "dokumenty" | "dostep" | "ustawienia";
export type Poziom = "brak" | "podglad" | "pelne";

const P = { brak: 0, podglad: 1, pelne: 2 } as const;

export const MACIERZ_UPRAWNIEN: Record<Rola, Record<Zasob, Poziom>> = {
  admin: { klienci: "pelne", materialy: "pelne", kampanie: "pelne", harmonogram: "pelne", raporty: "pelne", faktury: "pelne", dokumenty: "pelne", dostep: "pelne", ustawienia: "pelne" },
  csm: { klienci: "pelne", materialy: "pelne", kampanie: "pelne", harmonogram: "pelne", raporty: "pelne", faktury: "pelne", dokumenty: "pelne", dostep: "pelne", ustawienia: "brak" },
  content_creator: { klienci: "podglad", materialy: "pelne", kampanie: "pelne", harmonogram: "pelne", raporty: "podglad", faktury: "brak", dokumenty: "brak", dostep: "brak", ustawienia: "brak" },
  media_buyer: { klienci: "podglad", materialy: "podglad", kampanie: "pelne", harmonogram: "podglad", raporty: "pelne", faktury: "brak", dokumenty: "brak", dostep: "brak", ustawienia: "brak" },
  sales: { klienci: "podglad", materialy: "podglad", kampanie: "podglad", harmonogram: "podglad", raporty: "podglad", faktury: "brak", dokumenty: "brak", dostep: "brak", ustawienia: "brak" },
};

/** Role, które widzą wszystkich klientów; reszta tylko przypisanych (client_assignments albo opiekun). */
export const WIDZI_WSZYSTKICH_KLIENTOW: readonly Rola[] = ["admin", "sales"];

/** Role z prawem do impersonacji („Zobacz jak klient"). `sales` dostaje klienta demo, nie impersonację. */
export const MOZE_IMPERSONOWAC: readonly Rola[] = ["admin", "csm"];

/**
 * „Zobacz jak klient" (SPEC rozdz. 2, rozdz. 20 poz. 21): admin i csm dla każdego klienta; `sales` wyłącznie
 * dla klienta demonstracyjnego, bo to jego jedyny sposób pokazania panelu potencjalnym klientom.
 */
export function mozeImpersonowac(rola: Rola, klientDemo: boolean): boolean {
  return MOZE_IMPERSONOWAC.includes(rola) || (rola === "sales" && klientDemo);
}

/** Role z prawem do odszyfrowania tokenu linku (`token_enc`), SPEC rozdz. 16 pkt 12. Każde odszyfrowanie = wpis `link.odszyfrowany`. */
export const MOZE_ODSZYFROWAC_TOKEN: readonly Rola[] = ["admin", "csm"];

export function poziomUprawnienia(rola: Rola, zasob: Zasob): Poziom {
  return MACIERZ_UPRAWNIEN[rola][zasob];
}

export function maUprawnienie(rola: Rola, zasob: Zasob, minimum: Exclude<Poziom, "brak">): boolean {
  return P[poziomUprawnienia(rola, zasob)] >= P[minimum];
}
