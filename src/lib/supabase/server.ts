import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db-types";
import { env } from "@/lib/env";

/**
 * Jedyny klient Supabase do danych. Klucz sb_secret_ omija RLS, więc każdy odczyt i zapis
 * danych klienta MUSI przejść przez assertClientAccess() (CLAUDE.md, zasada 1).
 * Typy z `pnpm db:types` (src/lib/db-types.ts, generowane, nie pisane ręcznie).
 */
let klient: SupabaseClient<Database> | undefined;

export function supabaseSerwer(): SupabaseClient<Database> {
  if (!klient) {
    const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env();
    klient = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return klient;
}
