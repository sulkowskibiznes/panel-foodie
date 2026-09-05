import { describe, expect, it } from "vitest";
import { duzeWideo, planSchemat, plikiPlanu, policzPostep, sprawdzLimity, type Plan } from "@/lib/import/plan";
import { MB } from "@/lib/pliki/magia";

const plik = (id: string, bytes: number | null = 1000, assetId: string | null = null) => ({ id: `plik-${id}`, nazwa: `${id}.png`, mime: "image/png", bytes, assetId });

describe("plan importu (SPEC rozdz. 13.3, 13.4)", () => {
  it("limity: obraz 25 MB, wideo 300 MB, komunikat mówi który plik i ile waży", () => {
    expect(sprawdzLimity([{ nazwa: "1.png", mime: "image/png", bytes: 24 * MB }, { nazwa: "r.mp4", mime: "video/mp4", bytes: 299 * MB }])).toBeNull();
    const n = sprawdzLimity([{ nazwa: "1.png", mime: "image/png", bytes: 1000 }, { nazwa: "ogromny.png", mime: "image/png", bytes: 30 * MB }]);
    expect(n?.komunikat).toEqual({ nazwa: "ogromny.png", waga: "30 MB", limit: "25 MB" });
    expect(sprawdzLimity([{ nazwa: "film.mov", mime: "video/quicktime", bytes: 301 * MB }])?.komunikat.limit).toBe("300 MB");
    expect(sprawdzLimity([{ nazwa: "x.png", mime: "image/png", bytes: null }])).toBeNull();
    expect(duzeWideo([{ nazwa: "film.mp4", mime: "video/mp4", bytes: 151 * MB }, { nazwa: "maly.mp4", mime: "video/mp4", bytes: 10 * MB }])).toEqual([{ nazwa: "film.mp4", waga: "151 MB" }]);
  });

  it("liczy postęp bez pominiętych materiałów; assetId oznacza skopiowany plik", () => {
    const plan: Plan = { rodzaj: "content", folderId: "folder-1", materialy: [
      { klucz: "a", rodzaj: "post", tytul: "Post 1", opis: null, pliki: [plik("1", 1000, "asset-1"), plik("2")] },
      { klucz: "b", rodzaj: "relacja", tytul: "Relacja 1", opis: null, pliki: [plik("3")], pominiety: true },
    ] };
    expect(plikiPlanu(plan).map((p) => p.id)).toEqual(["plik-1", "plik-2"]);
    expect(policzPostep(plan)).toEqual({ razem: 2, gotowe: 1 });
  });

  it("walidacja odrzuca plan bez plików i z obcym rodzajem", () => {
    expect(planSchemat.safeParse({ rodzaj: "content", folderId: "folder-1", materialy: [{ klucz: "a", rodzaj: "post", tytul: "x", opis: null, pliki: [] }] }).success).toBe(false);
    expect(planSchemat.safeParse({ rodzaj: "reklamy", folderId: "folder-1", kampaniaId: "nie-uuid", grafiki: [], teksty: [], naglowki: [], opis: null, cta: null, link: null }).success).toBe(false);
    expect(planSchemat.safeParse({ rodzaj: "reklamy", folderId: "folder-1", kampaniaId: "6f1e2d3c-4b5a-4c6d-8e9f-0a1b2c3d4e5f", grafiki: [plik("g")], teksty: ["A"], naglowki: [], opis: null, cta: null, link: null }).success).toBe(true);
  });
});
