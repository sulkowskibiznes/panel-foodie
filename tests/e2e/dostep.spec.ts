import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { aktywneSesje, nieistniejacyToken, pakietKlienta, przesunSesjeWczas, rotatedAt, stanLinku, usunLinkTestowy, utworzLinkTestowy, wyczyscLimity, zasobKlienta, type LinkTestowy } from "./pomocnicze/baza";
import { probaPinu, zalogujKlienta } from "./pomocnicze/klient";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/** Kryteria odbioru 1-6 z SPEC rozdz. 18. Serial: limit prób na IP jest wspólny dla localhost. */
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const KLIENT_A = "burger-brothers";
const KLIENT_B = "pierogarnia-babci";

const utworzone: string[] = [];
async function link(slug = KLIENT_A, opcje?: { label?: string }): Promise<LinkTestowy> {
  const l = await utworzLinkTestowy(slug, opcje);
  utworzone.push(l.id);
  return l;
}

test.beforeEach(async () => {
  await wyczyscLimity();
});

test.afterAll(async () => {
  for (const id of utworzone) await usunLinkTestowy(id);
});

async function tekstEkranuPin(page: Page): Promise<string> {
  const tekst = await page.locator("main").innerText();
  return tekst.replace(/\s+/g, " ").trim();
}

test("1. zły token daje ten sam ekran co zły PIN, bez wskazówki", async ({ page }) => {
  const prawdziwy = await link();
  const zly = nieistniejacyToken();

  const odpZly = await page.goto(`/p/${zly}`);
  expect(odpZly?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.pin.tytul);
  const ekranZlyToken = await tekstEkranuPin(page);

  const odpDobry = await page.goto(`/p/${prawdziwy.token}`);
  expect(odpDobry?.status()).toBe(200);
  const ekranDobryToken = await tekstEkranuPin(page);
  expect(ekranZlyToken).toBe(ekranDobryToken);

  await probaPinu(page, zly, "1234");
  const poZlymTokenie = await tekstEkranuPin(page);
  await probaPinu(page, prawdziwy.token, prawdziwy.pin === "0000" ? "0001" : "0000");
  const poZlymPinie = await tekstEkranuPin(page);
  expect(poZlymTokenie).toBe(poZlymPinie);

  const odpFormat = await page.goto("/p/to-nie-jest-token");
  expect(odpFormat?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.pin.tytul);
});

test("2. pięć złych PIN-ów blokuje na 15 minut, szósta próba z dobrym PIN-em też odpada", async ({ page }) => {
  const l = await link();
  const zlyPin = l.pin === "0000" ? "0001" : "0000";
  for (let i = 0; i < 5; i++) await probaPinu(page, l.token, zlyPin);

  const stan = await stanLinku(l.id);
  expect(stan?.failed_attempts).toBe(5);
  expect(stan?.locked_until).not.toBeNull();
  const doKiedy = new Date(stan!.locked_until!).getTime() - Date.now();
  expect(doKiedy).toBeGreaterThan(13 * 60_000);
  expect(doKiedy).toBeLessThanOrEqual(15 * 60_000 + 5_000);

  await probaPinu(page, l.token, l.pin);
  expect((await stanLinku(l.id))?.failed_attempts).toBe(6);
  expect(await aktywneSesje(l.id)).toBe(0);
});

