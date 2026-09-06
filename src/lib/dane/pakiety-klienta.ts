import "server-only";
import type { Database } from "@/lib/db-types";
import type { KlientDlaKlienta, NajblizszaPublikacja, PakietDlaKlienta } from "@/lib/dto/klient";
import { supabaseSerwer } from "@/lib/supabase/server";

type WierszPakietu = {
  id: string;
  client_id: string;
  title: string | null;
  status: PakietDlaKlienta["status"];
  round: number;
  submitted_at: string | null;
  auto_approve_at: string | null;
  auto_approve_enabled: boolean;
  package_items: { type: string }[];
  campaigns: { id: string }[];
};

const KOLUMNY = "id, client_id, title, status, round, submitted_at, auto_approve_at, auto_approve_enabled, package_items(type), campaigns(id)";

function naDto(w: WierszPakietu): PakietDlaKlienta {
  const typy = w.package_items.map((i) => i.type);
  return {
    id: w.id,
    tytul: w.title ?? "",
    status: w.status,
    runda: w.round,
    liczbaPostow: typy.filter((t) => t === "post" || t === "reels").length,
    liczbaRelacji: typy.filter((t) => t === "relacja").length,
    liczbaKampanii: w.campaigns.length,
    wyslanoO: w.submitted_at,
    autoAkceptacjaO: w.auto_approve_enabled ? w.auto_approve_at : null,
  };
}

export async function pobierzKlienta(clientId: string): Promise<KlientDlaKlienta | null> {
  const { data } = await supabaseSerwer().from("clients").select("id, name").eq("id", clientId).maybeSingle();
  return data ? { id: data.id, nazwa: data.name } : null;
}

/** Pakiet cenowy klienta (filtr widoczności usług, SPEC rozdz. 5.8). */
export async function pobierzTierKlienta(clientId: string): Promise<Database["public"]["Enums"]["package_tier"] | null> {
  const { data } = await supabaseSerwer().from("clients").select("tier").eq("id", clientId).maybeSingle();
  return data?.tier ?? null;
}

/** Pakiety czekające na decyzję klienta (kat1 może mieć kilka: jeden na lokal). */
export async function pobierzPakietyDoAkceptacji(clientId: string): Promise<PakietDlaKlienta[]> {
  const { data, error } = await supabaseSerwer()
    .from("packages")
    .select(KOLUMNY)
    .eq("client_id", clientId)
    .eq("status", "do_akceptacji")
    .order("submitted_at", { ascending: true });
  if (error) throw new Error(`pobierzPakietyDoAkceptacji: ${error.message}`);
  return ((data ?? []) as unknown as WierszPakietu[]).map(naDto);
}

/**
 * Pakiet po id, BEZ filtra po kliencie: strona musi wywołać assertClientAccess(sesja.clientId, wynik.clientId)
 * zanim cokolwiek pokaże. Nieistniejący i cudzy pakiet wyglądają dla klienta identycznie (404).
 */
export async function pobierzPakiet(pakietId: string): Promise<{ clientId: string; pakiet: PakietDlaKlienta } | null> {
  const { data } = await supabaseSerwer().from("packages").select(KOLUMNY).eq("id", pakietId).maybeSingle();
  if (!data) return null;
  const w = data as unknown as WierszPakietu;
  return { clientId: w.client_id, pakiet: naDto(w) };
}

export type ZasobPliku = { clientId: string; storagePath: string; previewPath: string | null; thumbPath: string | null };

/** Plik po id z właścicielem (klientem) do assertClientAccess w trasie /plik. */
export async function pobierzZasob(assetId: string): Promise<ZasobPliku | null> {
  const { data } = await supabaseSerwer()
    .from("item_assets")
    .select("storage_path, preview_path, thumb_path, package_items!inner(packages!inner(client_id))")
    .eq("id", assetId)
    .maybeSingle();
  if (!data) return null;
  const item = data.package_items as unknown as { packages: { client_id: string } | null } | null;
  const clientId = item?.packages?.client_id;
  if (!clientId) return null;
  return { clientId, storagePath: data.storage_path, previewPath: data.preview_path, thumbPath: data.thumb_path };
}

/** Najbliższa publikacja (SPEC rozdz. 5.1): post albo relacja z datą w przyszłości w pakiecie zaakceptowanym lub zaplanowanym. */
export async function pobierzNajblizszaPublikacje(clientId: string, teraz: Date): Promise<NajblizszaPublikacja | null> {
  const { data, error } = await supabaseSerwer()
    .from("package_items")
    .select("package_id, title, type, publish_at, packages!inner(client_id, status)")
    .eq("packages.client_id", clientId)
    .in("packages.status", ["zaakceptowany", "zaplanowany"])
    .neq("type", "reklama")
    .gte("publish_at", teraz.toISOString())
    .order("publish_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`pobierzNajblizszaPublikacje: ${error.message}`);
  if (!data || !data.publish_at) return null;
  return { pakietId: data.package_id, tytul: data.title ?? "", typ: data.type, publikacjaO: data.publish_at };
}
