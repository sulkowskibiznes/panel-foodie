import { describe, expect, it } from "vitest";
import { nieuzyteSekcje, pogrupujPoNumerze, rodzajZMime, zaproponujPosty, zaproponujRelacje, type PlikDoParowania, type ZrodloOpisu } from "@/lib/drive/parowanie";

const obraz = (id: string, nazwa: string): PlikDoParowania => ({ id, nazwa, mime: "image/png", bytes: 1000, rodzaj: "obraz" });
const wideo = (id: string, nazwa: string): PlikDoParowania => ({ id, nazwa, mime: "video/mp4", bytes: 1000, rodzaj: "wideo" });

describe("parowanie grafik z opisami (SPEC rozdz. 13.3)", () => {
  it("rozpoznaje rodzaj pliku z mime", () => {
    expect(rodzajZMime("application/vnd.google-apps.document")).toBe("dokument");
    expect(rodzajZMime("application/vnd.google-apps.folder")).toBe("folder");
    expect(rodzajZMime("image/jpeg")).toBe("obraz");
    expect(rodzajZMime("video/quicktime")).toBe("wideo");
    expect(rodzajZMime("application/pdf")).toBe("inny");
  });

  it("grupuje karuzelę po numerze i sortuje slajdy", () => {
    const grupy = pogrupujPoNumerze([obraz("b", "3b.png"), obraz("a", "3a.png"), obraz("x", "10.png"), obraz("y", "2.png"), obraz("z", "nowe menu.png")]);
    expect(grupy.map((g) => [g.numer, g.pliki.map((p) => p.id)])).toEqual([
      [2, ["y"]],
      [3, ["a", "b"]],
      [10, ["x"]],
      [null, ["z"]],
    ]);
  });

  it("opis po numerze z dokumentu zbiorczego, wideo jako Reels, brak opisu oznaczony", () => {
    const zrodla: ZrodloOpisu[] = [{ dokumentId: "d", nazwaDokumentu: "Opisy", sekcje: [{ numer: 1, tytul: "burger", tresc: "Opis 1" }, { numer: 2, tytul: "", tresc: "Opis 2" }, { numer: 3, tytul: "rolka", tresc: "Opis 3" }] }];
    const p = zaproponujPosty([obraz("a", "1.png"), obraz("b1", "2a.png"), obraz("b2", "2b.png"), wideo("c", "3.mp4"), obraz("d", "4.png")], zrodla);
    expect(p.map((m) => [m.rodzaj, m.numer, m.pliki.length, m.opis, m.dopasowanie])).toEqual([
      ["post", 1, 1, "Opis 1", "numer"],
      ["post", 2, 2, "Opis 2", "numer"],
      ["reels", 3, 1, "Opis 3", "numer"],
      ["post", 4, 1, null, "brak"],
    ]);
    expect(p[0]?.tytul).toBe("Post 1 - burger");
    expect(p[2]?.tytul).toBe("Reels 3 - rolka");
    expect(p[3]?.tytul).toBe("Post 4");
  });

  it("dokument per post po numerze w nazwie dokumentu, a bez numerów po kolejności", () => {
    const perPost: ZrodloOpisu[] = [
      { dokumentId: "d2", nazwaDokumentu: "Post 2 - opis", sekcje: [{ numer: null, tytul: "", tresc: "Drugi" }] },
      { dokumentId: "d1", nazwaDokumentu: "Post 1 - opis", sekcje: [{ numer: null, tytul: "", tresc: "Pierwszy" }] },
    ];
    const p = zaproponujPosty([obraz("a", "1.png"), obraz("b", "2.png")], perPost);
    expect(p.map((m) => [m.opis, m.dopasowanie])).toEqual([
      ["Pierwszy", "dokument"],
      ["Drugi", "dokument"],
    ]);
    const bezNumerow: ZrodloOpisu[] = [{ dokumentId: "d", nazwaDokumentu: "Opisy", sekcje: [{ numer: null, tytul: "", tresc: "A" }, { numer: null, tytul: "", tresc: "B" }] }];
    const q = zaproponujPosty([obraz("a", "burger.png"), obraz("b", "pizza.png")], bezNumerow);
    expect(q.map((m) => [m.opis, m.dopasowanie])).toEqual([
      ["A", "kolejnosc"],
      ["B", "kolejnosc"],
    ]);
  });

  it("relacje po jednej na plik w kolejności naturalnej; nieużyte sekcje wracają", () => {
    const r = zaproponujRelacje([obraz("b", "10.png"), wideo("a", "2.mp4"), obraz("c", "1.png")]);
    expect(r.map((m) => [m.rodzaj, m.pliki[0]?.id, m.tytul])).toEqual([
      ["relacja", "c", "Relacja 1"],
      ["relacja", "a", "Relacja 2"],
      ["relacja", "b", "Relacja 10"],
    ]);
    const zrodla: ZrodloOpisu[] = [{ dokumentId: "d", nazwaDokumentu: "Opisy", sekcje: [{ numer: 1, tytul: "", tresc: "Opis 1" }, { numer: 7, tytul: "", tresc: "Opis 7" }] }];
    const p = zaproponujPosty([obraz("a", "1.png")], zrodla);
    expect(nieuzyteSekcje(zrodla, p).map((n) => n.sekcja.numer)).toEqual([7]);
  });
});
