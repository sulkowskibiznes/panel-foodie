import "server-only";
import type { Database } from "@/lib/db-types";
import { supabaseSerwer } from "@/lib/supabase/server";

type StatusOutbox = Database["public"]["Enums"]["outbox_status"];

export type ZdarzenieWKolejce = {
  id: number;
  event: string;
  klient: string | null;
  podsumowanie: string | null;
  status: StatusOutbox;
  proby: number;
  ostatniBlad: string | null;
  nastepnaProbaO: string | null;
  utworzonoO: string;
  wyslanoO: string | null;
};

/** Ustawienia -> Powiadomienia (admin): ostatnie zdarzenia kolejki, bez pełnego payloadu. */
export async function pobierzKolejkePowiadomien(limit = 100): Promise<ZdarzenieWKolejce[]> {
  const { data, error } = await supabaseSerwer().from("outbox").select("id, event, payload, status, attempts, last_error, next_attempt_at, created_at, sent_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`pobierzKolejkePowiadomien: ${error.message}`);
  return (data ?? []).map((w) => {
    const p = (w.payload ?? {}) as Record<string, unknown>;
    return {
      id: w.id,
      event: w.event,
      klient: typeof p.client_name === "string" ? p.client_name : null,
      podsumowanie: typeof p.summary === "string" ? p.summary : null,
      status: w.status,
      proby: w.attempts,
      ostatniBlad: w.last_error,
      nastepnaProbaO: w.status === "pending" ? w.next_attempt_at : null,
      utworzonoO: w.created_at,
      wyslanoO: w.sent_at,
    };
  });
}

/** „Ponów": zdarzenie wraca do kolejki z licznikiem prób od zera, cron weźmie je w najbliższej minucie. */
export async function ponowPowiadomienie(id: number): Promise<boolean> {
  const { data, error } = await supabaseSerwer().from("outbox").update({ status: "pending", attempts: 0, last_error: null, next_attempt_at: new Date().toISOString() }).eq("id", id).in("status", ["failed", "pending"]).select("id");
  if (error) throw new Error(`ponowPowiadomienie: ${error.message}`);
  return (data ?? []).length === 1;
}
