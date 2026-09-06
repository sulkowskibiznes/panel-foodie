/**
 * Wysyłka outboxu do Zapiera (SPEC rozdz. 15): cron co minutę, 5 prób z narastającym odstępem,
 * jeden generyczny webhook. Czysta logika z wstrzykiwanymi zależnościami; trasa /api/cron/outbox
 * i lib/outbox/baza.ts tylko ją spinają z bazą i siecią. Panel nie zna Slacka: routing robi Zapier.
 *
 * Współbieżność: dwa nakładające się przebiegi crona nie wyślą tego samego wiersza dwa razy, bo wiersz
 * jest najpierw zajmowany warunkowym UPDATE-em (attempts = dotychczasowe), a dopiero potem wysyłany.
 */
export const MAKS_PROB = 5;
/** Odstęp po n-tej nieudanej próbie (minuty); po piątej wiersz dostaje `failed`. */
export const ODSTEPY_MIN = [1, 5, 15, 60] as const;
/** Na czas wysyłki wiersz jest niewidoczny dla innych przebiegów. */
export const MIN_ZAJECIA = 2;
export const MS_LIMITU_ZADANIA = 10_000;

export function odstepPoProbie(nieudanychProb: number): number | null {
  if (nieudanychProb >= MAKS_PROB) return null;
  return ODSTEPY_MIN[nieudanychProb - 1] ?? ODSTEPY_MIN[ODSTEPY_MIN.length - 1] ?? null;
}

export type WierszOutbox = { id: number; event: string; payload: Record<string, unknown>; attempts: number };
export type WynikZadania = { ok: true; status: number } | { ok: false; blad: string };

export type ZaleznosciOutbox = {
  pobierzOczekujace(teraz: Date, limit: number): Promise<WierszOutbox[]>;
  /** true = wiersz zajęty przez ten przebieg (attempts podbite o 1, termin odsunięty); false = ktoś inny już go wziął albo status się zmienił. */
  zajmij(id: number, attempts: number, doKiedy: Date): Promise<boolean>;
  wyslij(cialo: Record<string, unknown>): Promise<WynikZadania>;
  oznaczWyslane(id: number, attempts: number, teraz: Date): Promise<void>;
  oznaczNieudane(id: number, dane: { attempts: number; blad: string; nextAttemptAt: Date | null; failed: boolean }): Promise<void>;
  teraz(): Date;
};

export type WynikWysylki = { sprawdzone: number; wyslane: number[]; ponowione: number[]; porzucone: number[]; pominiete: number[] };

/** Ciało webhooka: payload z bazy plus `event` z kolumny (kolumna wygrywa, gdy payload ma własne pole). */
export function cialoWebhooka(w: Pick<WierszOutbox, "event" | "payload">): Record<string, unknown> {
  return { ...w.payload, event: w.event };
}

export async function uruchomWysylkeOutbox(d: ZaleznosciOutbox, limit = 50): Promise<WynikWysylki> {
  const start = d.teraz();
  const wiersze = await d.pobierzOczekujace(start, limit);
  const wynik: WynikWysylki = { sprawdzone: wiersze.length, wyslane: [], ponowione: [], porzucone: [], pominiete: [] };
  for (const w of wiersze) {
    const teraz = d.teraz();
    if (!(await d.zajmij(w.id, w.attempts, new Date(teraz.getTime() + MIN_ZAJECIA * 60_000)))) {
      wynik.pominiete.push(w.id);
      continue;
    }
    const proba = w.attempts + 1;
    let odpowiedz: WynikZadania;
    try {
      odpowiedz = await d.wyslij(cialoWebhooka(w));
    } catch (blad) {
      odpowiedz = { ok: false, blad: blad instanceof Error ? blad.message : String(blad) };
    }
    if (odpowiedz.ok) {
      await d.oznaczWyslane(w.id, proba, d.teraz());
      wynik.wyslane.push(w.id);
      continue;
    }
    const odstep = odstepPoProbie(proba);
    const failed = odstep === null;
    await d.oznaczNieudane(w.id, { attempts: proba, blad: odpowiedz.blad.slice(0, 500), nextAttemptAt: failed ? null : new Date(d.teraz().getTime() + odstep * 60_000), failed });
    (failed ? wynik.porzucone : wynik.ponowione).push(w.id);
  }
  return wynik;
}
