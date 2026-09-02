import "server-only";
import type { Database } from "@/lib/db-types";
import { supabaseSerwer } from "@/lib/supabase/server";

/** Zdarzenia z SPEC rozdz. 15. Wysyłka cronem (faza 5); tu tylko zapis, nigdy oczekiwanie na webhook. */
export type ZdarzenieOutbox =
  | "pakiet.wyslany"
  | "pakiet.otwarty"
  | "pakiet.zaakceptowany"
  | "pakiet.zaakceptowany_auto"
  | "pakiet.poprawki"
  | "pakiet.nieotwarty_po_24h"
  | "pakiet.auto_za_24h"
  | "pakiet.auto_wstrzymana_uwagi"
  | "pakiet.wycofany"
  | "komentarz.po_akceptacji"
  | "material.podmieniony_po_akceptacji"
  | "usluga.zainteresowanie"
  | "bezpieczenstwo.blokada";

export async function dodajDoOutbox(event: ZdarzenieOutbox, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseSerwer()
    .from("outbox")
    .insert({ event, payload: payload as Database["public"]["Tables"]["outbox"]["Insert"]["payload"] });
  if (error) console.error("[outbox] nie zapisano zdarzenia", event, error.message);
}
