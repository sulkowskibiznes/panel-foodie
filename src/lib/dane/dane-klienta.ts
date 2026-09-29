import "server-only";
import type { Database } from "@/lib/db-types";
import { sha256Hex } from "@/lib/krypto";
import { czyMoznaZmienicKategorie, type Akceptacja, type DaneKlienta, type Kontakt, type Lokal } from "@/lib/klienci/nowy";
import { uniewaznijSesjeLinku } from "@/lib/sesja-klienta";
import { supabaseSerwer } from "@/lib/supabase/server";
import type { Rola } from "@/lib/uprawnienia";

/**
 * Zakładka „Dane i współpraca" karty klienta (plan domknięcia, Etap 1): odczyt i zapis danych klienta, lokali,
 * osób kontaktowych, zespołu klienta i ustawień akceptacji. Strona wyłącznie dla zespołu (admin i csm).
 * Każda funkcja zapisu zawęża zapytanie do `client_id` z autoryzacji; id lokalu, osoby i członka zespołu z formularza
 * nigdy nie wystarcza samo (`.eq("client_id", clientId)` i sprawdzenie liczby zmienionych wierszy).
 */
type Kategoria = Database["public"]["Enums"]["client_category"];
type Tier = Database["public"]["Enums"]["package_tier"];

/** `wersjaAwatara` zmienia się z plikiem: adres podglądu z nią omija pamięć przeglądarki (trasa awatara cache 9 min). */
export type LokalKlienta = Lokal & { id: string; position: number; wersjaAwatara: string | null };
export type KontaktKlienta = Kontakt & { id: string; is_primary: boolean; archived_at: string | null; aktywneLinki: number };
export type CzlonekKlienta = { id: string; name: string; role: Rola };

export type DaneKlientaZespolu = {
  id: string;
  slug: string;
  name: string;
  category: Kategoria;
  tier: Tier;
  monthly_amount_net: number | null;
  slack_channel: string | null;
  cooperation_started_on: string | null;
  opiekunId: string | null;
  akceptacja: Akceptacja;
  lokale: LokalKlienta[];
  kontakty: KontaktKlienta[];
  przypisani: CzlonekKlienta[];
  /** Aktywni członkowie zespołu do wyboru jako opiekun (admin, csm) i do przypisania (wszyscy poza sales). */
  zespol: CzlonekKlienta[];
  mozeZmienicKategorie: boolean;
};

export async function pobierzDaneKlienta(clientId: string): Promise<DaneKlientaZespolu | null> {
  const db = supabaseSerwer();
  const { data: k } = await db
    .from("clients")
    .select("id, slug, name, category, tier, monthly_amount_net, slack_channel, cooperation_started_on, opiekun_id, auto_approve_default, auto_approve_hours, default_publish_hours")
    .eq("id", clientId)
    .maybeSingle();
  if (!k) return null;
  const [lokale, kontakty, linki, przypisania, zespol, pakiety, raporty] = await Promise.all([
    db.from("locations").select("id, name, city, address, fb_page_name, ig_handle, position, avatar_path").eq("client_id", clientId).order("position"),
    db.from("client_contacts").select("id, name, role_label, phone, email, is_primary, archived_at, created_at").eq("client_id", clientId).order("created_at"),
    db.from("access_links").select("contact_id").eq("client_id", clientId).is("revoked_at", null),
    db.from("client_assignments").select("team_member_id").eq("client_id", clientId),
    db.from("team_members").select("id, name, role").eq("active", true).order("name"),
    db.from("packages").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    db.from("reports").select("id", { count: "exact", head: true }).eq("client_id", clientId),
  ]);
  const idsPrzypisanych = new Set((przypisania.data ?? []).map((p) => p.team_member_id));
  const czlonkowie = (zespol.data ?? []) as CzlonekKlienta[];
  return {
    id: k.id,
    slug: k.slug,
    name: k.name,
    category: k.category,
    tier: k.tier,
    monthly_amount_net: k.monthly_amount_net,
    slack_channel: k.slack_channel,
    cooperation_started_on: k.cooperation_started_on,
    opiekunId: k.opiekun_id,
    akceptacja: { auto_approve_default: k.auto_approve_default, auto_approve_hours: k.auto_approve_hours, default_publish_hours: k.default_publish_hours },
    lokale: (lokale.data ?? []).map((l) => ({ id: l.id, name: l.name, city: l.city, address: l.address, fb_page_name: l.fb_page_name, ig_handle: l.ig_handle, position: l.position, wersjaAwatara: l.avatar_path ? sha256Hex(l.avatar_path).slice(0, 10) : null })),
    kontakty: (kontakty.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      role_label: c.role_label,
      phone: c.phone,
      email: c.email,
      is_primary: c.is_primary,
      archived_at: c.archived_at,
      aktywneLinki: (linki.data ?? []).filter((l) => l.contact_id === c.id).length,
    })),
    przypisani: czlonkowie.filter((c) => idsPrzypisanych.has(c.id)),
    zespol: czlonkowie.filter((c) => c.role !== "sales"),
    mozeZmienicKategorie: czyMoznaZmienicKategorie({ pakiety: pakiety.count ?? 0, raporty: raporty.count ?? 0 }),
  };
}

