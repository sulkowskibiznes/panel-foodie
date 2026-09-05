import { describe, expect, it } from "vitest";
import { podzielOpisy, rozbierzDokumentReklam } from "@/lib/drive/opisy";

describe("podział dokumentu z opisami (SPEC rozdz. 13.3)", () => {
  it(`dzieli po nagłówkach „Post N" z tytułem`, () => {
    const tekst = "Opisy na maj\n\nPost 1 - burger klasyk\nZapraszamy na klasyka. #burger\n\nPost 2: nowe menu\nOd poniedziałku nowe menu!\nSprawdźcie.\n\nPost 3\nTrzeci opis.";
    const { sekcje, wstep } = podzielOpisy(tekst);
    expect(wstep).toBe("Opisy na maj");
    expect(sekcje.map((s) => [s.numer, s.tytul])).toEqual([
      [1, "burger klasyk"],
      [2, "nowe menu"],
      [3, ""],
    ]);
    expect(sekcje[1]?.tresc).toBe("Od poniedziałku nowe menu!\nSprawdźcie.");
  });

  it("numer z kropką i krótką resztą to nagłówek, z długim zdaniem to lista numerowana", () => {
    const krotkie = podzielOpisy("1. Burger\nOpis pierwszy\n2. Pizza\nOpis drugi");
    expect(krotkie.sekcje.map((s) => [s.numer, s.tytul, s.tresc])).toEqual([
      [1, "Burger", "Opis pierwszy"],
      [2, "Pizza", "Opis drugi"],
    ]);
    const lista = podzielOpisy("1. Zapraszamy na nowe burgery! Tylko w maju.\n2. Pizza w każdy piątek za pół ceny. Sprawdź menu.");
    expect(lista.sekcje.map((s) => [s.numer, s.tytul])).toEqual([
      [1, ""],
      [2, ""],
    ]);
    expect(lista.sekcje[0]?.tresc).toBe("Zapraszamy na nowe burgery! Tylko w maju.");
  });

  it(`opisy z Worda: „tekst 1", „tekst 2" jako nagłówki, kilka akapitów w pozycji`, () => {
    const tekst = "tekst 1\n\nNajmłodsi również znajdą u nas coś pysznego! 😄 Bafra Kids to zestaw dla dzieci.\n\nW środku czekają:\n🍟 chrupiące frytki\n🍗 nuggetsy\n\ntekst 2\n\nDrugi opis.\n\nTEKST 3:\nTrzeci opis.";
    const { sekcje, wstep } = podzielOpisy(tekst);
    expect(wstep).toBe("");
    expect(sekcje.map((s) => s.numer)).toEqual([1, 2, 3]);
    expect(sekcje[0]?.tresc).toBe("Najmłodsi również znajdą u nas coś pysznego! 😄 Bafra Kids to zestaw dla dzieci.\n\nW środku czekają:\n🍟 chrupiące frytki\n🍗 nuggetsy");
    expect(sekcje[2]?.tresc).toBe("Trzeci opis.");
  });

  it("linia z treścią zaczynająca się od słowa i liczby nie jest nagłówkiem", () => {
    const { sekcje } = podzielOpisy("Post 1\nTekst 2 razy dłuższy niż zwykle, bo mamy dużo do powiedzenia o nowym menu.\nPost 2\nB");
    expect(sekcje.map((s) => [s.numer, s.tresc])).toEqual([
      [1, "Tekst 2 razy dłuższy niż zwykle, bo mamy dużo do powiedzenia o nowym menu."],
      [2, "B"],
    ]);
  });

  it("dokument bez nagłówków to jedna całość we wstępie", () => {
    const { sekcje, wstep } = podzielOpisy("Zwykły opis bez numerów.\nDruga linia.");
    expect(sekcje).toEqual([]);
    expect(wstep).toBe("Zwykły opis bez numerów.\nDruga linia.");
  });

  it("windowsowe końce linii i separatory nie psują podziału", () => {
    const { sekcje } = podzielOpisy("Post 1\r\nA\r\n---\r\nPost 2\r\nB");
    expect(sekcje.map((s) => s.tresc)).toEqual(["A", "B"]);
  });
});

