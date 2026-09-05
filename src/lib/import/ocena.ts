import { czyNazwyPasuja, numerMiesiacaZNazwy, okresZNazwy } from "@/lib/drive/nazwy";
import { NAZWY_MIESIECY } from "@/lib/format";

/**
 * Ocena folderu na karcie weryfikacyjnej (SPEC rozdz. 13.2). Czysta logika na danych, które zebrał serwer:
 * ścieżka od „Materiałów klientów" (null = folder poza nimi), nazwa klienta, miesiąc współpracy, poprzednie
 * użycia tego folderu. Blokada (poza „Materiałami klientów") nie ma obejścia; ostrzeżenia da się świadomie
 * zignorować jednym kliknięciem, z wpisem w audycie.
 */
export type SegmentSciezki = { id: string; nazwa: string };

export type PoprzednieUzycie = { pakietId: string; slug: string; tytul: string; okres: { rok: number; miesiac: number }; zaimportowanoO: string | null };

export type OstrzezenieFolderu =
  | { kod: "klient"; folder: string; klient: string }
  | { kod: "miesiac"; wNazwie: number; oczekiwany: number }
  | { kod: "miesiac_kalendarzowy"; wNazwie: string; oczekiwany: string }
  | { kod: "okres"; wNazwie: string; oczekiwany: string }
  | { kod: "powtorny"; uzycie: PoprzednieUzycie }
  | { kod: "brak_podfolderow" }
  | { kod: "pusty" }
  | { kod: "nieobslugiwane"; nazwy: string[] }
  | { kod: "duze_wideo"; nazwy: string[] };

export type OcenaFolderu = { zablokowany: boolean; ostrzezenia: OstrzezenieFolderu[] };

export type DaneDoOceny = {
  /** Od folderu bezpośrednio pod „Materiałami klientów" do samego folderu; null = poza nimi. */
  sciezka: SegmentSciezki[] | null;
  nazwaKlienta: string;
  miesiacWspolpracy: number | null;
  okres: { rok: number; miesiac: number };
  rodzaj: "content" | "reklamy";
  liczbaPlikow: number;
  maPodfolderyContentu: boolean;
  nieobslugiwane: string[];
  duzeWideo: string[];
  poprzednie: PoprzednieUzycie[];
};

function nazwaMiesiacaWTekscie(nazwa: string): string | null {
  const n = nazwa.toLowerCase();
  return NAZWY_MIESIECY.find((m) => n.includes(m.slice(0, 4))) ?? null;
}

export function ocenFolder(d: DaneDoOceny): OcenaFolderu {
  if (d.sciezka === null) return { zablokowany: true, ostrzezenia: [] };
  const ostrzezenia: OstrzezenieFolderu[] = [];
  const folderKlienta = d.sciezka[0];
  if (folderKlienta && !czyNazwyPasuja(folderKlienta.nazwa, d.nazwaKlienta)) ostrzezenia.push({ kod: "klient", folder: folderKlienta.nazwa, klient: d.nazwaKlienta });
  const wlasny = d.sciezka[d.sciezka.length - 1];
  if (wlasny) {
    const okresWNazwie = okresZNazwy(wlasny.nazwa);
    const numer = numerMiesiacaZNazwy(wlasny.nazwa);
    if (okresWNazwie && (okresWNazwie.rok !== d.okres.rok || okresWNazwie.miesiac !== d.okres.miesiac)) {
      const rrmm = (o: { rok: number; miesiac: number }) => `${String(o.rok % 100).padStart(2, "0")}-${String(o.miesiac).padStart(2, "0")}`;
      ostrzezenia.push({ kod: "okres", wNazwie: rrmm(okresWNazwie), oczekiwany: rrmm(d.okres) });
    }
    if (numer !== null && d.miesiacWspolpracy !== null && numer !== d.miesiacWspolpracy) ostrzezenia.push({ kod: "miesiac", wNazwie: numer, oczekiwany: d.miesiacWspolpracy });
    const nazwaMiesiaca = nazwaMiesiacaWTekscie(wlasny.nazwa);
    const oczekiwana = NAZWY_MIESIECY[d.okres.miesiac - 1];
    if (!okresWNazwie && numer === null && nazwaMiesiaca && oczekiwana && nazwaMiesiaca !== oczekiwana) ostrzezenia.push({ kod: "miesiac_kalendarzowy", wNazwie: nazwaMiesiaca, oczekiwany: oczekiwana });
  }
  for (const u of d.poprzednie) ostrzezenia.push({ kod: "powtorny", uzycie: u });
  if (d.liczbaPlikow === 0) ostrzezenia.push({ kod: "pusty" });
  else if (d.rodzaj === "content" && !d.maPodfolderyContentu) ostrzezenia.push({ kod: "brak_podfolderow" });
  if (d.nieobslugiwane.length > 0) ostrzezenia.push({ kod: "nieobslugiwane", nazwy: d.nieobslugiwane });
  if (d.duzeWideo.length > 0) ostrzezenia.push({ kod: "duze_wideo", nazwy: d.duzeWideo });
  return { zablokowany: false, ostrzezenia };
}
