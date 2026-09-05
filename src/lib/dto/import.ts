import type { SekcjaOpisu } from "@/lib/drive/opisy";
import type { Dopasowanie } from "@/lib/drive/parowanie";
import type { OstrzezenieFolderu } from "@/lib/import/ocena";
import type { PlikPlanu } from "@/lib/import/plan";

/**
 * Kształty danych ekranu importu (SPEC rozdz. 13): karta weryfikacyjna, propozycja mapowania i stan zadań.
 * Strony i komponenty dostają wyłącznie te typy (CLAUDE.md, zasada 13); identyfikatory z Dysku są tu jawne,
 * bo zespół i tak widzi linki, a mutacje sprawdzają je ponownie po stronie serwera.
 */
export type RodzajFolderu = "content" | "reklamy";

export type StanKarty = "brak_linku" | "nie_znaleziono" | "zablokowany" | "ok";

export type BladKarty = { rodzaj: "limit"; nazwa: string; waga: string; limit: string } | { rodzaj: "dysk"; komunikat: string };

export type KartaWeryfikacyjna = {
  rodzaj: RodzajFolderu;
  kampaniaId: string | null;
  kampaniaNazwa: string | null;
  folderId: string | null;
  url: string | null;
  stan: StanKarty;
  /** Pełna ścieżka od „Materiałów klientów" włącznie; pusta poza nimi. */
  sciezka: string[];
  liczbaPlikow: number;
  typy: { obrazy: number; wideo: number; dokumenty: number; inne: number };
  zmodyfikowanoO: string | null;
  pierwszePliki: string[];
  ostrzezenia: OstrzezenieFolderu[];
  blad: BladKarty | null;
  podfoldery: { posty: string | null; relacje: string | null };
};

export type PlikPropozycji = PlikPlanu & { rodzajMediow: "obraz" | "wideo"; miniaturaUrl: string | null };

export type MaterialPropozycji = {
  klucz: string;
  rodzaj: "post" | "reels" | "relacja";
  tytul: string;
  opis: string | null;
  dopasowanie: Dopasowanie;
  zrodloOpisu: { dokumentId: string; numer: number | null } | null;
  pliki: PlikPropozycji[];
  pominiety: boolean;
};

export type PodgladDokumentu = { dokumentId: string; nazwa: string; sekcje: SekcjaOpisu[]; wstep: string };

export type PropozycjaContentu = {
  rodzaj: "content";
  folderId: string;
  materialy: MaterialPropozycji[];
  dokumenty: PodgladDokumentu[];
  nieuzyteSekcje: Array<{ dokumentId: string; nazwaDokumentu: string; sekcja: SekcjaOpisu }>;
};

export type PropozycjaReklam = {
  rodzaj: "reklamy";
  folderId: string;
  kampaniaId: string;
  kampaniaNazwa: string;
  grafiki: Array<PlikPropozycji & { pominiety: boolean }>;
  teksty: string[];
  naglowki: string[];
  opis: string | null;
  cta: string | null;
  link: string | null;
  dokumenty: string[];
  rozpoznanoSekcje: boolean;
};

export type Propozycja = PropozycjaContentu | PropozycjaReklam;

export type StatusZadania = "oczekuje" | "trwa" | "zakonczony" | "blad";

export type ZadanieImportuDto = {
  id: string;
  rodzaj: "content" | "reklamy" | "dodatkowy" | "podmiana";
  kampaniaNazwa: string | null;
  status: StatusZadania;
  razem: number;
  gotowe: number;
  ostrzezenia: string[];
  blad: string | null;
  sciezka: string[];
  utworzonoO: string;
  zakonczonoO: string | null;
  proby: number;
  /** `trwa` bez bicia serca od kilku minut: funkcja umarła w połowie, trzeba wznowić. */
  zawieszone: boolean;
};

export type StanImportu = { zadania: ZadanieImportuDto[]; wToku: boolean };
