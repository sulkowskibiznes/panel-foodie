import "server-only";
import type { Database } from "@/lib/db-types";
import { zmienStatusPakietu } from "@/lib/pakiety/baza";
import type { Aktor } from "@/lib/pakiety/przejscia";
import { BUCKETY_KLIENTA, usunFolderStorage } from "@/lib/pliki/sprzatanie";
import { supabaseSerwer } from "@/lib/supabase/server";

export type StatusKlienta = Database["public"]["Enums"]["client_status"];

export type StanWspolpracy = { status: StatusKlienta; zakonczonoO: string | null; aktywneLinki: number; aktywneSesje: number; pakietyWToku: number };

/** Stan współpracy na zakładkę Ustawienia karty klienta (SPEC rozdz. 17). */
export async function pobierzStanWspolpracy(clientId: string): Promise<StanWspolpracy | null> {
  const db = supabaseSerwer();
  const { data: klient } = await db.from("clients").select("status, ended_at").eq("id", clientId).maybeSingle();
  if (!klient) return null;
  const { data: linki } = await db.from("access_links").select("id").eq("client_id", clientId).is("revoked_at", null);
  const idsLinkow = (linki ?? []).map((l) => l.id);
  const { count } = idsLinkow.length > 0 ? await db.from("client_sessions").select("id", { count: "exact", head: true }).in("access_link_id", idsLinkow).is("revoked_at", null).gt("expires_at", new Date().toISOString()) : { count: 0 };
  const { count: wToku } = await db.from("packages").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "do_akceptacji");
  return { status: klient.status, zakonczonoO: klient.ended_at, aktywneLinki: idsLinkow.length, aktywneSesje: count ?? 0, pakietyWToku: wToku ?? 0 };
}

/**
 * Pakiety czekające na akceptację wracają do szkicu przed zakończeniem albo przerwą we współpracy: klient bez dostępu
 * nie może niczego zaakceptować, a cron nie może zrobić tego za niego. Wyłącznie przez maszynę stanów (zasada 9).
 */
export async function wycofajPakietyWToku(clientId: string, aktor: Extract<Aktor, { rodzaj: "zespol" }>): Promise<string[]> {
  const { data, error } = await supabaseSerwer().from("packages").select("id").eq("client_id", clientId).eq("status", "do_akceptacji");
  if (error) throw new Error(`wycofajPakietyWToku: ${error.message}`);
  const wycofane: string[] = [];
  for (const p of data ?? []) {
    const wynik = await zmienStatusPakietu(p.id, { typ: "wycofaj" }, aktor);
    if (wynik.ok) wycofane.push(p.id);
  }
  return wycofane;
}

export type WynikZakonczenia = { linki: number; sesje: number };

/**
 * „Zakończ współpracę" (SPEC rozdz. 17): wszystkie linki dostają `revoked_at`, wszystkie żywe sesje `revoked_at`,
 * klient status `zakonczony` i `ended_at`. Dane zostają do osobnej decyzji „Usuń dane klienta".
 */
export async function zakonczWspolprace(clientId: string, teraz: Date): Promise<WynikZakonczenia> {
  const db = supabaseSerwer();
  const iso = teraz.toISOString();
  const { data: wszystkieLinki } = await db.from("access_links").select("id").eq("client_id", clientId);
  const ids = (wszystkieLinki ?? []).map((l) => l.id);
  let sesje = 0;
  if (ids.length > 0) {
    const { data: uniewaznione, error: bladSesji } = await db.from("client_sessions").update({ revoked_at: iso }).in("access_link_id", ids).is("revoked_at", null).select("id");
    if (bladSesji) throw new Error(`zakonczWspolprace (sesje): ${bladSesji.message}`);
    sesje = uniewaznione?.length ?? 0;
  }
  const { data: wygaszone, error: bladLinkow } = await db.from("access_links").update({ revoked_at: iso }).eq("client_id", clientId).is("revoked_at", null).select("id");
  if (bladLinkow) throw new Error(`zakonczWspolprace (linki): ${bladLinkow.message}`);
  const { error } = await db.from("clients").update({ status: "zakonczony", ended_at: iso }).eq("id", clientId);
  if (error) throw new Error(`zakonczWspolprace: ${error.message}`);
  return { linki: wygaszone?.length ?? 0, sesje };
}

