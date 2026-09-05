import "server-only";
import sharp from "sharp";
import { MIME_DOKUMENTU, MIME_FOLDERU, type DriveApi, type MetadaneDysku, type PlikDysku, type ZawartoscPliku } from "@/lib/drive/api";
import { rodzajZMime } from "@/lib/drive/parowanie";

/**
 * Atrapa Dysku Google w pamięci (DRIVE_ATRAPA=1): testy E2E i `pnpm dev:lokalny` bez konta usługi.
 * Odwzorowuje strukturę z SPEC rozdz. 13.1 dla klientów z seedu, folder poza „Materiałami klientów",
 * plik ponad limit i dokumenty z opisami. Grafiki generuje sharp w locie (żadnych binariów w repo),
 * wideo to minimalny plik z nagłówkiem `ftyp` (przechodzi magic bytes; podglądu nie ma).
 */
export const ATRAPA_KORZEN = "atrapa-materialy-klientow";

type Wezel = {
  id: string;
  nazwa: string;
  mime: string;
  rodzic: string | null;
  bytesDeklarowane?: number;
  obraz?: { tekst: string; kolor: string; w: number; h: number };
  wideo?: boolean;
  tekst?: string;
  zmodyfikowanoO?: string;
};

const OPISY_POSTOW = [
  "Opisy postów - maj",
  "",
  "Post 1 - burger klasyk",
  "Klasyk wraca na stałe do menu. Wołowina 200 g, cheddar, ogórek i nasz sos. #burgerbrothers #lodz",
  "",
  "Post 2 - nowe menu",
  "Od poniedziałku nowe menu! Trzy nowe burgery i dwie sałatki. Sprawdźcie, co dla Was przygotowaliśmy.",
  "",
  "Post 3 - karuzela z zapleczem",
  "Zajrzyjcie na zaplecze: tak powstają nasze bułki. Przesuń, żeby zobaczyć więcej.",
  "",
  "Post 4 - rolka",
  "Sekundy do pierwszego gryza. Dźwięk włączony obowiązkowo.",
  "",
  "Post 5 - happy hours",
  "Happy hours codziennie 15-17: każdy burger 5 zł taniej.",
  "",
  "Post 6 - weekend",
  "Weekend w Burger Brothers: rezerwuj stolik, przyjdź z ekipą.",
].join("\n");

const TEKSTY_REKLAM = ["Teksty", "1. Burger miesiąca już czeka. Zamów online, odbierz w 15 minut.", "2. Dwa burgery w cenie jednego w każdy wtorek. Tylko w Burger Brothers.", "3. Nowe menu, te same ceny. Przyjdź i spróbuj.", "", "Nagłówki", "Burger miesiąca", "2 za 1 we wtorki", "Nowe menu", "", "Opis", "Dostawa gratis od 50 zł", "", "Przycisk: Zamów teraz", "Link: https://burgerbrothers.pl/zamow"].join("\n");

const TEKSTY_IMPREZ = ["Teksty", "Urodziny, komunie, firmówki: zarezerwuj salę na 40 osób z własnym menu.", "", "Nagłówki", "Sala na imprezy", "Rezerwuj termin", "", "Przycisk: Zarezerwuj", "Link: https://burgerbrothers.pl/imprezy"].join("\n");

function folder(id: string, nazwa: string, rodzic: string | null): Wezel {
  return { id, nazwa, mime: MIME_FOLDERU, rodzic };
}
function png(id: string, nazwa: string, rodzic: string, tekst: string, kolor: string, w = 1080, h = 1350): Wezel {
  return { id, nazwa, mime: "image/png", rodzic, obraz: { tekst, kolor, w, h } };
}
function mp4(id: string, nazwa: string, rodzic: string): Wezel {
  return { id, nazwa, mime: "video/mp4", rodzic, wideo: true };
}
function dokument(id: string, nazwa: string, rodzic: string, tekst: string): Wezel {
  return { id, nazwa, mime: MIME_DOKUMENTU, rodzic, tekst };
}

