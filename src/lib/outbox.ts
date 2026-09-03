import "server-only";
import type { Database } from "@/lib/db-types";
import { supabaseSerwer } from "@/lib/supabase/server";
import type { ZdarzenieOutbox } from "@/lib/zdarzenia";

export type { ZdarzenieOutbox } from "@/lib/zdarzenia";

/** Zapis zdarzenia z SPEC rozdz. 15. Wysyłka cronem (faza 5); tu tylko zapis, nigdy oczekiwanie na webhook. */
export async function dodajDoOutbox(event: ZdarzenieOutbox, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseSerwer()
    .from("outbox")
    .insert({ event, payload: payload as Database["public"]["Tables"]["outbox"]["Insert"]["payload"] });
  if (error) console.error("[outbox] nie zapisano zdarzenia", event, error.message);
}
