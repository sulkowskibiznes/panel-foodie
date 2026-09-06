import "server-only";
import { zapiszAudyt } from "@/lib/audyt";
import { copy } from "@/lib/copy";
import { pobierzUstawienia } from "@/lib/dane/ustawienia";
import type { Database } from "@/lib/db-types";
import { env } from "@/lib/env";
import { dodajDoOutbox } from "@/lib/outbox";
import { usunObiekty } from "@/lib/pliki/przetwarzanie";
import { dataOdroczenia, DOMYSLNA_RETENCJA_MIESIECY, type IstniejacyPrzeglad, type PakietDoPrzegladu, type WynikCronaRetencji, type ZaleznosciCronaRetencji } from "@/lib/retencja/przeglad";
import { supabaseSerwer } from "@/lib/supabase/server";

type Decyzja = Database["public"]["Enums"]["retention_decision"];

export type PrzegladNaLiscie = {
  id: string;
  packageId: string | null;
  klient: { slug: string; name: string };
  tytul: string;
  okres: { od: string; do: string };
  liczbaPlikow: number;
  zgloszonoO: string;
  decyzja: Decyzja | null;
  zdecydowanoO: string | null;
  zdecydowal: string | null;
  keepUntil: string | null;
  usunietoO: string | null;
};

const KOLUMNY = "id, package_id, package_title, period_from, period_to, files_count, flagged_at, decision, decided_at, keep_until, deleted_at, clients!inner(slug, name), decided_by_member:team_members!retention_reviews_decided_by_fkey(name)";

type Wiersz = {
  id: string;
  package_id: string | null;
  package_title: string;
  period_from: string;
  period_to: string;
  files_count: number;
  flagged_at: string;
  decision: Decyzja | null;
  decided_at: string | null;
  keep_until: string | null;
  deleted_at: string | null;
  clients: { slug: string; name: string };
  decided_by_member: { name: string } | null;
};

function naListe(w: Wiersz): PrzegladNaLiscie {
  return {
    id: w.id,
    packageId: w.package_id,
    klient: w.clients,
    tytul: w.package_title,
    okres: { od: w.period_from, do: w.period_to },
    liczbaPlikow: w.files_count,
    zgloszonoO: w.flagged_at,
    decyzja: w.decision,
    zdecydowanoO: w.decided_at,
    zdecydowal: w.decided_by_member?.name ?? null,
    keepUntil: w.keep_until,
    usunietoO: w.deleted_at,
  };
}

export async function pobierzMiesiaceRetencji(): Promise<number> {
  const mapa = await pobierzUstawienia(["retention_months"]);
  const n = Number(mapa.get("retention_months"));
  return Number.isFinite(n) && n > 0 ? n : DOMYSLNA_RETENCJA_MIESIECY;
}

/** Pakiety z okresem zakończonym przed progiem, z liczbą aktualnych plików (bez podmienionych). */
export async function pobierzPakietyStarszeNiz(prog: string): Promise<PakietDoPrzegladu[]> {
  const db = supabaseSerwer();
  const { data, error } = await db.from("packages").select("id, client_id, title, period_from, period_to").lt("period_to", prog).order("period_to");
  if (error) throw new Error(`pobierzPakietyStarszeNiz: ${error.message}`);
  const pakiety = data ?? [];
  if (pakiety.length === 0) return [];
  const { data: pliki, error: bladPlikow } = await db
    .from("item_assets")
    .select("id, package_items!inner(package_id)")
    .in(
      "package_items.package_id",
      pakiety.map((p) => p.id),
    )
    .is("superseded_at", null);
  if (bladPlikow) throw new Error(`pobierzPakietyStarszeNiz (pliki): ${bladPlikow.message}`);
  const licznik = new Map<string, number>();
  for (const p of (pliki ?? []) as unknown as Array<{ package_items: { package_id: string } }>) {
    licznik.set(p.package_items.package_id, (licznik.get(p.package_items.package_id) ?? 0) + 1);
  }
  return pakiety.map((p) => ({ id: p.id, clientId: p.client_id, tytul: p.title ?? "", okres: { od: p.period_from, do: p.period_to }, liczbaPlikow: licznik.get(p.id) ?? 0 }));
}

