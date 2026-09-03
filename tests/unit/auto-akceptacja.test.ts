import { describe, expect, it } from "vitest";
import { czyNiedziela, czyOstatnieDobra, przesunAutoAkceptacje, wyliczAutoAkceptacje, zaokraglijWGoreDoGodziny } from "@/lib/pakiety/auto-akceptacja";

/** Wrzesień 2026: czwartek 3.09, piątek 4.09, sobota 5.09, niedziela 6.09, poniedziałek 7.09. Europe/Warsaw = UTC+2. */
const KALENDARZ = { godziny: 72, dniRobocze: false };
const ROBOCZE = { godziny: 72, dniRobocze: true };

function iso(d: Date): string {
  return d.toISOString();
}

describe("auto-akceptacja: 72 godziny kalendarzowe (domyślnie)", () => {
  it("zaokrągla w górę do pełnej godziny, klient nigdy nie dostaje mniej niż 72 h", () => {
    expect(iso(wyliczAutoAkceptacje(new Date("2026-09-04T10:30:00+02:00"), KALENDARZ))).toBe(iso(new Date("2026-09-07T11:00:00+02:00")));
    expect(iso(wyliczAutoAkceptacje(new Date("2026-09-04T10:00:00.001+02:00"), KALENDARZ))).toBe(iso(new Date("2026-09-07T11:00:00+02:00")));
  });
  it("pełna godzina zostaje pełną godziną", () => {
    expect(iso(zaokraglijWGoreDoGodziny(new Date("2026-09-04T10:00:00+02:00")))).toBe(iso(new Date("2026-09-04T10:00:00+02:00")));
    expect(iso(wyliczAutoAkceptacje(new Date("2026-09-04T10:00:00+02:00"), KALENDARZ))).toBe(iso(new Date("2026-09-07T10:00:00+02:00")));
  });
  it("liczy niedzielę jak każdy inny dzień", () => {
    expect(iso(wyliczAutoAkceptacje(new Date("2026-09-03T09:00:00+02:00"), KALENDARZ))).toBe(iso(new Date("2026-09-06T09:00:00+02:00")));
  });
  it("respektuje nadpisanie liczby godzin per klient", () => {
    expect(iso(wyliczAutoAkceptacje(new Date("2026-09-04T10:00:00+02:00"), { godziny: 48, dniRobocze: false }))).toBe(iso(new Date("2026-09-06T10:00:00+02:00")));
  });
});

describe("auto-akceptacja: dni robocze poniedziałek-sobota (SPEC 1.4, poz. 30)", () => {
  it("rozpoznaje niedzielę w Europe/Warsaw, także tuż po północy", () => {
    expect(czyNiedziela(new Date("2026-09-06T12:00:00+02:00"))).toBe(true);
    expect(czyNiedziela(new Date("2026-09-06T00:30:00+02:00"))).toBe(true);
    expect(czyNiedziela(new Date("2026-09-05T23:30:00+02:00"))).toBe(false);
    expect(czyNiedziela(new Date("2026-09-07T00:30:00+02:00"))).toBe(false);
  });
  it("sobota liczy się do terminu: środa 8:00 + 72 h = sobota 8:00, tak samo jak kalendarzowo", () => {
    const od = new Date("2026-09-02T08:00:00+02:00");
    expect(iso(wyliczAutoAkceptacje(od, ROBOCZE))).toBe(iso(new Date("2026-09-05T08:00:00+02:00")));
    expect(iso(wyliczAutoAkceptacje(od, ROBOCZE))).toBe(iso(wyliczAutoAkceptacje(od, KALENDARZ)));
  });
  it("niedziela nie liczy się: piątek 10:30 + 72 h = wtorek 11:00 (kalendarzowo poniedziałek 11:00)", () => {
    const od = new Date("2026-09-04T10:30:00+02:00");
    expect(iso(wyliczAutoAkceptacje(od, ROBOCZE))).toBe(iso(new Date("2026-09-08T11:00:00+02:00")));
    expect(iso(wyliczAutoAkceptacje(od, KALENDARZ))).toBe(iso(new Date("2026-09-07T11:00:00+02:00")));
  });
  it("czwartek 9:00 + 72 h = poniedziałek 9:00 (kalendarzowo niedziela 9:00)", () => {
    expect(iso(wyliczAutoAkceptacje(new Date("2026-09-03T09:00:00+02:00"), ROBOCZE))).toBe(iso(new Date("2026-09-07T09:00:00+02:00")));
  });
  it("wysyłka w sobotę o 23:30: licznik rusza od poniedziałku 0:00 i kończy w czwartek 0:00", () => {
    expect(iso(wyliczAutoAkceptacje(new Date("2026-09-05T23:30:00+02:00"), ROBOCZE))).toBe(iso(new Date("2026-09-10T00:00:00+02:00")));
  });
  it("wysyłka w niedzielę: godziny niedzieli nie liczą się w ogóle", () => {
    expect(iso(wyliczAutoAkceptacje(new Date("2026-09-06T12:00:00+02:00"), ROBOCZE))).toBe(iso(new Date("2026-09-10T00:00:00+02:00")));
  });
  it("nadpisanie godzin działa też w dniach roboczych: piątek 10:00 + 24 h = sobota 10:00, sobota 10:00 + 24 h = poniedziałek 10:00", () => {
    expect(iso(wyliczAutoAkceptacje(new Date("2026-09-04T10:00:00+02:00"), { godziny: 24, dniRobocze: true }))).toBe(iso(new Date("2026-09-05T10:00:00+02:00")));
    expect(iso(wyliczAutoAkceptacje(new Date("2026-09-05T10:00:00+02:00"), { godziny: 24, dniRobocze: true }))).toBe(iso(new Date("2026-09-07T10:00:00+02:00")));
  });
});

describe("przesunięcie po zmianie materiałów i ostatnia doba", () => {
  const teraz = new Date("2026-09-04T10:15:00+02:00");
  it("termin dalszy niż 24 h zostaje bez zmian", () => {
    expect(iso(przesunAutoAkceptacje("2026-09-07T11:00:00+02:00", teraz))).toBe(iso(new Date("2026-09-07T11:00:00+02:00")));
  });
  it("termin bliższy niż 24 h przesuwa się na teraz + 24 h (pełna godzina w górę)", () => {
    expect(iso(przesunAutoAkceptacje("2026-09-04T18:00:00+02:00", teraz))).toBe(iso(new Date("2026-09-05T11:00:00+02:00")));
    expect(iso(przesunAutoAkceptacje(null, teraz))).toBe(iso(new Date("2026-09-05T11:00:00+02:00")));
  });
  it("ostatnia doba: tylko gdy termin jest w przyszłości i nie dalej niż 24 h", () => {
    expect(czyOstatnieDobra("2026-09-05T09:00:00+02:00", teraz)).toBe(true);
    expect(czyOstatnieDobra("2026-09-05T11:00:00+02:00", teraz)).toBe(false);
    expect(czyOstatnieDobra("2026-09-04T09:00:00+02:00", teraz)).toBe(false);
    expect(czyOstatnieDobra(null, teraz)).toBe(false);
  });
});
