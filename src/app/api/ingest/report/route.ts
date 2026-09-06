import { NextResponse } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { zapiszRaport } from "@/lib/dane/raporty";
import { env } from "@/lib/env";
import { porownajStale } from "@/lib/krypto";
import { domyslnyTytulRaportu, parsujOkresRaportu, schematWebhookaRaportu, wybierzLokalRaportu } from "@/lib/raporty/walidacja";
import { supabaseSerwer } from "@/lib/supabase/server";

/**
 * Webhook rejestrujący raporty (SPEC rozdz. 9): `POST /api/ingest/report` z `Authorization: Bearer INGEST_TOKEN`,
 * ciało `{ client_slug, period, url, title?, cooperation_month?, location? }`. Podpinany w Zapierze do wiadomości
 * ze Slacka. Host adresu tylko `raporty.foodiemedia.pl`; ten sam miesiąc i lokal nadpisuje poprzedni link.
 * Odpowiedzi: 401 bez tokenu, 400 złe ciało, 404 nieznany klient, 422 nieznany albo brakujący lokal (kat1), 503 webhook wyłączony.
 */
export async function POST(request: Request) {
  const token = env().INGEST_TOKEN;
  if (!token) return NextResponse.json({ error: "ingest_wylaczony" }, { status: 503 });
  const naglowek = request.headers.get("authorization") ?? "";
  const oczekiwany = `Bearer ${token}`;
  if (naglowek.length !== oczekiwany.length || !porownajStale(naglowek, oczekiwany)) return new NextResponse(null, { status: 401 });

  let cialo: unknown;
  try {
    cialo = await request.json();
  } catch {
    return NextResponse.json({ error: "zle_cialo" }, { status: 400 });
  }
  const parsed = schematWebhookaRaportu.safeParse(cialo);
  if (!parsed.success) return NextResponse.json({ error: "walidacja", pola: parsed.error.issues.map((i) => ({ pole: i.path.join("."), problem: i.message })) }, { status: 400 });
  const okres = parsujOkresRaportu(parsed.data.period);
  if (!okres) return NextResponse.json({ error: "walidacja", pola: [{ pole: "period", problem: "YYYY-MM" }] }, { status: 400 });

  const { data: klient } = await supabaseSerwer().from("clients").select("id, category, locations(id, name)").eq("slug", parsed.data.client_slug).maybeSingle();
  if (!klient) return NextResponse.json({ error: "nieznany_klient" }, { status: 404 });
  const lokal = wybierzLokalRaportu(klient.category, klient.locations, parsed.data.location);
  if (!lokal.ok) return NextResponse.json({ error: lokal.powod, lokale: klient.locations.map((l) => l.name) }, { status: 422 });

  const zapis = await zapiszRaport({
    clientId: klient.id,
    locationId: lokal.locationId,
    rok: okres.rok,
    miesiac: okres.miesiac,
    tytul: parsed.data.title?.trim() || null,
    domyslnyTytul: domyslnyTytulRaportu(okres),
    url: parsed.data.url,
    miesiacWspolpracy: parsed.data.cooperation_month ?? null,
    zrodlo: "webhook",
  });
  await zapiszAudyt({ actor_kind: "system", action: "system.raport_webhook", entity: "report", entity_id: zapis.id, client_id: klient.id, meta: { period: parsed.data.period, location_id: lokal.locationId, utworzony: zapis.utworzony } });
  return NextResponse.json({ ok: true, report_id: zapis.id, created: zapis.utworzony });
}
