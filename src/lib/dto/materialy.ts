import type { Database } from "@/lib/db-types";

/**
 * DTO ekranu pakietu i podglądów (CLAUDE.md, zasada 13): strony klienta i zespołu dostają wyłącznie
 * te kształty, nigdy surowe wiersze. Adresy plików są gotowe (trasa z kontrolą dostępu), pola zespołu
 * (`internal_note`, `storage_path`, `created_by`) tu nie istnieją.
 */
export type TypMaterialu = Database["public"]["Enums"]["item_type"];
export type RodzajWariantu = Database["public"]["Enums"]["variant_kind"];
export type CelKampanii = Database["public"]["Enums"]["campaign_goal"];
export type StatusPakietu = Database["public"]["Enums"]["package_status"];
export type KategoriaKlienta = Database["public"]["Enums"]["client_category"];
export type RodzajAkceptacji = Database["public"]["Enums"]["approval_kind"];

export type PlikDto = {
  id: string;
  rodzaj: "obraz" | "wideo";
  previewUrl: string;
  thumbUrl: string;
  szerokosc: number | null;
  wysokosc: number | null;
  czasMs: number | null;
  pozycja: number;
  nazwa: string | null;
};

/** Strona klienta w ramce podglądu: nazwa strony FB, nick IG i zdjęcie profilowe (wyłącznie wewnątrz ramki). */
export type StronaDto = {
  lokalId: string;
  nazwaLokalu: string;
  nazwaStrony: string;
  igHandle: string | null;
  avatarUrl: string | null;
};

export type KomentarzDto = {
  id: string;
  autor: "klient" | "zespol";
  autorNazwa: string;
  tresc: string;
  runda: number;
  poAkceptacji: boolean;
  utworzonoO: string;
  zalatwionoO: string | null;
  /** Dla klienta: odpowiedź zespołu jeszcze nieprzeczytana; dla zespołu: uwaga klienta jeszcze nieprzeczytana. */
  nieprzeczytany: boolean;
  materialId: string | null;
  wariantId: string | null;
};

export type WariantDto = {
  id: string;
  rodzaj: RodzajWariantu;
  pozycja: number;
  etykieta: string | null;
  tekst: string | null;
  plik: PlikDto | null;
  /** null = wspólny dla wszystkich lokali; wypełnione = tylko dla tego lokalu (SPEC rozdz. 3.1, 7.4). */
  lokalId: string | null;
};

export type MaterialDto = {
  id: string;
  typ: TypMaterialu;
  pozycja: number;
  tytul: string;
  opis: string | null;
  publikacjaO: string | null;
  lokaleIds: string[];
  /** `updated_in_round = round`: plakietka „Poprawione" (SPEC rozdz. 6.5). */
  poprawiony: boolean;
  /** `added_after_submit`: plakietka „Nowe". */
  nowy: boolean;
  pliki: PlikDto[];
  warianty: WariantDto[];
  kampaniaId: string | null;
  komentarze: KomentarzDto[];
};

export type KampaniaDto = {
  id: string;
  nazwa: string;
  cel: CelKampanii | null;
  notatka: string | null;
  pozycja: number;
  reklama: MaterialDto | null;
  /** Wklejony link do folderu z reklamami (SPEC rozdz. 12.3); tylko dla zespołu, klient dostaje null. */
  folderReklamUrl: string | null;
};

export type PakietSzczegoly = {
  id: string;
  kategoria: KategoriaKlienta;
  tytul: string;
  status: StatusPakietu;
  runda: number;
  okres: { rok: number; miesiac: number };
  wyslanoO: string | null;
  autoWlaczona: boolean;
  /** `clients.auto_approve_default`: domyślna wartość checkboxa przy wysyłce (zespół). */
  autoDomyslnaKlienta: boolean;
  autoAkceptacjaO: string | null;
  zaakceptowanoO: string | null;
  zaakceptowal: string | null;
  rodzajAkceptacji: RodzajAkceptacji | null;
  /** Ostatnie cofnięcie do poprawek, gdy pakiet nadal jest w `poprawki` (baner z 1.4, poz. 31). */
  cofniecie: { kiedyO: string; powod: string } | null;
  zmienionePoAkceptacji: boolean;
  /** Wklejony link do folderu z contentem; tylko dla zespołu, klient dostaje null. */
  folderContentuUrl: string | null;
  /** Dzień zakończenia pakietu (`period_to`, SPEC rozdz. 8) jako YYYY-MM-DD. */
  koniecOkresu: string | null;
  lokale: StronaDto[];
  posty: MaterialDto[];
  relacje: MaterialDto[];
  kampanie: KampaniaDto[];
  komentarzePakietu: KomentarzDto[];
  /** Id materiałów obejrzanych z tego linku (pasek „Obejrzano 12 z 19"). */
  obejrzane: string[];
  liczbaMaterialow: number;
  uwagiKlientaWRundzie: number;
  nierozwiazaneUwagiKlienta: number;
};

export type PakietNaLiscie = {
  id: string;
  tytul: string;
  status: StatusPakietu;
  runda: number;
  okres: { rok: number; miesiac: number };
  nazwaLokalu: string | null;
  wyslanoO: string | null;
  autoAkceptacjaO: string | null;
  autoWlaczona: boolean;
  liczbaPostow: number;
  liczbaRelacji: number;
  liczbaKampanii: number;
  nierozwiazaneUwagi: number;
  nieprzeczytaneUwagi: number;
};
