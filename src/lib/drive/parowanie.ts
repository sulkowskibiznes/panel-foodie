import { porownajNaturalnie, rozbierzNazwe, sortujNaturalnie, tytulZNazwy } from "@/lib/drive/nazwy";
import type { SekcjaOpisu } from "@/lib/drive/opisy";

/**
 * Propozycja parowania „grafika ↔ opis" (SPEC rozdz. 13.3). Czysta logika; wynik zawsze idzie na ekran
 * mapowania, gdzie człowiek poprawia, zanim cokolwiek trafi do bazy. Nigdy nie tworzymy pakietu bez tego kroku.
 *
 * Reguły: grafiki w kolejności naturalnej; pliki z tym samym numerem to jedna karuzela (3a, 3b albo 3-1, 3-2);
 * wideo w folderze postów to Reels; opis dopasowany po numerze („Post 3" ↔ „3.png"), w drugiej kolejności
 * po nazwie dokumentu, w ostatniej po kolejności. Dopasowanie po kolejności jest oznaczone, żeby rzucało się w oczy.
 */
export type RodzajPlikuDysku = "obraz" | "wideo" | "dokument" | "tekst" | "folder" | "inny";

export type PlikDoParowania = { id: string; nazwa: string; mime: string; bytes: number | null; rodzaj: RodzajPlikuDysku };

export type ZrodloOpisu = { dokumentId: string; nazwaDokumentu: string; sekcje: SekcjaOpisu[] };

export type Dopasowanie = "numer" | "dokument" | "kolejnosc" | "brak";

export type PropozycjaMaterialu = {
  klucz: string;
  rodzaj: "post" | "reels" | "relacja";
  numer: number | null;
  tytul: string;
  opis: string | null;
  dopasowanie: Dopasowanie;
  /** Skąd wzięty opis: identyfikator dokumentu i numer sekcji (dla podglądu podziału). */
  zrodloOpisu: { dokumentId: string; numer: number | null } | null;
  pliki: PlikDoParowania[];
};

export function rodzajZMime(mime: string): RodzajPlikuDysku {
  const m = mime.toLowerCase();
  if (m === "application/vnd.google-apps.folder") return "folder";
  if (m === "application/vnd.google-apps.document" || m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "dokument";
  if (m === "text/plain" || m === "text/markdown") return "tekst";
  if (m.startsWith("image/")) return "obraz";
  if (m.startsWith("video/")) return "wideo";
  return "inny";
}

type Grupa = { numer: number | null; pliki: PlikDoParowania[] };

/** Grupowanie po numerze z nazwy: „3a", „3b" i „3-1", „3-2" to jedna karuzela; pliki bez numeru osobno. */
export function pogrupujPoNumerze(pliki: PlikDoParowania[]): Grupa[] {
  const posortowane = sortujNaturalnie(pliki, (p) => p.nazwa);
  const grupy = new Map<number, PlikDoParowania[]>();
  const bezNumeru: PlikDoParowania[] = [];
  for (const p of posortowane) {
    const { numer } = rozbierzNazwe(p.nazwa);
    if (numer === null) {
      bezNumeru.push(p);
      continue;
    }
    const lista = grupy.get(numer) ?? [];
    lista.push(p);
    grupy.set(numer, lista);
  }
  const wynik: Grupa[] = [...grupy.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numer, lista]) => ({
      numer,
      pliki: [...lista].sort((a, b) => {
        const sa = rozbierzNazwe(a.nazwa).slajd ?? 0;
        const sb = rozbierzNazwe(b.nazwa).slajd ?? 0;
        return sa !== sb ? sa - sb : porownajNaturalnie(a.nazwa, b.nazwa);
      }),
    }));
  for (const p of bezNumeru) wynik.push({ numer: null, pliki: [p] });
  return wynik;
}

function opisDlaGrupy(grupa: Grupa, zrodla: ZrodloOpisu[], kolejnosc: number, uzyte: Set<string>): { opis: string | null; dopasowanie: Dopasowanie; zrodlo: PropozycjaMaterialu["zrodloOpisu"]; tytul: string | null } {
  const klucz = (z: ZrodloOpisu, s: SekcjaOpisu) => `${z.dokumentId}:${s.numer ?? "-"}:${z.sekcje.indexOf(s)}`;
  // 1. numer sekcji = numer grupy (dokument zbiorczy albo sekcja w dokumencie per post)
  if (grupa.numer !== null) {
    for (const z of zrodla) {
      const s = z.sekcje.find((x) => x.numer === grupa.numer && !uzyte.has(klucz(z, x)));
      if (s) {
        uzyte.add(klucz(z, s));
        return { opis: s.tresc || null, dopasowanie: "numer", zrodlo: { dokumentId: z.dokumentId, numer: s.numer }, tytul: s.tytul || null };
      }
    }
    // 2. dokument per post: numer w nazwie dokumentu („Post 3 - opis.gdoc") i jedna sekcja bez numeru
    for (const z of zrodla) {
      const jedyna = z.sekcje.length === 1 ? z.sekcje[0] : undefined;
      if (jedyna && jedyna.numer === null && rozbierzNazwe(z.nazwaDokumentu).numer === grupa.numer && !uzyte.has(klucz(z, jedyna))) {
        uzyte.add(klucz(z, jedyna));
        return { opis: jedyna.tresc || null, dopasowanie: "dokument", zrodlo: { dokumentId: z.dokumentId, numer: null }, tytul: jedyna.tytul || null };
      }
    }
  }
  // 3. kolejność: n-ta grupa ↔ n-ta nieużyta sekcja (tylko gdy sekcje nie mają numerów)
  const wolne = zrodla.flatMap((z) => z.sekcje.filter((s) => s.numer === null && !uzyte.has(klucz(z, s))).map((s) => ({ z, s })));
  const kandydat = wolne[0];
  if (kandydat && zrodla.every((z) => z.sekcje.every((s) => s.numer === null))) {
    uzyte.add(klucz(kandydat.z, kandydat.s));
    void kolejnosc;
    return { opis: kandydat.s.tresc || null, dopasowanie: "kolejnosc", zrodlo: { dokumentId: kandydat.z.dokumentId, numer: null }, tytul: kandydat.s.tytul || null };
  }
  return { opis: null, dopasowanie: "brak", zrodlo: null, tytul: null };
}

