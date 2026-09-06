import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { wyprowadzKlucz } from "@/lib/krypto";
import { czyMagiaPdf, formatujMB, MAKS_BAJTOW_PDF } from "@/lib/pliki/magia";
import { odczytajLadunek, podpiszLadunek } from "@/lib/podpis";
import { supabaseSerwer } from "@/lib/supabase/server";

/**
 * PDF faktur i dokumentów (SPEC rozdz. 10, 16 pkt 3 i 11) tą samą drogą co materiały (lib/pliki/upload.ts):
 * 1. `przygotujUploadPdf`: jednorazowy podpisany adres do bucketu `faktury` albo `dokumenty`
 *    (ścieżka {client_id}/{uuid}.pdf, bez nazwy klienta) i podpisane pozwolenie,
 * 2. przeglądarka wysyła plik PUT-em prosto do Storage,
 * 3. `zakonczUploadPdf`: serwer sprawdza magic bytes „%PDF-" i rzeczywistą wagę, potem wystawia podpisany OPIS,
 *    jedyną rzecz, jaką przyjmują mutacje faktury i dokumentu. Zespół nigdy nie podaje ścieżek sam (zasada 14).
 */
export type BucketPdf = "faktury" | "dokumenty";
export const BUCKETY_PDF: readonly BucketPdf[] = ["faktury", "dokumenty"];
const MS_WAZNOSCI = 2 * 60 * 60 * 1000;

export type PozwoleniePdf = { bucket: BucketPdf; clientId: string; sciezka: string; bytes: number; nazwa: string; wygasaO: number };
export type OpisPdf = { bucket: BucketPdf; clientId: string; sciezka: string; bytes: number; nazwa: string; wygasaO: number };

function klucz() {
  return wyprowadzKlucz(env().SESSION_SECRET, "upload-pdf");
}

export function czyBucketPdf(wartosc: string): wartosc is BucketPdf {
  return (BUCKETY_PDF as readonly string[]).includes(wartosc);
}

export type WynikPrzygotowaniaPdf = { ok: true; signedUrl: string; pozwolenie: string } | { ok: false; powod: "nieobslugiwany" | "zaDuzy"; limit?: string };

export async function przygotujUploadPdf(bucket: BucketPdf, clientId: string, plik: { nazwa: string; mime: string; bytes: number }): Promise<WynikPrzygotowaniaPdf> {
  if (plik.mime.toLowerCase() !== "application/pdf") return { ok: false, powod: "nieobslugiwany" };
  if (!Number.isFinite(plik.bytes) || plik.bytes <= 0) return { ok: false, powod: "nieobslugiwany" };
  if (plik.bytes > MAKS_BAJTOW_PDF) return { ok: false, powod: "zaDuzy", limit: formatujMB(MAKS_BAJTOW_PDF) };
  const sciezka = `${clientId}/${randomUUID()}.pdf`;
  const { data, error } = await supabaseSerwer().storage.from(bucket).createSignedUploadUrl(sciezka, { upsert: true });
  if (error || !data) throw new Error(`przygotujUploadPdf: ${error?.message ?? "brak adresu"}`);
  const pozwolenie: PozwoleniePdf = { bucket, clientId, sciezka, bytes: plik.bytes, nazwa: plik.nazwa.slice(0, 200), wygasaO: Date.now() + MS_WAZNOSCI };
  return { ok: true, signedUrl: data.signedUrl, pozwolenie: podpiszLadunek(klucz(), pozwolenie) };
}

export type WynikZakonczeniaPdf = { ok: true; opis: string; nazwa: string; bytes: number } | { ok: false; powod: "pozwolenie" | "brakPliku" | "nieobslugiwany" | "zaDuzy"; limit?: string };

async function pobierzPoczatek(bucket: BucketPdf, sciezka: string): Promise<{ bajty: Uint8Array; rozmiar: number } | null> {
  const { data, error } = await supabaseSerwer().storage.from(bucket).createSignedUrl(sciezka, 60);
  if (error || !data) return null;
  const odp = await fetch(data.signedUrl, { headers: { Range: "bytes=0-15" } });
  if (!odp.ok) return null;
  const bufor = new Uint8Array(await odp.arrayBuffer());
  const zakres = odp.headers.get("content-range");
  const calosc = zakres ? Number(zakres.split("/")[1]) : Number(odp.headers.get("content-length") ?? bufor.length);
  return { bajty: bufor.subarray(0, 16), rozmiar: Number.isFinite(calosc) ? calosc : bufor.length };
}

export async function zakonczUploadPdf(bucket: BucketPdf, clientId: string, pozwolenieToken: string): Promise<WynikZakonczeniaPdf> {
  const pozwolenie = odczytajLadunek<PozwoleniePdf>(klucz(), pozwolenieToken, new Date());
  if (!pozwolenie || pozwolenie.clientId !== clientId || pozwolenie.bucket !== bucket || !pozwolenie.sciezka.startsWith(`${clientId}/`)) return { ok: false, powod: "pozwolenie" };
  const poczatek = await pobierzPoczatek(bucket, pozwolenie.sciezka);
  if (!poczatek) return { ok: false, powod: "brakPliku" };
  const usun = () => supabaseSerwer().storage.from(bucket).remove([pozwolenie.sciezka]);
  if (!czyMagiaPdf(poczatek.bajty)) {
    await usun();
    return { ok: false, powod: "nieobslugiwany" };
  }
  if (poczatek.rozmiar > MAKS_BAJTOW_PDF) {
    await usun();
    return { ok: false, powod: "zaDuzy", limit: formatujMB(MAKS_BAJTOW_PDF) };
  }
  const opis: OpisPdf = { bucket, clientId, sciezka: pozwolenie.sciezka, bytes: poczatek.rozmiar, nazwa: pozwolenie.nazwa, wygasaO: Date.now() + MS_WAZNOSCI };
  return { ok: true, opis: podpiszLadunek(klucz(), opis), nazwa: opis.nazwa, bytes: opis.bytes };
}

/** Opis PDF z podpisanego tokenu: wyłącznie ten klient i ten bucket. */
export function odczytajOpisPdf(bucket: BucketPdf, clientId: string, token: string): OpisPdf | null {
  const opis = odczytajLadunek<OpisPdf>(klucz(), token, new Date());
  if (!opis || opis.clientId !== clientId || opis.bucket !== bucket || typeof opis.sciezka !== "string" || !opis.sciezka.startsWith(`${clientId}/`)) return null;
  return opis;
}

/** Signed URL ważny 10 minut do PDF-u (po sprawdzeniu dostępu przez wywołującego). */
export async function podpiszPdf(bucket: BucketPdf, sciezka: string): Promise<string | null> {
  const { data, error } = await supabaseSerwer().storage.from(bucket).createSignedUrl(sciezka, 600, { download: true });
  if (error || !data) return null;
  return data.signedUrl;
}
