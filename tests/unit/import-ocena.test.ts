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
  okres: { rok: 2026, miesiac: 9 },
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

  it("folder użyty w innym pakiecie to ostrzeżenie z tamtym pakietem (kryterium 18)", () => {
    const uzycie = { pakietId: "p1", slug: "nova-sushi", tytul: "Materiały - maj 2026", okres: { rok: 2026, miesiac: 5 }, zaimportowanoO: "2026-05-02T10:00:00Z" };
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
