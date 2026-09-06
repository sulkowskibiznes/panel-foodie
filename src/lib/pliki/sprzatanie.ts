import "server-only";
import { supabaseSerwer } from "@/lib/supabase/server";

export const BUCKETY_KLIENTA = ["materialy", "awatary", "faktury", "dokumenty"] as const;
export type BucketKlienta = (typeof BUCKETY_KLIENTA)[number];

/**
 * Usuwa wszystkie obiekty pod prefiksem (rekurencyjnie, partiami po 100). Ścieżki w Storage zaczynają się od
 * `{client_id}/`, więc prefiks = id klienta kasuje komplet jego plików w danym buckecie (SPEC rozdz. 17, offboarding).
 */
export async function usunFolderStorage(bucket: BucketKlienta, prefix: string): Promise<number> {
  const storage = supabaseSerwer().storage.from(bucket);
  const pliki: string[] = [];
  const kolejka = [prefix];
  while (kolejka.length > 0) {
    const folder = kolejka.pop()!;
    let offset = 0;
    for (;;) {
      const { data, error } = await storage.list(folder, { limit: 1000, offset });
      if (error) throw new Error(`list ${bucket}/${folder}: ${error.message}`);
      for (const wpis of data ?? []) {
        if (wpis.id === null) kolejka.push(`${folder}/${wpis.name}`);
        else pliki.push(`${folder}/${wpis.name}`);
      }
      if (!data || data.length < 1000) break;
      offset += data.length;
    }
  }
  for (let i = 0; i < pliki.length; i += 100) {
    const { error } = await storage.remove(pliki.slice(i, i + 100));
    if (error) throw new Error(`remove ${bucket}: ${error.message}`);
  }
  return pliki.length;
}