/** „Przerwa we współpracy" (plan 1.7): linki działają, klient może się logować; pulpit, cron i wysyłka go pomijają. */
export async function wstrzymajWspolprace(clientId: string): Promise<void> {
  const { error } = await supabaseSerwer().from("clients").update({ status: "wstrzymany" }).eq("id", clientId).eq("status", "aktywny");
  if (error) throw new Error(`wstrzymajWspolprace: ${error.message}`);
}

/** „Wznów współpracę": klient wraca na pulpit; po zakończeniu stare linki zostają wygaszone (zespół tworzy nowe w Dostępie). */
export async function wznowWspolprace(clientId: string): Promise<void> {
  const { error } = await supabaseSerwer().from("clients").update({ status: "aktywny", ended_at: null }).eq("id", clientId);
  if (error) throw new Error(`wznowWspolprace: ${error.message}`);
}

export type WynikUsunieciaKlienta = { obiekty: Record<string, number> };

/**
 * „Usuń dane klienta" (SPEC rozdz. 17): pliki ze wszystkich bucketów pod prefiksem klienta, potem wiersz klienta
 * (kaskada: lokale, kontakty, linki, sesje, pakiety z materiałami, komentarze, zdarzenia, importy, raporty, faktury,
 * dokumenty, zgłoszenia usług, kroki wdrożenia, przypisania, przeglądy retencyjne), wpisy outbox klienta, a audyt
 * zostaje (retencja 12 miesięcy) z wyczyszczonymi etykietami osób, UA, hashem IP i szczegółami.
 */
export async function usunDaneKlienta(clientId: string, slug: string): Promise<WynikUsunieciaKlienta> {
  const db = supabaseSerwer();
  const obiekty: Record<string, number> = {};
  // Najpierw Storage: przy błędzie wiersz klienta zostaje, a ponowne kliknięcie dokończy usuwanie (operacja idempotentna).
  for (const bucket of BUCKETY_KLIENTA) obiekty[bucket] = await usunFolderStorage(bucket, clientId);
  // RODO: kolejka powiadomień niesie nazwy osób (actor, summary, label). Zdarzenia pakietów mają w payloadzie slug,
  // zdarzenia bezpieczeństwa także client_id (starsze wpisy blokad tylko client_id), więc kasujemy po obu kluczach.
  const { error: bladOutbox } = await db.from("outbox").delete().or(`payload->>client_slug.eq.${slug},payload->>client_id.eq.${clientId}`);
  if (bladOutbox) throw new Error(`usunDaneKlienta (outbox): ${bladOutbox.message}`);
  // Audyt zostaje na 12 miesięcy (bezpieczeństwo), ale bez etykiet osób, przeglądarek i szczegółów.
  const { error: bladAudytu } = await db.from("audit_log").update({ actor_label: null, ua: null, ip_hash: null, meta: {} }).eq("client_id", clientId);
  if (bladAudytu) throw new Error(`usunDaneKlienta (audyt): ${bladAudytu.message}`);
  // Komentarze wskazują osoby kontaktowe bez kaskady, więc idą pierwsze (tak jak w seedzie).
  const { data: pakiety } = await db.from("packages").select("id").eq("client_id", clientId);
  const ids = (pakiety ?? []).map((p) => p.id);
  if (ids.length > 0) {
    const { error: bladKomentarzy } = await db.from("comments").delete().in("package_id", ids);
    if (bladKomentarzy) throw new Error(`usunDaneKlienta (komentarze): ${bladKomentarzy.message}`);
  }
  const { error } = await db.from("clients").delete().eq("id", clientId);
  if (error) throw new Error(`usunDaneKlienta: ${error.message}`);
  return { obiekty };
}

export type KlientNieaktywny = { id: string; slug: string; name: string; status: StatusKlienta; zakonczonoO: string | null };

/** Klienci poza pulpitem (wstrzymani i zakończeni) widoczni dla członka zespołu: żeby dało się wrócić do karty i usunąć dane. */
export async function pobierzKlientowNieaktywnych(clientIds: string[] | null): Promise<KlientNieaktywny[]> {
  let zapytanie = supabaseSerwer().from("clients").select("id, slug, name, status, ended_at").neq("status", "aktywny").order("ended_at", { ascending: false, nullsFirst: false }).order("name");
  if (clientIds) {
    if (clientIds.length === 0) return [];
    zapytanie = zapytanie.in("id", clientIds);
  }
  const { data, error } = await zapytanie;
  if (error) throw new Error(`pobierzKlientowNieaktywnych: ${error.message}`);
  return (data ?? []).map((k) => ({ id: k.id, slug: k.slug, name: k.name, status: k.status, zakonczonoO: k.ended_at }));
}
