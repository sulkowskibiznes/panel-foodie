import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { wyprowadzKlucz } from "@/lib/krypto";
import { czyObraz, czyRodzajPliku, formatujMB, limitBajtow, sprawdzPlik, type RodzajPliku } from "@/lib/pliki/magia";
import { BUCKET_MATERIALOW, sciezkaOryginalu, usunObiekty, zapiszPlikMaterialu } from "@/lib/pliki/przetwarzanie";
import { odczytajLadunek, podpiszLadunek } from "@/lib/podpis";
import { supabaseSerwer } from "@/lib/supabase/server";

/**
 * Upload materiału z komputera (SPEC rozdz. 12.6, 13.4, 16 pkt 11) w trzech krokach, bo funkcja na Vercelu
 * przyjmuje najwyżej kilka MB, a wideo waży do 300 MB:
 * 1. `przygotujUpload`: serwer sprawdza typ i wagę, wystawia jednorazowy podpisany adres do bucketu `materialy`
 *    (ścieżka {client_id}/{asset_id}/original.ext, bez nazwy klienta) i podpisane pozwolenie,
 * 2. przeglądarka wysyła plik PUT-em prosto do Storage (bez klucza Supabase; adres ważny 2 h),
 * 3. `zakonczUpload`: serwer sprawdza magic bytes i rzeczywistą wagę, dla obrazów zdejmuje EXIF i robi
 *    warianty preview 1080 px i thumb 400 px (webp), a potem wystawia podpisany OPIS pliku, który jedyna
 *    przyjmuje mutacja materiału (lib/dane/materialy-zespol.ts). Klient nigdy nie podaje ścieżek sam.
 */
export { BUCKET_MATERIALOW, usunObiekty };
const MS_WAZNOSCI_POZWOLENIA = 2 * 60 * 60 * 1000;
const MS_WAZNOSCI_OPISU = 2 * 60 * 60 * 1000;

export type Pozwolenie = { assetId: string; clientId: string; rodzaj: RodzajPliku; bytes: number; nazwa: string; wygasaO: number };

export type OpisPliku = {
  assetId: string;
  clientId: string;
  kind: "image" | "video";
  storagePath: string;
  previewPath: string | null;
  thumbPath: string | null;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalName: string;
  /** Identyfikator pliku na Dysku, gdy plik przyszedł linkiem (SPEC rozdz. 12.6); null z komputera. */
  driveFileId: string | null;
  wygasaO: number;
};

function klucz() {
  return wyprowadzKlucz(env().SESSION_SECRET, "upload");
}

export type WynikPrzygotowania = { ok: true; assetId: string; signedUrl: string; pozwolenie: string } | { ok: false; powod: "nieobslugiwany" | "zaDuzy"; limit?: string };

/** Krok 1. Nazwa pliku służy tylko do `original_name`; ścieżka w Storage nie zawiera nazwy ani klienta. */
export async function przygotujUpload(clientId: string, plik: { nazwa: string; mime: string; bytes: number }): Promise<WynikPrzygotowania> {
  const mime = plik.mime.toLowerCase();
  if (!czyRodzajPliku(mime)) return { ok: false, powod: "nieobslugiwany" };
  if (!Number.isFinite(plik.bytes) || plik.bytes <= 0) return { ok: false, powod: "nieobslugiwany" };
  const limit = limitBajtow(mime);
  if (plik.bytes > limit) return { ok: false, powod: "zaDuzy", limit: formatujMB(limit) };
  const assetId = randomUUID();
  const sciezka = sciezkaOryginalu(clientId, assetId, mime);
  const { data, error } = await supabaseSerwer().storage.from(BUCKET_MATERIALOW).createSignedUploadUrl(sciezka, { upsert: true });
  if (error || !data) throw new Error(`przygotujUpload: ${error?.message ?? "brak adresu"}`);
  const pozwolenie: Pozwolenie = { assetId, clientId, rodzaj: mime, bytes: plik.bytes, nazwa: plik.nazwa.slice(0, 200), wygasaO: Date.now() + MS_WAZNOSCI_POZWOLENIA };
  return { ok: true, assetId, signedUrl: data.signedUrl, pozwolenie: podpiszLadunek(klucz(), pozwolenie) };
}

export type WynikZakonczenia = { ok: true; opis: string; plik: Pick<OpisPliku, "assetId" | "kind" | "width" | "height" | "bytes" | "originalName">; ostrzezenia: string[] } | { ok: false; powod: "pozwolenie" | "brakPliku" | "nieobslugiwany" | "zaDuzy" | "niezgodnyZDeklaracja" | "przetwarzanie"; limit?: string };

