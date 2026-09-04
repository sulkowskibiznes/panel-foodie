import "server-only";
import type { Database } from "@/lib/db-types";
import { supabaseSerwer } from "@/lib/supabase/server";

export type AkcjaAudytu =
  | "klient.logowanie_ok"
  | "klient.logowanie_blad"
  | "klient.blokada_24h"
  | "klient.wylogowanie"
  | "klient.plik_pobrany"
  | "klient.pakiet_otwarty"
  | "klient.akceptacja"
  | "klient.uwagi"
  | "klient.komentarz"
  | "link.utworzony"
  | "link.wygaszony"
  | "link.pin_zresetowany"
  | "link.urzadzenia_wylogowane"
  | "link.skopiowany"
  | "link.odszyfrowany"
  | "zespol.logowanie_ok"
  | "zespol.logowanie_blad"
  | "zespol.wylogowanie"
  | "zespol.czlonek_dodany"
  | "zespol.czlonek_zmieniony"
  | "zespol.pakiet_wyslany"
  | "zespol.pakiet_wycofany"
  | "zespol.pakiet_cofniety"
  | "zespol.pakiet_zaplanowany"
  | "zespol.komentarz"
  | "zespol.uwaga_zalatwiona"
  | "zespol.podglad_klienta_start"
  | "zespol.podglad_klienta_koniec"
  | "zespol.pakiet_utworzony"
  | "zespol.pakiet_zmieniony"
  | "zespol.kampania_dodana"
  | "zespol.kampania_zmieniona"
  | "zespol.kampania_usunieta"
  | "zespol.material_dodany"
  | "zespol.material_podmieniony"
  | "zespol.material_zmieniony"
  | "zespol.material_usuniety"
  | "zespol.plik_pobrany"
  | "zespol.harmonogram_zmieniony"
  | "system.auto_akceptacja";

export type ZdarzenieAudytu = {
  actor_kind: Database["public"]["Enums"]["actor_kind"];
  actor_id?: string | null;
  actor_label?: string | null;
  action: AkcjaAudytu;
  entity?: string | null;
  entity_id?: string | null;
  client_id?: string | null;
  ip_hash?: string | null;
  ua?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Audyt (SPEC rozdz. 16.8). Błąd zapisu nie przerywa obsługi żądania, ale trafia do logów serwera:
 * lepiej wpuścić klienta bez wpisu w audycie niż zablokować akceptację przez awarię tabeli.
 */
export async function zapiszAudyt(z: ZdarzenieAudytu): Promise<void> {
  const { error } = await supabaseSerwer().from("audit_log").insert({
    actor_kind: z.actor_kind,
    actor_id: z.actor_id ?? null,
    actor_label: z.actor_label ?? null,
    action: z.action,
    entity: z.entity ?? null,
    entity_id: z.entity_id ?? null,
    client_id: z.client_id ?? null,
    ip_hash: z.ip_hash ?? null,
    ua: z.ua ? z.ua.slice(0, 300) : null,
    meta: (z.meta ?? {}) as Database["public"]["Tables"]["audit_log"]["Insert"]["meta"],
  });
  if (error) console.error("[audyt] nie zapisano zdarzenia", z.action, error.message);
}
