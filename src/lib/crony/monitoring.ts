/**
 * Monitoring cronów (plan domknięcia, Etap A): każdy cron zapisuje ostatni przebieg, a pulpit admina pokazuje baner,
 * gdy któryś stoi, kończy się błędami albo zdarzenia nie dochodzą do Zapiera. Awaria crona auto-akceptacji oznacza
 * pakiety, które utknęły, a to dokładnie problem z SPEC rozdz. 0. Czysta logika, bez bazy.
 */
export const CRONY = {
  "auto-akceptacja": { maksOdstepMin: 120 },
  outbox: { maksOdstepMin: 15 },
  faktury: { maksOdstepMin: 26 * 60 },
  retencja: { maksOdstepMin: 32 * 24 * 60 },
} as const;

export type NazwaCrona = keyof typeof CRONY;
export const NAZWY_CRONOW = Object.keys(CRONY) as NazwaCrona[];

export type PrzebiegCrona = { at: string; bledy: number };

export type ProblemCrona =
  | { cron: NazwaCrona; rodzaj: "brak" }
  | { cron: NazwaCrona; rodzaj: "opozniony"; ostatni: string }
  | { cron: NazwaCrona; rodzaj: "bledy"; bledy: number }
  | { cron: "outbox"; rodzaj: "nieudane"; liczba: number };

export function czyNazwaCrona(wartosc: string): wartosc is NazwaCrona {
  return (NAZWY_CRONOW as string[]).includes(wartosc);
}

/** Wartość zapisana w bazie; śmieci (ręczna edycja w panelu Supabase) traktujemy jak brak przebiegu. */
export function odczytajPrzebieg(wartosc: unknown): PrzebiegCrona | null {
  if (!wartosc || typeof wartosc !== "object") return null;
  const { at, bledy } = wartosc as Record<string, unknown>;
  if (typeof at !== "string" || Number.isNaN(new Date(at).getTime())) return null;
  return { at, bledy: typeof bledy === "number" && bledy > 0 ? Math.floor(bledy) : 0 };
}

/**
 * `wymagajPrzebiegu`: czy brak jakiegokolwiek zapisu to problem. Na produkcji tak (cron, który nigdy nie ruszył,
 * to np. plan Hobby albo zły CRON_SECRET); lokalnie crony nie chodzą same, więc tam brak zapisu nic nie znaczy.
 */
export function ocenCrony(przebiegi: Partial<Record<NazwaCrona, PrzebiegCrona>>, teraz: Date, o: { nieudaneOutbox: number; wymagajPrzebiegu: boolean }): ProblemCrona[] {
  const problemy: ProblemCrona[] = [];
  for (const cron of NAZWY_CRONOW) {
    const przebieg = przebiegi[cron];
    if (!przebieg) {
      if (o.wymagajPrzebiegu) problemy.push({ cron, rodzaj: "brak" });
      continue;
    }
    const minuty = (teraz.getTime() - new Date(przebieg.at).getTime()) / 60_000;
    if (minuty > CRONY[cron].maksOdstepMin) problemy.push({ cron, rodzaj: "opozniony", ostatni: przebieg.at });
    if (przebieg.bledy > 0) problemy.push({ cron, rodzaj: "bledy", bledy: przebieg.bledy });
  }
  if (o.nieudaneOutbox > 0) problemy.push({ cron: "outbox", rodzaj: "nieudane", liczba: o.nieudaneOutbox });
  return problemy;
}
