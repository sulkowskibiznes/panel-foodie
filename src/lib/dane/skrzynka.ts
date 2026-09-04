import "server-only";
import type { Database } from "@/lib/db-types";
import { supabaseSerwer } from "@/lib/supabase/server";

type Enums = Database["public"]["Enums"];

export type TypUwagi = Enums["item_type"] | "pakiet";

/** Uwaga klienta w skrzynce (SPEC rozdz. 12.5). DTO, nigdy surowy wiersz. */
export type UwagaWSkrzynce = {
  id: string;
  tresc: string;
  utworzonoO: string;
  autorNazwa: string;
  nieprzeczytana: boolean;
  poAkceptacji: boolean;
  runda: number;
  pakietId: string;
  pakietTytul: string;
  statusPakietu: Enums["package_status"];
  okres: { rok: number; miesiac: number };
  klient: { id: string; slug: string; name: string };
  materialId: string | null;
  materialTytul: string | null;
  typ: TypUwagi;
  wariantId: string | null;
  /** Odpowiedzi zespołu w tym samym wątku (ten sam materiał) po tej uwadze. */
  odpowiedzi: number;
};

type Wiersz = {
  id: string;
  body: string;
  created_at: string;
  author_label: string | null;
  seen_by_team_at: string | null;
  after_approval: boolean;
  round: number;
  item_id: string | null;
  variant_id: string | null;
  package_id: string;
  kontakt: { name: string } | null;
  packages: { id: string; title: string | null; status: Enums["package_status"]; period_year: number; period_month: number; client_id: string; clients: { id: string; slug: string; name: string } };
  package_items: { type: Enums["item_type"]; title: string | null; position: number } | null;
};

const KOLUMNY =
  "id, body, created_at, author_label, seen_by_team_at, after_approval, round, item_id, variant_id, package_id, kontakt:client_contacts!comments_author_contact_id_fkey(name), packages!inner(id, title, status, period_year, period_month, client_id, clients!inner(id, slug, name)), package_items(type, title, position)";

export type FiltrySkrzynki = { clientId?: string | null; typ?: TypUwagi | null };

/**
 * Nierozwiązane uwagi klientów ze wszystkich pakietów widocznych dla członka zespołu (`clientIds` null = wszyscy).
 * Wywołujący ogranicza `clientIds` wg roli (klienci-zespolu.ts); tu żadnych decyzji o dostępie.
 */
export async function pobierzNierozwiazaneUwagi(clientIds: string[] | null, filtry: FiltrySkrzynki = {}): Promise<UwagaWSkrzynce[]> {
  const db = supabaseSerwer();
  let zapytanie = db.from("comments").select(KOLUMNY).eq("author_kind", "klient").is("resolved_at", null).order("created_at", { ascending: false }).limit(500);
  if (clientIds) {
    if (clientIds.length === 0) return [];
    zapytanie = zapytanie.in("packages.client_id", clientIds);
  }
  if (filtry.clientId) zapytanie = zapytanie.eq("packages.client_id", filtry.clientId);
  const { data, error } = await zapytanie;
  if (error) throw new Error(`pobierzNierozwiazaneUwagi: ${error.message}`);
  const wiersze = (data ?? []) as unknown as Wiersz[];
  const idsPakietow = [...new Set(wiersze.map((w) => w.package_id))];
  const { data: odpowiedzi } = idsPakietow.length ? await db.from("comments").select("package_id, item_id, created_at").eq("author_kind", "zespol").in("package_id", idsPakietow) : { data: [] as { package_id: string; item_id: string | null; created_at: string }[] };
  const lista = wiersze.map<UwagaWSkrzynce>((w) => ({
    id: w.id,
    tresc: w.body,
    utworzonoO: w.created_at,
    autorNazwa: w.author_label ?? w.kontakt?.name ?? "",
    nieprzeczytana: w.seen_by_team_at === null,
    poAkceptacji: w.after_approval,
    runda: w.round,
    pakietId: w.packages.id,
    pakietTytul: w.packages.title ?? "",
    statusPakietu: w.packages.status,
    okres: { rok: w.packages.period_year, miesiac: w.packages.period_month },
    klient: w.packages.clients,
    materialId: w.item_id,
    materialTytul: w.package_items ? (w.package_items.title ?? `${w.package_items.type} ${w.package_items.position}`) : null,
    typ: w.package_items?.type ?? "pakiet",
    wariantId: w.variant_id,
    odpowiedzi: (odpowiedzi ?? []).filter((o) => o.package_id === w.package_id && o.item_id === w.item_id && o.created_at > w.created_at).length,
  }));
  return filtry.typ ? lista.filter((u) => u.typ === filtry.typ) : lista;
}

/** Liczba nieprzeczytanych, nierozwiązanych uwag klientów (plakietka w nawigacji). */
export async function liczNieprzeczytaneUwagi(clientIds: string[] | null): Promise<number> {
  if (clientIds && clientIds.length === 0) return 0;
  let zapytanie = supabaseSerwer().from("comments").select("id, packages!inner(client_id)", { count: "exact", head: true }).eq("author_kind", "klient").is("resolved_at", null).is("seen_by_team_at", null);
  if (clientIds) zapytanie = zapytanie.in("packages.client_id", clientIds);
  const { count, error } = await zapytanie;
  if (error) throw new Error(`liczNieprzeczytaneUwagi: ${error.message}`);
  return count ?? 0;
}

/** Skrzynka otwarta = uwagi z listy przeczytane przez zespół (licznik na pulpicie i w nawigacji spada). */
export async function oznaczPrzeczytaneWSkrzynce(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabaseSerwer().from("comments").update({ seen_by_team_at: new Date().toISOString() }).in("id", ids).is("seen_by_team_at", null);
  if (error) console.error("[skrzynka] nie oznaczono przeczytanych", error.message);
}
