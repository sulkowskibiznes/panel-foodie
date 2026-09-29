import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { prostyPdf } from "../../supabase/seed/pdf";
import { usunLinkTestowy, utworzLinkTestowy, wyczyscLimity, type LinkTestowy } from "./pomocnicze/baza";
import { bearerCrona, dataLokalna, dokumentPoTytule, fakturaPoNumerze, stanFaktury, usunDokumentyTestowe, usunFakturyTestowe, wstawFakture } from "./pomocnicze/faza5";
import { zalogujKlienta } from "./pomocnicze/klient";
import { PLIK_SESJI_ZESPOLU, potwierdzOkno } from "./pomocnicze/zespol";

/**
 * Faza 5, faktury i dokumenty (SPEC rozdz. 5.6, 10, 16.3): ręczne wpisanie faktury z PDF-em, pobieranie przez
 * signed URL po sprawdzeniu izolacji (cudza faktura = 404, jak w kryterium 4), cron przestawiający `po_terminie`,
 * ręczne „opłacona" i cofnięcie, dokumenty do pobrania. Klient A = Burger Brothers, klient B = Pierogarnia Babci.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

const KLIENT_A = "burger-brothers";
const KLIENT_B = "pierogarnia-babci";
const CRON = "/api/cron/faktury";

function prefix(): string {
  return `E2E/${test.info().project.name}/${process.env.E2E_SEED ?? "0"}/`;
}
function prefixDokumentu(): string {
  return `(test E2E ${test.info().project.name}) `;
}

let link: LinkTestowy;

test.beforeAll(async () => {
  await wyczyscLimity();
  link = await utworzLinkTestowy(KLIENT_A, { label: `E2E faktury ${Date.now()}`, zKontaktem: true });
});
test.afterAll(async () => {
  await usunFakturyTestowe(prefix());
  await usunDokumentyTestowe(prefixDokumentu());
  await usunLinkTestowy(link.id);
});

test("opiekun dodaje fakturę z PDF-em, klient ją widzi i pobiera przez signed URL; cudza faktura daje 404", async ({ page, browser }) => {
  const numer = `${prefix()}1`;
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KLIENT_A}/faktury`);
    await z.locator("[data-dodaj-fakture]").click();
    const dialog = z.locator("[data-dialog-faktury]");
    await expect(dialog).toBeVisible();
    await dialog.locator("#faktura-numer").fill(numer);
    await dialog.locator("#faktura-netto").fill("1000");
    await expect(dialog.locator("#faktura-brutto")).toHaveValue("1230");
    await dialog.locator('input[type="file"]').setInputFiles({ name: "faktura.pdf", mimeType: "application/pdf", buffer: prostyPdf(`Faktura ${numer}`) });
    await expect(dialog.locator("[data-pdf-gotowy]")).toBeVisible({ timeout: 30_000 });
    await dialog.locator("[data-zapisz-fakture]").click();
    await expect(dialog.locator("[data-wynik-akcji]")).toHaveText(copy.zespol.faktury.dialog.dodano);
    await z.keyboard.press("Escape");

    const faktura = await fakturaPoNumerze(KLIENT_A, numer);
    expect(faktura).toBeTruthy();
    expect(faktura?.status).toBe("do_zaplaty");
    expect(faktura?.pdf_path).toMatch(/\.pdf$/);
    expect(faktura?.pdf_path?.includes(KLIENT_A)).toBe(false);
    await expect(z.locator(`[data-faktura="${faktura!.id}"]`)).toContainText(copy.zespol.faktury.status.do_zaplaty);
    const zespolPdf = await z.request.get(`/zespol/faktura/${faktura!.id}`, { maxRedirects: 0 });
    expect(zespolPdf.status()).toBe(302);
    expect(zespolPdf.headers()["location"]).toContain("/storage/v1/object/sign/faktury/");

    // plik nie jest PDF-em: odrzucony po magic bytes, nie po rozszerzeniu
    await z.locator("[data-dodaj-fakture]").click();
    await z.locator("[data-dialog-faktury]").locator('input[type="file"]').setInputFiles({ name: "udaje.pdf", mimeType: "application/pdf", buffer: Buffer.from("to nie jest pdf, tylko tekst") });
    await expect(z.locator("[data-dialog-faktury]").getByRole("alert")).toHaveText(copy.zespol.pdf.bledy.nieobslugiwany, { timeout: 30_000 });
    await z.keyboard.press("Escape");
  } finally {
    await zespol.close();
  }

  const faktura = (await fakturaPoNumerze(KLIENT_A, numer))!;
  const cudza = await wstawFakture(KLIENT_B, { numer: `${prefix()}B`, dueDate: dataLokalna(14), pdf: true });

  await zalogujKlienta(page, link.token, link.pin);
  await page.goto(`/p/${link.token}/faktury`);
  const wiersz = page.locator(`[data-faktura="${faktura.id}"]`);
  await expect(wiersz).toContainText(numer);
  await expect(wiersz.locator('[data-status-faktury="do_zaplaty"]')).toBeVisible();
  await expect(wiersz.locator("[data-pobierz-fakture]")).toHaveAttribute("href", `/p/${link.token}/faktura/${faktura.id}`);
  const pdf = await page.request.get(`/p/${link.token}/faktura/${faktura.id}`, { maxRedirects: 0 });
  expect(pdf.status()).toBe(302);
  expect(pdf.headers()["location"]).toContain("/storage/v1/object/sign/faktury/");
  // izolacja (kryterium 4 rozszerzone o faktury): cudza faktura = 404, także z PDF-em
  expect((await page.request.get(`/p/${link.token}/faktura/${cudza.id}`)).status()).toBe(404);
  await expect(page.locator(`[data-faktura="${cudza.id}"]`)).toHaveCount(0);
  // bez sesji: 404
  const bezSesji = await browser.newContext();
  expect((await bezSesji.request.get(`/p/${link.token}/faktura/${faktura.id}`)).status()).toBe(404);
  await bezSesji.close();
});

test("cron o 6:00 przestawia do_zaplaty na po_terminie; klient widzi czerwony status z liczbą dni i kafel na Starcie; ręcznie tylko „opłacona\" i cofnięcie", async ({ page, request, browser }) => {
  const numer = `${prefix()}cron`;
  const wczoraj = dataLokalna(-1);
  const [poTerminie, przyszla, oplacona] = await Promise.all([
    wstawFakture(KLIENT_A, { numer, dueDate: wczoraj, issueDate: dataLokalna(-15) }),
    wstawFakture(KLIENT_A, { numer: `${prefix()}przyszla`, dueDate: dataLokalna(10) }),
    wstawFakture(KLIENT_A, { numer: `${prefix()}oplacona`, dueDate: dataLokalna(-30), issueDate: dataLokalna(-40), status: "oplacona" }),
  ]);

  expect((await request.get(CRON)).status()).toBe(401);
  const odp = await request.get(CRON, { headers: { authorization: bearerCrona() } });
  expect(odp.status()).toBe(200);
  const wynik = (await odp.json()) as { przeterminowane: string[] };
  expect(wynik.przeterminowane).toContain(poTerminie.id);
  expect(wynik.przeterminowane).not.toContain(przyszla.id);
  expect(wynik.przeterminowane).not.toContain(oplacona.id);
  expect((await stanFaktury(poTerminie.id))?.status).toBe("po_terminie");
  expect((await stanFaktury(przyszla.id))?.status).toBe("do_zaplaty");
  expect((await stanFaktury(oplacona.id))?.status).toBe("oplacona");

  await zalogujKlienta(page, link.token, link.pin);
  await page.goto(`/p/${link.token}/faktury`);
  const wiersz = page.locator(`[data-faktura="${poTerminie.id}"]`);
  const status = wiersz.locator('[data-status-faktury="po_terminie"]');
  await expect(status).toContainText(copy.faktury.status.po_terminie);
  await expect(status).toContainText(`1 ${copy.faktury.poTerminieDni.jeden}`);
  const kolor = await status.evaluate((el) => getComputedStyle(el).color);
  expect(kolor.replace(/\s/g, "")).toBe("rgb(180,35,24)");
  await expect(page.locator(`[data-faktura="${oplacona.id}"] [data-status-faktury="oplacona"]`)).toBeVisible();
  // kafel na Starcie pokazuje najstarszą fakturę po terminie (z seedu jest starsza), więc sprawdzamy sam kafel
  await page.goto(`/p/${link.token}/start`);
  await expect(page.locator("[data-kafel-faktura]")).toContainText(copy.klientStart.kafle.fakturaTytul);
  await expect(page.locator("[data-kafel-faktura]")).toContainText(copy.faktury.poTerminieDni.wiele);

  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KLIENT_A}/faktury`);
    const w = z.locator(`[data-faktura="${poTerminie.id}"]`);
    await expect(w).toHaveAttribute("data-status", "po_terminie");
    await w.locator("[data-oznacz-oplacona]").click();
    const dialog = z.locator("[data-dialog-oplacenia]");
    await expect(dialog).toBeVisible();
    await dialog.locator("[data-potwierdz-oplacenie]").click();
    await expect(w).toHaveAttribute("data-status", "oplacona");
    const poOplaceniu = await stanFaktury(poTerminie.id);
    expect(poOplaceniu?.status).toBe("oplacona");
    expect(poOplaceniu?.paid_at).toBe(dataLokalna(0));

    await w.locator("[data-cofnij-oplacenie]").click();
    await potwierdzOkno(z, copy.zespol.faktury.cofnijPotwierdz);
    await expect(w).toHaveAttribute("data-status", "po_terminie");
    expect((await stanFaktury(poTerminie.id))?.paid_at).toBeNull();

    await w.locator("[data-usun-fakture]").click();
    await potwierdzOkno(z);
    await expect(z.locator(`[data-faktura="${poTerminie.id}"]`)).toHaveCount(0);
    expect(await stanFaktury(poTerminie.id)).toBeNull();
  } finally {
    await zespol.close();
  }
});

test("dokumenty: opiekun wgrywa PDF, klient pobiera go w sekcji Dokumenty; cudzy dokument daje 404", async ({ page, browser }) => {
  const tytul = `${prefixDokumentu()}Aneks nr 1`;
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KLIENT_A}/dokumenty`);
    await z.locator("[data-dodaj-dokument]").click();
    const dialog = z.locator("[data-dialog-dokumentu]");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("[data-zapisz-dokument]")).toBeDisabled();
    await dialog.locator("#dokument-rodzaj").selectOption("aneks");
    await dialog.locator("#dokument-tytul").fill(tytul);
    await dialog.locator("#dokument-od").fill("2026-10-01");
    await dialog.locator('input[type="file"]').setInputFiles({ name: "aneks.pdf", mimeType: "application/pdf", buffer: prostyPdf(tytul) });
    await expect(dialog.locator("[data-pdf-gotowy]")).toBeVisible({ timeout: 30_000 });
    await dialog.locator("[data-zapisz-dokument]").click();
    await expect(dialog.locator("[data-wynik-akcji]")).toHaveText(copy.zespol.dokumenty.dialog.dodano);
    await z.keyboard.press("Escape");
    const dokument = await dokumentPoTytule(KLIENT_A, tytul);
    expect(dokument?.kind).toBe("aneks");
    await expect(z.locator(`[data-dokument="${dokument!.id}"]`)).toContainText(copy.zespol.dokumenty.rodzaje.aneks);
    const zespolPdf = await z.request.get(`/zespol/dokument/${dokument!.id}`, { maxRedirects: 0 });
    expect(zespolPdf.status()).toBe(302);
  } finally {
    await zespol.close();
  }

  const dokument = (await dokumentPoTytule(KLIENT_A, tytul))!;
  await zalogujKlienta(page, link.token, link.pin);
  await page.goto(`/p/${link.token}/faktury`);
  const pozycja = page.locator(`[data-dokument="${dokument.id}"]`);
  await expect(pozycja).toContainText(tytul);
  await expect(pozycja).toContainText(copy.faktury.rodzaje.aneks);
  const pdf = await page.request.get(`/p/${link.token}/dokument/${dokument.id}`, { maxRedirects: 0 });
  expect(pdf.status()).toBe(302);
  expect(pdf.headers()["location"]).toContain("/storage/v1/object/sign/dokumenty/");

  // dokument z seedu klienta B (umowa) jest niedostępny dla klienta A
  const cudzy = await dokumentPoTytule(KLIENT_B, "Umowa powierzenia przetwarzania danych");
  expect(cudzy).toBeTruthy();
  expect((await page.request.get(`/p/${link.token}/dokument/${cudzy!.id}`)).status()).toBe(404);
});
