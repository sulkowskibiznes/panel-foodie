import "server-only";
import type { DokumentDlaKlienta, RodzajDokumentu } from "@/lib/dto/klient";
import { supabaseSerwer } from "@/lib/supabase/server";

type WierszDokumentu = { id: string; client_id: string; kind: RodzajDokumentu; title: string; file_path: string; valid_from: string | null; created_at: string };
const KOLUMNY = "id, client_id, kind, title, file_path, valid_from, created_at";

function naDto(w: WierszDokumentu): DokumentDlaKlienta {
  return { id: w.id, rodzaj: w.kind, tytul: w.title, obowiazujeOd: w.valid_from, dodanoO: w.created_at };
}

/** Dokumenty klienta (SPEC rozdz. 10, 17): umowa, aneksy, umowa powierzenia; od najnowszego. */
export async function pobierzDokumentyKlienta(clientId: string): Promise<DokumentDlaKlienta[]> {
  const { data, error } = await supabaseSerwer().from("documents").select(KOLUMNY).eq("client_id", clientId).order("valid_from", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  if (error) throw new Error(`pobierzDokumentyKlienta: ${error.message}`);
  return ((data ?? []) as unknown as WierszDokumentu[]).map(naDto);
}

export type PlikDokumentu = { clientId: string; filePath: string; tytul: string };

/** Dokument po id BEZ filtra po kliencie: trasa PDF wywołuje assertClientAccess przed podpisaniem ścieżki. */
export async function pobierzDokument(id: string): Promise<PlikDokumentu | null> {
  const { data } = await supabaseSerwer().from("documents").select("client_id, file_path, title").eq("id", id).maybeSingle();
  return data ? { clientId: data.client_id, filePath: data.file_path, tytul: data.title } : null;
}

export async function dodajDokument(n: { clientId: string; rodzaj: RodzajDokumentu; tytul: string; obowiazujeOd: string | null; filePath: string; uploadedBy: string }): Promise<string> {
  const { data, error } = await supabaseSerwer().from("documents").insert({ client_id: n.clientId, kind: n.rodzaj, title: n.tytul, valid_from: n.obowiazujeOd, file_path: n.filePath, uploaded_by: n.uploadedBy }).select("id").single();
  if (error || !data) throw new Error(`dodajDokument: ${error?.message ?? "brak wiersza"}`);
  return data.id;
}

export async function usunDokument(id: string, clientId: string): Promise<boolean> {
  const { data, error } = await supabaseSerwer().from("documents").delete().eq("id", id).eq("client_id", clientId).select("id");
  if (error) throw new Error(`usunDokument: ${error.message}`);
  return (data ?? []).length === 1;
}