export async function pobierzPrzeglady(packageIds: string[]): Promise<IstniejacyPrzeglad[]> {
  if (packageIds.length === 0) return [];
  const { data, error } = await supabaseSerwer().from("retention_reviews").select("package_id, decision, keep_until").in("package_id", packageIds);
  if (error) throw new Error(`pobierzPrzeglady: ${error.message}`);
  return (data ?? []).filter((w) => w.package_id !== null).map((w) => ({ packageId: w.package_id as string, decision: w.decision, keepUntil: w.keep_until }));
}

/** Zgłoszenie jest idempotentne: równoległy przebieg (cron obok „Sprawdź teraz") nie wywraca się na unikalności `package_id`; zwraca true tylko dla wstawionego wiersza. */
export async function zglosPakiet(p: PakietDoPrzegladu, teraz: Date): Promise<boolean> {
  const { data, error } = await supabaseSerwer()
    .from("retention_reviews")
    .upsert(
      {
        package_id: p.id,
        client_id: p.clientId,
        package_title: p.tytul,
        period_from: p.okres.od,
        period_to: p.okres.do,
        files_count: p.liczbaPlikow,
        flagged_at: teraz.toISOString(),
      },
      { onConflict: "package_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`zglosPakiet: ${error.message}`);
  return (data ?? []).length === 1;
}

/** Po „zachowaj" odroczenie minęło: zgłoszenie wraca do kolejki bez decyzji. True tylko, gdy ten przebieg je cofnął. */
export async function ponowPrzeglad(packageId: string, teraz: Date): Promise<boolean> {
  const { data, error } = await supabaseSerwer()
    .from("retention_reviews")
    .update({ decision: null, decided_at: null, decided_by: null, keep_until: null, flagged_at: teraz.toISOString() })
    .eq("package_id", packageId)
    .eq("decision", "zachowaj")
    .lte("keep_until", teraz.toISOString())
    .select("id");
  if (error) throw new Error(`ponowPrzeglad: ${error.message}`);
  return (data ?? []).length === 1;
}

export async function pobierzOczekujacePrzeglady(): Promise<PrzegladNaLiscie[]> {
  const { data, error } = await supabaseSerwer().from("retention_reviews").select(KOLUMNY).is("decision", null).order("flagged_at", { ascending: true });
  if (error) throw new Error(`pobierzOczekujacePrzeglady: ${error.message}`);
  return ((data ?? []) as unknown as Wiersz[]).map(naListe);
}

export async function pobierzOstatnieDecyzje(limit = 20): Promise<PrzegladNaLiscie[]> {
  const { data, error } = await supabaseSerwer().from("retention_reviews").select(KOLUMNY).not("decision", "is", null).order("decided_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`pobierzOstatnieDecyzje: ${error.message}`);
  return ((data ?? []) as unknown as Wiersz[]).map(naListe);
}

/** „Zachowaj 12 miesięcy": decyzja z odroczeniem; cron zgłosi pakiet ponownie po `keep_until`. */
export async function zachowajPakiet(reviewId: string, memberId: string, teraz: Date): Promise<PrzegladNaLiscie | null> {
  const { data, error } = await supabaseSerwer()
    .from("retention_reviews")
    .update({ decision: "zachowaj", decided_at: teraz.toISOString(), decided_by: memberId, keep_until: dataOdroczenia(teraz).toISOString() })
    .eq("id", reviewId)
    .is("decision", null)
    .select(KOLUMNY)
    .maybeSingle();
  if (error) throw new Error(`zachowajPakiet: ${error.message}`);
  return data ? naListe(data as unknown as Wiersz) : null;
}

export type WynikUsuniecia = { ok: true; przeglad: PrzegladNaLiscie; usunietePliki: number } | { ok: false };

/**
 * „Usuń materiały": pakiet znika z bazy (kaskada: kampanie, materiały, pliki, komentarze, zdarzenia, importy),
 * obiekty z bucketu `materialy` znikają ze Storage, a wiersz przeglądu zostaje jako ślad z `deleted_at`.
 */
export async function usunMaterialyPakietu(reviewId: string, memberId: string, teraz: Date): Promise<WynikUsuniecia> {
  const db = supabaseSerwer();
  const { data: przeglad } = await db.from("retention_reviews").select("id, package_id").eq("id", reviewId).is("decision", null).maybeSingle();
  if (!przeglad || !przeglad.package_id) return { ok: false };
  const { data: materialy } = await db.from("package_items").select("id").eq("package_id", przeglad.package_id);
  const idsMaterialow = (materialy ?? []).map((m) => m.id);
  const { data: pliki } = idsMaterialow.length > 0 ? await db.from("item_assets").select("storage_path, preview_path, thumb_path").in("item_id", idsMaterialow) : { data: [] };
  const sciezki = (pliki ?? []).flatMap((p) => [p.storage_path, p.preview_path ?? "", p.thumb_path ?? ""]).filter((s) => s.length > 0);

  // Komentarze wskazują osoby kontaktowe bez kaskady, więc idą pierwsze (jak w seedzie), potem pakiet.
  const { error: bladKomentarzy } = await db.from("comments").delete().eq("package_id", przeglad.package_id);
  if (bladKomentarzy) throw new Error(`usunMaterialyPakietu (komentarze): ${bladKomentarzy.message}`);
  const { error: bladPakietu } = await db.from("packages").delete().eq("id", przeglad.package_id);
  if (bladPakietu) throw new Error(`usunMaterialyPakietu (pakiet): ${bladPakietu.message}`);
  for (let i = 0; i < sciezki.length; i += 100) await usunObiekty(sciezki.slice(i, i + 100));

  const { data, error } = await db
    .from("retention_reviews")
    .update({ decision: "usun", decided_at: teraz.toISOString(), decided_by: memberId, deleted_at: teraz.toISOString(), files_count: pliki?.length ?? 0 })
    .eq("id", reviewId)
    .select(KOLUMNY)
    .maybeSingle();
  if (error || !data) throw new Error(`usunMaterialyPakietu (przegląd): ${error?.message ?? "brak wiersza"}`);
  return { ok: true, przeglad: naListe(data as unknown as Wiersz), usunietePliki: sciezki.length };
}

/** Sesje klientów: wygasłe albo unieważnione wcześniej niż `przed` (SPEC rozdz. 17: 90 dni). */
export async function usunStareSesje(przed: Date): Promise<number> {
  const iso = przed.toISOString();
  const { count, error } = await supabaseSerwer().from("client_sessions").delete({ count: "exact" }).or(`revoked_at.lt.${iso},expires_at.lt.${iso}`);
  if (error) throw new Error(`usunStareSesje: ${error.message}`);
  return count ?? 0;
}

/** Audyt starszy niż `przed` (SPEC rozdz. 17: 12 miesięcy). */
export async function usunStaryAudyt(przed: Date): Promise<number> {
  const { count, error } = await supabaseSerwer().from("audit_log").delete({ count: "exact" }).lt("created_at", przed.toISOString());
  if (error) throw new Error(`usunStaryAudyt: ${error.message}`);
  return count ?? 0;
}

export function adresRetencji(): string {
  return `${env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/zespol/ustawienia/retencja`;
}

/** Zależności crona retencji na prawdziwej bazie; logika w lib/retencja/przeglad.ts. */
export function zaleznosciCronaRetencji(): ZaleznosciCronaRetencji {
  return {
    pobierzMiesiaceRetencji,
    pobierzPakietyStarszeNiz,
    pobierzPrzeglady,
    zglos: zglosPakiet,
    ponow: ponowPrzeglad,
    powiadom: async (liczba) => {
      const url = adresRetencji();
      await dodajDoOutbox("retencja.do_przegladu", { event: "retencja.do_przegladu", count: liczba, url, summary: copy.zdarzenia.retencja.replace("{n}", String(liczba)) });
    },
    usunStareSesje,
    usunStaryAudyt,
    teraz: () => new Date(),
  };
}

/** Wspólny zapis audytu dla crona i dla „Sprawdź teraz" w Ustawieniach. */
export async function odnotujWynikRetencji(wynik: WynikCronaRetencji, aktor: { actor_kind: "system" | "zespol"; actor_id?: string; actor_label?: string }): Promise<void> {
  await Promise.all([...wynik.zgloszone, ...wynik.ponowione].map((id) => zapiszAudyt({ ...aktor, action: "system.retencja_zgloszona", entity: "package", entity_id: id, meta: { prog: wynik.prog, miesiace: wynik.miesiace } })));
  if (wynik.sesjeUsuniete > 0 || wynik.audytUsuniety > 0) {
    await zapiszAudyt({ ...aktor, action: "system.retencja_sprzatanie", meta: { sesje: wynik.sesjeUsuniete, audyt: wynik.audytUsuniety } });
  }
}
