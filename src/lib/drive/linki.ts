/**
 * Rozpoznawanie wklejonych linków do Dysku Google (SPEC rozdz. 12.3, 13.1). Czysta logika bez sieci:
 * kreator pakietu zapisuje wyciągnięty identyfikator już w fazie 3, sam import (konto usługi) dochodzi w fazie 4.
 *
 * Obsługiwane formaty adresu: /drive/folders/<id>, /drive/u/0/folders/<id>, ?id=<id>, /file/d/<id>.
 * Panel nigdy nie zgaduje ścieżki na Dysku (CLAUDE.md, zasada 11): albo link daje identyfikator, albo go nie ma.
 */
export type RodzajLinkuDysku = "folder" | "plik" | "nieznany";

export type LinkDysku = { rodzaj: RodzajLinkuDysku; id: string; url: string };

const HOSTY = new Set(["drive.google.com", "docs.google.com"]);
const ID = /^[A-Za-z0-9_-]{10,}$/;

export function rozpoznajLinkDysku(wejscie: string | null | undefined): LinkDysku | null {
  const tekst = (wejscie ?? "").trim();
  if (!tekst) return null;
  let url: URL;
  try {
    url = new URL(tekst);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !HOSTY.has(url.hostname.toLowerCase())) return null;
  const folder = /\/folders\/([A-Za-z0-9_-]+)/.exec(url.pathname)?.[1];
  if (folder && ID.test(folder)) return { rodzaj: "folder", id: folder, url: url.toString() };
  const plik = /\/file\/d\/([A-Za-z0-9_-]+)/.exec(url.pathname)?.[1];
  if (plik && ID.test(plik)) return { rodzaj: "plik", id: plik, url: url.toString() };
  const zZapytania = url.searchParams.get("id");
  if (zZapytania && ID.test(zZapytania)) return { rodzaj: "nieznany", id: zZapytania, url: url.toString() };
  return null;
}

/** Link do folderu: jednoznaczny folder albo `?id=` (rozstrzygnie API Dysku w fazie 4). Link do pojedynczego pliku odpada. */
export function czyLinkDoFolderu(link: LinkDysku | null): link is LinkDysku {
  return link !== null && link.rodzaj !== "plik";
}
