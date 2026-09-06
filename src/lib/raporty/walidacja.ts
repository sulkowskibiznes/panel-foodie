/**
 * Raporty (SPEC rozdz. 9): czysta walidacja linku i ciała webhooka. Panel nie generuje raportów,
 * tylko linkuje do systemu raportów; adres MUSI wskazywać na `raporty.foodiemedia.pl`, żeby wyciek
 * `INGEST_TOKEN` nie pozwolił podstawić klientowi obcego adresu (plan sesji startowej, D6a).
 */
import { z } from "zod";
import { copy } from "@/lib/copy";
import { NAZWY_MIESIECY } from "@/lib/format";
import { parsujMiesiac } from "@/lib/harmonogram/kalendarz";

export const HOST_RAPORTOW = "raporty.foodiemedia.pl";
export const MAKS_MIESIAC_WSPOLPRACY = 600;

/** Tylko https, dokładnie ten host, bez danych logowania w adresie. */
export function czyAdresRaportu(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return u.protocol === "https:" && u.hostname.toLowerCase() === HOST_RAPORTOW && u.username === "" && u.password === "";
}

export type OkresRaportu = { rok: number; miesiac: number };

/** „2026-08" → { rok, miesiac }; raporty zostają miesięczne (SPEC rozdz. 20 poz. 35). */
export function parsujOkresRaportu(wartosc: unknown): OkresRaportu | null {
  return typeof wartosc === "string" ? parsujMiesiac(wartosc.trim()) : null;
}

export function domyslnyTytulRaportu(okres: OkresRaportu): string {
  return copy.raporty.domyslnyTytul.replace("{miesiac}", NAZWY_MIESIECY[okres.miesiac - 1] ?? "").replace("{rok}", String(okres.rok));
}

/** Ciało `POST /api/ingest/report` z rozdz. 9; `location` opcjonalne (kat1 z kilkoma restauracjami). */
export const schematWebhookaRaportu = z.object({
  client_slug: z.string().trim().min(1).max(100),
  period: z.string().trim().regex(/^\d{4}-\d{2}$/),
  url: z.string().trim().max(500).refine(czyAdresRaportu, { message: `host ${HOST_RAPORTOW}` }),
  title: z.string().trim().max(200).optional().nullable(),
  cooperation_month: z.number().int().min(1).max(MAKS_MIESIAC_WSPOLPRACY).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
});

export type CialoWebhookaRaportu = z.infer<typeof schematWebhookaRaportu>;

export type LokalDoRaportu = { id: string; name: string };
export type WyborLokalu = { ok: true; locationId: string | null } | { ok: false; powod: "nieznany_lokal" | "brak_lokalu" };

/**
 * Do którego lokalu przypiąć raport: kat1 = raport per restauracja (nazwa obowiązkowa, gdy restauracji jest kilka),
 * kat2/kat3 = jeden raport na klienta, nazwa lokalu ignorowana. Dopasowanie po nazwie bez wielkości liter.
 */
export function wybierzLokalRaportu(kategoria: "kat1" | "kat2" | "kat3", lokale: LokalDoRaportu[], nazwa: string | null | undefined): WyborLokalu {
  if (kategoria !== "kat1") return { ok: true, locationId: null };
  const szukana = (nazwa ?? "").trim().toLowerCase();
  if (szukana) {
    const lokal = lokale.find((l) => l.name.trim().toLowerCase() === szukana);
    return lokal ? { ok: true, locationId: lokal.id } : { ok: false, powod: "nieznany_lokal" };
  }
  if (lokale.length === 1 && lokale[0]) return { ok: true, locationId: lokale[0].id };
  return { ok: false, powod: "brak_lokalu" };
}
