import { randomUUID } from "node:crypto";
import { config as dotenv } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { prostyPdf } from "../../../supabase/seed/pdf";

dotenv({ path: ".env.local" });

/** Pomocnicze do retencji i offboardingu (faza 6): przeglądy, pliki testowe w Storage, stare sesje i audyt. */
function sql() {
  const url = process.env.E2E_DB_URL;
  if (!url) throw new Error("Brak E2E_DB_URL (ustawia go global-setup).");
  return postgres(url, { max: 1 });
}

async function zBaza<T>(fn: (s: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const s = sql();
  try {
    return await fn(s);
  } finally {
    await s.end();
  }
}

export function storageTestowe() {
  const url = process.env.E2E_API_URL;
  const key = process.env.E2E_SECRET_KEY;
  if (!url || !key) throw new Error("Brak E2E_API_URL / E2E_SECRET_KEY (ustawia je global-setup).");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).storage;
}

export type PrzegladTestowy = { id: string; package_id: string | null; client_id: string; decision: string | null; keep_until: string | null; deleted_at: string | null; files_count: number; flagged_at: string };

export async function przegladyPakietu(pakietId: string): Promise<PrzegladTestowy[]> {
  return zBaza((s) => s<PrzegladTestowy[]>`select id, package_id, client_id, decision::text as decision, keep_until::text as keep_until, deleted_at::text as deleted_at, files_count, flagged_at::text as flagged_at from public.retention_reviews where package_id = ${pakietId}`);
}

export async function przegladPoId(id: string): Promise<PrzegladTestowy | null> {
  return zBaza(async (s) => {
    const [w] = await s<PrzegladTestowy[]>`select id, package_id, client_id, decision::text as decision, keep_until::text as keep_until, deleted_at::text as deleted_at, files_count, flagged_at::text as flagged_at from public.retention_reviews where id = ${id}`;
    return w ?? null;
  });
}

export async function ustawOdroczenie(reviewId: string, keepUntil: Date): Promise<void> {
  await zBaza((s) => s`update public.retention_reviews set keep_until = ${keepUntil.toISOString()}::timestamptz where id = ${reviewId}`);
}

export async function pakietIstnieje(id: string): Promise<boolean> {
  return zBaza(async (s) => (await s`select 1 from public.packages where id = ${id}`).length === 1);
}

/** Minimalny PNG 1x1 (klon dzieli ścieżki z seedem, więc przed usunięciem podmieniamy je na własne obiekty). */
const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** Wgrywa trzy obiekty testowe pod prefiksem klienta i przepina na nie wszystkie pliki klonu. Zwraca ścieżki. */
export async function podmienPlikiKlonu(pakietId: string, clientId: string): Promise<string[]> {
  const katalog = `${clientId}/e2e-retencja-${randomUUID()}`;
  const [oryginal, podglad, miniatura] = [`${katalog}/original.png`, `${katalog}/preview.png`, `${katalog}/thumb.png`];
  const sciezki = [oryginal, podglad, miniatura];
  const st = storageTestowe();
  for (const sciezka of sciezki) {
    const wynik = await st.from("materialy").upload(sciezka, PNG_1X1, { contentType: "image/png", upsert: true });
    if (wynik.error) throw new Error(`upload ${sciezka}: ${wynik.error.message}`);
  }
  await zBaza((s) => s`
    update public.item_assets set storage_path = ${oryginal}, preview_path = ${podglad}, thumb_path = ${miniatura}
    where item_id in (select id from public.package_items where package_id = ${pakietId})`);
  return sciezki;
}

/** Obiekt testowy zgodny z typami dopuszczonymi w buckecie: PDF dla faktur i dokumentów, PNG dla reszty. */
export async function wgrajObiektTestowy(bucket: string, sciezka: string): Promise<void> {
  const pdf = sciezka.endsWith(".pdf");
  const wynik = await storageTestowe()
    .from(bucket)
    .upload(sciezka, pdf ? prostyPdf("Test E2E", sciezka) : PNG_1X1, { contentType: pdf ? "application/pdf" : "image/png", upsert: true });
  if (wynik.error) throw new Error(`upload ${bucket}/${sciezka}: ${wynik.error.message}`);
}

export async function czyObiektIstnieje(bucket: string, sciezka: string): Promise<boolean> {
  const i = sciezka.lastIndexOf("/");
  const folder = sciezka.slice(0, i);
  const nazwa = sciezka.slice(i + 1);
  const { data, error } = await storageTestowe().from(bucket).list(folder, { limit: 1000, search: nazwa });
  if (error) throw new Error(`list ${bucket}/${folder}: ${error.message}`);
  return (data ?? []).some((o) => o.name === nazwa);
}

/** Sesja linku unieważniona `dniTemu` dni temu (cron retencji ma ją skasować po 90 dniach). */
export async function wstawStaraSesje(linkId: string, dniTemu: number): Promise<string> {
  return zBaza(async (s) => {
    const [w] = await s<{ id: string }[]>`
      insert into public.client_sessions (access_link_id, session_hash, created_at, rotated_at, last_seen_at, expires_at, revoked_at)
      values (${linkId}, ${"e2e-" + randomUUID()}, now() - make_interval(days => ${dniTemu + 1}), now() - make_interval(days => ${dniTemu + 1}),
        now() - make_interval(days => ${dniTemu + 1}), now() - make_interval(days => ${dniTemu}), now() - make_interval(days => ${dniTemu}))
      returning id`;
    if (!w) throw new Error("Nie udało się wstawić sesji");
    return w.id;
  });
}

export async function sesjaIstnieje(id: string): Promise<boolean> {
  return zBaza(async (s) => (await s`select 1 from public.client_sessions where id = ${id}`).length === 1);
}

export async function wstawStaryAudyt(miesiecyTemu: number, akcja: string): Promise<number> {
  return zBaza(async (s) => {
    const [w] = await s<{ id: number }[]>`
      insert into public.audit_log (actor_kind, action, meta, created_at)
      values ('system', ${akcja}, '{}'::jsonb, now() - make_interval(months => ${miesiecyTemu}))
      returning id`;
    if (!w) throw new Error("Nie udało się wstawić audytu");
    return w.id;
  });
}

export async function audytIstnieje(id: number): Promise<boolean> {
  return zBaza(async (s) => (await s`select 1 from public.audit_log where id = ${id}`).length === 1);
}

export async function usunAudytTestowy(akcja: string): Promise<void> {
  await zBaza((s) => s`delete from public.audit_log where action = ${akcja}`);
}

export async function liczbaZdarzenRetencjiOd(od: Date): Promise<number> {
  return zBaza(async (s) => {
    const [w] = await s<{ n: number }[]>`select count(*)::int as n from public.outbox where event = 'retencja.do_przegladu' and created_at >= ${od.toISOString()}::timestamptz`;
    return w?.n ?? 0;
  });
}

export async function usunZdarzeniaRetencjiOd(od: Date): Promise<void> {
  await zBaza((s) => s`delete from public.outbox where event = 'retencja.do_przegladu' and created_at >= ${od.toISOString()}::timestamptz`);
}

export async function wpisyAudytuPoEncji(entityId: string, action: string): Promise<number> {
  return zBaza(async (s) => {
    const [w] = await s<{ n: number }[]>`select count(*)::int as n from public.audit_log where entity_id = ${entityId}::uuid and action = ${action}`;
    return w?.n ?? 0;
  });
}
