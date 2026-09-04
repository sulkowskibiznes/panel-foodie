import "server-only";
import type { CzlonekZespolu } from "@/lib/auth-zespol";
import type { Database } from "@/lib/db-types";
import { supabaseSerwer } from "@/lib/supabase/server";
import { WIDZI_WSZYSTKICH_KLIENTOW } from "@/lib/uprawnienia";

type Kategoria = Database["public"]["Enums"]["client_category"];
type Tier = Database["public"]["Enums"]["package_tier"];

export type KlientNaPulpicie = {
  id: string;
  slug: string;
  name: string;
  category: Kategoria;
  tier: Tier;
  monthly_amount_net: number | null;
  demo: boolean;
  doAkceptacji: number;
  aktywneLinki: number;
};

/** Id klientów przypisanych do członka zespołu (client_assignments) albo pod jego opieką, niezależnie od roli. */
export async function pobierzIdsMoichKlientow(memberId: string): Promise<string[]> {
  const db = supabaseSerwer();
  const [{ data: przypisania }, { data: podOpieka }] = await Promise.all([db.from("client_assignments").select("client_id").eq("team_member_id", memberId), db.from("clients").select("id").eq("opiekun_id", memberId)]);
  return [...new Set([...(przypisania ?? []).map((p) => p.client_id), ...(podOpieka ?? []).map((k) => k.id)])];
}

/** Zakres klientów do zapytań (pulpit, skrzynka): null = wszyscy (admin, sales), inaczej lista id wg przypisań. */
export async function zakresKlientow(czlonek: CzlonekZespolu): Promise<string[] | null> {
  return WIDZI_WSZYSTKICH_KLIENTOW.includes(czlonek.role) ? null : pobierzIdsMoichKlientow(czlonek.id);
}

/** Klienci widoczni dla członka zespołu: admin i sales wszyscy aktywni, reszta przypisani albo pod opieką. */
export async function pobierzKlientowDla(czlonek: CzlonekZespolu): Promise<KlientNaPulpicie[]> {
  const db = supabaseSerwer();
  let zapytanie = db.from("clients").select("id, slug, name, category, tier, monthly_amount_net, demo").eq("status", "aktywny").order("name");
  if (!WIDZI_WSZYSTKICH_KLIENTOW.includes(czlonek.role)) {
    const { data: przypisania } = await db.from("client_assignments").select("client_id").eq("team_member_id", czlonek.id);
    const { data: podOpieka } = await db.from("clients").select("id").eq("opiekun_id", czlonek.id);
    const ids = [...new Set([...(przypisania ?? []).map((p) => p.client_id), ...(podOpieka ?? []).map((k) => k.id)])];
    if (ids.length === 0) return [];
    zapytanie = zapytanie.in("id", ids);
  }
  const { data: klienci, error } = await zapytanie;
  if (error) throw new Error(`pobierzKlientowDla: ${error.message}`);
  if (!klienci || klienci.length === 0) return [];
  const ids = klienci.map((k) => k.id);
  const [{ data: pakiety }, { data: linki }] = await Promise.all([
    db.from("packages").select("client_id").in("client_id", ids).eq("status", "do_akceptacji"),
    db.from("access_links").select("client_id").in("client_id", ids).is("revoked_at", null),
  ]);
  const licz = (wiersze: { client_id: string }[] | null, id: string) => (wiersze ?? []).filter((w) => w.client_id === id).length;
  return klienci.map((k) => ({ ...k, doAkceptacji: licz(pakiety, k.id), aktywneLinki: licz(linki, k.id) }));
}

export type KartaKlienta = {
  id: string;
  slug: string;
  name: string;
  category: Kategoria;
  tier: Tier;
  monthly_amount_net: number | null;
  /** Klient demonstracyjny: bez linków dostępu i faktur (SPEC rozdz. 20 poz. 21). */
  demo: boolean;
  slack_channel: string | null;
  cooperation_started_on: string | null;
  opiekun: { name: string } | null;
  locations: { id: string; name: string; city: string | null; fb_page_name: string }[];
  client_contacts: { id: string; name: string; role_label: string | null; is_primary: boolean }[];
};

/** Karta klienta po slugu. Wywołujący MUSI potem zrobić assertTeamClientAccess. */
export async function pobierzKlientaPoSlugu(slug: string): Promise<KartaKlienta | null> {
  const { data } = await supabaseSerwer()
    .from("clients")
    .select(
      "id, slug, name, category, tier, monthly_amount_net, demo, slack_channel, cooperation_started_on, opiekun:team_members!clients_opiekun_id_fkey(name), locations(id, name, city, fb_page_name, position), client_contacts(id, name, role_label, is_primary)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const opiekun = data.opiekun as unknown as { name: string } | { name: string }[] | null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    category: data.category,
    tier: data.tier,
    monthly_amount_net: data.monthly_amount_net,
    demo: data.demo,
    slack_channel: data.slack_channel,
    cooperation_started_on: data.cooperation_started_on,
    opiekun: Array.isArray(opiekun) ? (opiekun[0] ?? null) : opiekun,
    locations: [...data.locations].sort((a, b) => a.position - b.position).map(({ id, name, city, fb_page_name }) => ({ id, name, city, fb_page_name })),
    client_contacts: data.client_contacts,
  };
}
