import "server-only";
import sharp, { type Metadata, type Sharp } from "sharp";
import { czyObraz, ROZSZERZENIA, type RodzajPliku } from "@/lib/pliki/magia";
import { supabaseSerwer } from "@/lib/supabase/server";

/**
 * Wspólne przetwarzanie pliku materiału (SPEC rozdz. 13.4, 16 pkt 11) dla uploadu z komputera i importu z Dysku:
 * obraz dostaje orientację z EXIF, a potem traci EXIF przez ponowne zakodowanie; do tego preview 1080 px
 * i thumb 400 px w webp. Wideo idzie do Storage bez zmian. Ścieżka: {client_id}/{asset_id}/original.ext | preview.webp | thumb.webp.
 */
export const BUCKET_MATERIALOW = "materialy";

export type WynikZapisu = { storagePath: string; previewPath: string | null; thumbPath: string | null; width: number | null; height: number | null; ostrzezenia: Array<"bezPodgladu"> };

export function katalogPliku(clientId: string, assetId: string): string {
  return `${clientId}/${assetId}`;
}

export function sciezkaOryginalu(clientId: string, assetId: string, rodzaj: RodzajPliku): string {
  return `${katalogPliku(clientId, assetId)}/original.${ROZSZERZENIA[rodzaj]}`;
}

export async function wgrajDoStorage(sciezka: string, dane: Buffer | Uint8Array, contentType: string): Promise<void> {
  const { error } = await supabaseSerwer().storage.from(BUCKET_MATERIALOW).upload(sciezka, Buffer.from(dane), { contentType, upsert: true });
  if (error) throw new Error(`upload ${sciezka}: ${error.message}`);
}

export async function usunObiekty(sciezki: string[]): Promise<void> {
  const lista = sciezki.filter((s) => s.length > 0);
  if (lista.length === 0) return;
  const { error } = await supabaseSerwer().storage.from(BUCKET_MATERIALOW).remove(lista);
  if (error) console.error("[pliki] nie usunięto obiektów", error.message);
}

/** Obraz z bufora: oryginał bez EXIF (HEIC bez enkodera zostaje jak był), preview i thumb. */
async function zapiszObraz(bufor: Buffer, rodzaj: RodzajPliku, clientId: string, assetId: string): Promise<WynikZapisu> {
  const storagePath = sciezkaOryginalu(clientId, assetId, rodzaj);
  const katalog = katalogPliku(clientId, assetId);
  let obraz: Sharp;
  let meta: Metadata;
  try {
    obraz = sharp(bufor, { failOn: "none" }).rotate();
    meta = await obraz.metadata();
  } catch {
    await wgrajDoStorage(storagePath, bufor, rodzaj);
    return { storagePath, previewPath: null, thumbPath: null, width: null, height: null, ostrzezenia: ["bezPodgladu"] };
  }
  const obrocone = meta.orientation && meta.orientation >= 5;
  const width = (obrocone ? meta.height : meta.width) ?? null;
  const height = (obrocone ? meta.width : meta.height) ?? null;
  const previewPath = `${katalog}/preview.webp`;
  const thumbPath = `${katalog}/thumb.webp`;
  const [preview, thumb] = await Promise.all([
    obraz.clone().resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    obraz.clone().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer(),
  ]);
  let oryginal: Buffer = bufor;
  if (rodzaj === "image/jpeg") oryginal = await obraz.clone().jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  else if (rodzaj === "image/png") oryginal = await obraz.clone().png().toBuffer();
  else if (rodzaj === "image/webp") oryginal = await obraz.clone().webp({ quality: 92 }).toBuffer();
  await Promise.all([wgrajDoStorage(previewPath, preview, "image/webp"), wgrajDoStorage(thumbPath, thumb, "image/webp"), wgrajDoStorage(storagePath, oryginal, rodzaj)]);
  return { storagePath, previewPath, thumbPath, width, height, ostrzezenia: [] };
}

/** Plik dowolnego obsługiwanego rodzaju z bufora do Storage pod wskazanym assetId. */
export async function zapiszPlikMaterialu(bufor: Buffer, rodzaj: RodzajPliku, clientId: string, assetId: string): Promise<WynikZapisu> {
  if (czyObraz(rodzaj)) return zapiszObraz(bufor, rodzaj, clientId, assetId);
  const storagePath = sciezkaOryginalu(clientId, assetId, rodzaj);
  await wgrajDoStorage(storagePath, bufor, rodzaj);
  return { storagePath, previewPath: null, thumbPath: null, width: null, height: null, ostrzezenia: [] };
}
