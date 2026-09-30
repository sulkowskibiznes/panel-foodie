import { describe, expect, it } from "vitest";
import { czyWKafelku, klienciBezNastepnegoPakietu, policzKafelki, rangaPilnosci, sortujWgPilnosci, type PakietDoPilnosci } from "@/lib/pakiety/pilnosc";

const TERAZ = new Date("2026-09-29T12:00:00Z");
const za = (h: number) => new Date(TERAZ.getTime() + h * 3_600_000).toISOString();

function pakiet(n: Partial<PakietDoPilnosci> & { id: string }): PakietDoPilnosci & { id: string } {
  return { status: "do_akceptacji", wstrzymana: false, autoAkceptacjaO: za(60), nieprzeczytaneUwagi: 0, wyslanoO: za(-12), okres: { od: "2026-10-01", do: "2026-10-31" }, ...n };
}

describe("kafelki pulpitu", () => {
  it("wstrzymana, auto w 24 h, nowe uwagi, poprawki, do zaplanowania, szkice", () => {
    expect(czyWKafelku(pakiet({ id: "a", wstrzymana: true, autoAkceptacjaO: za(-1) }), "wstrzymana", TERAZ)).toBe(true);
    expect(czyWKafelku(pakiet({ id: "b", autoAkceptacjaO: za(5) }), "auto24h", TERAZ)).toBe(true);
    expect(czyWKafelku(pakiet({ id: "c", autoAkceptacjaO: za(30) }), "auto24h", TERAZ)).toBe(false);
    // termin minął, ale bez uwag: cron go zatwierdzi, to nie „w 24 h"
    expect(czyWKafelku(pakiet({ id: "d", autoAkceptacjaO: za(-1) }), "auto24h", TERAZ)).toBe(false);
    expect(czyWKafelku(pakiet({ id: "e", nieprzeczytaneUwagi: 2 }), "noweUwagi", TERAZ)).toBe(true);
    expect(czyWKafelku(pakiet({ id: "f", status: "zaakceptowany", autoAkceptacjaO: null }), "doZaplanowania", TERAZ)).toBe(true);
  });

  it("liczniki: pakiet może być w kilku kafelkach", () => {
    const lista = [pakiet({ id: "a", wstrzymana: true, nieprzeczytaneUwagi: 1, autoAkceptacjaO: za(-1) }), pakiet({ id: "b", status: "szkic", autoAkceptacjaO: null, wyslanoO: null }), pakiet({ id: "c", status: "poprawki", autoAkceptacjaO: null })];
    expect(policzKafelki(lista, TERAZ)).toEqual({ wstrzymana: 1, auto24h: 0, noweUwagi: 1, poprawki: 1, doZaplanowania: 0, szkice: 1 });
  });
});

describe("sortujWgPilnosci", () => {
  it("wstrzymana, auto w 24 h (najbliższy termin pierwszy), nowe uwagi, poprawki, czekające, do zaplanowania, szkice", () => {
    const lista = [
      pakiet({ id: "szkic", status: "szkic", autoAkceptacjaO: null, wyslanoO: null }),
      pakiet({ id: "czeka", autoAkceptacjaO: za(70) }),
      pakiet({ id: "plan", status: "zaakceptowany", autoAkceptacjaO: null }),
      pakiet({ id: "auto10", autoAkceptacjaO: za(10) }),
      pakiet({ id: "poprawki", status: "poprawki", autoAkceptacjaO: null }),
      pakiet({ id: "uwagi", nieprzeczytaneUwagi: 1 }),
      pakiet({ id: "auto3", autoAkceptacjaO: za(3) }),
      pakiet({ id: "stoi", wstrzymana: true, autoAkceptacjaO: za(-2) }),
    ];
    expect(sortujWgPilnosci(lista, TERAZ).map((p) => p.id)).toEqual(["stoi", "auto3", "auto10", "uwagi", "poprawki", "czeka", "plan", "szkic"]);
    expect(rangaPilnosci(lista[0]!, TERAZ)).toBe(6);
  });
});

describe("klienciBezNastepnegoPakietu", () => {
  const klienci = [
    { id: "a", slug: "a", name: "Alfa" },
    { id: "b", slug: "b", name: "Beta" },
    { id: "c", slug: "c", name: "Cezar" },
  ];
  it("okres kończy się w ciągu 10 dni albo już się skończył; bez pakietów też na liście; z kolejnym pakietem nie", () => {
    const okresy = [
      { clientId: "a", lokalId: null, do: "2026-10-05" },
      { clientId: "b", lokalId: null, do: "2026-11-09" },
    ];
    expect(klienciBezNastepnegoPakietu(klienci, okresy, "2026-09-29")).toEqual([
      { id: "c", slug: "c", name: "Cezar", ostatniDo: null, lokal: null },
      { id: "a", slug: "a", name: "Alfa", ostatniDo: "2026-10-05", lokal: null },
    ]);
  });

  it("kat1: każdy lokal osobno, pakiet lokalu B nie zasłania braku pakietu lokalu A; lokal bez pakietu też na liście", () => {
    const kat1 = { id: "r", slug: "r", name: "Restauracje", category: "kat1", lokale: [{ id: "A", name: "Rynek" }, { id: "B", name: "Port" }, { id: "C", name: "Dworzec" }] };
    const okresy = [
      { clientId: "r", lokalId: "A", do: "2026-10-03" },
      { clientId: "r", lokalId: "B", do: "2026-11-05" },
    ];
    expect(klienciBezNastepnegoPakietu([kat1, ...klienci], okresy, "2026-09-29").map((k) => [k.id, k.lokal?.name ?? null, k.ostatniDo])).toEqual([
      ["a", null, null],
      ["b", null, null],
      ["c", null, null],
      ["r", "Dworzec", null],
      ["r", "Rynek", "2026-10-03"],
    ]);
    // kat1 bez listy lokali: ocena jak dla reszty (ostatni okres klienta)
    expect(klienciBezNastepnegoPakietu([{ ...kat1, lokale: undefined }], okresy, "2026-09-29")).toEqual([]);
  });
});
