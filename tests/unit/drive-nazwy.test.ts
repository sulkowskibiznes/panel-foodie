import { describe, expect, it } from "vitest";
import { czyNazwyPasuja, normalizujNazwe, numerMiesiacaZNazwy, okresZNazwy, rodzajPodfolderu, rozbierzNazwe, sortujNaturalnie, tytulZNazwy } from "@/lib/drive/nazwy";

describe("nazwy plików z Dysku (SPEC rozdz. 13.2, 13.3)", () => {
  it("sortuje naturalnie: 1, 2, ..., 10, nie 1, 10, 2", () => {
    const nazwy = ["10.png", "2.png", "1.png", "11.png", "3a.png", "3b.png", "Post 1.png"];
    expect(sortujNaturalnie(nazwy, (n) => n)).toEqual(["1.png", "2.png", "3a.png", "3b.png", "10.png", "11.png", "Post 1.png"]);
  });

  it("rozbiera numer i slajd z nazwy", () => {
    expect(rozbierzNazwe("3.png")).toMatchObject({ numer: 3, slajd: null });
    expect(rozbierzNazwe("3a.png")).toMatchObject({ numer: 3, slajd: 1 });
    expect(rozbierzNazwe("3b.jpg")).toMatchObject({ numer: 3, slajd: 2 });
    expect(rozbierzNazwe("3-2.png")).toMatchObject({ numer: 3, slajd: 2 });
    expect(rozbierzNazwe("3_1.png")).toMatchObject({ numer: 3, slajd: 1 });
    expect(rozbierzNazwe("post 3 slajd 2.png")).toMatchObject({ numer: 3, slajd: 2 });
    expect(rozbierzNazwe("Post 12 - burger klasyk.png")).toMatchObject({ numer: 12, slajd: null, reszta: "burger klasyk" });
    expect(rozbierzNazwe("burger 7.jpg")).toMatchObject({ numer: 7, slajd: null, reszta: "burger" });
    expect(rozbierzNazwe("10.png")).toMatchObject({ numer: 10, slajd: null });
    expect(rozbierzNazwe("IMG_20240512.jpg")).toMatchObject({ numer: null });
    expect(rozbierzNazwe("relacja_05.mp4")).toMatchObject({ numer: 5 });
    expect(rozbierzNazwe("nowe menu.png")).toMatchObject({ numer: null, reszta: "nowe menu" });
  });

  it("robocza nazwa materiału z nazwy pliku", () => {
    expect(tytulZNazwy("3. burger klasyk.png")).toBe("Burger klasyk");
    expect(tytulZNazwy("post_02_nowe-menu.jpg")).toBe("Nowe menu");
    expect(tytulZNazwy("7.png")).toBe("");
  });

  it("porównuje nazwy klientów bez polskich znaków i interpunkcji", () => {
    expect(normalizujNazwe("Pierogarnia Babci Sp. z o.o.")).toBe("pierogarnia babci sp z o o");
    expect(normalizujNazwe("Łódź - Śródmieście")).toBe("lodz srodmiescie");
    expect(czyNazwyPasuja("Nova Sushi", "NOVA SUSHI sp. z o.o.")).toBe(true);
    expect(czyNazwyPasuja("Burger Brothers", "Pierogarnia Babci")).toBe(false);
  });

  it("numer miesiąca z nazwy folderu i rodzaj podfolderu", () => {
    expect(numerMiesiacaZNazwy("content 5 mies")).toBe(5);
    expect(numerMiesiacaZNazwy("reklamy 12 mies - imprezy")).toBe(12);
    expect(numerMiesiacaZNazwy("content")).toBeNull();
    expect(numerMiesiacaZNazwy("Content 26-09")).toBeNull();
    expect(okresZNazwy("Content 26-09")).toEqual({ rok: 2026, miesiac: 9 });
    expect(okresZNazwy("Reklamy 26-12 imprezy")).toEqual({ rok: 2026, miesiac: 12 });
    expect(okresZNazwy("content 5 mies")).toBeNull();
    expect(okresZNazwy("Reklamy 26-13")).toBeNull();
    expect(rodzajPodfolderu("1. Posty")).toBe("posty");
    expect(rodzajPodfolderu("2. Relacje")).toBe("relacje");
    expect(rodzajPodfolderu("Stories")).toBe("relacje");
    expect(rodzajPodfolderu("Reelsy")).toBe("posty");
    expect(rodzajPodfolderu("Zdjęcia surowe")).toBeNull();
  });
});
