import "server-only";
import type { KrokWdrozenia, TwojPakiet } from "@/lib/dto/klient";
import { supabaseSerwer } from "@/lib/supabase/server";

/**
 * „Twój pakiet" (SPEC rozdz. 5.7): pakiet, kwota, lokale, opiekun (imię plus kanał kontaktu dla klienta,
 * nigdy e-mail prywatny ani telefon z team_members), data startu współpracy. Zero brandingu klienta.
 */
export async function pobierzTwojPakiet(clientId: string): Promise<TwojPakiet | null> {
  const { data, error } = await supabaseSerwer()
    .from("clients")
    .select("tier, category, monthly_amount_net, cooperation_started_on, opiekun:team_members!clients_opiekun_id_fkey(name, client_contact, active), locations(name, position)")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(`pobierzTwojPakiet: ${error.message}`);
  if (!data) return null;
  const surowy = data.opiekun as unknown as { name: string; client_contact: string | null; active: boolean } | { name: string; client_contact: string | null; active: boolean }[] | null;
  const opiekun = Array.isArray(surowy) ? (surowy[0] ?? null) : surowy;
  return {
    tier: data.tier,
    kategoria: data.category,
    kwotaNetto: data.monthly_amount_net === null ? null : Number(data.monthly_amount_net),
    lokale: [...data.locations].sort((a, b) => a.position - b.position).map((l) => l.name),
    opiekun: opiekun && opiekun.active ? { imie: opiekun.name, kontakt: opiekun.client_contact?.trim() || null } : null,
    wspolpracaOd: data.cooperation_started_on,
  };
}

/** Wdrożenie (SPEC rozdz. 11): kroki klienta, tylko do odczytu. */
export async function pobierzKrokiWdrozenia(clientId: string): Promise<KrokWdrozenia[]> {
  const { data, error } = await supabaseSerwer().from("onboarding_steps").select("id, position, title, body_md, form_url, external_url, done_at").eq("client_id", clientId).order("position");
  if (error) throw new Error(`pobierzKrokiWdrozenia: ${error.message}`);
  return (data ?? []).map((k) => ({ id: k.id, pozycja: k.position, tytul: k.title, opis: k.body_md, formUrl: k.form_url, externalUrl: k.external_url, zrobionoO: k.done_at }));
}