async function pobierzPoczatek(sciezka: string): Promise<{ bajty: Uint8Array; rozmiar: number } | null> {
  const { data, error } = await supabaseSerwer().storage.from(BUCKET_MATERIALOW).createSignedUrl(sciezka, 60);
  if (error || !data) return null;
  const odp = await fetch(data.signedUrl, { headers: { Range: "bytes=0-31" } });
  if (!odp.ok) return null;
  const bufor = new Uint8Array(await odp.arrayBuffer());
  const zakres = odp.headers.get("content-range");
  const calosc = zakres ? Number(zakres.split("/")[1]) : Number(odp.headers.get("content-length") ?? bufor.length);
  return { bajty: bufor.subarray(0, 32), rozmiar: Number.isFinite(calosc) ? calosc : bufor.length };
}

/**
 * Obraz już leży w Storage (PUT z przeglądarki): ściągamy go, zdejmujemy EXIF i robimy warianty
 * tą samą ścieżką co import z Dysku (lib/pliki/przetwarzanie.ts); oryginał wraca bez metadanych.
 */
async function przetworzObraz(sciezka: string, rodzaj: RodzajPliku, clientId: string, assetId: string) {
  const { data, error } = await supabaseSerwer().storage.from(BUCKET_MATERIALOW).download(sciezka);
  if (error || !data) throw new Error(`download ${sciezka}: ${error?.message ?? "brak danych"}`);
  return zapiszPlikMaterialu(Buffer.from(await data.arrayBuffer()), rodzaj, clientId, assetId);
}

/** Krok 3. Sprawdzenie pliku, który już leży w Storage, i podpisany opis dla mutacji materiału. */
export async function zakonczUpload(clientId: string, pozwolenieToken: string): Promise<WynikZakonczenia> {
  const pozwolenie = odczytajLadunek<Pozwolenie>(klucz(), pozwolenieToken, new Date());
  if (!pozwolenie || pozwolenie.clientId !== clientId) return { ok: false, powod: "pozwolenie" };
  const sciezka = sciezkaOryginalu(clientId, pozwolenie.assetId, pozwolenie.rodzaj);
  const poczatek = await pobierzPoczatek(sciezka);
  if (!poczatek) return { ok: false, powod: "brakPliku" };
  const sprawdzenie = sprawdzPlik({ bajtyPoczatku: poczatek.bajty, bytes: poczatek.rozmiar, zadeklarowanyMime: pozwolenie.rodzaj });
  if (!sprawdzenie.ok) {
    await usunObiekty([sciezka]);
    return { ok: false, powod: sprawdzenie.powod, limit: sprawdzenie.limit ? formatujMB(sprawdzenie.limit) : undefined };
  }
  const ostrzezenia: string[] = sprawdzenie.ostrzezenie ? [sprawdzenie.ostrzezenie] : [];
  let warianty = { previewPath: null as string | null, thumbPath: null as string | null, width: null as number | null, height: null as number | null };
  if (czyObraz(sprawdzenie.rodzaj)) {
    try {
      const w = await przetworzObraz(sciezka, sprawdzenie.rodzaj, clientId, pozwolenie.assetId);
      warianty = { previewPath: w.previewPath, thumbPath: w.thumbPath, width: w.width, height: w.height };
      ostrzezenia.push(...w.ostrzezenia);
    } catch (blad) {
      console.error("[upload] przetwarzanie obrazu", blad instanceof Error ? blad.message : blad);
      await usunObiekty([sciezka]);
      return { ok: false, powod: "przetwarzanie" };
    }
  }
  const opis: OpisPliku = {
    assetId: pozwolenie.assetId,
    clientId,
    kind: czyObraz(sprawdzenie.rodzaj) ? "image" : "video",
    storagePath: sciezka,
    previewPath: warianty.previewPath,
    thumbPath: warianty.thumbPath,
    mime: sprawdzenie.rodzaj,
    bytes: poczatek.rozmiar,
    width: warianty.width,
    height: warianty.height,
    originalName: pozwolenie.nazwa,
    driveFileId: null,
    wygasaO: Date.now() + MS_WAZNOSCI_OPISU,
  };
  return { ok: true, opis: podpiszLadunek(klucz(), opis), plik: { assetId: opis.assetId, kind: opis.kind, width: opis.width, height: opis.height, bytes: opis.bytes, originalName: opis.originalName }, ostrzezenia };
}

/** Podpisany opis pliku dla mutacji materiału; używa go też import pojedynczego pliku z Dysku (lib/import/pojedynczy.ts). */
export function podpiszOpisPliku(opis: Omit<OpisPliku, "wygasaO">): string {
  return podpiszLadunek(klucz(), { ...opis, wygasaO: Date.now() + MS_WAZNOSCI_OPISU });
}

/** Opis pliku z podpisanego tokenu, wyłącznie dla tego klienta (mutacja materiału sprawdza jeszcze pakiet). */
export function odczytajOpisPliku(clientId: string, token: string): OpisPliku | null {
  const opis = odczytajLadunek<OpisPliku>(klucz(), token, new Date());
  if (!opis || opis.clientId !== clientId || typeof opis.assetId !== "string" || typeof opis.storagePath !== "string") return null;
  if (!opis.storagePath.startsWith(`${clientId}/`)) return null;
  return opis;
}
