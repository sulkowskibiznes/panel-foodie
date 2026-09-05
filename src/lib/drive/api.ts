import type { RodzajPlikuDysku } from "@/lib/drive/parowanie";

/**
 * Wąski kontrakt na Dysk Google (SPEC rozdz. 13): tylko odczyt metadanych, listowanie folderu, pobranie
 * zawartości i eksport Dokumentu Google do text/plain. Dwie implementacje: konto usługi (lib/drive/google.ts)
 * i atrapa na lokalny Supabase (lib/drive/atrapa.ts, testy E2E i `pnpm dev:lokalny`). Panel nigdy nie zapisuje na Dysku.
 */
export const MIME_FOLDERU = "application/vnd.google-apps.folder";
export const MIME_DOKUMENTU = "application/vnd.google-apps.document";
export const MIME_SKROTU = "application/vnd.google-apps.shortcut";
export const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type PlikDysku = {
  id: string;
  nazwa: string;
  mime: string;
  rodzaj: RodzajPlikuDysku;
  bytes: number | null;
  zmodyfikowanoO: string | null;
  szerokosc: number | null;
  wysokosc: number | null;
  czasMs: number | null;
};

export type MetadaneDysku = PlikDysku & {
  /** Identyfikatory folderów nadrzędnych (na Dysku plik może mieć ich kilka; folder zawsze jeden). */
  rodzice: string[];
  /** Dysk współdzielony, na którym leży plik; null na „Moim dysku". */
  driveId: string | null;
  wKoszu: boolean;
};

export type ZawartoscPliku = { bajty: Uint8Array; mime: string | null; rozmiar: number | null };

export interface DriveApi {
  /** null, gdy plik nie istnieje albo konto usługi go nie widzi (nie rozróżniamy, jak przy 404). */
  metadane(id: string): Promise<MetadaneDysku | null>;
  /** Bezpośrednia zawartość folderu (bez kosza), w kolejności z API; sortowanie naturalne robi panel. */
  listuj(folderId: string): Promise<PlikDysku[]>;
  /** Zawartość pliku; `zakres` = pierwsze N bajtów (magic bytes) bez ściągania całości. */
  pobierz(id: string, opcje?: { pierwszeBajty?: number }): Promise<ZawartoscPliku | null>;
  /** Tekst dokumentu: Dokument Google przez eksport do text/plain, .docx przez rozpakowanie, zwykły plik tekstowy wprost. */
  eksportujTekst(id: string, mime: string): Promise<string | null>;
  /** Miniatura (do 400 px) na ekran mapowania; null, gdy Dysk jej nie ma. */
  miniatura(id: string): Promise<ZawartoscPliku | null>;
}

export class BladDysku extends Error {
  constructor(
    message: string,
    readonly kod: "konfiguracja" | "autoryzacja" | "siec" | "limit" | "odpowiedz",
    readonly status?: number,
  ) {
    super(message);
    this.name = "BladDysku";
  }
}
