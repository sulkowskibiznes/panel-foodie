import "server-only";
import type { Database } from "@/lib/db-types";
import type { RaportDlaKlienta } from "@/lib/dto/klient";
import { supabaseSerwer } from "@/lib/supabase/server";

type Zrodlo = Database["public"]["Enums"]["report_source"];
type WierszRaportu = {
  id: string;
  client_id: string;
  location_id: string | null;
  period_year: number;
  period_month: number;
  title: string;
  url: string;
  cooperation_month: number | null;
  published_at: string;
  source: Zrodlo;
  locations: { name: string } | null;
};

const KOLUMNY = "id, client_id, location_id, period_year, period_month, title, url, cooperation_month, published_at, source, locations(name)";

export type RaportZespolu = RaportDlaKlienta & { lokalId: string | null; zrodlo: Zrodlo };

function naDto(w: WierszRaportu): RaportZespolu {
  return {
    id: w.id,
    rok: w.period_year,
    miesiac: w.period_month,
    tytul: w.title,
    url: w.url,
    miesiacWspolpracy: w.cooperation_month,
    nazwaLokalu: w.locations?.name ?? null,
    lokalId: w.location_id,
    opublikowanoO: w.published_at,
    zrodlo: w.source,
  };
}

/** Raporty klienta od najnowszego (SPEC rozdz. 5.5); kat1 z kilkoma restauracjami ma raport per lokal. */
export async function pobierzRaportyKlienta(clientId: string): Promise<RaportZespolu[]> {
  const { data, error } = await supabaseSerwer().from("reports").select(KOLUMNY).eq("client_id", clientId).order("period_year", { ascending: false }).order("period_month", { ascending: false }).order("published_at", { ascending: false });
  if (error) throw new Error(`pobierzRaportyKlienta: ${error.message}`);
  return ((data ?? []) as unknown as WierszRaportu[]).map(naDto);
}

export async function pobierzNajnowszyRaport(clientId: string): Promise<RaportDlaKlienta | null> {
  const [pierwszy] = await pobierzRaportyKlienta(clientId);
  return pierwszy ?? null;
}

export type NowyRaport = {
  clientId: string;
  locationId: string | null;
  rok: number;
  miesiac: number;
  /** null = bez tytułu: przy nadpisaniu zostaje stary, przy nowym wierszu `domyslnyTytul`. */
  tytul: string | null;
  domyslnyTytul: string;
  url: string;
  /** null = nie podano: przy nadpisaniu zostaje stary numer. */
  miesiacWspolpracy: number | null;
  zrodlo: Zrodlo;
};

/**
 * Jeden raport na (klient, lokal, miesiąc): ponowne dodanie tego samego miesiąca nadpisuje link (webhook z Zapiera
 * bywa wysyłany więcej niż raz), a tytuł i numer miesiąca współpracy tylko wtedy, gdy przyszły w nowym wywołaniu.
 * `utworzony` mówi, czy to nowy wiersz.
 */
export async function zapiszRaport(n: NowyRaport): Promise<{ id: string; utworzony: boolean }> {
  const db = supabaseSerwer();
  let istniejacy = db.from("reports").select("id, title, cooperation_month").eq("client_id", n.clientId).eq("period_year", n.rok).eq("period_month", n.miesiac);
  istniejacy = n.locationId ? istniejacy.eq("location_id", n.locationId) : istniejacy.is("location_id", null);
  const { data: stary, error: bladOdczytu } = await istniejacy.maybeSingle();
  if (bladOdczytu) throw new Error(`zapiszRaport: ${bladOdczytu.message}`);
  const opublikowano = new Date().toISOString();
  if (stary) {
    const { error } = await db.from("reports").update({ title: n.tytul ?? stary.title, url: n.url, cooperation_month: n.miesiacWspolpracy ?? stary.cooperation_month, source: n.zrodlo, published_at: opublikowano }).eq("id", stary.id);
    if (error) throw new Error(`zapiszRaport (update): ${error.message}`);
    return { id: stary.id, utworzony: false };
  }
  const { data, error } = await db
    .from("reports")
    .insert({ client_id: n.clientId, location_id: n.locationId, period_year: n.rok, period_month: n.miesiac, title: n.tytul ?? n.domyslnyTytul, url: n.url, cooperation_month: n.miesiacWspolpracy, source: n.zrodlo, published_at: opublikowano })
    .select("id")
    .single();
  if (error || !data) throw new Error(`zapiszRaport (insert): ${error?.message ?? "brak wiersza"}`);
  return { id: data.id, utworzony: true };
}

/** Usunięcie z warunkiem na klienta: cudzy albo nieistniejący raport = 0 wierszy. */
export async function usunRaport(id: string, clientId: string): Promise<boolean> {
  const { data, error } = await supabaseSerwer().from("reports").delete().eq("id", id).eq("client_id", clientId).select("id");
  if (error) throw new Error(`usunRaport: ${error.message}`);
  return (data ?? []).length === 1;
}

/** Ostatni numer miesiąca współpracy w raportach klienta: podpowiedź w formularzu. */
export async function ostatniMiesiacWspolpracyRaportu(clientId: string): Promise<number | null> {
  const { data } = await supabaseSerwer().from("reports").select("cooperation_month").eq("client_id", clientId).not("cooperation_month", "is", null).order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(1).maybeSingle();
  return data?.cooperation_month ?? null;
}