/** Folder „1. Posty": grafiki i wideo (Reels) sparowane z opisami z dokumentów. */
export function zaproponujPosty(pliki: PlikDoParowania[], zrodla: ZrodloOpisu[]): PropozycjaMaterialu[] {
  const media = pliki.filter((p) => p.rodzaj === "obraz" || p.rodzaj === "wideo");
  const grupy = pogrupujPoNumerze(media);
  const uzyte = new Set<string>();
  const wynik: PropozycjaMaterialu[] = [];
  let licznik = 0;
  for (const grupa of grupy) {
    const wideo = grupa.pliki.filter((p) => p.rodzaj === "wideo");
    const obrazy = grupa.pliki.filter((p) => p.rodzaj === "obraz");
    const czesci: Array<{ rodzaj: "post" | "reels"; pliki: PlikDoParowania[] }> = [];
    if (obrazy.length > 0) czesci.push({ rodzaj: "post", pliki: obrazy });
    for (const w of wideo) czesci.push({ rodzaj: "reels", pliki: [w] });
    for (const czesc of czesci) {
      licznik += 1;
      const dopasowane = opisDlaGrupy({ numer: grupa.numer, pliki: czesc.pliki }, zrodla, licznik, uzyte);
      const pierwszy = czesc.pliki[0];
      const numer = grupa.numer ?? licznik;
      const tytulZPliku = pierwszy ? tytulZNazwy(pierwszy.nazwa) : "";
      const baza = czesc.rodzaj === "reels" ? "Reels" : "Post";
      const tytul = dopasowane.tytul ? `${baza} ${numer} - ${dopasowane.tytul}` : tytulZPliku ? `${baza} ${numer} - ${tytulZPliku}` : `${baza} ${numer}`;
      wynik.push({ klucz: `${czesc.rodzaj}-${licznik}-${pierwszy?.id ?? ""}`, rodzaj: czesc.rodzaj, numer: grupa.numer, tytul: tytul.slice(0, 160), opis: dopasowane.opis, dopasowanie: dopasowane.dopasowanie, zrodloOpisu: dopasowane.zrodlo, pliki: czesc.pliki });
    }
  }
  return wynik;
}

/** Folder „2. Relacje": każdy plik (grafika albo wideo) to osobna relacja w kolejności naturalnej. */
export function zaproponujRelacje(pliki: PlikDoParowania[]): PropozycjaMaterialu[] {
  const media = sortujNaturalnie(
    pliki.filter((p) => p.rodzaj === "obraz" || p.rodzaj === "wideo"),
    (p) => p.nazwa,
  );
  return media.map((p, i) => {
    const { numer } = rozbierzNazwe(p.nazwa);
    const n = numer ?? i + 1;
    const t = tytulZNazwy(p.nazwa);
    return { klucz: `relacja-${i + 1}-${p.id}`, rodzaj: "relacja", numer, tytul: (t ? `Relacja ${n} - ${t}` : `Relacja ${n}`).slice(0, 160), opis: null, dopasowanie: "brak", zrodloOpisu: null, pliki: [p] };
  });
}

/** Sekcje opisów, które nie trafiły do żadnego materiału: pokazujemy je na ekranie mapowania, żeby nic nie zginęło. */
export function nieuzyteSekcje(zrodla: ZrodloOpisu[], propozycje: PropozycjaMaterialu[]): Array<{ dokumentId: string; nazwaDokumentu: string; sekcja: SekcjaOpisu }> {
  const uzyte = new Set(propozycje.filter((p) => p.zrodloOpisu).map((p) => `${p.zrodloOpisu!.dokumentId}:${p.zrodloOpisu!.numer ?? "-"}:${p.opis ?? ""}`));
  const wynik: Array<{ dokumentId: string; nazwaDokumentu: string; sekcja: SekcjaOpisu }> = [];
  for (const z of zrodla) {
    for (const s of z.sekcje) {
      if (!uzyte.has(`${z.dokumentId}:${s.numer ?? "-"}:${s.tresc}`) && s.tresc.trim()) wynik.push({ dokumentId: z.dokumentId, nazwaDokumentu: z.nazwaDokumentu, sekcja: s });
    }
  }
  return wynik;
}
