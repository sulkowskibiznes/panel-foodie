import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Jedyny klient Supabase do danych. Klucz sb_secret_ omija RLS, więc każdy odczyt i zapis
 * danych klienta MUSI przejść przez assertClientAccess() (CLAUDE.md, zasada 1).
 * Generyk Database dochodzi po `pnpm db:types`.
 */
let klient: SupabaseClient | undefined;

export function supabaseSerwer(): SupabaseClient {
  if (!klient) {
    const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env();
    klient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return klient;
}
