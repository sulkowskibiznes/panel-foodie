import { describe, expect, it } from "vitest";
import { czyAdresRaportu, domyslnyTytulRaportu, parsujOkresRaportu, schematWebhookaRaportu, wybierzLokalRaportu } from "@/lib/raporty/walidacja";

const LOKALE = [
  { id: "a", name: "Trattoria Bella" },
  { id: "b", name: "Ramen Ichi" },
];

describe("raporty: adres tylko z systemu raportów (SPEC rozdz. 9, D6a)", () => {
  it("przyjmuje https na raporty.foodiemedia.pl, także z wielkimi literami w hoście", () => {
    expect(czyAdresRaportu("https://raporty.foodiemedia.pl/r/abc123")).toBe(true);
    expect(czyAdresRaportu("https://RAPORTY.foodiemedia.pl/r/abc123?x=1")).toBe(true);
  });
  it("odrzuca inny host, http, poddomeny, dane logowania w adresie i śmieci", () => {
    expect(czyAdresRaportu("http://raporty.foodiemedia.pl/r/abc")).toBe(false);
    expect(czyAdresRaportu("https://raporty.foodiemedia.pl.evil.com/r/abc")).toBe(false);
    expect(czyAdresRaportu("https://evil.com/raporty.foodiemedia.pl")).toBe(false);
    expect(czyAdresRaportu("https://user:haslo@raporty.foodiemedia.pl/r/abc")).toBe(false);
    expect(czyAdresRaportu("https://panel.foodiemedia.pl/r/abc")).toBe(false);
    expect(czyAdresRaportu("nie-adres")).toBe(false);
    expect(czyAdresRaportu("")).toBe(false);
  });
});

describe("raporty: okres i tytuł", () => {
  it("parsuje YYYY-MM i odrzuca resztę", () => {
    expect(parsujOkresRaportu("2026-08")).toEqual({ rok: 2026, miesiac: 8 });
    expect(parsujOkresRaportu(" 2026-12 ")).toEqual({ rok: 2026, miesiac: 12 });
    expect(parsujOkresRaportu("2026-13")).toBeNull();
    expect(parsujOkresRaportu("2026-8")).toBeNull();
    expect(parsujOkresRaportu(202608)).toBeNull();
    expect(parsujOkresRaportu(null)).toBeNull();
  });
  it("domyślny tytuł z nazwą miesiąca i zwykłym myślnikiem", () => {
    expect(domyslnyTytulRaportu({ rok: 2026, miesiac: 8 })).toBe("Raport miesięczny - sierpień 2026");
  });
});

describe("raporty: lokal dla raportu (rozdz. 20 poz. 20)", () => {
  it("kat1 z kilkoma restauracjami wymaga nazwy lokalu, dopasowanie bez wielkości liter", () => {
    expect(wybierzLokalRaportu("kat1", LOKALE, "ramen ichi")).toEqual({ ok: true, locationId: "b" });
    expect(wybierzLokalRaportu("kat1", LOKALE, " Trattoria Bella ")).toEqual({ ok: true, locationId: "a" });
    expect(wybierzLokalRaportu("kat1", LOKALE, "Sushi")).toEqual({ ok: false, powod: "nieznany_lokal" });
    expect(wybierzLokalRaportu("kat1", LOKALE, null)).toEqual({ ok: false, powod: "brak_lokalu" });
  });
  it("kat1 z jedną restauracją przypina raport do niej bez podawania nazwy", () => {
    expect(wybierzLokalRaportu("kat1", [LOKALE[0]!], undefined)).toEqual({ ok: true, locationId: "a" });
  });
  it("kat2 i kat3: jeden raport na klienta, nazwa lokalu ignorowana", () => {
    expect(wybierzLokalRaportu("kat2", LOKALE, "Ramen Ichi")).toEqual({ ok: true, locationId: null });
    expect(wybierzLokalRaportu("kat3", LOKALE, null)).toEqual({ ok: true, locationId: null });
  });
});

describe("raporty: ciało webhooka", () => {
  it("przyjmuje ciało z rozdz. 9 i odrzuca obcy host", () => {
    const ok = schematWebhookaRaportu.safeParse({ client_slug: "nova-sushi", period: "2026-08", url: "https://raporty.foodiemedia.pl/r/x", title: "Raport", cooperation_month: 5 });
    expect(ok.success).toBe(true);
    const zly = schematWebhookaRaportu.safeParse({ client_slug: "nova-sushi", period: "2026-08", url: "https://evil.com/r/x" });
    expect(zly.success).toBe(false);
    const bezSluga = schematWebhookaRaportu.safeParse({ period: "2026-08", url: "https://raporty.foodiemedia.pl/r/x" });
    expect(bezSluga.success).toBe(false);
  });
});
