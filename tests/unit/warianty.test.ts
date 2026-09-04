import { describe, expect, it } from "vitest";
import type { WariantDto } from "@/lib/dto/materialy";
import { domenaLinku, domyslnyWybor, dopasujWybor, liczbaKombinacji, lokaleZWariantami, opcjeWariantow, zlozWariant } from "@/lib/reklamy/warianty";

const L1 = "lokal-1";
const L2 = "lokal-2";

function w(rodzaj: WariantDto["rodzaj"], pozycja: number, tekst: string | null, lokalId: string | null = null): WariantDto {
  return { id: `${rodzaj}-${pozycja}-${lokalId ?? "wspolny"}`, rodzaj, pozycja, etykieta: null, tekst, plik: rodzaj === "grafika" ? { id: `plik-${pozycja}`, rodzaj: "obraz", previewUrl: "/p", thumbUrl: "/t", szerokosc: 1080, wysokosc: 1080, czasMs: null, pozycja, nazwa: null } : null, lokalId };
}

/** Jak w seedzie kat2: 6 grafik, 3 teksty, 3 nagłówki, opis i CTA wspólne, link per lokal. */
const SEED: WariantDto[] = [
  ...[0, 1, 2, 3, 4, 5].map((i) => w("grafika", i, null)),
  ...["A", "B", "C"].map((t, i) => w("tekst", i, `Tekst ${t}`)),
  ...[1, 2, 3].map((i) => w("naglowek", i - 1, `Nagłówek ${i}`)),
  w("opis", 0, "Rezerwacja i zamówienia online"),
  w("cta", 0, "Zamów teraz"),
  w("link", 0, "https://burgerbrothers.pl/manufaktura", L1),
  w("link", 0, "https://burgerbrothers.pl/piotrkowska", L2),
];

describe("warianty reklamy per lokal (SPEC 7.4, 1.4 poz. 15)", () => {
  it("54 kombinacje dla pełnego zestawu, niezależnie od lokalu", () => {
    expect(liczbaKombinacji(SEED, L1)).toBe(54);
    expect(liczbaKombinacji(SEED, null)).toBe(54);
    expect(liczbaKombinacji(SEED.filter((v) => v.rodzaj !== "naglowek"), L1)).toBe(0);
  });

  it("dla lokalu link jest z jego wersji, reszta ze wspólnej; źródła to mówią", () => {
    const z = zlozWariant(SEED, domyslnyWybor(SEED, L2));
    expect(z.link).toBe("https://burgerbrothers.pl/piotrkowska");
    expect(z.cta).toBe("Zamów teraz");
    expect(z.grafika?.id).toBe("grafika-0-wspolny");
    expect(z.zrodla).toEqual({ grafika: "wspolny", tekst: "wspolny", naglowek: "wspolny", opis: "wspolny", cta: "wspolny", link: "lokal" });
  });

  it("wersja wspólna pokazuje wyłącznie warianty wspólne: bez linku per lokal", () => {
    const z = zlozWariant(SEED, domyslnyWybor(SEED, null));
    expect(z.link).toBeNull();
    expect(z.zrodla.link).toBeUndefined();
    expect(z.tekst?.tekst).toBe("Tekst A");
  });

  it("wybór konkretnej grafiki, tekstu i nagłówka składa dokładnie tę kombinację", () => {
    const z = zlozWariant(SEED, { lokalId: L1, grafikaId: "grafika-4-wspolny", tekstId: "tekst-2-wspolny", naglowekId: "naglowek-1-wspolny" });
    expect(z.grafika?.id).toBe("grafika-4-wspolny");
    expect(z.tekst?.tekst).toBe("Tekst C");
    expect(z.naglowek?.tekst).toBe("Nagłówek 2");
  });

  it("lokal z własnymi tekstami zastępuje listę tekstów, a inne rodzaje bierze ze wspólnych", () => {
    const zTekstem = [...SEED, w("tekst", 0, "Tekst tylko dla Widzewa", L1)];
    const o = opcjeWariantow(zTekstem, L1);
    expect(o.teksty.map((t) => t.tekst)).toEqual(["Tekst tylko dla Widzewa"]);
    expect(o.grafiki).toHaveLength(6);
    expect(opcjeWariantow(zTekstem, L2).teksty).toHaveLength(3);
    expect(zlozWariant(zTekstem, domyslnyWybor(zTekstem, L1)).zrodla.tekst).toBe("lokal");
  });

  it("zmiana lokalu zachowuje wybór, gdy istnieje w nowych opcjach, inaczej wraca do pierwszej pozycji", () => {
    const zTekstem = [...SEED, w("tekst", 0, "Tekst tylko dla Widzewa", L1)];
    const wybor = { lokalId: L2, grafikaId: "grafika-3-wspolny", tekstId: "tekst-1-wspolny", naglowekId: "naglowek-2-wspolny" };
    const naL1 = dopasujWybor(zTekstem, wybor, L1);
    expect(naL1).toEqual({ lokalId: L1, grafikaId: "grafika-3-wspolny", tekstId: "tekst-0-lokal-1", naglowekId: "naglowek-2-wspolny" });
    const zPowrotem = dopasujWybor(zTekstem, naL1, L2);
    expect(zPowrotem.tekstId).toBe("tekst-0-wspolny");
    expect(zPowrotem.grafikaId).toBe("grafika-3-wspolny");
  });

  it("lokale z wariantami i domena linku", () => {
    expect(lokaleZWariantami(SEED).sort()).toEqual([L1, L2]);
    expect(domenaLinku("https://www.burgerbrothers.pl/manufaktura")).toBe("BURGERBROTHERS.PL");
    expect(domenaLinku("trattoriabella.pl/rezerwacja")).toBe("TRATTORIABELLA.PL");
    expect(domenaLinku(null)).toBeNull();
  });
});
