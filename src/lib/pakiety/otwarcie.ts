import "server-only";
import { zapiszAudyt } from "@/lib/audyt";
import { dodajDoOutbox } from "@/lib/outbox";
import { adresPakietuZespolu, pobierzPakietDoPrzejscia } from "@/lib/pakiety/baza";
import { zbudujPayloadOutbox, type Aktor } from "@/lib/pakiety/przejscia";
import { supabaseSerwer } from "@/lib/supabase/server";

/**
 * Pierwsze otwarcie pakietu przez klienta w tej rundzie (SPEC rozdz. 6.4, 15): `first_opened_at`,
 * zdarzenie `otwarty`, `pakiet.otwarty` w outbox i wpis w audycie. Warunek `is null` w bazie sprawia,
 * że równoległe żądania zapiszą to raz. Wysyłka i wysyłka v2 zerują `first_opened_at`.
 */
export async function odnotujOtwarciePakietu(pakietId: string, aktor: Extract<Aktor, { rodzaj: "klient" }>, info: { ipHash: string; ua: string }): Promise<boolean> {
  const db = supabaseSerwer();
  const teraz = new Date().toISOString();
  const { data, error } = await db.from("packages").update({ first_opened_at: teraz }).eq("id", pakietId).is("first_opened_at", null).neq("status", "szkic").select("id");
  if (error) {
    console.error("[pakiet] nie zapisano otwarcia", error.message);
    return false;
  }
  if ((data ?? []).length === 0) return false;
  const pakiet = await pobierzPakietDoPrzejscia(pakietId);
  if (!pakiet) return false;
  await Promise.all([
    db.from("package_events").insert({ package_id: pakietId, kind: "otwarty", actor_kind: "klient", actor_id: aktor.contactId, payload: { round: pakiet.round, link_id: aktor.linkId, aktor: aktor.label } }),
    dodajDoOutbox("pakiet.otwarty", zbudujPayloadOutbox("pakiet.otwarty", pakiet, aktor, pakiet.round, adresPakietuZespolu(pakiet.klient.slug, pakiet.id))),
    zapiszAudyt({ actor_kind: "klient", actor_id: aktor.contactId, actor_label: aktor.label, action: "klient.pakiet_otwarty", entity: "package", entity_id: pakietId, client_id: pakiet.clientId, ip_hash: info.ipHash, ua: info.ua, meta: { round: pakiet.round } }),
  ]);
  return true;
}

/** „Obejrzano 12 z 19" (SPEC rozdz. 6.2): materiał liczy się raz na link, po 2 s w polu widzenia. */
export async function odnotujObejrzenieMaterialu(pakietId: string, materialId: string, linkId: string): Promise<boolean> {
  const db = supabaseSerwer();
  const { data: material } = await db.from("package_items").select("id").eq("id", materialId).eq("package_id", pakietId).maybeSingle();
  if (!material) return false;
  const { error } = await db.from("item_views").upsert({ item_id: materialId, access_link_id: linkId }, { onConflict: "item_id,access_link_id", ignoreDuplicates: true });
  if (error) {
    console.error("[pakiet] nie zapisano obejrzenia", error.message);
    return false;
  }
  return true;
}
