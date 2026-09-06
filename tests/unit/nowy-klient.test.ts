import { describe, expect, it } from "vitest";
import { slugZNazwy, waliduj } from "@/lib/klienci/nowy";

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
