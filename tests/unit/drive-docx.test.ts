import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { tekstZDocx } from "@/lib/drive/docx";
import { podzielOpisy, rozbierzDokumentReklam } from "@/lib/drive/opisy";

function docx(akapity: Array<string | { tekst: string; numerowany?: boolean; lamanie?: boolean }>): Uint8Array {
  const p = akapity
    .map((a) => {
      const x = typeof a === "string" ? { tekst: a } : a;
      if (!x.tekst) return "<w:p/>";
      const tresc = x.lamanie ? x.tekst.split("\n").map((l) => `<w:t xml:space="preserve">${l}</w:t>`).join("<w:br/>") : `<w:t>${x.tekst}</w:t>`;
      return `<w:p>${x.numerowany ? "<w:pPr><w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"1\"/></w:numPr></w:pPr>" : ""}<w:r>${tresc}</w:r></w:p>`;
    })
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p}</w:body></w:document>`;
  return zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "word/document.xml": strToU8(xml) });
}

describe("tekst z .docx (opisy i teksty reklam w Wordzie)", () => {
  it("składa akapity, łamania linii i encje; numeracja Worda dostaje prefiks", () => {
    const tekst = tekstZDocx(docx(["Teksty", { tekst: "Pierwszy &amp; drugi", numerowany: true }, { tekst: "Linia 1\nLinia 2", numerowany: true }, "", "Nagłówki", "Burger miesiąca"]));
    expect(tekst).toBe("Teksty\n- Pierwszy & drugi\n- Linia 1\nLinia 2\n\nNagłówki\nBurger miesiąca");
  });

  it("dokument reklam z Worda rozbiera się na teksty i nagłówki", () => {
    const d = rozbierzDokumentReklam(tekstZDocx(docx(["Teksty reklamowe", { tekst: "Tekst A.", numerowany: true }, { tekst: "Tekst B.", numerowany: true }, "", "Nagłówki", { tekst: "Nagłówek 1", numerowany: true }, { tekst: "Nagłówek 2", numerowany: true }])));
    expect(d.teksty).toEqual(["Tekst A.", "Tekst B."]);
    expect(d.naglowki).toEqual(["Nagłówek 1", "Nagłówek 2"]);
  });

  it("opisy postów z Worda dzielą się po nagłówkach", () => {
    const { sekcje } = podzielOpisy(tekstZDocx(docx(["Post 1", "Opis pierwszy.", "", "Post 2", "Opis drugi."])));
    expect(sekcje.map((s) => [s.numer, s.tresc])).toEqual([
      [1, "Opis pierwszy."],
      [2, "Opis drugi."],
    ]);
  });

  it("śmieci zamiast docx dają pusty tekst", () => {
    expect(tekstZDocx(new Uint8Array([1, 2, 3]))).toBe("");
  });
});
