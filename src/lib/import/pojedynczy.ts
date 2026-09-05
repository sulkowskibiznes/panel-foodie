import "server-only";
import { randomUUID } from "node:crypto";
import { zapiszAudyt } from "@/lib/audyt";
import type { AktorZespolu } from "@/lib/dane/materialy-zespol";
import { BladDysku, MIME_FOLDERU } from "@/lib/drive/api";
import { konfiguracjaDysku } from "@/lib/drive/klient";
import type { LinkDysku } from "@/lib/drive/linki";
import type { Database } from "@/lib/db-types";
import { sciezkaOdKorzenia } from "@/lib/import/weryfikacja";
import { czyObslugiwanyMime } from "@/lib/import/plan";
import { formatujMB, sprawdzPlik } from "@/lib/pliki/magia";
import { zapiszPlikMaterialu } from "@/lib/pliki/przetwarzanie";
import { podpiszOpisPliku, type OpisPliku, type WynikZakonczenia } from "@/lib/pliki/upload";
import { supabaseSerwer } from "@/lib/supabase/server";

/**
 * „Dodaj materiał" i „Podmień" linkiem do pojedynczego pliku na Dysku (SPEC rozdz. 12.6): plik przechodzi
 * tę samą drogę co upload z komputera (magic bytes, limit, EXIF, warianty) i kończy jako podpisany OPIS pliku,
 * więc mutacja materiału i skutki z tabeli 12.6 zostają bez zmian. Plik spoza „Materiałów klientów" odpada.
 */
export type WynikPlikuZDysku = WynikZakonczenia | { ok: false; powod: "zlyLink" | "folder" | "nieZnaleziono" | "zablokowany" | "nieSkonfigurowany" | "dysk" };

type Json = Database["public"]["Tables"]["import_jobs"]["Insert"]["plan"];

export async function pobierzPlikZDysku(p: { clientId: string; pakietId: string; itemId: string | null; rodzaj: "dodatkowy" | "podmiana"; link: LinkDysku; aktor: AktorZespolu; ipHash: string | null; ua: string | null }): Promise<WynikPlikuZDysku> {
  const k = konfiguracjaDysku();
  if (!k) return { ok: false, powod: "nieSkonfigurowany" };
  try {
    const sciezka = await sciezkaOdKorzenia(k.drive, p.link.id, k.korzenId);
    if (sciezka.stan === "nie_znaleziono") return { ok: false, powod: "nieZnaleziono" };
    if (sciezka.stan === "poza") return { ok: false, powod: "zablokowany" };
    const meta = sciezka.meta;
    if (meta.mime === MIME_FOLDERU) return { ok: false, powod: "folder" };
    if ((meta.rodzaj !== "obraz" && meta.rodzaj !== "wideo") || !czyObslugiwanyMime(meta.mime)) return { ok: false, powod: "nieobslugiwany" };
    const zDysku = await k.drive.pobierz(meta.id);
    if (!zDysku) return { ok: false, powod: "nieZnaleziono" };
    const sprawdzenie = sprawdzPlik({ bajtyPoczatku: zDysku.bajty.subarray(0, 32), bytes: zDysku.bajty.length, zadeklarowanyMime: meta.mime });
    if (!sprawdzenie.ok) return { ok: false, powod: sprawdzenie.powod, limit: sprawdzenie.limit ? formatujMB(sprawdzenie.limit) : undefined };
    const assetId = randomUUID();
    const zapis = await zapiszPlikMaterialu(Buffer.from(zDysku.bajty), sprawdzenie.rodzaj, p.clientId, assetId);
    const opis: Omit<OpisPliku, "wygasaO"> = {
      assetId,
      clientId: p.clientId,
      kind: sprawdzenie.rodzaj.startsWith("image/") ? "image" : "video",
      storagePath: zapis.storagePath,
      previewPath: zapis.previewPath,
      thumbPath: zapis.thumbPath,
      mime: sprawdzenie.rodzaj,
      bytes: zDysku.bajty.length,
      width: zapis.width,
      height: zapis.height,
      originalName: meta.nazwa.slice(0, 200),
      driveFileId: meta.id,
    };
    const ostrzezenia: string[] = [];
    if (sprawdzenie.ostrzezenie) ostrzezenia.push(sprawdzenie.ostrzezenie);
    ostrzezenia.push(...zapis.ostrzezenia);
    const { data: job } = await supabaseSerwer()
      .from("import_jobs")
      .insert({ package_id: p.pakietId, item_id: p.itemId, kind: p.rodzaj, source_url: p.link.url, source_folder_id: meta.rodzice[0] ?? null, status: "zakonczony", files_total: 1, files_done: 1, plan: { plik: { id: meta.id, nazwa: meta.nazwa, assetId } } as unknown as Json, verification: { sciezka: sciezka.pelna } as unknown as Json, created_by: p.aktor.memberId, started_at: new Date().toISOString(), finished_at: new Date().toISOString(), attempts: 1 })
      .select("id")
      .single();
    await zapiszAudyt({ actor_kind: "zespol", actor_id: p.aktor.memberId, actor_label: p.aktor.name, action: "zespol.import_pliku_z_dysku", entity: "import_job", entity_id: job?.id ?? null, client_id: p.clientId, ip_hash: p.ipHash, ua: p.ua, meta: { package_id: p.pakietId, item_id: p.itemId, rodzaj: p.rodzaj, plik: meta.id, asset_id: assetId, sciezka: sciezka.pelna } });
    return { ok: true, opis: podpiszOpisPliku(opis), plik: { assetId, kind: opis.kind, width: opis.width, height: opis.height, bytes: opis.bytes, originalName: opis.originalName }, ostrzezenia };
  } catch (blad) {
    if (blad instanceof BladDysku) return { ok: false, powod: "dysk" };
    console.error("[import] plik z Dysku", blad instanceof Error ? blad.message : blad);
    return { ok: false, powod: "przetwarzanie" };
  }
}