const WEZLY: Wezel[] = [
  folder(ATRAPA_KORZEN, "Materiały klientów", null),
  // Burger Brothers (kat2)
  folder("atrapa-bb", "Burger Brothers", ATRAPA_KORZEN),
  folder("atrapa-bb-content", "content", "atrapa-bb"),
  folder("atrapa-content-5", "content 5 mies", "atrapa-bb-content"),
  folder("atrapa-content-5-posty", "1. Posty", "atrapa-content-5"),
  png("atrapa-p1", "1. Burger klasyk.png", "atrapa-content-5-posty", "Post 1", "#7600F4"),
  png("atrapa-p2", "2. Nowe menu.png", "atrapa-content-5-posty", "Post 2", "#12855C"),
  png("atrapa-p3a", "3a. Zaplecze.png", "atrapa-content-5-posty", "Post 3 / 1", "#B45309"),
  png("atrapa-p3b", "3b. Zaplecze.png", "atrapa-content-5-posty", "Post 3 / 2", "#B45309"),
  mp4("atrapa-p4", "4. Rolka.mp4", "atrapa-content-5-posty"),
  png("atrapa-p5", "5. Happy hours.png", "atrapa-content-5-posty", "Post 5", "#1B1B1B"),
  png("atrapa-p6", "6. Weekend.png", "atrapa-content-5-posty", "Post 6", "#B42318"),
  png("atrapa-p10", "10. Bonus.png", "atrapa-content-5-posty", "Post 10", "#7600F4"),
  dokument("atrapa-opisy", "Opisy postów", "atrapa-content-5-posty", OPISY_POSTOW),
  { id: "atrapa-psd", nazwa: "projekt.psd", mime: "image/vnd.adobe.photoshop", rodzic: "atrapa-content-5-posty", bytesDeklarowane: 40_000_000 },
  folder("atrapa-content-5-relacje", "2. Relacje", "atrapa-content-5"),
  png("atrapa-r1", "1.png", "atrapa-content-5-relacje", "Relacja 1", "#7600F4", 1080, 1920),
  png("atrapa-r2", "2.png", "atrapa-content-5-relacje", "Relacja 2", "#12855C", 1080, 1920),
  mp4("atrapa-r3", "3.mp4", "atrapa-content-5-relacje"),
  folder("atrapa-content-6", "content 6 mies", "atrapa-bb-content"),
  folder("atrapa-content-6-posty", "1. Posty", "atrapa-content-6"),
  { ...png("atrapa-ogromny", "1. Ogromny plakat.png", "atrapa-content-6-posty", "Ogromny", "#B42318"), bytesDeklarowane: 30 * 1024 * 1024 },
  folder("atrapa-bb-reklamy", "reklamy", "atrapa-bb"),
  folder("atrapa-reklamy-5", "reklamy 5 mies", "atrapa-bb-reklamy"),
  png("atrapa-a1", "Reklama 1.png", "atrapa-reklamy-5", "Reklama 1", "#7600F4", 1080, 1080),
  png("atrapa-a2", "Reklama 2.png", "atrapa-reklamy-5", "Reklama 2", "#12855C", 1080, 1080),
  png("atrapa-a3", "Reklama 3.png", "atrapa-reklamy-5", "Reklama 3", "#B45309", 1080, 1080),
  dokument("atrapa-teksty", "Teksty i nagłówki", "atrapa-reklamy-5", TEKSTY_REKLAM),
  folder("atrapa-reklamy-5-imprezy", "reklamy 5 mies - imprezy", "atrapa-bb-reklamy"),
  png("atrapa-i1", "Imprezy 1.png", "atrapa-reklamy-5-imprezy", "Imprezy 1", "#1B1B1B", 1080, 1080),
  png("atrapa-i2", "Imprezy 2.png", "atrapa-reklamy-5-imprezy", "Imprezy 2", "#B42318", 1080, 1080),
  dokument("atrapa-teksty-imprezy", "Teksty imprezy", "atrapa-reklamy-5-imprezy", TEKSTY_IMPREZ),
  // Pierogarnia Babci (kat3): do ostrzeżenia o innym kliencie
  folder("atrapa-pb", "Pierogarnia Babci", ATRAPA_KORZEN),
  folder("atrapa-pb-content", "content", "atrapa-pb"),
  folder("atrapa-pierogarnia-3", "content 3 mies", "atrapa-pb-content"),
  folder("atrapa-pierogarnia-3-posty", "1. Posty", "atrapa-pierogarnia-3"),
  png("atrapa-pb1", "1. Pierogi ruskie.png", "atrapa-pierogarnia-3-posty", "Pierogi 1", "#12855C"),
  folder("atrapa-pierogarnia-3-relacje", "2. Relacje", "atrapa-pierogarnia-3"),
  png("atrapa-pbr1", "1.png", "atrapa-pierogarnia-3-relacje", "Relacja 1", "#12855C", 1080, 1920),
  // Poza „Materiałami klientów": prywatny dysk (kryterium 17)
  folder("atrapa-inny-dysk", "Mój dysk", null),
  folder("atrapa-poza", "Prywatne zdjęcia", "atrapa-inny-dysk"),
  png("atrapa-poza-1", "1. Wakacje.png", "atrapa-poza", "Wakacje", "#B42318"),
];

