/**
 * Buduje dwustronicową instrukcję dla zespołu (docs/instrukcja): robi zrzuty ekranów na lokalnym stacku
 * i składa PDF z pliku INSTRUKCJA-ZESPOL.md. Uruchomienie:
 *   pnpm db:start && pnpm dev:lokalny   (w drugim terminalu)
 *   pnpm instrukcja
 * Wymaga danych z seedu (pnpm db:seed na lokalnym stacku) i Mailpita (kod logowania zespołu).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "@playwright/test";
import { lokalnyStack } from "../../tests/e2e/pomocnicze/lokalny-stack";

const KATALOG = join(dirname(fileURLToPath(import.meta.url)), "../../docs/instrukcja");
const ZRZUTY = join(KATALOG, "zrzuty");
const BAZA = process.env.INSTRUKCJA_BASE_URL ?? "http://localhost:3100";
const OPIEKUN = "gosia@foodiemedia.pl";

async function czekajNaSerwer(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    try {
      const odp = await fetch(`${BAZA}/zespol/logowanie`);
      if (odp.ok) return;
    } catch {
      /* jeszcze nie wstał */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Serwer ${BAZA} nie odpowiada. Uruchom pnpm dev:lokalny.`);
}

async function zrzut(page: Page, nazwa: string, o: { wysokosc?: number; selektor?: string } = {}): Promise<void> {
  // Nie „networkidle": podglądy wideo i obserwator obejrzeń podtrzymują ruch. Chwila na obrazy z signed URL wystarczy.
  await page.waitForLoadState("load");
  await page.waitForTimeout(2500);
  const sciezka = join(ZRZUTY, nazwa);
  if (o.selektor) await page.locator(o.selektor).first().screenshot({ path: sciezka });
  else await page.screenshot({ path: sciezka, clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: o.wysokosc ?? page.viewportSize()!.height } });
  console.log(`zrzut: ${nazwa}`);
}

async function zrzutyZespolu(): Promise<void> {
  const { zalogujZespol } = await import("../../tests/e2e/pomocnicze/zespol");
  const { pakietKlienta } = await import("../../tests/e2e/pomocnicze/baza");
  const przegladarka = await chromium.launch();
  const ctx = await przegladarka.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: "pl-PL", timezoneId: "Europe/Warsaw", baseURL: BAZA });
  const page = await ctx.newPage();
  try {
    await zalogujZespol(page, OPIEKUN);
    await zrzut(page, "01-pulpit.png", { wysokosc: 640 });
    await page.goto("/zespol/klienci/grupa-smakosz/pakiety/nowy");
    await page.locator("[data-kreator-pakietu]").scrollIntoViewIfNeeded();
    await zrzut(page, "02-kreator.png", { selektor: "[data-kreator-pakietu]" });
    const pakiet = await pakietKlienta("burger-brothers");
    await page.goto(`/zespol/klienci/burger-brothers/pakiety/${pakiet}`);
    await zrzut(page, "03-pakiet-akcje.png", { selektor: "[data-pasek-zespolu]" });
    await page.goto("/zespol/klienci/burger-brothers/dostep");
    await zrzut(page, "04-dostep.png", { selektor: "main section" });
    await page.goto("/zespol/uwagi");
    await zrzut(page, "05-skrzynka.png", { wysokosc: 640 });
  } finally {
    await ctx.close();
    await przegladarka.close();
  }
}

async function zrzutKlienta(): Promise<void> {
  const { pakietKlienta, usunLinkTestowy, utworzLinkTestowy } = await import("../../tests/e2e/pomocnicze/baza");
  const { zalogujKlienta } = await import("../../tests/e2e/pomocnicze/klient");
  const link = await utworzLinkTestowy("burger-brothers", { label: "Instrukcja (zrzut)" });
  const przegladarka = await chromium.launch();
  const ctx = await przegladarka.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pl-PL", timezoneId: "Europe/Warsaw", baseURL: BAZA });
  const page = await ctx.newPage();
  try {
    await zalogujKlienta(page, link.token, link.pin);
    await page.goto(`/p/${link.token}/materialy/${await pakietKlienta("burger-brothers")}`);
    await zrzut(page, "06-klient-mobile.png", { wysokosc: 760 });
  } finally {
    await ctx.close();
    await przegladarka.close();
    await usunLinkTestowy(link.id);
  }
}

/** Minimalny markdown -> HTML: nagłówki, akapity, listy (- i 1.), pogrubienia, kod, obrazy jako data URI. */
function markdownNaHtml(md: string): string {
  const inline = (t: string) =>
    t
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  // Linie kontynuacji (wcięte) doklejamy do poprzedniej, żeby pogrubienie łamane na dwie linie nie zostało bez pary.
  const linie: string[] = [];
  for (const linia of md.split("\n")) {
    if (/^\s+\S/.test(linia) && linie.length > 0 && linie[linie.length - 1]!.trim() !== "") linie[linie.length - 1] += ` ${linia.trim()}`;
    else linie.push(linia);
  }
  const html: string[] = [];
  let lista: "ul" | "ol" | null = null;
  let akapit: string[] = [];
  const zamknijAkapit = () => {
    if (akapit.length > 0) html.push(`<p>${inline(akapit.join(" "))}</p>`);
    akapit = [];
  };
  const zamknijListe = () => {
    if (lista) html.push(`</${lista}>`);
    lista = null;
  };
  for (const linia of linie) {
    const obraz = /^!\[(.*?)\]\((.+?)\)$/.exec(linia.trim());
    if (obraz) {
      zamknijAkapit();
      zamknijListe();
      const sciezka = join(KATALOG, obraz[2]!);
      const dane = existsSync(sciezka) ? `data:image/png;base64,${readFileSync(sciezka).toString("base64")}` : "";
      const pion = /mobile/.test(obraz[2]!) ? ' class="pion"' : "";
      html.push(`<figure${pion}><img src="${dane}" alt="${obraz[1]}" /><figcaption>${obraz[1]}</figcaption></figure>`);
      continue;
    }
    const naglowek = /^(#{1,3}) (.+)$/.exec(linia);
    if (naglowek) {
      zamknijAkapit();
      zamknijListe();
      html.push(`<h${naglowek[1]!.length}>${inline(naglowek[2]!)}</h${naglowek[1]!.length}>`);
      continue;
    }
    const punkt = /^(-|\d+\.) (.+)$/.exec(linia);
    if (punkt) {
      zamknijAkapit();
      const rodzaj = punkt[1] === "-" ? "ul" : "ol";
      if (lista !== rodzaj) {
        zamknijListe();
        lista = rodzaj;
        html.push(`<${rodzaj}>`);
      }
      html.push(`<li>${inline(punkt[2]!)}</li>`);
      continue;
    }
    if (linia.trim() === "") {
      zamknijAkapit();
      zamknijListe();
      continue;
    }
    akapit.push(linia.trim());
  }
  zamknijAkapit();
  zamknijListe();
  return html.join("\n");
}

const STYL = `
  @page { size: A4; margin: 11mm 12mm; }
  body { font-family: -apple-system, "Segoe UI", Inter, Helvetica, Arial, sans-serif; color: #1B1B1B; font-size: 9.4pt; line-height: 1.32; margin: 0; }
  h1 { font-size: 15pt; margin: 0 0 4pt; color: #1B1B1B; }
  h1 + p { margin-top: 0; }
  h2 { font-size: 10.6pt; margin: 8pt 0 3pt; color: #7600F4; break-after: avoid; }
  p { margin: 0 0 4pt; }
  ul, ol { margin: 0 0 4pt 14pt; padding: 0; }
  li { margin: 0 0 1.5pt; }
  li::marker { color: #7600F4; }
  code { font-family: Menlo, Consolas, monospace; font-size: 8.4pt; background: #F5F5F5; padding: 0 2pt; border-radius: 2pt; }
  figure { margin: 3pt 0 5pt; break-inside: avoid; }
  figure img { display: block; width: 100%; border: 1px solid #E5E5E5; border-radius: 4pt; }
  figcaption { font-size: 7.4pt; color: #6B6B6B; margin-top: 1.5pt; }
  figure.pion img { width: 46%; margin: 0 auto; }
  figure.pion figcaption { text-align: center; }
  .kolumny { column-count: 2; column-gap: 8mm; }
  .kolumny h2:first-of-type { margin-top: 0; }
  .stopka { position: fixed; bottom: 0; right: 0; font-size: 7pt; color: #6B6B6B; }
`;

async function zbudujPdf(): Promise<void> {
  const md = readFileSync(join(KATALOG, "INSTRUKCJA-ZESPOL.md"), "utf8");
  const tresc = markdownNaHtml(md);
  const [naglowek, ...reszta] = tresc.split("\n<h2>");
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Instrukcja</title><style>${STYL}</style></head><body>
    ${naglowek}
    <div class="kolumny">${reszta.map((r) => `<h2>${r}`).join("\n")}</div>
    <div class="stopka">Foodie Media · panel klienta · wersja z ${new Date().toISOString().slice(0, 10)}</div>
  </body></html>`;
  writeFileSync(join(KATALOG, "INSTRUKCJA-ZESPOL.html"), html);
  const przegladarka = await chromium.launch();
  const page = await przegladarka.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.emulateMedia({ media: "print" });
  const wysokoscTresci = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.pdf({ path: join(KATALOG, "INSTRUKCJA-ZESPOL.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
  await przegladarka.close();
  const stronA4 = Math.ceil(wysokoscTresci / ((297 - 22) * 3.78));
  console.log(`PDF: docs/instrukcja/INSTRUKCJA-ZESPOL.pdf (treść ~${stronA4} str. A4 wg wysokości ekranu; sprawdź plik)`);
}

async function main() {
  mkdirSync(ZRZUTY, { recursive: true });
  if (!process.argv.includes("--bez-zrzutow")) {
    const stack = lokalnyStack();
    process.env.E2E_DB_URL = stack.dbUrl;
    process.env.E2E_MAILPIT_URL = stack.mailpitUrl;
    process.env.E2E_API_URL = stack.apiUrl;
    process.env.E2E_SECRET_KEY = stack.secretKey;
    // Generator linku testowego jest deterministyczny wg ziarna; świeże ziarno, żeby nie trafić w istniejący token.
    process.env.E2E_SEED ??= String(Date.now() % 2_000_000_000);
    await czekajNaSerwer();
    await zrzutyZespolu();
    await zrzutKlienta();
  }
  await zbudujPdf();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
