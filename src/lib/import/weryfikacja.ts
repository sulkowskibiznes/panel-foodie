import "server-only";
import { copy } from "@/lib/copy";
import { poprzednieUzyciaFolderu } from "@/lib/dane/import";
import { BladDysku, MIME_FOLDERU, type DriveApi, type MetadaneDysku, type PlikDysku } from "@/lib/drive/api";
import type { KonfiguracjaDysku } from "@/lib/drive/klient";
import { rodzajPodfolderu, sortujNaturalnie } from "@/lib/drive/nazwy";
import type { BladKarty, KartaWeryfikacyjna, RodzajFolderu } from "@/lib/dto/import";
import { ocenFolder, type SegmentSciezki } from "@/lib/import/ocena";
import { czyObslugiwanyMime, duzeWideo, sprawdzLimity } from "@/lib/import/plan";

/**
 * Karta weryfikacyjna (SPEC rozdz. 13.2): ścieżka od „Materiałów klientów" (blokada, gdy folder leży poza nimi),
 * liczba i rodzaje plików, ostatnia zmiana, pierwsze nazwy, ostrzeżenia. Wszystko liczone na serwerze z metadanych,
 * zanim ściągniemy choć bajt.
 */
const MAKS_GLEBOKOSC = 30;

export type WynikSciezki = { stan: "nie_znaleziono" } | { stan: "poza"; meta: MetadaneDysku } | { stan: "ok"; meta: MetadaneDysku; segmenty: SegmentSciezki[]; pelna: string[] };

/** Wspinaczka po rodzicach aż do korzenia. Korzeń może być zwykłym folderem albo dyskiem współdzielonym (driveId). */
export async function sciezkaOdKorzenia(drive: DriveApi, folderId: string, korzenId: string): Promise<WynikSciezki> {
  const meta = await drive.metadane(folderId);
  if (!meta || meta.wKoszu) return { stan: "nie_znaleziono" };
  if (meta.id === korzenId) return { stan: "poza", meta };
  const segmenty: SegmentSciezki[] = [{ id: meta.id, nazwa: meta.nazwa }];
  let biezacy = meta;
  for (let krok = 0; krok < MAKS_GLEBOKOSC; krok++) {
    const rodzic = biezacy.rodzice[0];
    if (rodzic === korzenId) {
      const korzen = await drive.metadane(korzenId);
      return { stan: "ok", meta, segmenty, pelna: [korzen?.nazwa ?? "Materiały klientów", ...segmenty.map((s) => s.nazwa)] };
    }
    if (!rodzic) {
      if (biezacy.driveId === korzenId) return { stan: "ok", meta, segmenty, pelna: ["Materiały klientów", ...segmenty.map((s) => s.nazwa)] };
      return { stan: "poza", meta };
    }
    const wyzej = await drive.metadane(rodzic);
    if (!wyzej) return { stan: "poza", meta };
    segmenty.unshift({ id: wyzej.id, nazwa: wyzej.nazwa });
    biezacy = wyzej;
  }
  return { stan: "poza", meta };
}

export type ZawartoscFolderu = { pliki: PlikDysku[]; podfoldery: { posty: string | null; relacje: string | null }; bezposrednie: PlikDysku[] };

/** Content: folder plus podfoldery „1. Posty" i „2. Relacje"; reklamy: sam folder (na podfolder kampanii wkleja się osobny link). */
export async function zawartoscFolderu(drive: DriveApi, folderId: string, rodzaj: RodzajFolderu): Promise<ZawartoscFolderu> {
  const dzieci = await drive.listuj(folderId);
  const bezposrednie = dzieci.filter((d) => d.mime !== MIME_FOLDERU);
  const podfoldery = { posty: null as string | null, relacje: null as string | null };
  if (rodzaj === "content") {
    for (const d of dzieci) {
      if (d.mime !== MIME_FOLDERU) continue;
      const r = rodzajPodfolderu(d.nazwa);
      if (r === "posty" && !podfoldery.posty) podfoldery.posty = d.id;
      if (r === "relacje" && !podfoldery.relacje) podfoldery.relacje = d.id;
    }
  }
  const [posty, relacje] = await Promise.all([podfoldery.posty ? drive.listuj(podfoldery.posty) : Promise.resolve([]), podfoldery.relacje ? drive.listuj(podfoldery.relacje) : Promise.resolve([])]);
  // Kolejność: folder, potem „1. Posty", potem „2. Relacje"; w obrębie grupy naturalnie (1, 2, ..., 10).
  const wGrupie = (lista: PlikDysku[]) => sortujNaturalnie(lista.filter((p) => p.mime !== MIME_FOLDERU), (p) => p.nazwa);
  const pliki = [...wGrupie(bezposrednie), ...wGrupie(posty), ...wGrupie(relacje)];
  return { pliki, podfoldery, bezposrednie };
}

export type WejscieKarty = {
  rodzaj: RodzajFolderu;
  kampaniaId: string | null;
  kampaniaNazwa: string | null;
  folderId: string | null;
  url: string | null;
  klient: { name: string };
  pakiet: { id: string; miesiacWspolpracy: number | null; okres: { rok: number; miesiac: number } };
};

