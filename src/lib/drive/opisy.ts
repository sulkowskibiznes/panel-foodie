/**
 * Dokumenty z Dysku wyeksportowane jako text/plain (SPEC rozdz. 13.3). Czysta logika:
 * - jeden dokument ze wszystkimi opisami postów dzielimy po nagłówkach („Post 1", „2.", „Relacja 3 - burger"),
 *   z podglądem podziału na ekranie mapowania,
 * - dokument reklam rozbieramy na sekcje „Teksty" i „Nagłówki" (oraz opis, przycisk, link).
 * Człowiek i tak ogląda wynik na ekranie mapowania, więc heurystyki mają być przewidywalne, nie sprytne.
 */
export type SekcjaOpisu = { numer: number | null; tytul: string; tresc: string };
export type PodzialOpisow = { sekcje: SekcjaOpisu[]; wstep: string };

/**
 * Słowa, po których numer oznacza nagłówek pozycji. Content creatorzy piszą „tekst 1", „Post 2", „TEKST 3:"
 * albo „nagłówek 1"; treść pozycji to jeden lub kilka akapitów pod spodem.
 */
const SLOWO_POZYCJI = "post|posty|relacja|relacje|reels|rolka|stories|story|slajd|tekst|teksty|tre[sś][cć]|opis|grafika|zdj[eę]cie|reklama|wariant|wersja|nag[lł][oó]wek|headline|tytu[lł]|copy";
const NAGLOWEK = new RegExp(`^\\s*(?:#+\\s*)?(?:(${SLOWO_POZYCJI})\\s*)?(?:nr\\.?\\s*)?(\\d{1,2})(?!\\d)\\s*(?:[.:)\\-–—]+\\s*)?(.*)$`, "i");
const SLOWO_NAGLOWKA_REKLAMY = /^(nag[lł][oó]wek|headline|tytu[lł])$/i;
const SEPARATOR = /^\s*(?:[-=_*]{3,}|—{2,})\s*$/;

function czyste(tekst: string): string {
  return tekst.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
}

function przytnij(tresc: string[]): string {
  return tresc.join("\n").replace(/^\n+|\n+$/g, "").replace(/\n{3,}/g, "\n\n");
}

/**
 * Nagłówek to linia ze słowem „post/relacja/reels" i numerem (dowolna reszta), albo sam numer z kropką
 * i krótką resztą bez interpunkcji zdaniowej („3. burger klasyk"). Numer z kropką i długim zdaniem
 * („1. Zapraszamy na nowe burgery!") to lista numerowana: też nowa sekcja, ale zdanie zostaje w treści.
 */
export type SekcjaZeSlowem = SekcjaOpisu & { slowo: string | null; /** Surowa linia nagłówka („Nagłówek 1"): gdy pod etykietą nic nie ma, ona sama jest treścią pozycji. */ linia: string };

/** Jak `podzielOpisy`, ale z zapamiętanym słowem nagłówka („tekst", „nagłówek"), z którego korzysta rozbiór dokumentu reklam. */
export function podzielNaPozycje(tekst: string): { sekcje: SekcjaZeSlowem[]; wstep: string } {
  const linie = czyste(tekst).split("\n");
  const sekcje: SekcjaZeSlowem[] = [];
  const wstep: string[] = [];
  let biezaca: { numer: number; tytul: string; slowo: string | null; linia: string; tresc: string[] } | null = null;
  for (const linia of linie) {
    if (SEPARATOR.test(linia)) continue;
    const m = NAGLOWEK.exec(linia);
    if (m?.[2]) {
      const slowo = m[1] ? m[1].toLowerCase() : null;
      const numer = Number(m[2]);
      const reszta = (m[3] ?? "").trim();
      const krotka = reszta.length <= (slowo ? 60 : 40) && !/[.!?…]$/.test(reszta) && !/[.!?]\s/.test(reszta);
      if (krotka) {
        if (biezaca) sekcje.push({ numer: biezaca.numer, tytul: biezaca.tytul, slowo: biezaca.slowo, linia: biezaca.linia, tresc: przytnij(biezaca.tresc) });
        biezaca = { numer, tytul: reszta, slowo, linia: linia.trim(), tresc: [] };
        continue;
      }
      if (!slowo && /^\s*\d{1,2}\s*[.)]\s+/.test(linia)) {
        if (biezaca) sekcje.push({ numer: biezaca.numer, tytul: biezaca.tytul, slowo: biezaca.slowo, linia: biezaca.linia, tresc: przytnij(biezaca.tresc) });
        biezaca = { numer, tytul: "", slowo: null, linia: linia.trim(), tresc: [reszta] };
        continue;
      }
    }
    if (biezaca) biezaca.tresc.push(linia);
    else wstep.push(linia);
  }
  if (biezaca) sekcje.push({ numer: biezaca.numer, tytul: biezaca.tytul, slowo: biezaca.slowo, linia: biezaca.linia, tresc: przytnij(biezaca.tresc) });
  return { sekcje, wstep: przytnij(wstep) };
}

