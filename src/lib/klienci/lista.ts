/**
 * Lista klientów zespołu (plan domknięcia, Etap 3b; SPEC rozdz. 12.1): wyszukiwarka, filtry i sortowanie z parametrów
 * adresu. Czysta logika bez bazy (testy jednostkowe); zakres widocznych klientów ustala wcześniej serwer.
 */
import type { Kategoria } from "@/lib/klienci/nowy";

export type StatusKlienta = "aktywny" | "wstrzymany" | "zakonczony";

export type KlientNaLiscie = {
  id: string;
  slug: string;
  name: string;
  category: Kategoria;
  status: StatusKlienta;
  demo: boolean;
  opiekunId: string | null;
  opiekun: string | null;
  doAkceptacji: number;
  aktywneLinki: number;
  /** Koniec ostatniego okresu pakietu (YYYY-MM-DD) albo null, gdy klient nie ma pakietów. */
  ostatniOkresDo: string | null;
};

export const SORTOWANIA = ["nazwa", "do_akceptacji", "okres"] as const;
export type Sortowanie = (typeof SORTOWANIA)[number];
export const FILTRY_STATUSU = ["trwajace", "nieaktywne", "wszystkie"] as const;
export type FiltrStatusu = (typeof FILTRY_STATUSU)[number];

export type FiltryListy = { q: string; opiekun: string | null; kategoria: Kategoria | null; status: FiltrStatusu; sort: Sortowanie };

const KATEGORIE = ["kat1", "kat2", "kat3"] as const;

/** Parametry adresu (formularz GET): nieznane wartości dają domyślne, nic nie trafia dalej bez sprawdzenia. */
export function odczytajFiltry(sp: Record<string, string | string[] | undefined>): FiltryListy {
  const jeden = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const kategoria = jeden("kategoria");
  const status = jeden("status");
  const sort = jeden("sort");
  const opiekun = jeden("opiekun");
  return {
    q: jeden("q").trim().slice(0, 80),
    opiekun: opiekun === "brak" || /^[0-9a-f-]{36}$/.test(opiekun) ? opiekun : null,
    kategoria: (KATEGORIE as readonly string[]).includes(kategoria) ? (kategoria as Kategoria) : null,
    status: (FILTRY_STATUSU as readonly string[]).includes(status) ? (status as FiltrStatusu) : "trwajace",
    sort: (SORTOWANIA as readonly string[]).includes(sort) ? (sort as Sortowanie) : "nazwa",
  };
}

/** Porównanie bez wielkości liter i polskich znaków: „zolc" znajdzie „Żółć". */
export function normalizuj(tekst: string): string {
  const mapa: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
  return tekst
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (z) => mapa[z] ?? z)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function filtrujKlientow(lista: KlientNaLiscie[], f: FiltryListy): KlientNaLiscie[] {
  const szukane = normalizuj(f.q);
  const wynik = lista.filter((k) => {
    if (f.status === "trwajace" && k.status !== "aktywny") return false;
    if (f.status === "nieaktywne" && k.status === "aktywny") return false;
    if (f.kategoria && k.category !== f.kategoria) return false;
    if (f.opiekun === "brak" ? k.opiekunId !== null : f.opiekun && k.opiekunId !== f.opiekun) return false;
    if (szukane && !normalizuj(k.name).includes(szukane) && !k.slug.includes(szukane)) return false;
    return true;
  });
  const poNazwie = (a: KlientNaLiscie, b: KlientNaLiscie) => a.name.localeCompare(b.name, "pl");
  return wynik.sort((a, b) => {
    if (f.sort === "do_akceptacji") return b.doAkceptacji - a.doAkceptacji || poNazwie(a, b);
    // najbliżej końca okresu na górze, klienci bez pakietów na samej górze (nie mają czego kończyć)
    if (f.sort === "okres") return (a.ostatniOkresDo ?? "").localeCompare(b.ostatniOkresDo ?? "") || poNazwie(a, b);
    return poNazwie(a, b);
  });
}