const MAPA = new Map(WEZLY.map((w) => [w.id, w]));
const pamiec = new Map<string, Buffer>();

async function bajtyWezla(w: Wezel): Promise<Buffer> {
  const z = pamiec.get(w.id);
  if (z) return z;
  let bufor: Buffer;
  if (w.obraz) {
    const { tekst, kolor, w: sz, h } = w.obraz;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${h}"><rect width="100%" height="100%" fill="${kolor}"/><text x="50%" y="50%" fill="#fff" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(Math.min(sz, h) / 9)}" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${tekst}</text></svg>`;
    bufor = await sharp(Buffer.from(svg)).png().toBuffer();
  } else if (w.wideo) {
    const ftyp = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0, 0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x32]);
    const dane = Buffer.alloc(2048, 0);
    const mdat = Buffer.concat([Buffer.from([0, 0, 0x08, 0x08, 0x6d, 0x64, 0x61, 0x74]), dane]);
    bufor = Buffer.concat([ftyp, mdat]);
  } else if (w.tekst !== undefined) {
    bufor = Buffer.from(w.tekst, "utf8");
  } else {
    bufor = Buffer.alloc(0);
  }
  pamiec.set(w.id, bufor);
  return bufor;
}

async function naPlik(w: Wezel): Promise<PlikDysku> {
  const bytes = w.bytesDeklarowane ?? (w.mime === MIME_FOLDERU || w.mime === MIME_DOKUMENTU ? null : (await bajtyWezla(w)).length);
  return {
    id: w.id,
    nazwa: w.nazwa,
    mime: w.mime,
    rodzaj: rodzajZMime(w.mime),
    bytes,
    zmodyfikowanoO: w.zmodyfikowanoO ?? "2026-04-28T14:30:00.000Z",
    szerokosc: w.obraz?.w ?? null,
    wysokosc: w.obraz?.h ?? null,
    czasMs: w.wideo ? 12_000 : null,
  };
}

export class AtrapaDysku implements DriveApi {
  async metadane(id: string): Promise<MetadaneDysku | null> {
    const w = MAPA.get(id);
    if (!w) return null;
    return { ...(await naPlik(w)), rodzice: w.rodzic ? [w.rodzic] : [], driveId: null, wKoszu: false };
  }

  async listuj(folderId: string): Promise<PlikDysku[]> {
    const dzieci = WEZLY.filter((w) => w.rodzic === folderId);
    return Promise.all(dzieci.map(naPlik));
  }

  async pobierz(id: string, opcje: { pierwszeBajty?: number } = {}): Promise<ZawartoscPliku | null> {
    const w = MAPA.get(id);
    if (!w || w.mime === MIME_FOLDERU) return null;
    const calosc = await bajtyWezla(w);
    const bajty = opcje.pierwszeBajty ? calosc.subarray(0, opcje.pierwszeBajty) : calosc;
    return { bajty: new Uint8Array(bajty), mime: w.mime, rozmiar: w.bytesDeklarowane ?? calosc.length };
  }

  /** Atrapa trzyma tekst wprost, niezależnie od typu pliku. */
  async eksportujTekst(id: string): Promise<string | null> {
    const w = MAPA.get(id);
    return w?.tekst ?? null;
  }

  async miniatura(id: string): Promise<ZawartoscPliku | null> {
    const w = MAPA.get(id);
    if (!w?.obraz) return null;
    const bajty = await sharp(await bajtyWezla(w)).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
    return { bajty: new Uint8Array(bajty), mime: "image/webp", rozmiar: bajty.length };
  }
}
