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

/** Kandydaci do przypisania przy zakładaniu klienta: aktywni content creatorzy i media buyerzy. */
export async function pobierzZespolDoPrzypisania(): Promise<Array<Opiekun & { role: "content_creator" | "media_buyer" }>> {
  const { data, error } = await supabaseSerwer().from("team_members").select("id, name, role").eq("active", true).in("role", ["content_creator", "media_buyer"]).order("name");
  if (error) throw new Error(`pobierzZespolDoPrzypisania: ${error.message}`);
  return (data ?? []) as Array<Opiekun & { role: "content_creator" | "media_buyer" }>;
}

export type WynikUtworzenia = { ok: true; id: string } | { ok: false; powod: "slugZajety" | "inny" };

/**
 * Nowy klient z lokalami, osobami kontaktowymi i przypisaniami w jednej transakcji (funkcja SQL `utworz_klienta`,
 * plan 1.8): błąd w dowolnym kroku cofa całość. Twórca spoza ról widzących wszystkich (csm) dostaje przypisanie,
 * żeby po utworzeniu od razu widział kartę (czyWidziKlienta: opiekun albo client_assignments).
 */
export async function utworzKlienta(d: DaneNowegoKlienta, tworca: CzlonekZespolu): Promise<WynikUtworzenia> {
  const przypisani = new Set(d.przypisani);
  if (tworca.role !== "admin" && tworca.role !== "sales" && d.opiekun_id !== tworca.id) przypisani.add(tworca.id);
  const { data, error } = await supabaseSerwer().rpc("utworz_klienta", {
    p: {
      name: d.name,
      slug: d.slug,
      category: d.category,
      tier: d.tier,
      monthly_amount_net: d.monthly_amount_net === null ? "" : String(d.monthly_amount_net),
      slack_channel: d.slack_channel ?? "",
      cooperation_started_on: d.cooperation_started_on ?? "",
      opiekun_id: d.opiekun_id ?? "",
      lokale: d.lokale,
      kontakty: d.kontakty,
      przypisani: [...przypisani],
    },
  });
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, powod: "slugZajety" };
    console.error("[klienci] utworzKlienta", error?.message);
    return { ok: false, powod: "inny" };
  }
  return { ok: true, id: data };
}