describe("dokument reklam: teksty i nagłówki", () => {
  it("rozpoznaje sekcje i pozycje", () => {
    const tekst = "TEKSTY:\n1. Pierwszy tekst reklamy.\n2. Drugi tekst,\nw dwóch liniach.\n3. Trzeci.\n\nNagłówki\n- Burger miesiąca\n- Zamów online\n\nOpis\nDostawa gratis\n\nPrzycisk: Zamów teraz\nLink: https://burger.pl/zamow";
    const d = rozbierzDokumentReklam(tekst);
    expect(d.rozpoznanoSekcje).toBe(true);
    expect(d.teksty).toEqual(["Pierwszy tekst reklamy.", "Drugi tekst,\nw dwóch liniach.", "Trzeci."]);
    expect(d.naglowki).toEqual(["Burger miesiąca", "Zamów online"]);
    expect(d.opis).toBe("Dostawa gratis");
    expect(d.cta).toBe("Zamów teraz");
    expect(d.link).toBe("https://burger.pl/zamow");
  });

  it("teksty jako akapity, gdy nie ma numeracji", () => {
    const d = rozbierzDokumentReklam("Teksty reklamowe\nTekst A pierwsza linia.\nTekst A druga linia.\n\nTekst B.\n\nNagłówki:\nNagłówek 1\nNagłówek 2");
    expect(d.teksty).toEqual(["Tekst A pierwsza linia.\nTekst A druga linia.", "Tekst B."]);
    expect(d.naglowki).toEqual(["Nagłówek 1", "Nagłówek 2"]);
  });

  it(`dokument reklam z Worda: „tekst 1..3" bez sekcji, każdy tekst z kilku akapitów; nagłówki z „nagłówek N"`, () => {
    const tekst = "tekst 1\n\n⭐ Opinie naszych klientów mówią same za siebie! 🥙🔥\n\nSprawdź, za co wybierają Bafrę!\n\n📍 Budowlana 13, Kętrzyn\n🌐 www.bafraketrzyn.pl\n\ntekst 2\n\n🥙 Masz ochotę na dobrego kebaba?\n\n📍 Budowlana 13, Kętrzyn\n\ntekst 3\n\n🔥 Głód nie poczeka.\n\nnagłówek 1\nKebab miesiąca\n\nNagłówek 2:\nZamów online";
    const d = rozbierzDokumentReklam(tekst);
    expect(d.rozpoznanoSekcje).toBe(true);
    expect(d.teksty).toEqual(["⭐ Opinie naszych klientów mówią same za siebie! 🥙🔥\n\nSprawdź, za co wybierają Bafrę!\n\n📍 Budowlana 13, Kętrzyn\n🌐 www.bafraketrzyn.pl", "🥙 Masz ochotę na dobrego kebaba?\n\n📍 Budowlana 13, Kętrzyn", "🔥 Głód nie poczeka."]);
    expect(d.naglowki).toEqual(["Kebab miesiąca", "Zamów online"]);
  });

  it(`sekcja „Teksty" z pozycjami „tekst N" i sekcja „Nagłówki" z pozycjami „nagłówek N"`, () => {
    const d = rozbierzDokumentReklam("Teksty\ntekst 1\nA\ntekst 2\nB\n\nNagłówki\nnagłówek 1\nN1\nnagłówek 2\nN2");
    expect(d.teksty).toEqual(["A", "B"]);
    expect(d.naglowki).toEqual(["N1", "N2"]);
  });

  it("bez sekcji wszystko ląduje w tekstach z flagą", () => {
    const d = rozbierzDokumentReklam("Jakiś tekst.\n\nDrugi tekst.");
    expect(d.rozpoznanoSekcje).toBe(false);
    expect(d.teksty).toEqual(["Jakiś tekst.", "Drugi tekst."]);
    expect(d.naglowki).toEqual([]);
  });
});
