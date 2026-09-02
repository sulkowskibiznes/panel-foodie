import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";

function zbierzTeksty(wartosc: unknown, sciezka: string, wynik: Array<[string, string]>) {
  if (typeof wartosc === "string") {
    wynik.push([sciezka, wartosc]);
  } else if (Array.isArray(wartosc)) {
    wartosc.forEach((el, i) => zbierzTeksty(el, `${sciezka}[${i}]`, wynik));
  } else if (wartosc && typeof wartosc === "object") {
    for (const [klucz, el] of Object.entries(wartosc)) zbierzTeksty(el, `${sciezka}.${klucz}`, wynik);
  }
  return wynik;
}

const teksty = zbierzTeksty(copy, "copy", []);

describe("copy.ts", () => {
  it("ma jakiekolwiek teksty", () => {
    expect(teksty.length).toBeGreaterThan(10);
  });

  it("nie zawiera pauz ani półpauz (tylko zwykły myślnik)", () => {
    const zPauza = teksty.filter(([, tekst]) => /[–—]/.test(tekst));
    expect(zPauza, "teksty z pauzą lub półpauzą").toEqual([]);
  });

  it("nie ma pustych tekstów", () => {
    const puste = teksty.filter(([, tekst]) => tekst.trim() === "");
    expect(puste).toEqual([]);
  });

  it("nie używa żargonu widocznego dla klienta", () => {
    const zargon = /\b(asset|item|deploy|placement)\b/i;
    const trafienia = teksty.filter(([sciezka, tekst]) => !sciezka.startsWith("copy.zespol") && zargon.test(tekst));
    expect(trafienia).toEqual([]);
  });
});
