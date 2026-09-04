import type { RodzajWariantu, WariantDto } from "@/lib/dto/materialy";

/**
 * Składanie wariantu reklamy dla wybranego lokalu (SPEC rozdz. 7.4, 1.4 poz. 15). Czysta logika,
 * używana przez podgląd reklamy w panelu klienta i zespołu oraz przez testy.
 *
 * Reguła: dla wybranego lokalu każdy rodzaj (grafika, tekst, nagłówek, opis, przycisk, link) bierze
 * warianty z `lokalId = lokal`, a gdy dla danego rodzaju ich nie ma, warianty wspólne (`lokalId = null`).
 * Pozycja „Wszystkie lokale (wersja wspólna)" (`lokalId = null`) pokazuje wyłącznie warianty wspólne.
 */
export type RodzajListy = "grafika" | "tekst" | "naglowek";
export type Zrodlo = "lokal" | "wspolny";

export type WyborWariantu = {
  lokalId: string | null;
  grafikaId: string | null;
  tekstId: string | null;
  naglowekId: string | null;
};

export type ZlozonyWariant = {
  grafika: WariantDto | null;
  tekst: WariantDto | null;
  naglowek: WariantDto | null;
  opis: string | null;
  cta: string | null;
  link: string | null;
  /** Skąd pochodzi każdy element: z wersji lokalu czy wspólnej. Brak klucza = elementu nie ma. */
  zrodla: Partial<Record<RodzajWariantu, Zrodlo>>;
};

const wgPozycji = (a: WariantDto, b: WariantDto) => a.pozycja - b.pozycja;

export function wariantyRodzaju(warianty: WariantDto[], rodzaj: RodzajWariantu, lokalId: string | null): { lista: WariantDto[]; zrodlo: Zrodlo | null } {
  if (lokalId !== null) {
    const swoje = warianty.filter((w) => w.rodzaj === rodzaj && w.lokalId === lokalId).sort(wgPozycji);
    if (swoje.length > 0) return { lista: swoje, zrodlo: "lokal" };
  }
  const wspolne = warianty.filter((w) => w.rodzaj === rodzaj && w.lokalId === null).sort(wgPozycji);
  return { lista: wspolne, zrodlo: wspolne.length > 0 ? "wspolny" : null };
}

export function opcjeWariantow(warianty: WariantDto[], lokalId: string | null): Record<"grafiki" | "teksty" | "naglowki", WariantDto[]> {
  return {
    grafiki: wariantyRodzaju(warianty, "grafika", lokalId).lista,
    teksty: wariantyRodzaju(warianty, "tekst", lokalId).lista,
    naglowki: wariantyRodzaju(warianty, "naglowek", lokalId).lista,
  };
}

export function domyslnyWybor(warianty: WariantDto[], lokalId: string | null): WyborWariantu {
  const o = opcjeWariantow(warianty, lokalId);
  return { lokalId, grafikaId: o.grafiki[0]?.id ?? null, tekstId: o.teksty[0]?.id ?? null, naglowekId: o.naglowki[0]?.id ?? null };
}

/** Zmiana lokalu: wybór zostaje, jeśli istnieje w nowych opcjach, inaczej wraca do pierwszej pozycji. */
export function dopasujWybor(warianty: WariantDto[], wybor: WyborWariantu, nowyLokalId: string | null): WyborWariantu {
  const o = opcjeWariantow(warianty, nowyLokalId);
  const zachowaj = (lista: WariantDto[], id: string | null) => (id && lista.some((w) => w.id === id) ? id : (lista[0]?.id ?? null));
  return { lokalId: nowyLokalId, grafikaId: zachowaj(o.grafiki, wybor.grafikaId), tekstId: zachowaj(o.teksty, wybor.tekstId), naglowekId: zachowaj(o.naglowki, wybor.naglowekId) };
}

export function zlozWariant(warianty: WariantDto[], wybor: WyborWariantu): ZlozonyWariant {
  const zrodla: ZlozonyWariant["zrodla"] = {};
  const zListy = (rodzaj: RodzajListy, id: string | null): WariantDto | null => {
    const { lista, zrodlo } = wariantyRodzaju(warianty, rodzaj, wybor.lokalId);
    const wybrany = (id ? lista.find((w) => w.id === id) : undefined) ?? lista[0] ?? null;
    if (wybrany && zrodlo) zrodla[rodzaj] = zrodlo;
    return wybrany;
  };
  const pojedynczy = (rodzaj: "opis" | "cta" | "link"): string | null => {
    const { lista, zrodlo } = wariantyRodzaju(warianty, rodzaj, wybor.lokalId);
    const w = lista[0];
    if (w && zrodlo) zrodla[rodzaj] = zrodlo;
    return w?.tekst ?? null;
  };
  return {
    grafika: zListy("grafika", wybor.grafikaId),
    tekst: zListy("tekst", wybor.tekstId),
    naglowek: zListy("naglowek", wybor.naglowekId),
    opis: pojedynczy("opis"),
    cta: pojedynczy("cta"),
    link: pojedynczy("link"),
    zrodla,
  };
}

/** 6 × 3 × 3 = 54 dla pełnego zestawu; 0, gdy brakuje któregoś rodzaju. */
export function liczbaKombinacji(warianty: WariantDto[], lokalId: string | null): number {
  const o = opcjeWariantow(warianty, lokalId);
  return o.grafiki.length * o.teksty.length * o.naglowki.length;
}

/** Lokale, które mają własne warianty (do podpisów „wersja dla ..."). */
export function lokaleZWariantami(warianty: WariantDto[]): string[] {
  return [...new Set(warianty.map((w) => w.lokalId).filter((id): id is string => id !== null))];
}

/** Wyświetlana domena linku, jak w pasku reklamy na Facebooku. */
export function domenaLinku(link: string | null): string | null {
  if (!link) return null;
  try {
    return new URL(link.includes("://") ? link : `https://${link}`).hostname.replace(/^www\./, "").toUpperCase();
  } catch {
    return null;
  }
}
