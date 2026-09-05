import "server-only";
import { MIME_FOLDERU, type DriveApi, type PlikDysku } from "@/lib/drive/api";
import type { KonfiguracjaDysku } from "@/lib/drive/klient";
import { sortujNaturalnie } from "@/lib/drive/nazwy";
import { podzielOpisy, rozbierzDokumentReklam } from "@/lib/drive/opisy";
import { nieuzyteSekcje, zaproponujPosty, zaproponujRelacje, type PlikDoParowania, type ZrodloOpisu } from "@/lib/drive/parowanie";
import type { KartaWeryfikacyjna, PlikPropozycji, PodgladDokumentu, Propozycja } from "@/lib/dto/import";
import { env } from "@/lib/env";
import { czyObslugiwanyMime } from "@/lib/import/plan";
import { wyprowadzKlucz } from "@/lib/krypto";
import { odczytajLadunek, podpiszLadunek } from "@/lib/podpis";

/**
 * Propozycja mapowania (SPEC rozdz. 13.3) z potwierdzonej karty: grafiki w kolejności naturalnej, dokumenty
 * wyeksportowane do text/plain i podzielone po nagłówkach, parowanie „grafika ↔ opis" czystą logiką
 * (lib/drive/parowanie.ts). Miniatury z Dysku idą przez podpisany adres w panelu, nigdy prosto z Google.
 */
const MS_WAZNOSCI_MINIATURY = 2 * 60 * 60 * 1000;

function kluczMiniatur() {
  return wyprowadzKlucz(env().SESSION_SECRET, "import");
}

export function adresMiniatury(slug: string, pakietId: string, fileId: string): string {
  const token = podpiszLadunek(kluczMiniatur(), { pakietId, fileId, wygasaO: Date.now() + MS_WAZNOSCI_MINIATURY });
  return `/zespol/klienci/${slug}/pakiety/${pakietId}/import/miniatura/${encodeURIComponent(fileId)}?t=${encodeURIComponent(token)}`;
}

/** Miniatura otwiera się tylko z tokenem wystawionym dla tego pakietu i tego pliku. */
export function sprawdzTokenMiniatury(token: string, pakietId: string, fileId: string): boolean {
  const l = odczytajLadunek<{ pakietId: string; fileId: string; wygasaO: number }>(kluczMiniatur(), token, new Date());
  return !!l && l.pakietId === pakietId && l.fileId === fileId;
}

function naPlikDoParowania(p: PlikDysku): PlikDoParowania {
  return { id: p.id, nazwa: p.nazwa, mime: p.mime, bytes: p.bytes, rodzaj: p.rodzaj };
}

function media(pliki: PlikDysku[]): PlikDysku[] {
  return pliki.filter((p) => (p.rodzaj === "obraz" || p.rodzaj === "wideo") && czyObslugiwanyMime(p.mime));
}

async function dokumenty(drive: DriveApi, pliki: PlikDysku[]): Promise<Array<{ plik: PlikDysku; tekst: string }>> {
  const doc = sortujNaturalnie(
    pliki.filter((p) => p.rodzaj === "dokument" || p.rodzaj === "tekst"),
    (p) => p.nazwa,
  );
  const wyniki = await Promise.all(doc.map(async (plik) => ({ plik, tekst: (await drive.eksportujTekst(plik.id, plik.mime)) ?? "" })));
  return wyniki.filter((w) => w.tekst.trim().length > 0);
}

type Adresowanie = { slug: string; pakietId: string };

function naPlikPropozycji(p: PlikDoParowania, a: Adresowanie): PlikPropozycji {
  return { id: p.id, nazwa: p.nazwa, mime: p.mime, bytes: p.bytes, assetId: null, rodzajMediow: p.rodzaj === "wideo" ? "wideo" : "obraz", miniaturaUrl: p.rodzaj === "obraz" ? adresMiniatury(a.slug, a.pakietId, p.id) : null };
}

export async function zbudujPropozycje(k: KonfiguracjaDysku, karta: KartaWeryfikacyjna, a: Adresowanie): Promise<Propozycja | null> {
  if (!karta.folderId || karta.stan !== "ok") return null;
  const drive = k.drive;
  if (karta.rodzaj === "content") {
    const bezposrednie = (await drive.listuj(karta.folderId)).filter((p) => p.mime !== MIME_FOLDERU);
    const wPostach = karta.podfoldery.posty ? (await drive.listuj(karta.podfoldery.posty)).filter((p) => p.mime !== MIME_FOLDERU) : [];
    const wRelacjach = karta.podfoldery.relacje ? (await drive.listuj(karta.podfoldery.relacje)).filter((p) => p.mime !== MIME_FOLDERU) : [];
    const doPostow = karta.podfoldery.posty || karta.podfoldery.relacje ? [...wPostach, ...(karta.podfoldery.posty ? [] : bezposrednie)] : bezposrednie;
    const teksty = await dokumenty(drive, [...bezposrednie, ...wPostach]);
    const podglady: PodgladDokumentu[] = [];
    const zrodla: ZrodloOpisu[] = [];
    for (const { plik, tekst } of teksty) {
      const podzial = podzielOpisy(tekst);
      podglady.push({ dokumentId: plik.id, nazwa: plik.nazwa, sekcje: podzial.sekcje, wstep: podzial.wstep });
      const sekcje = podzial.sekcje.length > 0 ? podzial.sekcje : podzial.wstep ? [{ numer: null, tytul: "", tresc: podzial.wstep }] : [];
      if (sekcje.length > 0) zrodla.push({ dokumentId: plik.id, nazwaDokumentu: plik.nazwa, sekcje });
    }
    const posty = zaproponujPosty(media(doPostow).map(naPlikDoParowania), zrodla);
    const relacje = zaproponujRelacje(media(wRelacjach).map(naPlikDoParowania));
    const propozycje = [...posty, ...relacje];
    return {
      rodzaj: "content",
      folderId: karta.folderId,
      materialy: propozycje.map((m) => ({ klucz: m.klucz, rodzaj: m.rodzaj, tytul: m.tytul, opis: m.opis, dopasowanie: m.dopasowanie, zrodloOpisu: m.zrodloOpisu, pliki: m.pliki.map((p) => naPlikPropozycji(p, a)), pominiety: false })),
      dokumenty: podglady,
      nieuzyteSekcje: nieuzyteSekcje(zrodla, propozycje),
    };
  }
  const pliki = (await drive.listuj(karta.folderId)).filter((p) => p.mime !== MIME_FOLDERU);
  const grafiki = sortujNaturalnie(media(pliki), (p) => p.nazwa).map((p) => ({ ...naPlikPropozycji(naPlikDoParowania(p), a), pominiety: false }));
  const teksty = await dokumenty(drive, pliki);
  const rozbior = rozbierzDokumentReklam(teksty.map((t) => t.tekst).join("\n\n"));
  return {
    rodzaj: "reklamy",
    folderId: karta.folderId,
    kampaniaId: karta.kampaniaId ?? "",
    kampaniaNazwa: karta.kampaniaNazwa ?? "",
    grafiki,
    teksty: teksty.length ? rozbior.teksty : [],
    naglowki: rozbior.naglowki,
    opis: rozbior.opis,
    cta: rozbior.cta,
    link: rozbior.link,
    dokumenty: teksty.map((t) => t.plik.nazwa),
    rozpoznanoSekcje: teksty.length === 0 ? true : rozbior.rozpoznanoSekcje,
  };
}
