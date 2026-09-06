import type { Database } from "@/lib/db-types";

/** Kształty danych dla stron klienta. Nigdy surowe wiersze z bazy (CLAUDE.md, zasada 13). */
export type StatusPakietu = Database["public"]["Enums"]["package_status"];
export type StatusFaktury = Database["public"]["Enums"]["invoice_status"];
export type RodzajDokumentu = Database["public"]["Enums"]["document_kind"];
export type TierPakietu = Database["public"]["Enums"]["package_tier"];
export type KategoriaKlienta = Database["public"]["Enums"]["client_category"];

export type PakietDlaKlienta = {
  id: string;
  tytul: string;
  status: StatusPakietu;
  runda: number;
  liczbaPostow: number;
  liczbaRelacji: number;
  liczbaKampanii: number;
  wyslanoO: string | null;
  autoAkceptacjaO: string | null;
};

export type KlientDlaKlienta = { id: string; nazwa: string };

/** Raport (SPEC rozdz. 5.5): link do systemu raportów, bez osadzania. */
export type RaportDlaKlienta = {
  id: string;
  rok: number;
  miesiac: number;
  tytul: string;
  url: string;
  miesiacWspolpracy: number | null;
  nazwaLokalu: string | null;
  opublikowanoO: string;
};

/** Faktura (SPEC rozdz. 5.6): bez notatki wewnętrznej i bez ścieżki w Storage. */
export type FakturaDlaKlienta = {
  id: string;
  numer: string;
  wystawiono: string;
  termin: string;
  netto: number;
  brutto: number;
  status: StatusFaktury;
  zaplaconoDnia: string | null;
  maPdf: boolean;
};

export type DokumentDlaKlienta = {
  id: string;
  rodzaj: RodzajDokumentu;
  tytul: string;
  obowiazujeOd: string | null;
  dodanoO: string;
};

/** „Twój pakiet" (SPEC rozdz. 5.7): opiekun tylko z imieniem i kanałem kontaktu, bez numerów prywatnych. */
export type TwojPakiet = {
  tier: TierPakietu;
  kategoria: KategoriaKlienta;
  kwotaNetto: number | null;
  lokale: string[];
  opiekun: { imie: string; kontakt: string | null } | null;
  wspolpracaOd: string | null;
};

export type UslugaDlaKlienta = {
  id: string;
  slug: string;
  nazwa: string;
  opis: string;
  ikona: string | null;
  cta: string;
  /** Ostatnie zgłoszenie tego klienta (dowolna osoba kontaktowa) albo null. */
  zgloszonoO: string | null;
};

export type NajblizszaPublikacja = { pakietId: string; tytul: string; typ: Database["public"]["Enums"]["item_type"]; publikacjaO: string };

export type KrokWdrozenia = { id: string; pozycja: number; tytul: string; opis: string | null; formUrl: string | null; externalUrl: string | null; zrobionoO: string | null };
