import "server-only";
import type { TierPakietu, UslugaDlaKlienta } from "@/lib/dto/klient";
import { supabaseSerwer } from "@/lib/supabase/server";

export const MAKS_DLUGOSC_ZAINTERESOWANIA = 1000;

/** Karty usług (SPEC rozdz. 5.8): aktywne, widoczne dla pakietu klienta, z datą ostatniego zgłoszenia tego klienta. */
export async function pobierzUslugiDlaKlienta(clientId: string, tier: TierPakietu): Promise<UslugaDlaKlienta[]> {
  const db = supabaseSerwer();
  const [{ data: uslugi, error }, { data: zgloszenia }] = await Promise.all([
    db.from("services").select("id, slug, name, short_desc, icon, cta_label, visible_for_tiers").eq("active", true).order("position"),
    db.from("service_interests").select("service_id, created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
  ]);
  if (error) throw new Error(`pobierzUslugiDlaKlienta: ${error.message}`);
  const ostatnie = new Map<string, string>();
  for (const z of zgloszenia ?? []) if (!ostatnie.has(z.service_id)) ostatnie.set(z.service_id, z.created_at);
  return (uslugi ?? [])
    .filter((u) => u.visible_for_tiers.includes(tier))
    .map((u) => ({ id: u.id, slug: u.slug, nazwa: u.name, opis: u.short_desc, ikona: u.icon, cta: u.cta_label, zgloszonoO: ostatnie.get(u.id) ?? null }));
}

export async function pobierzUsluge(id: string): Promise<{ id: string; nazwa: string; slug: string } | null> {
  const { data } = await supabaseSerwer().from("services").select("id, name, slug").eq("id", id).eq("active", true).maybeSingle();
  return data ? { id: data.id, nazwa: data.name, slug: data.slug } : null;
}

export async function zapiszZainteresowanie(n: { clientId: string; contactId: string | null; serviceId: string; notatka: string | null }): Promise<string> {
  const { data, error } = await supabaseSerwer().from("service_interests").insert({ client_id: n.clientId, contact_id: n.contactId, service_id: n.serviceId, note: n.notatka }).select("id").single();
  if (error || !data) throw new Error(`zapiszZainteresowanie: ${error?.message ?? "brak wiersza"}`);
  return data.id;
}

export type ZainteresowanieZespolu = { id: string; usluga: string; notatka: string | null; osoba: string | null; zgloszonoO: string; zalatwionoO: string | null };

/** Lista dla karty klienta w panelu zespołu: kto, kiedy, o jaką usługę pytał. */
export async function pobierzZainteresowaniaKlienta(clientId: string): Promise<ZainteresowanieZespolu[]> {
  const { data, error } = await supabaseSerwer().from("service_interests").select("id, note, created_at, handled_at, services(name), client_contacts(name)").eq("client_id", clientId).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(`pobierzZainteresowaniaKlienta: ${error.message}`);
  return (data ?? []).map((z) => {
    const usluga = z.services as unknown as { name: string } | null;
    const kontakt = z.client_contacts as unknown as { name: string } | null;
    return { id: z.id, usluga: usluga?.name ?? "", notatka: z.note, osoba: kontakt?.name ?? null, zgloszonoO: z.created_at, zalatwionoO: z.handled_at };
  });
}

export async function oznaczZainteresowanieZalatwione(id: string, clientId: string, memberId: string): Promise<boolean> {
  const { data, error } = await supabaseSerwer().from("service_interests").update({ handled_at: new Date().toISOString(), handled_by: memberId }).eq("id", id).eq("client_id", clientId).is("handled_at", null).select("id");
  if (error) throw new Error(`oznaczZainteresowanieZalatwione: ${error.message}`);
  return (data ?? []).length === 1;
}
