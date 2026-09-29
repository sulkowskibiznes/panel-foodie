import { describe, expect, it } from "vitest";
import { czyNazwaCrona, ocenCrony, odczytajPrzebieg } from "@/lib/crony/monitoring";

const TERAZ = new Date("2026-10-01T10:00:00Z");
const minutTemu = (m: number) => new Date(TERAZ.getTime() - m * 60_000).toISOString();

describe("ocenCrony", () => {
  it("świeże przebiegi bez błędów i bez nieudanych powiadomień: brak problemów", () => {
    const przebiegi = { "auto-akceptacja": { at: minutTemu(30), bledy: 0 }, outbox: { at: minutTemu(1), bledy: 0 }, faktury: { at: minutTemu(600), bledy: 0 }, retencja: { at: minutTemu(60 * 24 * 10), bledy: 0 } };
    expect(ocenCrony(przebiegi, TERAZ, { nieudaneOutbox: 0, wymagajPrzebiegu: true })).toEqual([]);
  });

  it("opóźnienie liczone wg rytmu crona: godzinny po 2 h, minutowy po 15 min, dzienny po 26 h, miesięczny po 32 dniach", () => {
    const przebiegi = { "auto-akceptacja": { at: minutTemu(121), bledy: 0 }, outbox: { at: minutTemu(16), bledy: 0 }, faktury: { at: minutTemu(26 * 60 + 1), bledy: 0 }, retencja: { at: minutTemu(32 * 24 * 60 + 1), bledy: 0 } };
    const problemy = ocenCrony(przebiegi, TERAZ, { nieudaneOutbox: 0, wymagajPrzebiegu: true });
    expect(problemy.map((p) => `${p.cron}:${p.rodzaj}`)).toEqual(["auto-akceptacja:opozniony", "outbox:opozniony", "faktury:opozniony", "retencja:opozniony"]);
  });

  it("błędy ostatniego przebiegu i nieudane powiadomienia to osobne problemy", () => {
    const problemy = ocenCrony({ "auto-akceptacja": { at: minutTemu(5), bledy: 2 } }, TERAZ, { nieudaneOutbox: 3, wymagajPrzebiegu: false });
    expect(problemy).toEqual([
      { cron: "auto-akceptacja", rodzaj: "bledy", bledy: 2 },
      { cron: "outbox", rodzaj: "nieudane", liczba: 3 },
    ]);
  });

  it("brak zapisu to problem tylko tam, gdzie crony mają chodzić same (produkcja)", () => {
    expect(ocenCrony({}, TERAZ, { nieudaneOutbox: 0, wymagajPrzebiegu: false })).toEqual([]);
    expect(ocenCrony({}, TERAZ, { nieudaneOutbox: 0, wymagajPrzebiegu: true })).toHaveLength(4);
  });
});

describe("odczytajPrzebieg i czyNazwaCrona", () => {
  it("śmieci z bazy traktuje jak brak przebiegu", () => {
    expect(odczytajPrzebieg({ at: "2026-10-01T09:00:00Z", bledy: 1 })).toEqual({ at: "2026-10-01T09:00:00Z", bledy: 1 });
    expect(odczytajPrzebieg({ at: "nie-data" })).toBeNull();
    expect(odczytajPrzebieg("tekst")).toBeNull();
    expect(odczytajPrzebieg({ at: "2026-10-01T09:00:00Z", bledy: -4 })).toEqual({ at: "2026-10-01T09:00:00Z", bledy: 0 });
  });
  it("zna tylko cztery crony", () => {
    expect(czyNazwaCrona("outbox")).toBe(true);
    expect(czyNazwaCrona("cokolwiek")).toBe(false);
  });
});
