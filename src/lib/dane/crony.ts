import "server-only";
import { NAZWY_CRONOW, odczytajPrzebieg, type NazwaCrona, type PrzebiegCrona } from "@/lib/crony/monitoring";
import { supabaseSerwer } from "@/lib/supabase/server";

const PREFIKS = "cron:";

/**
 * Ostatni przebieg crona w tabeli `settings` (klucz `cron:<nazwa>`): jeden wiersz na crona, nadpisywany, więc cron
 * outboxu co minutę nie zaśmieca audytu. Błąd zapisu nie przerywa crona, tylko trafia do logów.
 */
export async function zapiszPrzebiegCrona(nazwa: NazwaCrona, bledy: number, teraz = new Date()): Promise<void> {
  const { error } = await supabaseSerwer()
    .from("settings")
    .upsert({ key: `${PREFIKS}${nazwa}`, value: { at: teraz.toISOString(), bledy }, updated_at: teraz.toISOString(), updated_by: null }, { onConflict: "key" });
  if (error) console.error("[crony] nie zapisano przebiegu", nazwa, error.message);
}

export async function pobierzPrzebiegiCronow(): Promise<Partial<Record<NazwaCrona, PrzebiegCrona>>> {
  const { data, error } = await supabaseSerwer()
    .from("settings")
    .select("key, value")
    .in(
      "key",
      NAZWY_CRONOW.map((n) => `${PREFIKS}${n}`),
    );
  if (error) throw new Error(`pobierzPrzebiegiCronow: ${error.message}`);
  const wynik: Partial<Record<NazwaCrona, PrzebiegCrona>> = {};
  for (const w of data ?? []) {
    const przebieg = odczytajPrzebieg(w.value);
    if (przebieg) wynik[w.key.slice(PREFIKS.length) as NazwaCrona] = przebieg;
  }
  return wynik;
}

export async function liczNieudaneOutbox(): Promise<number> {
  const { count, error } = await supabaseSerwer().from("outbox").select("id", { count: "exact", head: true }).eq("status", "failed");
  if (error) throw new Error(`liczNieudaneOutbox: ${error.message}`);
  return count ?? 0;
}
