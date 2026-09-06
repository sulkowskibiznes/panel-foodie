import { describe, expect, it } from "vitest";
import { ocenFolder, type DaneDoOceny } from "@/lib/import/ocena";

const baza: DaneDoOceny = {
  sciezka: [
    { id: "k", nazwa: "Nova Sushi" },
    { id: "c", nazwa: "content" },
    { id: "m", nazwa: "content 5 mies" },
  ],
  nazwaKlienta: "Nova Sushi",
  miesiacWspolpracy: 5,
  okres: { od: "2026-09-01", do: "2026-09-30" },
  rodzaj: "content",
  liczbaPlikow: 12,
  maPodfolderyContentu: true,
  nieobslugiwane: [],
  duzeWideo: [],
  poprzednie: [],
};

describe("karta weryfikacyjna (SPEC rozdz. 13.2)", () => {
  it("folder poza „Materiałami klientów\" blokuje import bez obejścia (kryterium 17)", () => {
    expect(ocenFolder({ ...baza, sciezka: null })).toEqual({ zablokowany: true, ostrzezenia: [] });
  });

  it("poprawny folder przechodzi bez ostrzeżeń", () => {
    expect(ocenFolder(baza)).toEqual({ zablokowany: false, ostrzezenia: [] });
  });

  it("ostrzega, gdy nazwa klienta albo numer miesiąca się nie zgadza", () => {
    const o = ocenFolder({ ...baza, nazwaKlienta: "Burger Brothers", miesiacWspolpracy: 6 }).ostrzezenia;
    expect(o).toEqual([
      { kod: "klient", folder: "Nova Sushi", klient: "Burger Brothers" },
      { kod: "miesiac", wNazwie: 5, oczekiwany: 6 },
    ]);
  });

  it("nazwa miesiąca kalendarzowego w folderze bez numeru", () => {
    const o = ocenFolder({ ...baza, sciezka: [{ id: "k", nazwa: "Nova Sushi" }, { id: "m", nazwa: "content maj" }] }).ostrzezenia;
    expect(o).toEqual([{ kod: "miesiac_kalendarzowy", wNazwie: "maj", oczekiwany: "wrzesień" }]);
    expect(ocenFolder({ ...baza, sciezka: [{ id: "k", nazwa: "Nova Sushi" }, { id: "m", nazwa: "content wrzesień" }] }).ostrzezenia).toEqual([]);
  });

  it("nazwa folderu z okresem RR-MM: ostrzeżenie tylko przy innym miesiącu, bez porównania z numerem współpracy", () => {
    const sciezka = (nazwa: string) => [{ id: "k", nazwa: "Nova Sushi" }, { id: "m", nazwa }];
    expect(ocenFolder({ ...baza, sciezka: sciezka("Content 26-09") }).ostrzezenia).toEqual([]);
    expect(ocenFolder({ ...baza, sciezka: sciezka("Content 26-08") }).ostrzezenia).toEqual([{ kod: "okres", wNazwie: "26-08", oczekiwany: "26-09" }]);
  });

  it("okres na styku miesięcy: nazwa folderu z miesiącem startu albo końca nie ostrzega", () => {
    const styk = { ...baza, okres: { od: "2026-09-20", do: "2026-10-19" } };
    const sciezka = (nazwa: string) => [{ id: "k", nazwa: "Nova Sushi" }, { id: "m", nazwa }];
    expect(ocenFolder({ ...styk, sciezka: sciezka("Content 26-09") }).ostrzezenia).toEqual([]);
    expect(ocenFolder({ ...styk, sciezka: sciezka("Content 26-10") }).ostrzezenia).toEqual([]);
    expect(ocenFolder({ ...styk, sciezka: sciezka("Content 26-11") }).ostrzezenia).toEqual([{ kod: "okres", wNazwie: "26-11", oczekiwany: "26-09" }]);
    expect(ocenFolder({ ...styk, sciezka: sciezka("content październik") }).ostrzezenia).toEqual([]);
    expect(ocenFolder({ ...styk, sciezka: sciezka("content listopad") }).ostrzezenia).toEqual([{ kod: "miesiac_kalendarzowy", wNazwie: "listopad", oczekiwany: "wrzesień" }]);
  });

  it("folder użyty w innym pakiecie to ostrzeżenie z tamtym pakietem (kryterium 18)", () => {
    const uzycie = { pakietId: "p1", slug: "nova-sushi", tytul: "Materiały 01.05 - 31.05.2026", okres: { od: "2026-05-01", do: "2026-05-31" }, zaimportowanoO: "2026-05-02T10:00:00Z" };
    expect(ocenFolder({ ...baza, poprzednie: [uzycie] }).ostrzezenia).toEqual([{ kod: "powtorny", uzycie }]);
  });

  it("pusty folder, brak podfolderów, nieobsługiwane pliki i duże wideo", () => {
    expect(ocenFolder({ ...baza, liczbaPlikow: 0 }).ostrzezenia).toEqual([{ kod: "pusty" }]);
    expect(ocenFolder({ ...baza, maPodfolderyContentu: false }).ostrzezenia).toEqual([{ kod: "brak_podfolderow" }]);
    expect(ocenFolder({ ...baza, rodzaj: "reklamy", maPodfolderyContentu: false }).ostrzezenia).toEqual([]);
    expect(ocenFolder({ ...baza, nieobslugiwane: ["projekt.psd"], duzeWideo: ["rolka.mp4"] }).ostrzezenia).toEqual([
      { kod: "nieobslugiwane", nazwy: ["projekt.psd"] },
      { kod: "duze_wideo", nazwy: ["rolka.mp4"] },
    ]);
  });
});
