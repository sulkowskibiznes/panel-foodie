/** Dzielenie tekstu posta na zwykłe fragmenty oraz hashtagi i linki (kolor odnośnika, bez klikania). */
export type FragmentTekstu = { rodzaj: "tekst" | "odnosnik"; tresc: string };

const WZORZEC = /(https?:\/\/\S+|www\.\S+|#[\p{L}\p{N}_]+)/gu;

export function podzielTekst(tekst: string): FragmentTekstu[] {
  const fragmenty: FragmentTekstu[] = [];
  let ostatni = 0;
  for (const m of tekst.matchAll(WZORZEC)) {
    const start = m.index ?? 0;
    if (start > ostatni) fragmenty.push({ rodzaj: "tekst", tresc: tekst.slice(ostatni, start) });
    fragmenty.push({ rodzaj: "odnosnik", tresc: m[0] });
    ostatni = start + m[0].length;
  }
  if (ostatni < tekst.length) fragmenty.push({ rodzaj: "tekst", tresc: tekst.slice(ostatni) });
  return fragmenty;
}

/** Skrót do listy rozwijanej: pierwsze znaki tekstu bez nowych linii. */
export function skrotTekstu(tekst: string | null | undefined, maks = 48): string {
  if (!tekst) return "";
  const jednaLinia = tekst.replace(/\s+/g, " ").trim();
  return jednaLinia.length > maks ? `${jednaLinia.slice(0, maks - 1).trimEnd()}...` : jednaLinia;
}
