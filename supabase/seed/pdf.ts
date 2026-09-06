/**
 * Minimalny, poprawny PDF (jedna strona A4, jeden wiersz tekstu w Helvetice) bez zależności.
 * Używa go seed (umowa, umowa powierzenia, PDF opłaconych faktur) i testy E2E (upload faktury i dokumentu).
 * Tekst wyłącznie ASCII: Helvetica bez osadzonej czcionki nie zna polskich znaków.
 */
function ascii(tekst: string): string {
  return tekst
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/[\\()]/g, (z) => `\\${z}`);
}

export function prostyPdf(tytul: string, podtytul = ""): Buffer {
  const tresc = `BT /F1 24 Tf 72 770 Td (${ascii(tytul)}) Tj ET\nBT /F1 12 Tf 72 740 Td (${ascii(podtytul)}) Tj ET`;
  const obiekty = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(tresc, "latin1")} >>\nstream\n${tresc}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let wyjscie = "%PDF-1.4\n";
  const przesuniecia: number[] = [];
  obiekty.forEach((o, i) => {
    przesuniecia.push(Buffer.byteLength(wyjscie, "latin1"));
    wyjscie += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(wyjscie, "latin1");
  wyjscie += `xref\n0 ${obiekty.length + 1}\n0000000000 65535 f \n`;
  for (const p of przesuniecia) wyjscie += `${String(p).padStart(10, "0")} 00000 n \n`;
  wyjscie += `trailer\n<< /Size ${obiekty.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(wyjscie, "latin1");
}
