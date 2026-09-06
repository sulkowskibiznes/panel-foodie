import { randomUUID } from "node:crypto";
import { config as dotenv } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { prostyPdf } from "../../../supabase/seed/pdf";

dotenv({ path: ".env.local" });

/** Pomocnicze fazy 5: raporty, faktury, dokumenty, zainteresowania usługami, kolejka outbox. Wszystko wprost w bazie. */
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

function storage() {
  const url = process.env.E2E_API_URL;
  const key = process.env.E2E_SECRET_KEY;
  if (!url || !key) throw new Error("Brak E2E_API_URL / E2E_SECRET_KEY (ustawia je global-setup).");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).storage;
}

export function tokenWebhooka(): string {
  const t = process.env.INGEST_TOKEN;
  if (!t) throw new Error("Brak INGEST_TOKEN (ustawia go playwright.config.ts)");
  return t;
}

export function bearerCrona(): string {
  const sekret = process.env.CRON_SECRET;
  if (!sekret) throw new Error("Brak CRON_SECRET w .env.local");
  return `Bearer ${sekret}`;
}

/** Data „YYYY-MM-DD" w Warszawie, przesunięta o `dni` względem dziś. */
export function dataLokalna(dni = 0): string {
  const d = new Date(Date.now() + dni * 86_400_000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// ---------- raporty ----------

export type RaportTestowy = { id: string; title: string; url: string; period_year: number; period_month: number; source: string; location_id: string | null };

export async function raportyKlienta(slug: string): Promise<RaportTestowy[]> {
  return zBaza((s) => s<RaportTestowy[]>`select r.id, r.title, r.url, r.period_year, r.period_month, r.source::text as source, r.location_id from public.reports r join public.clients c on c.id = r.client_id where c.slug = ${slug} order by r.period_year desc, r.period_month desc`);
}

export async function usunRaportyTestowe(prefixUrl: string): Promise<void> {
  await zBaza((s) => s`delete from public.reports where url like ${prefixUrl + "%"}`);
}

// ---------- faktury ----------

export type FakturaTestowa = { id: string; number: string; status: string; paid_at: string | null; pdf_path: string | null; due_date: string };

/** Faktura wprost w bazie, opcjonalnie z PDF-em w buckecie `faktury` (ścieżka bez nazwy klienta). */
export async function wstawFakture(slug: string, o: { numer: string; dueDate: string; issueDate?: string; netto?: number; status?: "do_zaplaty" | "po_terminie" | "oplacona"; pdf?: boolean }): Promise<{ id: string; pdfPath: string | null }> {
  return zBaza(async (s) => {
    const [klient] = await s<{ id: string }[]>`select id from public.clients where slug = ${slug}`;
    if (!klient) throw new Error(`Brak klienta ${slug}`);
    let pdfPath: string | null = null;
    if (o.pdf) {
      pdfPath = `${klient.id}/${randomUUID()}.pdf`;
      const wynik = await storage().from("faktury").upload(pdfPath, prostyPdf(`Faktura ${o.numer}`, "test E2E"), { contentType: "application/pdf", upsert: true });
      if (wynik.error) throw new Error(`upload faktury: ${wynik.error.message}`);
    }
    const netto = o.netto ?? 1000;
    const [w] = await s<{ id: string }[]>`
      insert into public.invoices (client_id, number, issue_date, due_date, amount_net, amount_gross, status, pdf_path)
      values (${klient.id}, ${o.numer}, ${o.issueDate ?? o.dueDate}::date, ${o.dueDate}::date, ${netto}, ${Math.round(netto * 1.23 * 100) / 100}, ${o.status ?? "do_zaplaty"}::public.invoice_status, ${pdfPath})
      returning id`;
    if (!w) throw new Error("Nie udało się wstawić faktury");
    return { id: w.id, pdfPath };
  });
}

export async function fakturaPoNumerze(slug: string, numer: string): Promise<FakturaTestowa | null> {
  return zBaza(async (s) => {
    const [w] = await s<FakturaTestowa[]>`select i.id, i.number, i.status::text as status, i.paid_at::text as paid_at, i.pdf_path, i.due_date::text as due_date from public.invoices i join public.clients c on c.id = i.client_id where c.slug = ${slug} and i.number = ${numer}`;
    return w ?? null;
  });
}

export async function stanFaktury(id: string): Promise<FakturaTestowa | null> {
  return zBaza(async (s) => {
    const [w] = await s<FakturaTestowa[]>`select id, number, status::text as status, paid_at::text as paid_at, pdf_path, due_date::text as due_date from public.invoices where id = ${id}`;
    return w ?? null;
  });
}

export async function usunFakturyTestowe(prefixNumeru: string): Promise<void> {
  await zBaza((s) => s`delete from public.invoices where number like ${prefixNumeru + "%"}`);
}

// ---------- dokumenty ----------

export async function dokumentPoTytule(slug: string, tytul: string): Promise<{ id: string; file_path: string; kind: string } | null> {
  return zBaza(async (s) => {
    const [w] = await s<{ id: string; file_path: string; kind: string }[]>`select d.id, d.file_path, d.kind::text as kind from public.documents d join public.clients c on c.id = d.client_id where c.slug = ${slug} and d.title = ${tytul}`;
    return w ?? null;
  });
}

export async function usunDokumentyTestowe(prefixTytulu: string): Promise<void> {
  await zBaza((s) => s`delete from public.documents where title like ${prefixTytulu + "%"}`);
}

// ---------- usługi ----------

export type ZainteresowanieTestowe = { id: string; note: string | null; handled_at: string | null; contact_id: string | null; service_slug: string };

export async function zainteresowaniaPoNotatce(fragment: string): Promise<ZainteresowanieTestowe[]> {
  return zBaza((s) => s<ZainteresowanieTestowe[]>`select z.id, z.note, z.handled_at::text as handled_at, z.contact_id, u.slug as service_slug from public.service_interests z join public.services u on u.id = z.service_id where z.note like ${"%" + fragment + "%"} order by z.created_at`);
}

export async function usunZainteresowaniaTestowe(fragment: string): Promise<void> {
  await zBaza((s) => s`delete from public.service_interests where note like ${"%" + fragment + "%"}`);
}

// ---------- outbox ----------

export type WierszOutboxTestowy = { id: number; event: string; status: string; attempts: number; last_error: string | null; next_attempt_at: string; sent_at: string | null; payload: Record<string, unknown> };

export async function outboxPoZnaczniku(znacznik: string): Promise<WierszOutboxTestowy[]> {
  return zBaza((s) => s<WierszOutboxTestowy[]>`select id::int as id, event, status::text as status, attempts, last_error, next_attempt_at::text as next_attempt_at, sent_at::text as sent_at, payload from public.outbox where payload->>'e2e' = ${znacznik} or payload->>'note' like ${"%" + znacznik + "%"} order by id`);
}

export async function wstawOutbox(event: string, payload: Record<string, unknown>): Promise<number> {
  return zBaza(async (s) => {
    const [w] = await s<{ id: number }[]>`insert into public.outbox (event, payload) values (${event}, ${s.json(payload as never)}) returning id::int as id`;
    if (!w) throw new Error("Nie udało się wstawić do outbox");
    return w.id;
  });
}

export async function stanOutbox(id: number): Promise<WierszOutboxTestowy | null> {
  return zBaza(async (s) => {
    const [w] = await s<WierszOutboxTestowy[]>`select id::int as id, event, status::text as status, attempts, last_error, next_attempt_at::text as next_attempt_at, sent_at::text as sent_at, payload from public.outbox where id = ${id}`;
    return w ?? null;
  });
}

export async function ustawOutbox(id: number, zmiany: { attempts?: number; nextAttemptAt?: Date; status?: "pending" | "sent" | "failed" }): Promise<void> {
  await zBaza(async (s) => {
    if (zmiany.attempts !== undefined) await s`update public.outbox set attempts = ${zmiany.attempts} where id = ${id}`;
    if (zmiany.nextAttemptAt !== undefined) await s`update public.outbox set next_attempt_at = ${zmiany.nextAttemptAt.toISOString()}::timestamptz where id = ${id}`;
    if (zmiany.status !== undefined) await s`update public.outbox set status = ${zmiany.status}::public.outbox_status where id = ${id}`;
  });
}

export async function usunOutboxTestowe(znacznik: string): Promise<void> {
  await zBaza((s) => s`delete from public.outbox where payload->>'e2e' = ${znacznik} or payload->>'note' like ${"%" + znacznik + "%"}`);
}

/** Seedowe zdarzenia w kolejce dostają odległy termin, żeby cron w teście nie próbował ich wysłać (atrapa Zapiera ich nie zna). */
export async function odsunKolejkeSeedu(wyjatki: number[]): Promise<void> {
  await zBaza((s) => s`update public.outbox set next_attempt_at = now() + interval '1 day' where status = 'pending' and next_attempt_at <= now() and id <> all(${wyjatki}::bigint[])`);
}
