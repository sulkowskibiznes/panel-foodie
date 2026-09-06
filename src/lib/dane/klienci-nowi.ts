import "server-only";
import type { CzlonekZespolu } from "@/lib/auth-zespol";
import type { DaneNowegoKlienta } from "@/lib/klienci/nowy";
import { supabaseSerwer } from "@/lib/supabase/server";

export type Opiekun = { id: string; name: string };

/** Kandydaci na opiekuna: aktywni admini i csm (SPEC rozdz. 2: opiekun to osoba, którą klient widzi w „Twój pakiet"). */
export async function pobierzOpiekunow(): Promise<Opiekun[]> {
  const { data, error } = await supabaseSerwer().from("team_members").select("id, name").eq("active", true).in("role", ["admin", "csm"]).order("name");
  if (error) throw new Error(`pobierzOpiekunow: ${error.message}`);
  return data ?? [];
}

export type WynikUtworzenia = { ok: true; id: string } | { ok: false; powod: "slugZajety" | "inny" };

/**
 * Nowy klient z lokalami i osobami kontaktowymi. Twórca spoza ról widzących wszystkich dostaje przypisanie,
 * żeby po utworzeniu od razu widział kartę (czyWidziKlienta: opiekun albo client_assignments).
 */
export async function utworzKlienta(d: DaneNowegoKlienta, tworca: CzlonekZespolu): Promise<WynikUtworzenia> {
  const db = supabaseSerwer();
  const { data: klient, error } = await db
    .from("clients")
    .insert({
      name: d.name,
      slug: d.slug,
      category: d.category,
      tier: d.tier,
      monthly_amount_net: d.monthly_amount_net,
      extra_locations_count: Math.max(0, d.lokale.length - 1),
      slack_channel: d.slack_channel,
      cooperation_started_on: d.cooperation_started_on,
      opiekun_id: d.opiekun_id,
    })
    .select("id")
    .single();
  if (error || !klient) {
    if (error?.code === "23505") return { ok: false, powod: "slugZajety" };
    console.error("[klienci] utworzKlienta", error?.message);
    return { ok: false, powod: "inny" };
  }
  const { error: bladLokali } = await db.from("locations").insert(d.lokale.map((l, i) => ({ client_id: klient.id, name: l.name, city: l.city, fb_page_name: l.fb_page_name, ig_handle: l.ig_handle, separate_materials: d.category === "kat1", position: i })));
  if (bladLokali) throw new Error(`utworzKlienta (lokale): ${bladLokali.message}`);
  const { error: bladKontaktow } = await db.from("client_contacts").insert(d.kontakty.map((k, i) => ({ client_id: klient.id, name: k.name, role_label: k.role_label, phone: k.phone, email: k.email, is_primary: i === 0 })));
  if (bladKontaktow) throw new Error(`utworzKlienta (kontakty): ${bladKontaktow.message}`);
  if (tworca.role !== "admin" && tworca.role !== "sales" && d.opiekun_id !== tworca.id) {
    await db.from("client_assignments").insert({ client_id: klient.id, team_member_id: tworca.id });
  }
  return { ok: true, id: klient.id };
}
