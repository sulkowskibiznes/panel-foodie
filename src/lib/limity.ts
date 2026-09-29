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

export type RezerwacjaProby = { dozwolona: boolean; proby: number; zamrozony: boolean };

/**
 * Rezerwacja próby PIN-u PRZED argon2 (przegląd Etapu 2): pod blokadą wiersza nabija licznik jak nieudaną próbę,
 * nakłada blokady 15 min / 24 h i mówi, czy wolno weryfikować (wiersz nie był zablokowany ani zamrożony przed tą
 * próbą). Równoległe żądania dostają kolejne numery prób, więc nie przeskoczą blokady.
 */
export async function zarezerwujProbePinu(linkId: string): Promise<RezerwacjaProby> {
  const { data, error } = await supabaseSerwer().rpc("zarezerwuj_probe_pinu", { p_link_id: linkId });
  if (error) throw new Error(`zarezerwuj_probe_pinu: ${error.message}`);
  const w = Array.isArray(data) ? data[0] : data;
  return { dozwolona: w?.dozwolona ?? false, proby: w?.proby ?? 0, zamrozony: w?.zamrozony ?? false };
}

/** `blokada24h` tylko dla próby nr 10 (jeden alarm); `zamrozony` = druga blokada 24 h w ciągu 30 dni, właśnie teraz. */
export type WynikNieudanejProby = { proby: number; zablokowanyDo: string | null; blokada24h: boolean; zamrozony: boolean };

/** Potwierdzona porażka zarezerwowanej próby: alarm i zamrożenie liczone w bazie (funkcja potwierdz_nieudana_probe_pinu). */
export async function potwierdzNieudanaProbePinu(linkId: string, proby: number): Promise<WynikNieudanejProby> {
  const { data, error } = await supabaseSerwer().rpc("potwierdz_nieudana_probe_pinu", { p_link_id: linkId, p_proby: proby });
  if (error) throw new Error(`potwierdz_nieudana_probe_pinu: ${error.message}`);
  const w = Array.isArray(data) ? data[0] : data;
  return { proby, zablokowanyDo: w?.zablokowany_do ?? null, blokada24h: w?.blokada_24h ?? false, zamrozony: w?.zamrozony ?? false };
}

/** Udana próba: zerowanie licznika i blokad, jeśli po naszej rezerwacji nikt nie dołożył próby. */
export async function zerujProbyPinu(linkId: string, proby: number): Promise<boolean> {
  const { data, error } = await supabaseSerwer().rpc("zeruj_proby_pinu", { p_link_id: linkId, p_proby: proby });
  if (error) throw new Error(`zeruj_proby_pinu: ${error.message}`);
  return data === true;
}

/** Identyfikator, który nie istnieje: ścieżka „zły token" wykonuje ten sam zapis co „zły PIN", żeby czas odpowiedzi był identyczny. */
export const NIEISTNIEJACY_LINK = "00000000-0000-0000-0000-000000000000";
