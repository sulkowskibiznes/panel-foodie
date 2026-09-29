import { describe, expect, it } from "vitest";
import { czyMoznaZmienicKategorie, slugZNazwy, waliduj, walidujAkceptacje, walidujDaneKlienta, walidujKontakt, walidujLokal } from "@/lib/klienci/nowy";

function formularz(pola: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(pola)) for (const w of Array.isArray(v) ? v : [v]) fd.append(k, w);
  return fd;
}

const OPIEKUN = "11111111-1111-4111-8111-111111111111";
const POPRAWNY = {
  name: "Nova Sushi",
  category: "kat2",
  tier: "foodie_360",
  monthly_amount_net: "3 800,00",
  slack_channel: "#nova-sushi",
  cooperation_started_on: "2026-09-20",
  opiekun_id: OPIEKUN,
  lokal_name: ["Nova Sushi Piotrkowska", "Nova Sushi Manufaktura"],
  lokal_city: ["Łódź", "Łódź"],
  lokal_fb: ["Nova Sushi", "Nova Sushi"],
  lokal_ig: ["@novasushi", ""],
  kontakt_name: ["Marek Nowak", ""],
  kontakt_rola: ["właściciel", ""],
  kontakt_telefon: ["+48 500 000 000", ""],
  kontakt_email: ["marek@example.com", ""],
};

describe("slugZNazwy", () => {
  it("zamienia polskie znaki i odstępy, przycina myślniki", () => {
    expect(slugZNazwy("Pierogarnia Babci Żółć")).toBe("pierogarnia-babci-zolc");
    expect(slugZNazwy("  Bao & Bar!  ")).toBe("bao-bar");
  });
});

describe("waliduj (nowy klient)", () => {
  it("składa dane: slug z nazwy, kwota z przecinkiem i spacją, IG bez @, puste wiersze pominięte, pierwszy kontakt główny", () => {
    const w = waliduj(formularz(POPRAWNY), new Set([OPIEKUN]));
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    expect(w.dane.slug).toBe("nova-sushi");
    expect(w.dane.monthly_amount_net).toBe(3800);
    expect(w.dane.lokale).toHaveLength(2);
    expect(w.dane.lokale[0]?.ig_handle).toBe("novasushi");
    expect(w.dane.lokale[1]?.ig_handle).toBeNull();
    expect(w.dane.kontakty).toEqual([{ name: "Marek Nowak", role_label: "właściciel", phone: "+48 500 000 000", email: "marek@example.com" }]);
    expect(w.dane.opiekun_id).toBe(OPIEKUN);
  });

  it("opiekun spoza listy kandydatów wraca jako null", () => {
    const w = waliduj(formularz(POPRAWNY), new Set());
    expect(w.ok && w.dane.opiekun_id).toBeNull();
  });

  it("odrzuca brak nazwy, zły slug, ujemną kwotę, złą datę", () => {
    expect(waliduj(formularz({ ...POPRAWNY, name: " " }), new Set())).toEqual({ ok: false, blad: "nazwa" });
    expect(waliduj(formularz({ ...POPRAWNY, slug: "Nova Sushi" }), new Set())).toEqual({ ok: false, blad: "slug" });
    expect(waliduj(formularz({ ...POPRAWNY, monthly_amount_net: "-5" }), new Set())).toEqual({ ok: false, blad: "kwota" });
    expect(waliduj(formularz({ ...POPRAWNY, cooperation_started_on: "20.09.2026" }), new Set())).toEqual({ ok: false, blad: "data" });
  });

  it("wymaga co najmniej jednego lokalu z nazwą i stroną FB oraz jednej osoby z imieniem i poprawnym e-mailem", () => {
    expect(waliduj(formularz({ ...POPRAWNY, lokal_name: ["", ""], lokal_fb: ["", ""], lokal_city: ["", ""], lokal_ig: ["", ""] }), new Set())).toEqual({ ok: false, blad: "lokal" });
    expect(waliduj(formularz({ ...POPRAWNY, lokal_fb: ["", "Nova Sushi"] }), new Set())).toEqual({ ok: false, blad: "lokal" });
    expect(waliduj(formularz({ ...POPRAWNY, kontakt_name: ["", ""], kontakt_email: ["", ""], kontakt_rola: ["", ""], kontakt_telefon: ["", ""] }), new Set())).toEqual({ ok: false, blad: "kontakt" });
    expect(waliduj(formularz({ ...POPRAWNY, kontakt_email: ["marek(at)example", ""] }), new Set())).toEqual({ ok: false, blad: "email" });
  });
});

describe("waliduj: przypisania zespołu", () => {
  const CC = "22222222-2222-4222-8222-222222222222";
  const OBCY = "33333333-3333-4333-8333-333333333333";
  it("bierze tylko kandydatów z listy, bez powtórzeń", () => {
    const w = waliduj(formularz({ ...POPRAWNY, przypisany: [CC, CC, OBCY] }), new Set([OPIEKUN]), new Set([CC]));
    expect(w.ok && w.dane.przypisani).toEqual([CC]);
  });
});

