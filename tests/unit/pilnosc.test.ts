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
      { clientId: "a", od: "2026-09-10", do: "2026-10-05" },
      { clientId: "b", od: "2026-09-10", do: "2026-10-09" },
      { clientId: "b", od: "2026-10-10", do: "2026-11-09" },
    ];
    expect(klienciBezNastepnegoPakietu(klienci, okresy, "2026-09-29")).toEqual([
      { id: "c", slug: "c", name: "Cezar", ostatniDo: null },
      { id: "a", slug: "a", name: "Alfa", ostatniDo: "2026-10-05" },
    ]);
  });
});
