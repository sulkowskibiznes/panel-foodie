/**
 * Sześć placementów reklamy (SPEC rozdz. 7.4, rozdz. 20 poz. 14): cztery na Facebooku, dwa na Instagramie.
 * Instagramowe wymagają nicka (`locations.ig_handle`); bez niego są wyszarzone, nie ukryte.
 */
export type Placement = "fb_kanal_telefon" | "fb_kanal_komputer" | "fb_relacje" | "fb_reels" | "ig_kanal" | "ig_relacje_reels";
export type GrupaPlacementu = "facebook" | "instagram";

export type OpisPlacementu = { id: Placement; grupa: GrupaPlacementu; wymagaIg: boolean; pionowy: boolean };

export const PLACEMENTY: readonly OpisPlacementu[] = [
  { id: "fb_kanal_telefon", grupa: "facebook", wymagaIg: false, pionowy: false },
  { id: "fb_kanal_komputer", grupa: "facebook", wymagaIg: false, pionowy: false },
  { id: "fb_relacje", grupa: "facebook", wymagaIg: false, pionowy: true },
  { id: "fb_reels", grupa: "facebook", wymagaIg: false, pionowy: true },
  { id: "ig_kanal", grupa: "instagram", wymagaIg: true, pionowy: false },
  { id: "ig_relacje_reels", grupa: "instagram", wymagaIg: true, pionowy: true },
];

export const DOMYSLNY_PLACEMENT: Placement = "fb_kanal_telefon";

export function czyPlacement(wartosc: string): wartosc is Placement {
  return PLACEMENTY.some((p) => p.id === wartosc);
}

export function placementDostepny(p: OpisPlacementu, igHandle: string | null): boolean {
  return !p.wymagaIg || !!igHandle;
}
