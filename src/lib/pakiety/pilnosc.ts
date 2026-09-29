/**
 * Pulpit według pilności (plan domknięcia, Etap 3b; SPEC rozdz. 12.1): kolejność pakietów, kafelki z licznikami
 * i klienci bez pakietu na następny okres. Czysta logika bez Next i bazy (testy jednostkowe).
 */
import type { StatusPakietu } from "@/lib/dto/materialy";

const MS_GODZINY = 3_600_000;
const MS_DNIA = 24 * MS_GODZINY;

export type PakietDoPilnosci = {
  status: StatusPakietu;
  wstrzymana: boolean;
  autoAkceptacjaO: string | null;
  nieprzeczytaneUwagi: number;
  wyslanoO: string | null;
  okres: { od: string; do: string };
};

/** Kafelki nad tabelą: każdy jest też filtrem (`?kafelek=`). Pakiet może trafić do kilku kafelków naraz. */
export const KAFELKI = ["wstrzymana", "auto24h", "noweUwagi", "poprawki", "doZaplanowania", "szkice"] as const;
export type Kafelek = (typeof KAFELKI)[number];

function doAuto(p: PakietDoPilnosci, teraz: Date): number | null {
  return p.status === "do_akceptacji" && p.autoAkceptacjaO ? new Date(p.autoAkceptacjaO).getTime() - teraz.getTime() : null;
}

export function czyWKafelku(p: PakietDoPilnosci, k: Kafelek, teraz: Date): boolean {
  switch (k) {
    case "wstrzymana":
      return p.wstrzymana;
    case "auto24h": {
      const ms = doAuto(p, teraz);
      return !p.wstrzymana && ms !== null && ms > 0 && ms <= 24 * MS_GODZINY;
    }
    case "noweUwagi":
      return p.nieprzeczytaneUwagi > 0;
    case "poprawki":
      return p.status === "poprawki";
    case "doZaplanowania":
      return p.status === "zaakceptowany";
    case "szkice":
      return p.status === "szkic";
  }
}

export function policzKafelki(pakiety: PakietDoPilnosci[], teraz: Date): Record<Kafelek, number> {
  const wynik = Object.fromEntries(KAFELKI.map((k) => [k, 0])) as Record<Kafelek, number>;
  for (const p of pakiety) for (const k of KAFELKI) if (czyWKafelku(p, k, teraz)) wynik[k]++;
  return wynik;
}

/**
 * Ranga (mniej = pilniej): wstrzymana auto-akceptacja, auto-akceptacja w 24 h, nowe uwagi, poprawki, reszta czekająca
 * na klienta, do zaplanowania w Meta, szkice. Kolory terminów zostają jak w Bazie Klientów (lib/pakiety/terminy.ts).
 */
export function rangaPilnosci(p: PakietDoPilnosci, teraz: Date): number {
  if (p.wstrzymana) return 0;
  if (czyWKafelku(p, "auto24h", teraz)) return 1;
  if (p.nieprzeczytaneUwagi > 0) return 2;
  if (p.status === "poprawki") return 3;
  if (p.status === "do_akceptacji") return 4;
  if (p.status === "zaakceptowany") return 5;
  return 6;
}

/** W obrębie rangi: najbliższy termin auto-akceptacji, potem najwcześniejszy początek okresu, potem najdawniej wysłane. */
export function sortujWgPilnosci<T extends PakietDoPilnosci>(pakiety: T[], teraz: Date): T[] {
  const klucz = (p: T) => [rangaPilnosci(p, teraz), doAuto(p, teraz) ?? Number.MAX_SAFE_INTEGER, p.okres.od, p.wyslanoO ?? "9999"] as const;
  return [...pakiety].sort((a, b) => {
    const ka = klucz(a);
    const kb = klucz(b);
    for (let i = 0; i < ka.length; i++) {
      const x = ka[i]!;
      const y = kb[i]!;
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  });
}

export type KlientDoPlanu = { id: string; slug: string; name: string };
export type OkresPakietu = { clientId: string; od: string; do: string };
export type KlientBezPakietu = KlientDoPlanu & { ostatniDo: string | null };

/**
 * Klienci bez pakietu na następny okres: ostatni okres kończy się w ciągu `dni` dni (albo już się skończył), a po nim
 * nie ma kolejnego pakietu; klient bez żadnego pakietu też trafia na listę (`ostatniDo: null`). Daty `YYYY-MM-DD`.
 */
export function klienciBezNastepnegoPakietu(klienci: KlientDoPlanu[], okresy: OkresPakietu[], dzis: string, dni = 10): KlientBezPakietu[] {
  const granica = new Date(new Date(`${dzis}T00:00:00Z`).getTime() + dni * MS_DNIA).toISOString().slice(0, 10);
  const ostatni = new Map<string, string>();
  for (const o of okresy) {
    const obecny = ostatni.get(o.clientId);
    if (!obecny || o.do > obecny) ostatni.set(o.clientId, o.do);
  }
  return klienci
    .map((k) => ({ ...k, ostatniDo: ostatni.get(k.id) ?? null }))
    .filter((k) => k.ostatniDo === null || k.ostatniDo <= granica)
    .sort((a, b) => (a.ostatniDo ?? "").localeCompare(b.ostatniDo ?? "") || a.name.localeCompare(b.name, "pl"));
}
