/**
 * Kolory terminów na pulpicie zespołu (SPEC rozdz. 12.1, CLAUDE.md „Marka"): TAKIE SAME jak w Bazie Klientów
 * agencji, bo zespół zna ten kod: niebieski 6-7 dni, żółty 4-5, pomarańczowy 1-3, czerwony dziś, szary po terminie.
 * Liczymy dni kalendarzowe w Europe/Warsaw (różnica dat, nie pełnych dób): termin jutro o 8:00 to „1 dzień"
 * także wieczorem dnia poprzedniego.
 */
import { dataLokalna } from "@/lib/harmonogram/kalendarz";

export type KolorTerminu = "niebieski" | "zolty" | "pomaranczowy" | "czerwony" | "szary";

const MS_DNIA = 86_400_000;

function dzienJakoLiczba(data: string): number {
  const [r, m, d] = data.split("-").map(Number);
  return Date.UTC(r ?? 1970, (m ?? 1) - 1, d ?? 1) / MS_DNIA;
}

/** Liczba dni kalendarzowych (Europe/Warsaw) od dziś do dnia terminu; ujemna po terminie. */
export function dniDoTerminu(termin: Date | string, teraz: Date): number {
  return dzienJakoLiczba(dataLokalna(termin)) - dzienJakoLiczba(dataLokalna(teraz));
}

export function kolorTerminu(termin: Date | string, teraz: Date): KolorTerminu {
  const ms = (typeof termin === "string" ? new Date(termin) : termin).getTime() - teraz.getTime();
  if (ms <= 0) return "szary";
  const dni = dniDoTerminu(termin, teraz);
  if (dni <= 0) return "czerwony";
  if (dni <= 3) return "pomaranczowy";
  if (dni <= 5) return "zolty";
  return "niebieski";
}

export const KLASA_TERMINU: Record<KolorTerminu, string> = {
  niebieski: "text-termin-niebieski",
  zolty: "text-termin-zolty",
  pomaranczowy: "text-termin-pomaranczowy",
  czerwony: "text-termin-czerwony",
  szary: "text-termin-szary",
};
