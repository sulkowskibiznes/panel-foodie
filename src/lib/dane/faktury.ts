import "server-only";
import type { FakturaDlaKlienta, StatusFaktury } from "@/lib/dto/klient";
import type { FakturaDoTerminu } from "@/lib/faktury/status";
import { supabaseSerwer } from "@/lib/supabase/server";

type WierszFaktury = {
  id: string;
  client_id: string;
  number: string;
  issue_date: string;
  due_date: string;
  amount_net: number;
  amount_gross: number;
  status: StatusFaktury;
  paid_at: string | null;
  pdf_path: string | null;
  note: string | null;
  created_at: string;
};

const KOLUMNY = "id, client_id, number, issue_date, due_date, amount_net, amount_gross, status, paid_at, pdf_path, note, created_at";

function naDto(w: WierszFaktury): FakturaDlaKlienta {
  return { id: w.id, numer: w.number, wystawiono: w.issue_date, termin: w.due_date, netto: Number(w.amount_net), brutto: Number(w.amount_gross), status: w.status, zaplaconoDnia: w.paid_at, maPdf: w.pdf_path !== null };
}

/** Widok zespołu: to samo co klient plus notatka wewnętrzna (nigdy w DTO klienta). */
export type FakturaZespolu = FakturaDlaKlienta & { notatka: string | null };

/** Faktury klienta od najnowszej daty wystawienia (SPEC rozdz. 5.6). */
export async function pobierzFakturyKlienta(clientId: string): Promise<FakturaDlaKlienta[]> {
  const { data, error } = await supabaseSerwer().from("invoices").select(KOLUMNY).eq("client_id", clientId).order("issue_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error(`pobierzFakturyKlienta: ${error.message}`);
  return ((data ?? []) as unknown as WierszFaktury[]).map(naDto);
}

export async function pobierzFakturyZespolu(clientId: string): Promise<FakturaZespolu[]> {
  const { data, error } = await supabaseSerwer().from("invoices").select(KOLUMNY).eq("client_id", clientId).order("issue_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error(`pobierzFakturyZespolu: ${error.message}`);
  return ((data ?? []) as unknown as WierszFaktury[]).map((w) => ({ ...naDto(w), notatka: w.note }));
}

/** Najstarsza faktura po terminie: kafel na Starcie (SPEC rozdz. 5.1). */
export async function pobierzFakturePoTerminie(clientId: string): Promise<FakturaDlaKlienta | null> {
  const { data, error } = await supabaseSerwer().from("invoices").select(KOLUMNY).eq("client_id", clientId).eq("status", "po_terminie").order("due_date", { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error(`pobierzFakturePoTerminie: ${error.message}`);
  return data ? naDto(data as unknown as WierszFaktury) : null;
}

export type PlikFaktury = { clientId: string; pdfPath: string | null; numer: string };

/** Faktura po id BEZ filtra po kliencie: trasa PDF musi wywołać assertClientAccess zanim podpisze ścieżkę. */
export async function pobierzFakture(id: string): Promise<PlikFaktury | null> {
  const { data } = await supabaseSerwer().from("invoices").select("client_id, pdf_path, number").eq("id", id).maybeSingle();
  return data ? { clientId: data.client_id, pdfPath: data.pdf_path, numer: data.number } : null;
}

export type NowaFaktura = {
  clientId: string;
  numer: string;
  wystawiono: string;
  termin: string;
  netto: number;
  brutto: number;
  status: StatusFaktury;
  notatka: string | null;
  pdfPath: string | null;
};

export type WynikDodaniaFaktury = { ok: true; id: string } | { ok: false; powod: "numerZajety" | "klientDemo" | "inny"; blad: string };

export async function dodajFakture(n: NowaFaktura): Promise<WynikDodaniaFaktury> {
  const { data, error } = await supabaseSerwer()
    .from("invoices")
    .insert({ client_id: n.clientId, number: n.numer, issue_date: n.wystawiono, due_date: n.termin, amount_net: n.netto, amount_gross: n.brutto, status: n.status, note: n.notatka, pdf_path: n.pdfPath })
    .select("id")
    .single();
  if (error || !data) {
    const tekst = error?.message ?? "brak wiersza";
    if (error?.code === "23505") return { ok: false, powod: "numerZajety", blad: tekst };
    if (/demonstracyjn/i.test(tekst)) return { ok: false, powod: "klientDemo", blad: tekst };
    return { ok: false, powod: "inny", blad: tekst };
  }
  return { ok: true, id: data.id };
}

/** Zmiany z warunkiem na klienta: cudza faktura = 0 wierszy = false. */
async function zmienFakture(id: string, clientId: string, zmiany: { status?: StatusFaktury; paid_at?: string | null; pdf_path?: string | null }): Promise<boolean> {
  const { data, error } = await supabaseSerwer().from("invoices").update(zmiany).eq("id", id).eq("client_id", clientId).select("id");
  if (error) throw new Error(`zmienFakture: ${error.message}`);
  return (data ?? []).length === 1;
}

export function oznaczFaktureOplacona(id: string, clientId: string, dataWplaty: string): Promise<boolean> {
  return zmienFakture(id, clientId, { status: "oplacona", paid_at: dataWplaty });
}

export function cofnijOplacenieFaktury(id: string, clientId: string, status: Exclude<StatusFaktury, "oplacona">): Promise<boolean> {
  return zmienFakture(id, clientId, { status, paid_at: null });
}

export function ustawPdfFaktury(id: string, clientId: string, pdfPath: string): Promise<boolean> {
  return zmienFakture(id, clientId, { pdf_path: pdfPath });
}

/** Wiersz znika; PDF zostaje w Storage (SPEC 12: nic nie kasujemy w ciemno; sprzątanie w fazie 6). */
export async function usunFakture(id: string, clientId: string): Promise<boolean> {
  const { data, error } = await supabaseSerwer().from("invoices").delete().eq("id", id).eq("client_id", clientId).select("id");
  if (error) throw new Error(`usunFakture: ${error.message}`);
  return (data ?? []).length === 1;
}

/** Faktura po id w obrębie klienta (do akcji zespołu). */
export async function pobierzFaktureKlienta(id: string, clientId: string): Promise<FakturaZespolu | null> {
  const { data } = await supabaseSerwer().from("invoices").select(KOLUMNY).eq("id", id).eq("client_id", clientId).maybeSingle();
  if (!data) return null;
  const w = data as unknown as WierszFaktury;
  return { ...naDto(w), notatka: w.note };
}

// ---------- cron statusów (SPEC rozdz. 10) ----------

export async function pobierzFakturyDoZaplaty(): Promise<FakturaDoTerminu[]> {
  const { data, error } = await supabaseSerwer().from("invoices").select("id, status, due_date").eq("status", "do_zaplaty");
  if (error) throw new Error(`pobierzFakturyDoZaplaty: ${error.message}`);
  return (data ?? []).map((w) => ({ id: w.id, status: w.status, dueDate: w.due_date }));
}

/** Warunek na status w UPDATE: faktura opłacona w międzyczasie nie dostanie „po terminie". */
export async function oznaczFakturyPoTerminie(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabaseSerwer().from("invoices").update({ status: "po_terminie" }).in("id", ids).eq("status", "do_zaplaty");
  if (error) throw new Error(`oznaczFakturyPoTerminie: ${error.message}`);
}