test("3. po poprawnym PIN-ie sesja żyje po odświeżeniu i po 24 godzinach (z rotacją tokenu)", async ({ page, context }) => {
  const l = await link();
  await zalogujKlienta(page, l.token, l.pin);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const cookiePrzed = (await context.cookies()).find((c) => c.name === "fm_sesja");
  expect(cookiePrzed?.httpOnly).toBe(true);
  expect(cookiePrzed?.sameSite).toBe("Lax");

  await page.reload();
  await expect(page).toHaveURL(`/p/${l.token}/start`);

  await przesunSesjeWczas(l.id, 25);
  const rotacjaPrzed = await rotatedAt(l.id);
  await page.goto(`/p/${l.token}/start`);
  await expect(page).toHaveURL(`/p/${l.token}/start`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const cookiePo = (await context.cookies()).find((c) => c.name === "fm_sesja");
  expect(cookiePo?.value).not.toBe(cookiePrzed?.value);
  expect(await rotatedAt(l.id)).not.toBe(rotacjaPrzed);

  await page.reload();
  await expect(page).toHaveURL(`/p/${l.token}/start`);
});

test("4. klient A nie otwiera pakietu ani pliku klienta B (404)", async ({ page, browser }) => {
  const l = await link(KLIENT_A);
  await zalogujKlienta(page, l.token, l.pin);
  const [pakietA, pakietB, plikA, plikB] = await Promise.all([pakietKlienta(KLIENT_A), pakietKlienta(KLIENT_B), zasobKlienta(KLIENT_A), zasobKlienta(KLIENT_B)]);

  expect((await page.goto(`/p/${l.token}/materialy/${pakietB}`))?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.nieZnaleziono.tytul);
  expect((await page.request.get(`/p/${l.token}/plik/${plikB}/thumb`))?.status()).toBe(404);

  expect((await page.goto(`/p/${l.token}/materialy/${pakietA}`))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(copy.nieZnaleziono.tytul);
  const plik = await page.request.get(`/p/${l.token}/plik/${plikA}/thumb`, { maxRedirects: 0 });
  expect(plik.status()).toBe(302);
  expect(plik.headers()["location"]).toContain("/storage/v1/object/sign/materialy/");

  const bezSesji: BrowserContext = await browser.newContext();
  const odp = await bezSesji.request.get(`/p/${l.token}/plik/${plikA}/thumb`, { maxRedirects: 0 });
  expect(odp.status()).toBe(404);
  await bezSesji.close();
});

test("5. wygaszenie linku przez zespół wylogowuje otwartą sesję przy następnym żądaniu", async ({ page, browser }) => {
  const l = await link(KLIENT_A, { label: `E2E wygaszenie ${test.info().project.name} ${Date.now()}` });
  await zalogujKlienta(page, l.token, l.pin);

  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  const stronaZespolu = await zespol.newPage();
  await stronaZespolu.goto(`/zespol/klienci/${KLIENT_A}/dostep`);
  const wiersz = stronaZespolu.getByRole("table", { name: copy.zespol.dostep.tytul }).locator("tr", { hasText: l.label });
  await expect(wiersz).toBeVisible();
  stronaZespolu.once("dialog", (d) => void d.accept());
  await wiersz.getByRole("button", { name: copy.zespol.dostep.akcje.wygas }).click();
  await expect(wiersz.getByText(copy.zespol.dostep.status.wygaszony)).toBeVisible();
  await zespol.close();

  await page.goto(`/p/${l.token}/start`);
  await expect(page).toHaveURL(`/p/${l.token}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.pin.tytul);
  await probaPinu(page, l.token, l.pin);
});

test("6. reset PIN-u wylogowuje wszystkie urządzenia linku, a nowy PIN działa", async ({ page, browser }) => {
  const l = await link(KLIENT_A, { label: `E2E reset ${test.info().project.name} ${Date.now()}` });
  await zalogujKlienta(page, l.token, l.pin);
  const drugieUrzadzenie = await browser.newContext();
  const druga = await drugieUrzadzenie.newPage();
  await zalogujKlienta(druga, l.token, l.pin);
  expect(await aktywneSesje(l.id)).toBe(2);

  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  const stronaZespolu = await zespol.newPage();
  await stronaZespolu.goto(`/zespol/klienci/${KLIENT_A}/dostep`);
  const wiersz = stronaZespolu.getByRole("table", { name: copy.zespol.dostep.tytul }).locator("tr", { hasText: l.label });
  stronaZespolu.once("dialog", (d) => void d.accept());
  await wiersz.getByRole("button", { name: copy.zespol.dostep.akcje.resetujPin }).click();
  const dialog = stronaZespolu.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: copy.zespol.dostep.gotowy.nowyPinTytul })).toBeVisible();
  const nowyPin = await dialog.getByLabel(copy.zespol.dostep.gotowy.pin).inputValue();
  expect(nowyPin).toMatch(/^\d{4}$/);
  await zespol.close();

  expect(await aktywneSesje(l.id)).toBe(0);
  await page.goto(`/p/${l.token}/start`);
  await expect(page).toHaveURL(`/p/${l.token}`);
  await druga.goto(`/p/${l.token}/start`);
  await expect(druga).toHaveURL(`/p/${l.token}`);
  await drugieUrzadzenie.close();

  if (nowyPin !== l.pin) await probaPinu(page, l.token, l.pin);
  await zalogujKlienta(page, l.token, nowyPin);
});
