import { unzipSync } from "fflate";

/**
 * Tekst z pliku .docx (Word): content creatorzy trzymają opisy postów i teksty reklam w Wordzie, nie w Dokumentach
 * Google, więc Drive nie wyeksportuje ich do text/plain. Czysta logika: rozpakowanie word/document.xml i akapity.
 * Akapity z numeracją Worda (w:numPr) dostają prefiks „- ", żeby podział na pozycje (lib/drive/opisy.ts) je rozdzielił.
 */
const ENCJE: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

function odkodujXml(tekst: string): string {
  return tekst.replace(/&(?:amp|lt|gt|quot|apos);|&#x([0-9a-fA-F]+);|&#(\d+);/g, (m, hex?: string, dec?: string) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (dec) return String.fromCodePoint(Number(dec));
    return ENCJE[m] ?? m;
  });
}

/** Akapity dokumentu; pusty akapit to pusta linia (granica bloku w rozbiorze tekstów). */
export function akapityZDocx(bajty: Uint8Array): string[] {
  let pliki: Record<string, Uint8Array>;
  try {
    pliki = unzipSync(bajty, { filter: (f) => f.name === "word/document.xml" });
  } catch {
    return [];
  }
  const xmlBajty = pliki["word/document.xml"];
  if (!xmlBajty) return [];
  const xml = new TextDecoder("utf-8").decode(xmlBajty);
  const akapity: string[] = [];
  // Pusty akapit „<w:p/>" musi trafić w drugą gałąź, więc pierwsza wyklucza znacznik samozamykający.
  const wzorAkapitu = /<w:p\b(?![^>]*\/>)[^>]*>([\s\S]*?)<\/w:p>|<w:p\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = wzorAkapitu.exec(xml)) !== null) {
    const wnetrze = m[1] ?? "";
    const numerowany = /<w:numPr\b/.test(wnetrze);
    const czesci: string[] = [];
    const wzorWezla = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:t\b[^>]*\/>|<w:(br|cr)\b[^>]*\/>|<w:tab\b[^>]*\/>/g;
    let w: RegExpExecArray | null;
    while ((w = wzorWezla.exec(wnetrze)) !== null) {
      if (w[0].startsWith("<w:t")) {
        if (w[0].startsWith("<w:tab")) czesci.push(" ");
        else czesci.push(odkodujXml(w[1] ?? ""));
      } else czesci.push("\n");
    }
    const tekst = czesci.join("").replace(/ /g, " ").trim();
    akapity.push(tekst && numerowany ? `- ${tekst}` : tekst);
  }
  return akapity;
}

export function tekstZDocx(bajty: Uint8Array): string {
  return akapityZDocx(bajty).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
