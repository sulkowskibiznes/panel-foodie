import "server-only";
import { generujPin, generujToken, hashujPin, hashujToken, tokenLookup, type RodzajPinu } from "@/lib/auth-klient";
import type { AkcjaAudytu } from "@/lib/audyt";
import type { Database } from "@/lib/db-types";
import { env } from "@/lib/env";
import { odszyfruj, wyprowadzKlucz, zaszyfruj } from "@/lib/krypto";
import { uniewaznijSesjeLinku } from "@/lib/sesja-klienta";
import { supabaseSerwer } from "@/lib/supabase/server";

export type LinkDostepu = {
  id: string;
  label: string;
  kontakt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  lockedUntil: string | null;
  canApprove: boolean;
  pinKind: RodzajPinu;
  aktywneUrzadzenia: number;
  /** Pełny adres do skopiowania (token odszyfrowany po stronie serwera, tylko dla zespołu z prawem do zakładki Dostęp). */
  adres: string;
};

function kluczTokenu() {
  return wyprowadzKlucz(env().SESSION_SECRET, "token");
}

export function adresLinku(token: string): string {
  return `${env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/p/${token}`;
}

export async function pobierzLinkiKlienta(clientId: string): Promise<LinkDostepu[]> {
  const db = supabaseSerwer();
  const { data, error } = await db
    .from("access_links")
    .select("id, label, created_at, last_used_at, revoked_at, locked_until, can_approve, pin_kind, token_enc, client_contacts(name)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`pobierzLinkiKlienta: ${error.message}`);
  const ids = (data ?? []).map((l) => l.id);
  const { data: sesje } = ids.length
    ? await db.from("client_sessions").select("access_link_id").in("access_link_id", ids).is("revoked_at", null).gt("expires_at", new Date().toISOString())
    : { data: [] as { access_link_id: string }[] };
  const klucz = kluczTokenu();
  return (data ?? []).map((l) => {
    const kontakt = l.client_contacts as unknown as { name: string } | null;
    return {
      id: l.id,
      label: l.label,
      kontakt: kontakt?.name ?? null,
      createdAt: l.created_at,
      lastUsedAt: l.last_used_at,
      revokedAt: l.revoked_at,
      lockedUntil: l.locked_until && new Date(l.locked_until) > new Date() ? l.locked_until : null,
      canApprove: l.can_approve,
      pinKind: l.pin_kind,
      aktywneUrzadzenia: (sesje ?? []).filter((s) => s.access_link_id === l.id).length,
      adres: adresLinku(odszyfruj(klucz, l.token_enc)),
    };
  });
}

export type NowyLink = { clientId: string; contactId: string | null; label: string; pinKind: RodzajPinu; canApprove: boolean; createdBy: string };

/** Token i PIN wyłącznie z generatorów (crypto.randomBytes). PIN wraca do wywołującego tylko raz. */
export async function utworzLinkDostepu(n: NowyLink): Promise<{ linkId: string; token: string; pin: string }> {
  const token = generujToken();
  const pin = generujPin(n.pinKind);
  const { data, error } = await supabaseSerwer()
    .from("access_links")
    .insert({
      client_id: n.clientId,
      contact_id: n.contactId,
      label: n.label,
      token_lookup: tokenLookup(token),
      token_hash: hashujToken(token),
      token_enc: zaszyfruj(kluczTokenu(), token),
      pin_hash: await hashujPin(pin),
      pin_kind: n.pinKind,
      can_approve: n.canApprove,
      created_by: n.createdBy,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`utworzLinkDostepu: ${error?.message ?? "brak wiersza"}`);
  return { linkId: data.id, token, pin };
}

async function linkKlienta(linkId: string, clientId: string) {
  const { data } = await supabaseSerwer().from("access_links").select("id, pin_kind, revoked_at").eq("id", linkId).eq("client_id", clientId).maybeSingle();
  return data;
}

export async function wygasLinkDostepu(linkId: string, clientId: string): Promise<boolean> {
  const link = await linkKlienta(linkId, clientId);
  if (!link) return false;
  const { error } = await supabaseSerwer().from("access_links").update({ revoked_at: new Date().toISOString() }).eq("id", linkId).is("revoked_at", null);
  if (error) throw new Error(`wygasLinkDostepu: ${error.message}`);
  await uniewaznijSesjeLinku(linkId);
  return true;
}

export async function wylogujUrzadzeniaLinku(linkId: string, clientId: string): Promise<number | null> {
  const link = await linkKlienta(linkId, clientId);
  if (!link) return null;
  return uniewaznijSesjeLinku(linkId);
}

/** Nowy PIN, zerowanie blokad i liczników, wylogowanie wszystkich urządzeń (SPEC rozdz. 12.4, 16.5). */
export async function zresetujPinLinku(linkId: string, clientId: string): Promise<{ pin: string; token: string } | null> {
  const db = supabaseSerwer();
  const { data: link } = await db.from("access_links").select("id, pin_kind, revoked_at, token_enc").eq("id", linkId).eq("client_id", clientId).maybeSingle();
  if (!link || link.revoked_at) return null;
  const pin = generujPin(link.pin_kind);
  const { error } = await db
    .from("access_links")
    .update({ pin_hash: await hashujPin(pin), failed_attempts: 0, failed_window_started_at: null, locked_until: null })
    .eq("id", linkId);
  if (error) throw new Error(`zresetujPinLinku: ${error.message}`);
  await uniewaznijSesjeLinku(linkId);
  return { pin, token: odszyfruj(kluczTokenu(), link.token_enc) };
}

export type WpisHistorii = {
  id: number;
  kiedy: string;
  akcja: AkcjaAudytu;
  linkLabel: string | null;
  actorLabel: string | null;
  meta: Record<string, unknown>;
};

const AKCJE_HISTORII: AkcjaAudytu[] = [
  "klient.logowanie_ok",
  "klient.logowanie_blad",
  "klient.blokada_24h",
  "klient.wylogowanie",
  "link.utworzony",
  "link.wygaszony",
  "link.pin_zresetowany",
  "link.urzadzenia_wylogowane",
  "link.skopiowany",
];

/** Historia logowań i zmian dostępu klienta z audit_log (SPEC rozdz. 4.4). */
export async function pobierzHistorieDostepu(clientId: string, limit = 50): Promise<WpisHistorii[]> {
  const db = supabaseSerwer();
  const { data, error } = await db
    .from("audit_log")
    .select("id, created_at, action, entity_id, actor_label, meta")
    .eq("client_id", clientId)
    .in("action", AKCJE_HISTORII)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`pobierzHistorieDostepu: ${error.message}`);
  const linkIds = [...new Set((data ?? []).map((w) => w.entity_id).filter((x): x is string => !!x))];
  const { data: linki } = linkIds.length ? await db.from("access_links").select("id, label").in("id", linkIds) : { data: [] as { id: string; label: string }[] };
  const etykiety = new Map((linki ?? []).map((l) => [l.id, l.label]));
  return (data ?? []).map((w) => ({
    id: w.id,
    kiedy: w.created_at,
    akcja: w.action as AkcjaAudytu,
    linkLabel: w.entity_id ? (etykiety.get(w.entity_id) ?? null) : null,
    actorLabel: w.actor_label,
    meta: (w.meta ?? {}) as Record<string, unknown>,
  }));
}

export type RodzajPinuDb = Database["public"]["Enums"]["pin_kind"];
