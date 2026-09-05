/**
 * Nazwy plików i folderów z Dysku (SPEC rozdz. 13.2, 13.3). Czysta logika bez sieci: sortowanie naturalne
 * (1, 2, ..., 10, nie 1, 10, 2), numer i slajd z nazwy grafiki („3a.png", „3-2.png", „post 3 slajd 2"),
 * normalizacja do porównań (nazwa klienta na Dysku vs w bazie) i numer miesiąca z nazwy folderu.
 */
const kolator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });

export function porownajNaturalnie(a: string, b: string): number {
  return kolator.compare(a, b);
}

export function sortujNaturalnie<T>(lista: readonly T[], nazwa: (t: T) => string): T[] {
  return [...lista].sort((a, b) => porownajNaturalnie(nazwa(a), nazwa(b)));
}

/** Małe litery, bez polskich znaków i interpunkcji, pojedyncze spacje: do porównań „czy to ten sam klient". */
export function normalizujNazwe(tekst: string): string {
  return tekst
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Nazwa klienta na Dysku „pasuje", gdy po normalizacji jedna zawiera drugą (np. „Nova Sushi" i „Nova Sushi Sp. z o.o."). */
export function czyNazwyPasuja(a: string, b: string): boolean {
  const na = normalizujNazwe(a);
  const nb = normalizujNazwe(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function bezRozszerzenia(nazwa: string): string {
  const kropka = nazwa.lastIndexOf(".");
  return kropka > 0 ? nazwa.slice(0, kropka) : nazwa;
}

export function rozszerzenie(nazwa: string): string {
  const kropka = nazwa.lastIndexOf(".");
  return kropka > 0 ? nazwa.slice(kropka + 1).toLowerCase() : "";
}

export type RozbiorNazwy = { numer: number | null; slajd: number | null; reszta: string };

const PREFIKS = /^(?:post|posty|relacja|relacje|reels|rolka|grafika|slajd|stories|story|ad|reklama)?[\s_\-.]*/i;
const WIODACY = /^(\d{1,3})(?!\d)(?:[\s_\-.]*(?:\(?(\d{1,2})\)?(?!\d)|([a-z])(?=[\s_\-.]|$)))?(?:[\s_\-.]+|$)/i;
const KONCOWY = /(?:^|[\s_\-.])(\d{1,2})(?!\d)(?:[\s_\-.]*([a-z])(?=$)|[\s_\-.]+(\d{1,2})(?!\d))?\s*$/i;
const SLAJD = /(?:slajd|slide)[\s_\-.]*(\d{1,2})(?!\d)/i;

/**
 * Numer materiału i numer slajdu z nazwy pliku. „3.png" → 3; „3a.png" → 3/1; „3-2.png" → 3/2;
 * „post 3 slajd 2.png" → 3/2; „burger 7.jpg" → 7; „IMG_20240512.jpg" → bez numeru (data to nie numer posta).
 */
export function rozbierzNazwe(nazwaPliku: string): RozbiorNazwy {
  const baza = bezRozszerzenia(nazwaPliku).trim();
  const bezPrefiksu = baza.replace(PREFIKS, "");
  const slajdZeSlowa = SLAJD.exec(baza)?.[1];
  const w = WIODACY.exec(bezPrefiksu);
  if (w?.[1]) {
    const numer = Number(w[1]);
    if (numer >= 1 && numer <= 99) {
      const slajd = slajdZeSlowa ? Number(slajdZeSlowa) : w[2] ? Number(w[2]) : w[3] ? w[3].toLowerCase().charCodeAt(0) - 96 : null;
      return { numer, slajd, reszta: bezPrefiksu.slice(w[0].length).trim() };
    }
  }
  const k = KONCOWY.exec(baza);
  if (k?.[1]) {
    const numer = Number(k[1]);
    if (numer >= 1 && numer <= 99) {
      const slajd = slajdZeSlowa ? Number(slajdZeSlowa) : k[3] ? Number(k[3]) : k[2] ? k[2].toLowerCase().charCodeAt(0) - 96 : null;
      return { numer, slajd, reszta: baza.slice(0, k.index).trim() };
    }
  }
  return { numer: null, slajd: slajdZeSlowa ? Number(slajdZeSlowa) : null, reszta: baza };
}

/** Okres „RR-MM" w nazwie folderu („Content 26-09" → { rok: 2026, miesiac: 9 }); zespół nazywa tak foldery zamiast numerem miesiąca współpracy. */
export function okresZNazwy(nazwa: string): { rok: number; miesiac: number } | null {
  const m = /(?:^|\D)(\d{2})[-_.](\d{2})(?!\d)/.exec(nazwa);
  if (!m?.[1] || !m[2]) return null;
  const rok = 2000 + Number(m[1]);
  const miesiac = Number(m[2]);
  return miesiac >= 1 && miesiac <= 12 ? { rok, miesiac } : null;
}

/** Pierwsza liczba 1-99 w nazwie folderu („content 5 mies" → 5, „reklamy 12 mies - imprezy" → 12); nazwa z „RR-MM" nie ma numeru miesiąca współpracy. */
export function numerMiesiacaZNazwy(nazwa: string): number | null {
  if (okresZNazwy(nazwa)) return null;
  const m = /(?:^|\D)(\d{1,2})(?!\d)/.exec(nazwa);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 99 ? n : null;
}

/** Podfolder „1. Posty" albo „2. Relacje" po nazwie, niezależnie od numeracji i wielkości liter. */
export function rodzajPodfolderu(nazwa: string): "posty" | "relacje" | null {
  const n = normalizujNazwe(nazwa);
  if (/\bpost/.test(n) || /\breels|\brolk/.test(n)) return "posty";
  if (/\brelacj|\bstor(?:y|ies)\b/.test(n)) return "relacje";
  return null;
}

/** Robocza nazwa materiału z nazwy pliku: bez rozszerzenia, numeru i podkreśleń („3. burger klasyk.png" → „Burger klasyk"). */
export function tytulZNazwy(nazwaPliku: string): string {
  const { reszta } = rozbierzNazwe(nazwaPliku);
  const tekst = reszta.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!tekst) return "";
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}
