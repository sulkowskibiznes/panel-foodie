import "server-only";
import { supabaseSerwer } from "@/lib/supabase/server";

/** SPEC rozdz. 16.3: signed URL ważny 10 minut, generowany po stronie serwera, po sprawdzeniu dostępu. */
export const SEKUND_WAZNOSCI_PLIKU = 600;
export const WARIANTY_PLIKU = ["original", "preview", "thumb"] as const;
export type WariantPliku = (typeof WARIANTY_PLIKU)[number];

export function czyWariantPliku(wartosc: string): wartosc is WariantPliku {
  return (WARIANTY_PLIKU as readonly string[]).includes(wartosc);
}

export async function podpiszSciezke(bucket: "materialy" | "awatary", sciezka: string): Promise<string | null> {
  const { data, error } = await supabaseSerwer().storage.from(bucket).createSignedUrl(sciezka, SEKUND_WAZNOSCI_PLIKU);
  if (error || !data) return null;
  return data.signedUrl;
}

export type AwatarLokalu = { clientId: string; avatarPath: string | null };

/** Zdjęcie profilowe strony po id lokalu, z właścicielem do kontroli dostępu. */
export async function pobierzAwatarLokalu(lokalId: string): Promise<AwatarLokalu | null> {
  const { data } = await supabaseSerwer().from("locations").select("client_id, avatar_path").eq("id", lokalId).maybeSingle();
  return data ? { clientId: data.client_id, avatarPath: data.avatar_path } : null;
}

export function sciezkaWariantu(zasob: { storagePath: string; previewPath: string | null; thumbPath: string | null }, wariant: WariantPliku): string {
  if (wariant === "original") return zasob.storagePath;
  if (wariant === "preview") return zasob.previewPath ?? zasob.storagePath;
  return zasob.thumbPath ?? zasob.storagePath;
}
