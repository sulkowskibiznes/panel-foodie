import { describe, expect, it } from "vitest";
import { cialoWebhooka, MAKS_PROB, odstepPoProbie, uruchomWysylkeOutbox, type WierszOutbox, type ZaleznosciOutbox } from "@/lib/outbox/wysylka";

const TERAZ = new Date("2026-09-07T12:00:00+02:00");

type Stan = { status: "pending" | "sent" | "failed"; attempts: number; blad: string | null; next: Date | null };

function zaleznosci(wiersze: WierszOutbox[], odpowiedzi: Array<{ ok: true; status: number } | { ok: false; blad: string }>, opcje: { zajete?: number[] } = {}) {
  const stany = new Map<number, Stan>(wiersze.map((w) => [w.id, { status: "pending", attempts: w.attempts, blad: null, next: null }]));
  const wyslane: Record<string, unknown>[] = [];
  let i = 0;
  const d: ZaleznosciOutbox = {
    pobierzOczekujace: async () => wiersze,
    zajmij: async (id) => !(opcje.zajete ?? []).includes(id),
    wyslij: async (cialo) => {
      wyslane.push(cialo);
      const odp = odpowiedzi[i++];
      if (!odp) throw new Error("brak odpowiedzi w teście");
      return odp;
    },
    oznaczWyslane: async (id, attempts) => {
      stany.set(id, { status: "sent", attempts, blad: null, next: null });
    },
    oznaczNieudane: async (id, dane) => {
      stany.set(id, { status: dane.failed ? "failed" : "pending", attempts: dane.attempts, blad: dane.blad, next: dane.nextAttemptAt });
    },
    teraz: () => TERAZ,
  };
  return { d, stany, wyslane };
}

const wiersz = (id: number, attempts = 0): WierszOutbox => ({ id, event: "pakiet.zaakceptowany", payload: { client_slug: "nova-sushi", summary: "ok", event: "cokolwiek" }, attempts });

describe("outbox: 5 prób z narastającym odstępem (SPEC rozdz. 15)", () => {
  it("odstępy: 1, 5, 15, 60 minut, po piątej nieudanej próbie koniec", () => {
    expect(odstepPoProbie(1)).toBe(1);
    expect(odstepPoProbie(2)).toBe(5);
    expect(odstepPoProbie(3)).toBe(15);
    expect(odstepPoProbie(4)).toBe(60);
    expect(odstepPoProbie(5)).toBeNull();
    expect(MAKS_PROB).toBe(5);
  });

  it("ciało webhooka: payload z bazy, `event` z kolumny wygrywa", () => {
    expect(cialoWebhooka(wiersz(1))).toEqual({ client_slug: "nova-sushi", summary: "ok", event: "pakiet.zaakceptowany" });
  });

  it("udana wysyłka oznacza wiersz jako wysłany z liczbą prób", async () => {
    const { d, stany, wyslane } = zaleznosci([wiersz(1)], [{ ok: true, status: 200 }]);
    const wynik = await uruchomWysylkeOutbox(d);
    expect(wynik.wyslane).toEqual([1]);
    expect(stany.get(1)).toEqual({ status: "sent", attempts: 1, blad: null, next: null });
    expect(wyslane[0]?.event).toBe("pakiet.zaakceptowany");
  });

  it("nieudana próba przesuwa następną o narastający odstęp i zapisuje błąd", async () => {
    const { d, stany } = zaleznosci([wiersz(1, 0), wiersz(2, 1), wiersz(3, 3)], [{ ok: false, blad: "HTTP 500" }, { ok: false, blad: "HTTP 502" }, { ok: false, blad: "TimeoutError: x" }]);
    const wynik = await uruchomWysylkeOutbox(d);
    expect(wynik.ponowione).toEqual([1, 2, 3]);
    expect(stany.get(1)).toMatchObject({ status: "pending", attempts: 1, blad: "HTTP 500" });
    expect(stany.get(1)?.next?.getTime()).toBe(TERAZ.getTime() + 60_000);
    expect(stany.get(2)?.next?.getTime()).toBe(TERAZ.getTime() + 5 * 60_000);
    expect(stany.get(3)?.next?.getTime()).toBe(TERAZ.getTime() + 60 * 60_000);
  });

  it("piąta nieudana próba daje status failed bez kolejnego terminu", async () => {
    const { d, stany } = zaleznosci([wiersz(1, 4)], [{ ok: false, blad: "HTTP 500" }]);
    const wynik = await uruchomWysylkeOutbox(d);
    expect(wynik.porzucone).toEqual([1]);
    expect(stany.get(1)).toEqual({ status: "failed", attempts: 5, blad: "HTTP 500", next: null });
  });

  it("wyjątek w wysyłce liczy się jak nieudana próba", async () => {
    const d: ZaleznosciOutbox = { ...zaleznosci([wiersz(1)], []).d, wyslij: async () => { throw new Error("sieć padła"); } };
    const nieudane: unknown[] = [];
    d.oznaczNieudane = async (_id, dane) => { nieudane.push(dane); };
    const wynik = await uruchomWysylkeOutbox(d);
    expect(wynik.ponowione).toEqual([1]);
    expect(nieudane[0]).toMatchObject({ attempts: 1, blad: "sieć padła", failed: false });
  });

  it("wiersz zajęty przez inny przebieg jest pomijany bez wysyłki", async () => {
    const { d, wyslane } = zaleznosci([wiersz(1), wiersz(2)], [{ ok: true, status: 200 }], { zajete: [1] });
    const wynik = await uruchomWysylkeOutbox(d);
    expect(wynik.pominiete).toEqual([1]);
    expect(wynik.wyslane).toEqual([2]);
    expect(wyslane).toHaveLength(1);
  });
});
