import type { CSSProperties } from "react";
import type { PlikDto, StronaDto } from "@/lib/dto/materialy";

/** Strona w ramce podglądu: nazwa, nick i zdjęcie profilowe. Nic poza tym nie jest brandingiem klienta. */
export type Strona = Pick<StronaDto, "nazwaStrony" | "igHandle" | "avatarUrl">;

export const PROPORCJA_KANALU = { min: 4 / 5, max: 1.91 } as const;
export const PROPORCJA_PIONOWA = 9 / 16;

/** Proporcja szerokość / wysokość z wymiarów pliku; bez wymiarów zakładamy kwadrat. */
export function proporcjaPliku(plik: Pick<PlikDto, "szerokosc" | "wysokosc"> | null | undefined): number {
  if (!plik || !plik.szerokosc || !plik.wysokosc) return 1;
  return plik.szerokosc / plik.wysokosc;
}

/**
 * Decyzja z 2026-09-04: Facebook nie przycina grafik klienta (99 % postów to 4:5), więc pokazujemy
 * proporcję z pliku, tylko domykając skrajności tak, jak robi to kanał (nie wyżej niż 4:5, nie szerzej niż 1.91:1).
 */
export function proporcjaWKanale(plik: Pick<PlikDto, "szerokosc" | "wysokosc"> | null | undefined): number {
  return Math.min(PROPORCJA_KANALU.max, Math.max(PROPORCJA_KANALU.min, proporcjaPliku(plik)));
}

export function stylProporcji(proporcja: number): CSSProperties {
  return { aspectRatio: `${proporcja}` };
}

export function czyPionowy(plik: Pick<PlikDto, "szerokosc" | "wysokosc"> | null | undefined): boolean {
  return Math.abs(proporcjaPliku(plik) - PROPORCJA_PIONOWA) < 0.05;
}

export function inicjal(nazwa: string): string {
  return nazwa.trim().charAt(0).toUpperCase() || "?";
}
