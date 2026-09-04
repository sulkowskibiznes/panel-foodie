import "server-only";
import type { Database } from "@/lib/db-types";
import { dodajDoOutbox } from "@/lib/outbox";
import { adresPakietuZespolu, pobierzPakietDoPrzejscia } from "@/lib/pakiety/baza";
import { zbudujPayloadOutbox, type Aktor } from "@/lib/pakiety/przejscia";
import { supabaseSerwer } from "@/lib/supabase/server";

type Json = Database["public"]["Tables"]["package_events"]["Insert"]["payload"];

export const MAKS_DLUGOSC_KOMENTARZA = 4000;

/** Znaki sterujące (poza tabulatorem i nową linią) budowane z kodów, żeby w źródle nie było znaków niewidocznych. */
const znak = (kod: number) => String.fromCharCode(kod);
const ZNAKI_STERUJACE = new RegExp(`[${znak(0)}-${znak(8)}${znak(11)}${znak(12)}${znak(14)}-${znak(31)}${znak(127)}]`, "g");

/** Treść bez znaków sterujących; HTML nie jest interpretowany (React), więc zostaje jako zwykły tekst. */
export function oczyscTrescKomentarza(tresc: string): { ok: true; tresc: string } | { ok: false; powod: "pusty" | "zaDlugi" } {
  const czysta = tresc.replace(ZNAKI_STERUJACE, "").replace(/\r\n/g, "\n").trim();
  if (!czysta) return { ok: false, powod: "pusty" };
  if (czysta.length > MAKS_DLUGOSC_KOMENTARZA) return { ok: false, powod: "zaDlugi" };
  return { ok: true, tresc: czysta };
}

/** Materiał (i wariant) muszą należeć do pakietu, inaczej komentarz nie powstaje. */
export async function sprawdzMaterialWPakiecie(pakietId: string, materialId: string | null, wariantId: string | null): Promise<boolean> {
  const db = supabaseSerwer();
  if (materialId === null) return wariantId === null;
  const { data: material } = await db.from("package_items").select("id").eq("id", materialId).eq("package_id", pakietId).maybeSingle();
  if (!material) return false;
  if (wariantId === null) return true;
  const { data: wariant } = await db.from("ad_variants").select("id").eq("id", wariantId).eq("item_id", materialId).maybeSingle();
  return !!wariant;
}

export type NowyKomentarz = {
  pakietId: string;
  materialId: string | null;
  wariantId: string | null;
  tresc: string;
  aktor: Extract<Aktor, { rodzaj: "klient" | "zespol" }>;
};

/**
 * Zapis komentarza (SPEC rozdz. 6.7) ze zdarzeniem `komentarz`. Uwaga klienta po akceptacji
 * (`after_approval`) idzie dodatkowo do outbox jako `komentarz.po_akceptacji` (rozdz. 6.6); status pakietu
 * się nie zmienia (kryterium 13).
 */
export async function dodajKomentarz(n: NowyKomentarz): Promise<{ id: string; poAkceptacji: boolean; runda: number }> {
  const db = supabaseSerwer();
  const pakiet = await pobierzPakietDoPrzejscia(n.pakietId);
  if (!pakiet) throw new Error("dodajKomentarz: brak pakietu");
  const poAkceptacji = n.aktor.rodzaj === "klient" && (pakiet.status === "zaakceptowany" || pakiet.status === "zaplanowany");
  const teraz = new Date().toISOString();
  const { data, error } = await db
    .from("comments")
    .insert({
      package_id: n.pakietId,
      item_id: n.materialId,
      variant_id: n.wariantId,
      author_kind: n.aktor.rodzaj,
      author_contact_id: n.aktor.rodzaj === "klient" ? n.aktor.contactId : null,
      author_member_id: n.aktor.rodzaj === "zespol" ? n.aktor.memberId : null,
      author_label: n.aktor.rodzaj === "klient" ? n.aktor.label : n.aktor.name,
      body: n.tresc,
      round: pakiet.round,
      after_approval: poAkceptacji,
      // Odpowiedź zespołu jest „przeczytana przez zespół" z definicji; uwaga klienta ma seen_by_team_at = null.
      seen_by_team_at: n.aktor.rodzaj === "zespol" ? teraz : null,
      seen_by_client_at: n.aktor.rodzaj === "klient" ? teraz : null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`dodajKomentarz: ${error?.message ?? "brak wiersza"}`);

  const payload: Record<string, unknown> = {
    comment_id: data.id,
    item_id: n.materialId,
    variant_id: n.wariantId,
    round: pakiet.round,
    after_approval: poAkceptacji,
    aktor: n.aktor.rodzaj === "klient" ? n.aktor.label : n.aktor.name,
  };
  const zdarzenie = await db.from("package_events").insert({
    package_id: n.pakietId,
    kind: "komentarz",
    actor_kind: n.aktor.rodzaj,
    actor_id: n.aktor.rodzaj === "klient" ? n.aktor.contactId : n.aktor.memberId,
    payload: payload as Json,
  });
  if (zdarzenie.error) console.error("[komentarze] nie zapisano zdarzenia", zdarzenie.error.message);
  if (poAkceptacji) {
    await dodajDoOutbox(
      "komentarz.po_akceptacji",
      zbudujPayloadOutbox("komentarz.po_akceptacji", pakiet, n.aktor, pakiet.round, adresPakietuZespolu(pakiet.klient.slug, pakiet.id), { comment_id: data.id, item_id: n.materialId, variant_id: n.wariantId }),
    );
  }
  return { id: data.id, poAkceptacji, runda: pakiet.round };
}

/** „Załatwione" (zespół): wątek przestaje wstrzymywać auto-akceptację. */
export async function oznaczZalatwione(pakietId: string, komentarzId: string, memberId: string): Promise<boolean> {
  const { data, error } = await supabaseSerwer()
    .from("comments")
    .update({ resolved_at: new Date().toISOString(), resolved_by: memberId })
    .eq("id", komentarzId)
    .eq("package_id", pakietId)
    .is("resolved_at", null)
    .select("id");
  if (error) throw new Error(`oznaczZalatwione: ${error.message}`);
  return (data ?? []).length === 1;
}

/** Klient otworzył pakiet: odpowiedzi zespołu przestają być „nieprzeczytane" (plakietki przy zakładkach). */
export async function oznaczPrzeczytanePrzezKlienta(pakietId: string): Promise<void> {
  const { error } = await supabaseSerwer().from("comments").update({ seen_by_client_at: new Date().toISOString() }).eq("package_id", pakietId).eq("author_kind", "zespol").is("seen_by_client_at", null);
  if (error) console.error("[komentarze] nie oznaczono przeczytanych przez klienta", error.message);
}

/** Zespół otworzył pakiet: uwagi klienta przestają liczyć się jako nieprzeczytane na pulpicie (1.4, poz. 26). */
export async function oznaczPrzeczytanePrzezZespol(pakietId: string): Promise<void> {
  const { error } = await supabaseSerwer().from("comments").update({ seen_by_team_at: new Date().toISOString() }).eq("package_id", pakietId).eq("author_kind", "klient").is("seen_by_team_at", null);
  if (error) console.error("[komentarze] nie oznaczono przeczytanych przez zespół", error.message);
}
