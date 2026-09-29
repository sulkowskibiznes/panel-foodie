import { describe, expect, it } from "vitest";
import { filtrujKlientow, normalizuj, odczytajFiltry, type KlientNaLiscie } from "@/lib/klienci/lista";

const OPIEKUN = "11111111-1111-4111-8111-111111111111";

function klient(n: Partial<KlientNaLiscie> & Pick<KlientNaLiscie, "name">): KlientNaLiscie {
  return { id: n.name, slug: normalizuj(n.name).replace(/\s+/g, "-"), category: "kat2", status: "aktywny", demo: false, opiekunId: null, opiekun: null, doAkceptacji: 0, aktywneLinki: 0, ostatniOkresDo: null, ...n };
}

const LISTA = [
  klient({ name: "Żółta Kuchnia", category: "kat1", opiekunId: OPIEKUN, doAkceptacji: 2, ostatniOkresDo: "2026-10-19" }),
  klient({ name: "Bao Bar", doAkceptacji: 0, ostatniOkresDo: "2026-10-04" }),
  klient({ name: "Nova Sushi", status: "wstrzymany", opiekunId: OPIEKUN }),
  klient({ name: "Ramen Ichi", status: "zakonczony", category: "kat3" }),
];

describe("odczytajFiltry", () => {
  it("domyślnie trwające, po nazwie; śmieci w adresie dają wartości domyślne", () => {
    expect(odczytajFiltry({})).toEqual({ q: "", opiekun: null, kategoria: null, status: "trwajace", sort: "nazwa" });
    expect(odczytajFiltry({ kategoria: "kat9", status: "x", sort: "id; drop", opiekun: "nie-uuid", q: ["a", "b"] })).toEqual({ q: "", opiekun: null, kategoria: null, status: "trwajace", sort: "nazwa" });
    expect(odczytajFiltry({ opiekun: "brak", kategoria: "kat1", status: "wszystkie", sort: "okres", q: " bao " })).toEqual({ q: "bao", opiekun: "brak", kategoria: "kat1", status: "wszystkie", sort: "okres" });
  });
});

describe("filtrujKlientow", () => {
  const f = odczytajFiltry({});
  it("wyszukiwanie bez polskich znaków i wielkości liter, także po slugu", () => {
    expect(filtrujKlientow(LISTA, { ...f, q: "zolta" }).map((k) => k.name)).toEqual(["Żółta Kuchnia"]);
    expect(filtrujKlientow(LISTA, { ...f, q: "BAO" }).map((k) => k.name)).toEqual(["Bao Bar"]);
  });

  it("status: trwające, nieaktywne (przerwy i zakończone), wszystkie", () => {
    expect(filtrujKlientow(LISTA, f).map((k) => k.name)).toEqual(["Bao Bar", "Żółta Kuchnia"]);
    expect(filtrujKlientow(LISTA, { ...f, status: "nieaktywne" }).map((k) => k.name)).toEqual(["Nova Sushi", "Ramen Ichi"]);
    expect(filtrujKlientow(LISTA, { ...f, status: "wszystkie" })).toHaveLength(4);
  });

  it("opiekun (także „bez opiekuna”) i kategoria", () => {
    expect(filtrujKlientow(LISTA, { ...f, status: "wszystkie", opiekun: OPIEKUN }).map((k) => k.name)).toEqual(["Nova Sushi", "Żółta Kuchnia"]);
    expect(filtrujKlientow(LISTA, { ...f, status: "wszystkie", opiekun: "brak" }).map((k) => k.name)).toEqual(["Bao Bar", "Ramen Ichi"]);
    expect(filtrujKlientow(LISTA, { ...f, status: "wszystkie", kategoria: "kat3" }).map((k) => k.name)).toEqual(["Ramen Ichi"]);
  });

  it("sortowanie: najwięcej do akceptacji, najbliższy koniec okresu", () => {
    expect(filtrujKlientow(LISTA, { ...f, sort: "do_akceptacji" }).map((k) => k.name)).toEqual(["Żółta Kuchnia", "Bao Bar"]);
    expect(filtrujKlientow(LISTA, { ...f, sort: "okres" }).map((k) => k.name)).toEqual(["Bao Bar", "Żółta Kuchnia"]);
  });
});
