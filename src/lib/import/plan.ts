import { z } from "zod";
import { czyRodzajPliku, formatujMB, limitBajtow, MAKS_BAJTOW_OBRAZU, MAKS_BAJTOW_WIDEO, OSTRZEZENIE_BAJTOW_WIDEO } from "@/lib/pliki/magia";

/**
 * Plan importu (SPEC rozdz. 13.3, 13.4): to, co człowiek potwierdził na ekranie mapowania, zapisane w `import_jobs.plan`.
 * Czysty moduł: kształt, walidacja zod tego, co przysyła przeglądarka, limity wagi z metadanych Dysku
 * (zanim cokolwiek ściągniemy) i liczniki do paska postępu. Postęp per plik (`assetId`) też siedzi tutaj,
 * więc ponowienie po błędzie pomija to, co już jest w Storage.
 */
export const plikPlanuSchemat = z.object({
  id: z.string().min(5).max(200),
  nazwa: z.string().min(1).max(300),
  mime: z.string().min(1).max(120),
  bytes: z.number().int().nonnegative().nullable(),
  assetId: z.string().nullable().optional(),
});

export const materialPlanuSchemat = z.object({
  klucz: z.string().min(1).max(200),
  rodzaj: z.enum(["post", "reels", "relacja"]),
  tytul: z.string().trim().min(1).max(160),
  opis: z.string().max(6000).nullable(),
  pliki: z.array(plikPlanuSchemat).min(1).max(20),
  pominiety: z.boolean().optional(),
  itemId: z.string().nullable().optional(),
});

export const planContentuSchemat = z.object({
  rodzaj: z.literal("content"),
  folderId: z.string().min(5).max(200),
  materialy: z.array(materialPlanuSchemat).max(200),
});

export const planReklamSchemat = z.object({
  rodzaj: z.literal("reklamy"),
  folderId: z.string().min(5).max(200),
  kampaniaId: z.string().uuid(),
  grafiki: z.array(plikPlanuSchemat.extend({ pominiety: z.boolean().optional() })).max(60),
  teksty: z.array(z.string().trim().max(4000)).max(10),
  naglowki: z.array(z.string().trim().max(300)).max(10),
  opis: z.string().trim().max(1000).nullable(),
  cta: z.string().trim().max(60).nullable(),
  link: z.string().trim().max(500).nullable(),
  itemId: z.string().nullable().optional(),
  wariantyZapisane: z.boolean().optional(),
});

export const planSchemat = z.discriminatedUnion("rodzaj", [planContentuSchemat, planReklamSchemat]);

export type PlikPlanu = z.infer<typeof plikPlanuSchemat>;
export type MaterialPlanu = z.infer<typeof materialPlanuSchemat>;
export type PlanContentu = z.infer<typeof planContentuSchemat>;
export type PlanReklam = z.infer<typeof planReklamSchemat>;
export type Plan = z.infer<typeof planSchemat>;

/** Pliki, które import faktycznie skopiuje (bez pominiętych). */
export function plikiPlanu(plan: Plan): PlikPlanu[] {
  if (plan.rodzaj === "content") return plan.materialy.filter((m) => !m.pominiety).flatMap((m) => m.pliki);
  return plan.grafiki.filter((g) => !g.pominiety);
}

export function policzPostep(plan: Plan): { razem: number; gotowe: number } {
  const pliki = plikiPlanu(plan);
  return { razem: pliki.length, gotowe: pliki.filter((p) => !!p.assetId).length };
}

export type NaruszenieLimitu = { nazwa: string; bytes: number; limit: number; komunikat: { nazwa: string; waga: string; limit: string } };

/**
 * Limity z SPEC rozdz. 13.4 sprawdzane na metadanych, zanim ściągniemy choć bajt: obraz 25 MB, wideo 300 MB.
 * Pierwsze naruszenie przerywa import z komunikatem, który plik i ile waży.
 */
export function sprawdzLimity(pliki: Array<{ nazwa: string; mime: string; bytes: number | null }>): NaruszenieLimitu | null {
  for (const p of pliki) {
    if (p.bytes === null) continue;
    const mime = p.mime.toLowerCase();
    const limit = czyRodzajPliku(mime) ? limitBajtow(mime) : mime.startsWith("video/") ? MAKS_BAJTOW_WIDEO : MAKS_BAJTOW_OBRAZU;
    if (p.bytes > limit) return { nazwa: p.nazwa, bytes: p.bytes, limit, komunikat: { nazwa: p.nazwa, waga: formatujMB(p.bytes), limit: formatujMB(limit) } };
  }
  return null;
}

/** Wideo powyżej 150 MB: ostrzeżenie, nie blokada. */
export function duzeWideo(pliki: Array<{ nazwa: string; mime: string; bytes: number | null }>): Array<{ nazwa: string; waga: string }> {
  return pliki.filter((p) => p.mime.toLowerCase().startsWith("video/") && p.bytes !== null && p.bytes > OSTRZEZENIE_BAJTOW_WIDEO).map((p) => ({ nazwa: p.nazwa, waga: formatujMB(p.bytes ?? 0) }));
}

/** Pliki obsługiwane przez panel (magic bytes sprawdzamy dopiero po pobraniu; tu tylko deklarowany mime). */
export function czyObslugiwanyMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return czyRodzajPliku(m) || m === "image/heif" || m === "video/x-m4v";
}
