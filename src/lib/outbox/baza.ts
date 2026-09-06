import "server-only";
import { env } from "@/lib/env";
import { supabaseSerwer } from "@/lib/supabase/server";
import { MS_LIMITU_ZADANIA, type WynikZadania, type ZaleznosciOutbox } from "@/lib/outbox/wysylka";

/** POST JSON do Catch Hooka Zapiera (SPEC rozdz. 15); 2xx = dostarczone. Limit 10 s, żeby cron nie wisiał. */
export async function wyslijDoZapiera(url: string, cialo: Record<string, unknown>): Promise<WynikZadania> {
  try {
    const odp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "panel-foodie-outbox/1" },
      body: JSON.stringify(cialo),
      signal: AbortSignal.timeout(MS_LIMITU_ZADANIA),
      cache: "no-store",
    });
    if (odp.ok) return { ok: true, status: odp.status };
    return { ok: false, blad: `HTTP ${odp.status}` };
  } catch (blad) {
    return { ok: false, blad: blad instanceof Error ? `${blad.name}: ${blad.message}` : String(blad) };
  }
}

/** Zależności wysyłki: wiersze `pending` po terminie próby, zajęcie warunkowym UPDATE-em, oznaczenia wyniku. */
export function zaleznosciOutbox(url: string): ZaleznosciOutbox {
  const db = supabaseSerwer();
  return {
    async pobierzOczekujace(teraz, limit) {
      const { data, error } = await db.from("outbox").select("id, event, payload, attempts").eq("status", "pending").lte("next_attempt_at", teraz.toISOString()).order("created_at", { ascending: true }).limit(limit);
      if (error) throw new Error(`pobierzOczekujace: ${error.message}`);
      return (data ?? []).map((w) => ({ id: w.id, event: w.event, payload: (w.payload ?? {}) as Record<string, unknown>, attempts: w.attempts }));
    },
    async zajmij(id, attempts, doKiedy) {
      // Podbicie `attempts` w tym samym UPDATE sprawia, że drugi przebieg z tym samym wierszem (warunek attempts = stare) odpada.
      const { data, error } = await db.from("outbox").update({ next_attempt_at: doKiedy.toISOString(), attempts: attempts + 1 }).eq("id", id).eq("status", "pending").eq("attempts", attempts).select("id");
      if (error) throw new Error(`zajmij: ${error.message}`);
      return (data ?? []).length === 1;
    },
    wyslij: (cialo) => wyslijDoZapiera(url, cialo),
    async oznaczWyslane(id, attempts, teraz) {
      const { error } = await db.from("outbox").update({ status: "sent", attempts, sent_at: teraz.toISOString(), last_error: null }).eq("id", id);
      if (error) throw new Error(`oznaczWyslane: ${error.message}`);
    },
    async oznaczNieudane(id, dane) {
      const { error } = await db.from("outbox").update({ status: dane.failed ? "failed" : "pending", attempts: dane.attempts, last_error: dane.blad, next_attempt_at: (dane.nextAttemptAt ?? new Date()).toISOString() }).eq("id", id);
      if (error) throw new Error(`oznaczNieudane: ${error.message}`);
    },
    teraz: () => new Date(),
  };
}

/** Adres webhooka albo null, gdy nie skonfigurowano: wtedy cron zostawia kolejkę w spokoju. */
export function adresZapiera(): string | null {
  return env().ZAPIER_WEBHOOK_URL ?? null;
}
