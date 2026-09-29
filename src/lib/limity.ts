import "server-only";
import { supabaseSerwer } from "@/lib/supabase/server";

/** SPEC rozdz. 4.3: 20 prób PIN-u z jednego IP na 10 minut. */
export const LIMIT_PIN_IP = { max: 20, oknoSekund: 600 } as const;

/** Atomowy licznik w tabeli rate_limits (funkcja zwieksz_limit). Zwraca liczbę prób w oknie. */
export async function zwiekszLicznik(klucz: string, oknoSekund: number): Promise<number> {
  const { data, error } = await supabaseSerwer().rpc("zwieksz_limit", { p_key: klucz, p_okno_sekund: oknoSekund });
  if (error) throw new Error(`zwieksz_limit: ${error.message}`);
  return data ?? 0;
}

export async function czyPrzekroczonyLimitIp(ipHash: string): Promise<boolean> {
  const proby = await zwiekszLicznik(`pin:ip:${ipHash}`, LIMIT_PIN_IP.oknoSekund);
  return proby > LIMIT_PIN_IP.max;
}

/** `blokada24h` tylko przy przejściu na 10. próbę (jeden alarm); `zamrozony` = druga blokada 24 h w ciągu 30 dni, właśnie teraz. */
export type WynikNieudanejProby = { proby: number; zablokowanyDo: string | null; blokada24h: boolean; zamrozony: boolean };

/** Nieudana próba PIN-u dla linku: okno 24 h, blokady 15 min / 24 h i zamrożenie liczone atomowo w bazie jednym zapisem. */
export async function odnotujNieudaneLogowanie(linkId: string): Promise<WynikNieudanejProby> {
  const { data, error } = await supabaseSerwer().rpc("odnotuj_nieudane_logowanie", { p_link_id: linkId });
  if (error) throw new Error(`odnotuj_nieudane_logowanie: ${error.message}`);
  const wiersz = Array.isArray(data) ? data[0] : data;
  return {
    proby: wiersz?.proby ?? 0,
    zablokowanyDo: wiersz?.zablokowany_do ?? null,
    blokada24h: wiersz?.blokada_24h ?? false,
    zamrozony: wiersz?.zamrozony ?? false,
  };
}

/** Identyfikator, który nie istnieje: ścieżka „zły token" wykonuje ten sam zapis co „zły PIN", żeby czas odpowiedzi był identyczny. */
export const NIEISTNIEJACY_LINK = "00000000-0000-0000-0000-000000000000";
