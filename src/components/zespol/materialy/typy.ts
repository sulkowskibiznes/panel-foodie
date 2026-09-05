import type { WynikPlikuZDysku } from "@/lib/import/pojedynczy";
import type { WynikPrzygotowania, WynikZakonczenia } from "@/lib/pliki/upload";
import type { WynikZmiany } from "@/app/zespol/(panel)/klienci/[slug]/pakiety/[pakietId]/materialy-akcje";
import type { CelKampanii, TypMaterialu } from "@/lib/dto/materialy";

export type DaneKampaniiFormularz = { nazwa: string; cel: CelKampanii | null; notatka: string | null; folder: string | null; potwierdzono: boolean };

/** Akcje serwerowe zespołu nad pakietem, związane ze slugiem i id pakietu na stronie serwerowej. */
export type AkcjeMaterialow = {
  przygotuj: (plik: { nazwa: string; mime: string; bytes: number }) => Promise<WynikPrzygotowania>;
  zakoncz: (pozwolenie: string) => Promise<WynikZakonczenia>;
  /** Link do pojedynczego pliku na Dysku zamiast pliku z komputera (SPEC rozdz. 12.6); wynik to ten sam podpisany opis. */
  pobierzZDysku: (dane: { url: string; materialId: string | null; rodzaj: "dodatkowy" | "podmiana" }) => Promise<WynikPlikuZDysku>;
  dodajMaterial: (dane: { typ: TypMaterialu; kampaniaId: string | null; tytul: string | null; pozycja: number | null; opis: string; potwierdzono: boolean }) => Promise<WynikZmiany>;
  podmienPlik: (dane: { materialId: string; assetId: string; opis: string; potwierdzono: boolean }) => Promise<WynikZmiany>;
  dodajPlik: (dane: { materialId: string; opis: string; potwierdzono: boolean }) => Promise<WynikZmiany>;
  usunPlik: (dane: { materialId: string; assetId: string; potwierdzono: boolean }) => Promise<WynikZmiany>;
  edytujMaterial: (dane: { materialId: string; tytul?: string | null; opis?: string | null; publikacja?: string | null; lokaleIds?: string[]; potwierdzono: boolean }) => Promise<WynikZmiany>;
  usunMaterial: (materialId: string) => Promise<WynikZmiany>;
  zapiszReklame: (dane: { materialId: string; teksty: { id: string | null; tekst: string }[]; naglowki: { id: string | null; tekst: string }[]; opis: string | null; cta: string | null; link: string | null; perLokal: { lokalId: string; link: string | null; cta: string | null; opis: string | null }[]; potwierdzono: boolean }) => Promise<WynikZmiany>;
  dodajKampanie: (dane: DaneKampaniiFormularz) => Promise<WynikZmiany & { kampaniaId?: string }>;
  edytujKampanie: (kampaniaId: string, dane: DaneKampaniiFormularz) => Promise<WynikZmiany>;
  usunKampanie: (kampaniaId: string) => Promise<WynikZmiany>;
  edytujPakiet: (dane: { tytul?: string; folder?: string | null; koniecOkresu?: string | null }) => Promise<WynikZmiany>;
};

export type UprawnieniaMaterialow = { content: boolean; kampanie: boolean };

export const POLE = "mt-1 h-10 w-full rounded-lg border border-szary-300 bg-white px-3 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30";
export const POLE_TEKSTOWE = "mt-1 w-full rounded-lg border border-szary-300 bg-white px-3 py-2 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30";