export async function zapiszDaneKlienta(clientId: string, dane: DaneKlienta): Promise<void> {
  const db = supabaseSerwer();
  const { error } = await db
    .from("clients")
    .update({ name: dane.name, category: dane.category, tier: dane.tier, monthly_amount_net: dane.monthly_amount_net, slack_channel: dane.slack_channel, cooperation_started_on: dane.cooperation_started_on })
    .eq("id", clientId);
  if (error) throw new Error(`zapiszDaneKlienta: ${error.message}`);
  // Kategoria 1 = osobne materiały per lokal (SPEC rozdz. 3.1); zmienić ją można tylko przed pierwszym pakietem.
  const { error: bladLokali } = await db.from("locations").update({ separate_materials: dane.category === "kat1" }).eq("client_id", clientId);
  if (bladLokali) throw new Error(`zapiszDaneKlienta (lokale): ${bladLokali.message}`);
}

async function przeliczDodatkoweLokale(clientId: string): Promise<void> {
  const db = supabaseSerwer();
  const { count } = await db.from("locations").select("id", { count: "exact", head: true }).eq("client_id", clientId);
  await db.from("clients").update({ extra_locations_count: Math.max(0, (count ?? 1) - 1) }).eq("id", clientId);
}

/** Nowy lokal (lokalId = null) albo zmiana istniejącego tego klienta. Zwraca id albo null, gdy lokal nie należy do klienta. */
export async function zapiszLokal(clientId: string, lokalId: string | null, lokal: Lokal, kategoria: Kategoria): Promise<string | null> {
  const db = supabaseSerwer();
  if (lokalId) {
    const { data, error } = await db.from("locations").update({ name: lokal.name, city: lokal.city, address: lokal.address, fb_page_name: lokal.fb_page_name, ig_handle: lokal.ig_handle }).eq("id", lokalId).eq("client_id", clientId).select("id");
    if (error) throw new Error(`zapiszLokal: ${error.message}`);
    return (data ?? []).length === 1 ? lokalId : null;
  }
  const { data: ostatni } = await db.from("locations").select("position").eq("client_id", clientId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await db
    .from("locations")
    .insert({ client_id: clientId, ...lokal, separate_materials: kategoria === "kat1", position: (ostatni?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error || !data) throw new Error(`zapiszLokal (nowy): ${error?.message ?? "brak wiersza"}`);
  await przeliczDodatkoweLokale(clientId);
  return data.id;
}

/** Nowa ścieżka zdjęcia profilowego; zwraca poprzednią (do usunięcia ze Storage) albo null, gdy lokal nie należy do klienta. */
export async function ustawAwatarLokalu(clientId: string, lokalId: string, sciezka: string): Promise<{ poprzednia: string | null } | null> {
  const db = supabaseSerwer();
  const { data: lokal } = await db.from("locations").select("avatar_path").eq("id", lokalId).eq("client_id", clientId).maybeSingle();
  if (!lokal) return null;
  const { error } = await db.from("locations").update({ avatar_path: sciezka }).eq("id", lokalId).eq("client_id", clientId);
  if (error) throw new Error(`ustawAwatarLokalu: ${error.message}`);
  return { poprzednia: lokal.avatar_path };
}

export async function czyLokalKlienta(clientId: string, lokalId: string): Promise<boolean> {
  const { data } = await supabaseSerwer().from("locations").select("id").eq("id", lokalId).eq("client_id", clientId).maybeSingle();
  return !!data;
}

/** Nowa osoba (kontaktId = null) albo zmiana aktywnej osoby tego klienta. */
export async function zapiszKontakt(clientId: string, kontaktId: string | null, kontakt: Kontakt): Promise<string | null> {
  const db = supabaseSerwer();
  if (kontaktId) {
    const { data, error } = await db.from("client_contacts").update(kontakt).eq("id", kontaktId).eq("client_id", clientId).is("archived_at", null).select("id");
    if (error) throw new Error(`zapiszKontakt: ${error.message}`);
    return (data ?? []).length === 1 ? kontaktId : null;
  }
  const { count } = await db.from("client_contacts").select("id", { count: "exact", head: true }).eq("client_id", clientId).is("archived_at", null);
  const { data, error } = await db
    .from("client_contacts")
    .insert({ client_id: clientId, ...kontakt, is_primary: (count ?? 0) === 0 })
    .select("id")
    .single();
  if (error || !data) throw new Error(`zapiszKontakt (nowy): ${error?.message ?? "brak wiersza"}`);
  return data.id;
}

export async function ustawGlownyKontakt(clientId: string, kontaktId: string): Promise<boolean> {
  const db = supabaseSerwer();
  const { data: osoba } = await db.from("client_contacts").select("id").eq("id", kontaktId).eq("client_id", clientId).is("archived_at", null).maybeSingle();
  if (!osoba) return false;
  await db.from("client_contacts").update({ is_primary: false }).eq("client_id", clientId).neq("id", kontaktId);
  const { error } = await db.from("client_contacts").update({ is_primary: true }).eq("id", kontaktId);
  if (error) throw new Error(`ustawGlownyKontakt: ${error.message}`);
  return true;
}

/**
 * Osoba przestaje współpracować: `archived_at`, telefon i e-mail wyzerowane (RODO), imię zostaje w historii akceptacji.
 * `wygasLinki` wygasza jej linki dostępu i wylogowuje urządzenia (tak samo jak „Wygaś link" w zakładce Dostęp).
 */
export async function archiwizujKontakt(clientId: string, kontaktId: string, wygasLinki: boolean): Promise<{ wygaszone: number } | null> {
  const db = supabaseSerwer();
  const teraz = new Date().toISOString();
  const { data, error } = await db
    .from("client_contacts")
    .update({ archived_at: teraz, phone: null, email: null, is_primary: false })
    .eq("id", kontaktId)
    .eq("client_id", clientId)
    .is("archived_at", null)
    .select("id");
  if (error) throw new Error(`archiwizujKontakt: ${error.message}`);
  if ((data ?? []).length !== 1) return null;
  let wygaszone = 0;
  if (wygasLinki) {
    const { data: linki } = await db.from("access_links").update({ revoked_at: teraz }).eq("client_id", clientId).eq("contact_id", kontaktId).is("revoked_at", null).select("id");
    for (const l of linki ?? []) await uniewaznijSesjeLinku(l.id);
    wygaszone = (linki ?? []).length;
  }
  // Główną zostaje najstarsza aktywna osoba, jeśli zarchiwizowana była główna.
  const { data: glowna } = await db.from("client_contacts").select("id").eq("client_id", clientId).is("archived_at", null).eq("is_primary", true).maybeSingle();
  if (!glowna) {
    const { data: pierwsza } = await db.from("client_contacts").select("id").eq("client_id", clientId).is("archived_at", null).order("created_at").limit(1).maybeSingle();
    if (pierwsza) await db.from("client_contacts").update({ is_primary: true }).eq("id", pierwsza.id);
  }
  return { wygaszone };
}

/** Opiekun: aktywny admin albo csm (albo nikt). Zwraca false, gdy wskazana osoba nie może być opiekunem. */
export async function ustawOpiekuna(clientId: string, memberId: string | null): Promise<boolean> {
  const db = supabaseSerwer();
  if (memberId) {
    const { data: osoba } = await db.from("team_members").select("id").eq("id", memberId).eq("active", true).in("role", ["admin", "csm"]).maybeSingle();
    if (!osoba) return false;
  }
  const { error } = await db.from("clients").update({ opiekun_id: memberId }).eq("id", clientId);
  if (error) throw new Error(`ustawOpiekuna: ${error.message}`);
  return true;
}

/** Przypisania zespołu klienta (client_assignments) ustawiane w całości: tylko aktywni, bez roli sales. */
export async function ustawPrzypisania(clientId: string, memberIds: string[]): Promise<{ dodani: string[]; usunieci: string[] }> {
  const db = supabaseSerwer();
  const { data: dozwoleni } = memberIds.length > 0 ? await db.from("team_members").select("id").in("id", memberIds).eq("active", true).neq("role", "sales") : { data: [] as { id: string }[] };
  const docelowi = new Set((dozwoleni ?? []).map((d) => d.id));
  const { data: obecne } = await db.from("client_assignments").select("team_member_id").eq("client_id", clientId);
  const obecni = new Set((obecne ?? []).map((o) => o.team_member_id));
  const dodani = [...docelowi].filter((id) => !obecni.has(id));
  const usunieci = [...obecni].filter((id) => !docelowi.has(id));
  if (usunieci.length > 0) {
    const { error } = await db.from("client_assignments").delete().eq("client_id", clientId).in("team_member_id", usunieci);
    if (error) throw new Error(`ustawPrzypisania (usuń): ${error.message}`);
  }
  if (dodani.length > 0) {
    const { error } = await db.from("client_assignments").insert(dodani.map((id) => ({ client_id: clientId, team_member_id: id })));
    if (error) throw new Error(`ustawPrzypisania (dodaj): ${error.message}`);
  }
  return { dodani, usunieci };
}

export async function zapiszAkceptacje(clientId: string, a: Akceptacja): Promise<void> {
  const { error } = await supabaseSerwer().from("clients").update(a).eq("id", clientId);
  if (error) throw new Error(`zapiszAkceptacje: ${error.message}`);
}

export type PierwszeKroki = { linki: boolean; zdjecia: boolean; zespol: boolean; dokumenty: boolean; pakiet: boolean };

/**
 * Karta „Pierwsze kroki" na Podsumowaniu: link dla każdej aktywnej osoby, zdjęcia profilowe lokali z osobnym profilem
 * (kat1 i kat3 wszystkie, kat2 pierwszy), przypisany content creator, umowa i umowa powierzenia, pierwszy pakiet.
 */
export async function pobierzPierwszeKroki(clientId: string): Promise<PierwszeKroki> {
  const db = supabaseSerwer();
  const [{ data: klient }, { data: kontakty }, { data: linki }, { data: lokale }, { data: przypisania }, { data: dokumenty }, { count: pakiety }] = await Promise.all([
    db.from("clients").select("category").eq("id", clientId).maybeSingle(),
    db.from("client_contacts").select("id").eq("client_id", clientId).is("archived_at", null),
    db.from("access_links").select("contact_id").eq("client_id", clientId).is("revoked_at", null),
    db.from("locations").select("avatar_path, position").eq("client_id", clientId).order("position"),
    db.from("client_assignments").select("team_members!inner(role)").eq("client_id", clientId),
    db.from("documents").select("kind").eq("client_id", clientId),
    db.from("packages").select("id", { count: "exact", head: true }).eq("client_id", clientId),
  ]);
  const zLinkiem = new Set((linki ?? []).map((l) => l.contact_id));
  const lokaleDoZdjecia = klient?.category === "kat2" ? (lokale ?? []).slice(0, 1) : (lokale ?? []);
  const role = (przypisania ?? []).map((p) => (p.team_members as unknown as { role: Rola }).role);
  const rodzaje = new Set((dokumenty ?? []).map((d) => d.kind));
  return {
    linki: (kontakty ?? []).length > 0 && (kontakty ?? []).every((k) => zLinkiem.has(k.id)),
    zdjecia: lokaleDoZdjecia.length > 0 && lokaleDoZdjecia.every((l) => !!l.avatar_path),
    zespol: role.includes("content_creator"),
    dokumenty: rodzaje.has("umowa") && rodzaje.has("powierzenie"),
    pakiet: (pakiety ?? 0) > 0,
  };
}

/** Liczba klientów, których członek zespołu jest opiekunem albo do których jest przypisany (Ustawienia → Zespół). */
export async function policzKlientowZespolu(): Promise<Map<string, { opiekun: number; przypisany: number }>> {
  const db = supabaseSerwer();
  const [{ data: opieka }, { data: przypisania }] = await Promise.all([
    db.from("clients").select("opiekun_id").neq("status", "zakonczony").not("opiekun_id", "is", null),
    db.from("client_assignments").select("team_member_id, clients!inner(status)").neq("clients.status", "zakonczony"),
  ]);
  const mapa = new Map<string, { opiekun: number; przypisany: number }>();
  const wpis = (id: string) => mapa.get(id) ?? mapa.set(id, { opiekun: 0, przypisany: 0 }).get(id)!;
  for (const o of opieka ?? []) if (o.opiekun_id) wpis(o.opiekun_id).opiekun++;
  for (const p of przypisania ?? []) wpis(p.team_member_id).przypisany++;
  return mapa;
}