function pustaKarta(w: WejscieKarty, stan: KartaWeryfikacyjna["stan"], blad: BladKarty | null = null): KartaWeryfikacyjna {
  return { rodzaj: w.rodzaj, kampaniaId: w.kampaniaId, kampaniaNazwa: w.kampaniaNazwa, folderId: w.folderId, url: w.url, stan, sciezka: [], liczbaPlikow: 0, typy: { obrazy: 0, wideo: 0, dokumenty: 0, inne: 0 }, zmodyfikowanoO: null, pierwszePliki: [], ostrzezenia: [], blad, podfoldery: { posty: null, relacje: null } };
}

export async function zbudujKarte(k: KonfiguracjaDysku, w: WejscieKarty): Promise<KartaWeryfikacyjna> {
  if (!w.folderId) return pustaKarta(w, "brak_linku");
  try {
    const sciezka = await sciezkaOdKorzenia(k.drive, w.folderId, k.korzenId);
    if (sciezka.stan === "nie_znaleziono") return pustaKarta(w, "nie_znaleziono");
    if (sciezka.stan === "poza") return pustaKarta(w, "zablokowany");
    if (sciezka.meta.mime !== MIME_FOLDERU) return pustaKarta(w, "nie_znaleziono");
    const zawartosc = await zawartoscFolderu(k.drive, w.folderId, w.rodzaj);
    const typy = { obrazy: 0, wideo: 0, dokumenty: 0, inne: 0 };
    const nieobslugiwane: string[] = [];
    for (const p of zawartosc.pliki) {
      if (p.rodzaj === "obraz" || p.rodzaj === "wideo") {
        if (czyObslugiwanyMime(p.mime)) typy[p.rodzaj === "obraz" ? "obrazy" : "wideo"] += 1;
        else {
          typy.inne += 1;
          nieobslugiwane.push(p.nazwa);
        }
      } else if (p.rodzaj === "dokument" || p.rodzaj === "tekst") typy.dokumenty += 1;
      else {
        typy.inne += 1;
        nieobslugiwane.push(p.nazwa);
      }
    }
    const media = zawartosc.pliki.filter((p) => (p.rodzaj === "obraz" || p.rodzaj === "wideo") && czyObslugiwanyMime(p.mime));
    const limit = sprawdzLimity(media);
    const daty = [sciezka.meta.zmodyfikowanoO, ...zawartosc.pliki.map((p) => p.zmodyfikowanoO)].filter((d): d is string => !!d).sort();
    const poprzednie = await poprzednieUzyciaFolderu(w.folderId, w.pakiet.id);
    const ocena = ocenFolder({
      sciezka: sciezka.segmenty,
      nazwaKlienta: w.klient.name,
      miesiacWspolpracy: w.pakiet.miesiacWspolpracy,
      okres: w.pakiet.okres,
      rodzaj: w.rodzaj,
      liczbaPlikow: zawartosc.pliki.length,
      maPodfolderyContentu: !!(zawartosc.podfoldery.posty || zawartosc.podfoldery.relacje),
      nieobslugiwane,
      duzeWideo: duzeWideo(media).map((d) => `${d.nazwa} (${d.waga})`),
      poprzednie,
    });
    return {
      rodzaj: w.rodzaj,
      kampaniaId: w.kampaniaId,
      kampaniaNazwa: w.kampaniaNazwa,
      folderId: w.folderId,
      url: w.url,
      stan: ocena.zablokowany ? "zablokowany" : "ok",
      sciezka: sciezka.pelna,
      liczbaPlikow: zawartosc.pliki.length,
      typy,
      zmodyfikowanoO: daty.at(-1) ?? null,
      pierwszePliki: zawartosc.pliki.slice(0, 6).map((p) => p.nazwa),
      ostrzezenia: ocena.ostrzezenia,
      blad: limit ? { rodzaj: "limit", ...limit.komunikat } : null,
      podfoldery: zawartosc.podfoldery,
    };
  } catch (blad) {
    if (blad instanceof BladDysku) return pustaKarta(w, "nie_znaleziono", { rodzaj: "dysk", komunikat: blad.message });
    console.error("[import] karta weryfikacyjna", blad instanceof Error ? blad.message : blad);
    return pustaKarta(w, "nie_znaleziono", { rodzaj: "dysk", komunikat: copy.zespol.import.bledy.ogolny });
  }
}

export type PakietDoWeryfikacji = {
  id: string;
  miesiacWspolpracy: number | null;
  okres: { rok: number; miesiac: number };
  folderContentuId: string | null;
  folderContentuUrl: string | null;
  kampanie: Array<{ id: string; nazwa: string; folderReklamId: string | null; folderReklamUrl: string | null }>;
};

/** Karty dla całego pakietu: content plus jedna na każdą kampanię (bywa ich kilka). */
export async function zbudujKartyPakietu(k: KonfiguracjaDysku, klient: { name: string }, pakiet: PakietDoWeryfikacji): Promise<KartaWeryfikacyjna[]> {
  const wejscia: WejscieKarty[] = [
    { rodzaj: "content", kampaniaId: null, kampaniaNazwa: null, folderId: pakiet.folderContentuId, url: pakiet.folderContentuUrl, klient, pakiet },
    ...pakiet.kampanie.map((kamp): WejscieKarty => ({ rodzaj: "reklamy", kampaniaId: kamp.id, kampaniaNazwa: kamp.nazwa, folderId: kamp.folderReklamId, url: kamp.folderReklamUrl, klient, pakiet })),
  ];
  return Promise.all(wejscia.map((w) => zbudujKarte(k, w)));
}