describe("walidujDaneKlienta (edycja)", () => {
  it("zwraca dane bez sluga i opiekuna, puste pola jako null", () => {
    const w = walidujDaneKlienta(formularz({ name: " Bao Bar ", category: "kat3", tier: "siec", monthly_amount_net: "", slack_channel: "", cooperation_started_on: "" }));
    expect(w).toEqual({ ok: true, dane: { name: "Bao Bar", category: "kat3", tier: "siec", monthly_amount_net: null, slack_channel: null, cooperation_started_on: null } });
  });
  it("odrzuca nieznaną kategorię i pakiet oraz kwotę powyżej miliona", () => {
    expect(walidujDaneKlienta(formularz({ name: "X", category: "kat9", tier: "siec" })).ok).toBe(false);
    expect(walidujDaneKlienta(formularz({ name: "X", category: "kat1", tier: "vip" })).ok).toBe(false);
    expect(walidujDaneKlienta(formularz({ name: "X", category: "kat1", tier: "siec", monthly_amount_net: "1000001" }))).toEqual({ ok: false, blad: "kwota" });
  });
});

describe("walidujLokal i walidujKontakt", () => {
  it("lokal: nazwa i strona FB obowiązkowe, IG bez @ i bez spacji, adres przycięty", () => {
    expect(walidujLokal({ name: "Bao", city: "", fb_page_name: "Bao Bar", ig_handle: "@bao.bar", address: " ul. Długa 1 " })).toEqual({ ok: true, dane: { name: "Bao", city: null, fb_page_name: "Bao Bar", ig_handle: "bao.bar", address: "ul. Długa 1" } });
    expect(walidujLokal({ name: "Bao", city: "", fb_page_name: " ", ig_handle: "" })).toEqual({ ok: false, blad: "lokal" });
    expect(walidujLokal({ name: "Bao", city: "", fb_page_name: "Bao", ig_handle: "bao bar" })).toEqual({ ok: false, blad: "ig" });
  });
  it("kontakt: imię obowiązkowe, e-mail sprawdzany, puste pola jako null", () => {
    expect(walidujKontakt({ name: "Ola", role_label: "", phone: "", email: "" })).toEqual({ ok: true, dane: { name: "Ola", role_label: null, phone: null, email: null } });
    expect(walidujKontakt({ name: "", role_label: "", phone: "", email: "ola@example.com" })).toEqual({ ok: false, blad: "kontakt" });
    expect(walidujKontakt({ name: "Ola", role_label: "", phone: "", email: "ola@" })).toEqual({ ok: false, blad: "email" });
  });
});

describe("walidujAkceptacje", () => {
  it("godziny auto-akceptacji tylko 72-720 (regulamin § 5: wolno wydłużyć), puste = ustawienie globalne", () => {
    expect(walidujAkceptacje(formularz({ auto_approve_default: "on", auto_approve_hours: "96", default_publish_hours: "18, 12 12" }))).toEqual({ ok: true, dane: { auto_approve_default: true, auto_approve_hours: 96, default_publish_hours: [12, 18] } });
    expect(walidujAkceptacje(formularz({ auto_approve_hours: "", default_publish_hours: "12" }))).toEqual({ ok: true, dane: { auto_approve_default: false, auto_approve_hours: null, default_publish_hours: [12] } });
    expect(walidujAkceptacje(formularz({ auto_approve_hours: "48", default_publish_hours: "12" }))).toEqual({ ok: false, blad: "godzinyAuto" });
    expect(walidujAkceptacje(formularz({ auto_approve_hours: "721", default_publish_hours: "12" }))).toEqual({ ok: false, blad: "godzinyAuto" });
    expect(walidujAkceptacje(formularz({ auto_approve_hours: "80.5", default_publish_hours: "12" }))).toEqual({ ok: false, blad: "godzinyAuto" });
  });
  it("godziny publikacji: 1 do 6 pełnych godzin 0-23", () => {
    expect(walidujAkceptacje(formularz({ default_publish_hours: "" }))).toEqual({ ok: false, blad: "godzinyPublikacji" });
    expect(walidujAkceptacje(formularz({ default_publish_hours: "24" }))).toEqual({ ok: false, blad: "godzinyPublikacji" });
    expect(walidujAkceptacje(formularz({ default_publish_hours: "1 2 3 4 5 6 7" }))).toEqual({ ok: false, blad: "godzinyPublikacji" });
  });
});

describe("czyMoznaZmienicKategorie", () => {
  it("tylko klient bez pakietów i raportów", () => {
    expect(czyMoznaZmienicKategorie({ pakiety: 0, raporty: 0 })).toBe(true);
    expect(czyMoznaZmienicKategorie({ pakiety: 1, raporty: 0 })).toBe(false);
    expect(czyMoznaZmienicKategorie({ pakiety: 0, raporty: 2 })).toBe(false);
  });
});
