import "server-only";
import { copy } from "@/lib/copy";
import { pobierzUstawieniaAutoAkceptacji } from "@/lib/dane/ustawienia";
import type { Database } from "@/lib/db-types";
import { env } from "@/lib/env";
import { sha256Hex } from "@/lib/krypto";
import { dodajDoOutbox } from "@/lib/outbox";
import { wykonajPrzejscie, type Aktor, type KontrolaWysylki, type PakietDoPrzejscia, type Przejscie, type WynikPrzejscia, type ZaleznosciPrzejsc } from "@/lib/pakiety/przejscia";
import { supabaseSerwer } from "@/lib/supabase/server";

type Json = Database["public"]["Tables"]["package_events"]["Insert"]["payload"];

const KOLUMNY_PAKIETU =
  "id, client_id, status, round, title, period_year, period_month, auto_approve_enabled, auto_approve_at, submitted_at, clients!inner(slug, name, slack_channel, auto_approve_hours, auto_approve_default)";

export async function pobierzPakietDoPrzejscia(id: string): Promise<PakietDoPrzejscia | null> {
  const { data, error } = await supabaseSerwer().from("packages").select(KOLUMNY_PAKIETU).eq("id", id).maybeSingle();
  if (error) throw new Error(`pobierzPakietDoPrzejscia: ${error.message}`);
  if (!data) return null;
  const k = data.clients;
  return {
    id: data.id,
    clientId: data.client_id,
    status: data.status,
    round: data.round,
    tytul: data.title ?? "",
    okres: { rok: data.period_year, miesiac: data.period_month },
    autoApproveEnabled: data.auto_approve_enabled,
    autoApproveAt: data.auto_approve_at,
    submittedAt: data.submitted_at,
    klient: { slug: k.slug, name: k.name, slackChannel: k.slack_channel, autoApproveHours: k.auto_approve_hours, autoApproveDefault: k.auto_approve_default },
  };
}

/** Walidacja przed wysyłką (SPEC rozdz. 8): każdy post i relacja z datą; brak kampanii to tylko ostrzeżenie (poz. 29). */
export async function sprawdzPrzedWysylka(pakietId: string): Promise<KontrolaWysylki> {
  const db = supabaseSerwer();
  const [materialy, kampanie] = await Promise.all([
    db.from("package_items").select("type, title, position, publish_at").eq("package_id", pakietId).order("position"),
    db.from("campaigns").select("id", { count: "exact", head: true }).eq("package_id", pakietId),
  ]);
  if (materialy.error) throw new Error(`sprawdzPrzedWysylka: ${materialy.error.message}`);
  const lista = materialy.data ?? [];
  const braki = lista
    .filter((m) => m.type !== "reklama" && !m.publish_at)
    .map((m) => copy.wysylka.brakDaty.replace("{tytul}", m.title ?? `${copy.wysylka.typ[m.type]} ${m.position}`));
  if (lista.length === 0) braki.push(copy.wysylka.bezMaterialow);
  const ostrzezenia: string[] = [];
  if ((kampanie.count ?? 0) === 0) ostrzezenia.push(copy.wysylka.bezKampanii);
  return { braki, ostrzezenia };
}

/** Migawka do zdarzenia `zaakceptowany`: identyfikatory materiałów i plików oraz skróty treści (dowód, co zaakceptowano). */
export async function pobierzMigawkePakietu(pakietId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabaseSerwer()
    .from("package_items")
    .select("id, type, position, title, caption, campaign_id, updated_in_round, item_assets(id, superseded_at), ad_variants(id, kind, value_text, asset_id, location_id)")
    .eq("package_id", pakietId)
    .order("position");
  if (error) throw new Error(`pobierzMigawkePakietu: ${error.message}`);
  return {
    materialy: (data ?? []).map((m) => ({
      id: m.id,
      typ: m.type,
      pozycja: m.position,
      tytul: m.title,
      kampania_id: m.campaign_id,
      runda_zmiany: m.updated_in_round,
      tresc_sha256: m.caption ? sha256Hex(m.caption) : null,
      pliki: m.item_assets.filter((a) => !a.superseded_at).map((a) => a.id),
      warianty: m.ad_variants.map((w) => ({ id: w.id, rodzaj: w.kind, lokal_id: w.location_id, plik_id: w.asset_id, wartosc_sha256: w.value_text ? sha256Hex(w.value_text) : null })),
    })),
  };
}

export function adresPakietuZespolu(slug: string, pakietId: string): string {
  return `${env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/zespol/klienci/${slug}/pakiety/${pakietId}`;
}

export function zaleznosciPrzejsc(): ZaleznosciPrzejsc {
  const db = supabaseSerwer();
  return {
    pobierzPakiet: pobierzPakietDoPrzejscia,
    async zapiszPakiet(id, zeStatusu, zmiany) {
      const { data, error } = await db.from("packages").update(zmiany).eq("id", id).eq("status", zeStatusu).select("id");
      if (error) throw new Error(`zapiszPakiet: ${error.message}`);
      return (data ?? []).length === 1;
    },
    async dodajZdarzenie(z) {
      const { error } = await db.from("package_events").insert({ package_id: z.package_id, kind: z.kind, actor_kind: z.actor_kind, actor_id: z.actor_id, payload: z.payload as Json });
      if (error) throw new Error(`dodajZdarzenie: ${error.message}`);
    },
    dodajDoOutbox,
    async liczUwagiKlienta(pakietId, runda, tylkoNierozwiazane) {
      let zapytanie = db.from("comments").select("id", { count: "exact", head: true }).eq("package_id", pakietId).eq("author_kind", "klient").eq("round", runda);
      if (tylkoNierozwiazane) zapytanie = zapytanie.is("resolved_at", null);
      const { count, error } = await zapytanie;
      if (error) throw new Error(`liczUwagiKlienta: ${error.message}`);
      return count ?? 0;
    },
    sprawdzPrzedWysylka,
    pobierzMigawke: pobierzMigawkePakietu,
    ustawienia: pobierzUstawieniaAutoAkceptacji,
    adresPakietu: (p) => adresPakietuZespolu(p.klient.slug, p.id),
    teraz: () => new Date(),
  };
}

/**
 * JEDYNA droga zmiany statusu pakietu w aplikacji (CLAUDE.md, zasada 9). Handlery nie ustawiają
 * `status` samodzielnie; audyt z IP i UA dopisują po swojej stronie, bo maszyna nie zna żądania.
 */
export function zmienStatusPakietu(pakietId: string, przejscie: Przejscie, aktor: Aktor): Promise<WynikPrzejscia> {
  return wykonajPrzejscie(pakietId, przejscie, aktor, zaleznosciPrzejsc());
}
