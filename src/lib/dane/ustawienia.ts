import "server-only";
import type { Database } from "@/lib/db-types";
import { DOMYSLNE_GODZINY_AUTO_AKCEPTACJI, type UstawieniaAutoAkceptacji } from "@/lib/pakiety/auto-akceptacja";
import { supabaseSerwer } from "@/lib/supabase/server";

export type KluczUstawienia = "auto_approve_hours" | "auto_approve_business_days" | "retention_months" | "onboarding_enabled";
type Json = Database["public"]["Tables"]["settings"]["Row"]["value"];

/** `true` albo napis "true" (ręczny wpis w panelu Supabase): obie postaci znaczą włączone. */
function czyPrawda(wartosc: Json | undefined): boolean {
  return wartosc === true || wartosc === "true";
}

export async function pobierzUstawienia(klucze: KluczUstawienia[]): Promise<Map<string, Json>> {
  const { data, error } = await supabaseSerwer().from("settings").select("key, value").in("key", klucze);
  if (error) throw new Error(`pobierzUstawienia: ${error.message}`);
  return new Map((data ?? []).map((w) => [w.key, w.value]));
}

/** Globalne ustawienia auto-akceptacji (SPEC rozdz. 6.4). Nadpisanie per klient dokłada maszyna stanów. */
export async function pobierzUstawieniaAutoAkceptacji(): Promise<UstawieniaAutoAkceptacji> {
  const mapa = await pobierzUstawienia(["auto_approve_hours", "auto_approve_business_days"]);
  const godziny = Number(mapa.get("auto_approve_hours"));
  return {
    godziny: Number.isFinite(godziny) && godziny > 0 ? godziny : DOMYSLNE_GODZINY_AUTO_AKCEPTACJI,
    dniRobocze: czyPrawda(mapa.get("auto_approve_business_days")),
  };
}

export async function zapiszUstawienie(klucz: KluczUstawienia, wartosc: Json, updatedBy: string | null): Promise<void> {
  const { error } = await supabaseSerwer().from("settings").upsert({ key: klucz, value: wartosc, updated_at: new Date().toISOString(), updated_by: updatedBy }, { onConflict: "key" });
  if (error) throw new Error(`zapiszUstawienie: ${error.message}`);
}