export function podzielOpisy(tekst: string): PodzialOpisow {
  const { sekcje, wstep } = podzielNaPozycje(tekst);
  return { sekcje: sekcje.map(({ numer, tytul, tresc }) => ({ numer, tytul, tresc })), wstep };
}

export type DokumentReklam = { teksty: string[]; naglowki: string[]; opis: string | null; cta: string | null; link: string | null; rozpoznanoSekcje: boolean };

type Sekcja = "teksty" | "naglowki" | "opis" | "cta" | "link" | null;

const NAGLOWKI_SEKCJI: Array<{ sekcja: Exclude<Sekcja, null>; wzor: RegExp }> = [
  { sekcja: "teksty", wzor: /^\s*(?:#+\s*)?(?:teksty?(?:\s+reklam(?:owe|owy|y)?)?|tre[sś][cć](?:i)?(?:\s+reklam\w*)?|primary\s*texts?|copy)\s*:?\s*$/i },
  { sekcja: "naglowki", wzor: /^\s*(?:#+\s*)?(?:nag[lł][oó]wki?|headlines?|tytu[lł]y?)\s*:?\s*$/i },
  { sekcja: "opis", wzor: /^\s*(?:#+\s*)?(?:opis(?:y)?(?:\s+reklam\w*)?|descriptions?)\s*:?\s*$/i },
  { sekcja: "cta", wzor: /^\s*(?:#+\s*)?(?:przycisk|cta|call\s*to\s*action)\s*:?\s*$/i },
  { sekcja: "link", wzor: /^\s*(?:#+\s*)?(?:link|url|adres|strona)\s*:?\s*$/i },
];
const SEKCJA_JEDNOLINIOWA = /^\s*(przycisk|cta|call\s*to\s*action|link|url|adres|opis)\s*:\s*(\S.*)$/i;
const ENUMERATOR = /^\s*(?:\d{1,2}[.)]|[a-z][.)]|[-–•*])\s+/i;

function pozycje(blok: string[]): string[] {
  const linie = blok.filter((l) => l.trim().length > 0);
  const enumerowane = linie.filter((l) => ENUMERATOR.test(l)).length;
  if (enumerowane >= 2 && enumerowane >= linie.length - 1) {
    const wynik: string[] = [];
    for (const l of linie) {
      if (ENUMERATOR.test(l) || wynik.length === 0) wynik.push(l.replace(ENUMERATOR, "").trim());
      else wynik[wynik.length - 1] = `${wynik[wynik.length - 1]}\n${l.trim()}`;
    }
    return wynik.filter((w) => w.length > 0);
  }
  const razem = linie.map((l) => l.trim()).join("\n").trim();
  return razem ? [razem] : [];
}

function akapity(linie: string[]): string[][] {
  const bloki: string[][] = [];
  let biezacy: string[] = [];
  for (const l of linie) {
    if (l.trim() === "") {
      if (biezacy.length) bloki.push(biezacy);
      biezacy = [];
    } else biezacy.push(l);
  }
  if (biezacy.length) bloki.push(biezacy);
  return bloki;
}

/**
 * Pozycje z nagłówków „tekst 1", „tekst 2", „nagłówek 1" (tak piszą content creatorzy w Wordzie): każda pozycja
 * to wszystko pod nagłówkiem, także kilka akapitów. Zwraca null, gdy w tekście nie ma co najmniej dwóch takich nagłówków.
 */
function pozycjeZNaglowkow(linie: string[]): { teksty: string[]; naglowki: string[] } | null {
  const { sekcje } = podzielNaPozycje(linie.join("\n"));
  const numerowane = sekcje.filter((s) => s.slowo !== null || sekcje.length >= 2);
  if (numerowane.length < 2 && !(numerowane.length === 1 && numerowane[0]?.slowo)) return null;
  const teksty: string[] = [];
  const naglowki: string[] = [];
  for (const s of numerowane) {
    const tresc = [s.tytul, s.tresc].filter((x) => x.trim()).join("\n").trim() || s.linia;
    (s.slowo && SLOWO_NAGLOWKA_REKLAMY.test(s.slowo) ? naglowki : teksty).push(tresc);
  }
  return { teksty, naglowki };
}

/**
 * Sekcje „Teksty" i „Nagłówki" (oraz opis, przycisk, link), a w nich pozycje: po nagłówkach „tekst N" / „nagłówek N",
 * po numeracji, albo akapitami. Bez sekcji cały dokument idzie tą samą drogą, więc Word z samymi „tekst 1..3" też działa.
 */
export function rozbierzDokumentReklam(tekst: string): DokumentReklam {
  const linie = czyste(tekst).split("\n");
  const zebrane: Record<Exclude<Sekcja, null>, string[]> = { teksty: [], naglowki: [], opis: [], cta: [], link: [] };
  let biezaca: Sekcja = null;
  let rozpoznano = false;
  for (const linia of linie) {
    if (SEPARATOR.test(linia)) continue;
    const naglowek = NAGLOWKI_SEKCJI.find((n) => n.wzor.test(linia));
    if (naglowek) {
      biezaca = naglowek.sekcja;
      rozpoznano = true;
      continue;
    }
    const jedna = SEKCJA_JEDNOLINIOWA.exec(linia);
    if (jedna?.[1] && jedna[2]) {
      const klucz = jedna[1].toLowerCase();
      const sekcja: Exclude<Sekcja, null> = klucz === "opis" ? "opis" : /link|url|adres/.test(klucz) ? "link" : "cta";
      zebrane[sekcja].push(jedna[2].trim());
      rozpoznano = true;
      continue;
    }
    if (biezaca) zebrane[biezaca].push(linia);
    else zebrane.teksty.push(linia);
  }
  const zNaglowkow = pozycjeZNaglowkow(zebrane.teksty);
  const teksty = zNaglowkow ? zNaglowkow.teksty : akapity(zebrane.teksty).flatMap(pozycje);
  const naglowkiZTekstow = zNaglowkow?.naglowki ?? [];
  const naglowkiSekcji = pozycjeZNaglowkow(zebrane.naglowki)?.naglowki.concat(pozycjeZNaglowkow(zebrane.naglowki)?.teksty ?? []) ?? zebrane.naglowki.map((l) => l.replace(ENUMERATOR, "").trim()).filter((l) => l.length > 0);
  const naglowki = [...naglowkiSekcji, ...naglowkiZTekstow];
  if (zNaglowkow) rozpoznano = true;
  const pierwsze = (lista: string[]) => {
    const t = lista.map((l) => l.replace(ENUMERATOR, "").trim()).filter((l) => l.length > 0);
    return t.length ? t.join(" ").trim() : null;
  };
  return { teksty, naglowki, opis: pierwsze(zebrane.opis), cta: pierwsze(zebrane.cta), link: pierwsze(zebrane.link), rozpoznanoSekcje: rozpoznano };
}
