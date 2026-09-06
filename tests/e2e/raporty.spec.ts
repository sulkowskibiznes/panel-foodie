import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { usunLinkTestowy, utworzLinkTestowy, wyczyscLimity, type LinkTestowy } from "./pomocnicze/baza";
import { raportyKlienta, tokenWebhooka, usunRaportyTestowe } from "./pomocnicze/faza5";
import { zalogujKlienta } from "./pomocnicze/klient";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/**
 * Faza 5, raporty (SPEC rozdz. 5.5, 9): webhook z bearerem INGEST_TOKEN (host tylko raporty.foodiemedia.pl,
 * raport per lokal dla kat1), ręczne dodanie linku przez opiekuna, karty u klienta, kafel na Starcie.
 * Okresy w odległych latach, osobny rok na projekt Playwrighta (mobile 2040, desktop 2041).
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const KAT1 = "grupa-smakosz";
const KAT2 = "burger-brothers";
const TRASA = "/api/ingest/report";

function rok(): number {
  return test.info().project.name.startsWith("mobile") ? 2040 : 2041;
}
function prefixUrl(): string {
  return `https://raporty.foodiemedia.pl/r/e2e-${test.info().project.name}-`;
}

let link: LinkTestowy;

test.beforeAll(async () => {
  await wyczyscLimity();
  link = await utworzLinkTestowy(KAT1, { label: `E2E raporty ${Date.now()}`, zKontaktem: true });
});
test.afterAll(async () => {
  await usunRaportyTestowe(prefixUrl());
  await usunLinkTestowy(link.id);
});

test("webhook: 401 bez tokenu, 400 obcy host, 404 nieznany klient, 422 bez lokalu w kat1, 200 z lokalem i nadpisanie tego samego miesiąca", async ({ request, page, browser }) => {
  const naglowki = { authorization: `Bearer ${tokenWebhooka()}` };
  const url = `${prefixUrl()}webhook`;
  const period = `${rok()}-01`;

  expect((await request.post(TRASA, { data: { client_slug: KAT1, period, url } })).status()).toBe(401);
  expect((await request.post(TRASA, { headers: { authorization: "Bearer zly-token" }, data: { client_slug: KAT1, period, url } })).status()).toBe(401);
  const obcy = await request.post(TRASA, { headers: naglowki, data: { client_slug: KAT1, period, url: "https://evil.example.com/r/x" } });
  expect(obcy.status()).toBe(400);
  expect(((await obcy.json()) as { error: string }).error).toBe("walidacja");
  expect((await request.post(TRASA, { headers: naglowki, data: { client_slug: "nie-ma-takiego", period, url } })).status()).toBe(404);
  const bezLokalu = await request.post(TRASA, { headers: naglowki, data: { client_slug: KAT1, period, url } });
  expect(bezLokalu.status()).toBe(422);
  expect(((await bezLokalu.json()) as { error: string; lokale: string[] }).lokale).toContain("Ramen Ichi");
  expect((await request.post(TRASA, { headers: naglowki, data: { client_slug: KAT1, period, url, location: "Bar Nieznany" } })).status()).toBe(422);

  const pierwszy = await request.post(TRASA, { headers: naglowki, data: { client_slug: KAT1, period, url, location: "ramen ichi", title: `Raport E2E ${period}`, cooperation_month: 7 } });
  expect(pierwszy.status()).toBe(200);
  const p = (await pierwszy.json()) as { ok: boolean; report_id: string; created: boolean };
  expect(p.created).toBe(true);

  // ten sam miesiąc i lokal = nadpisanie linku, nie drugi wiersz
  const drugi = await request.post(TRASA, { headers: naglowki, data: { client_slug: KAT1, period, url: `${url}-v2`, location: "Ramen Ichi" } });
  expect(drugi.status()).toBe(200);
  expect(((await drugi.json()) as { report_id: string; created: boolean })).toEqual({ ok: true, report_id: p.report_id, created: false });
  const wiersze = (await raportyKlienta(KAT1)).filter((r) => r.period_year === rok() && r.period_month === 1);
  expect(wiersze).toHaveLength(1);
  expect(wiersze[0]).toMatchObject({ url: `${url}-v2`, source: "webhook" });
  expect(wiersze[0]?.location_id).not.toBeNull();

  // kat2: jeden raport na klienta, lokal ignorowany
  const kat2 = await request.post(TRASA, { headers: naglowki, data: { client_slug: KAT2, period, url: `${prefixUrl()}kat2` } });
  expect(kat2.status()).toBe(200);
  const wierszeKat2 = (await raportyKlienta(KAT2)).filter((r) => r.period_year === rok() && r.period_month === 1);
  expect(wierszeKat2[0]?.location_id).toBeNull();
  await usunRaportyTestowe(`${prefixUrl()}kat2`);

  // klient: karta z nazwą lokalu, numerem miesiąca współpracy i linkiem w nowej karcie; kafel na Starcie
  await zalogujKlienta(page, link.token, link.pin);
  await page.goto(`/p/${link.token}/raporty`);
  const karta = page.locator(`[data-raport="${p.report_id}"]`);
  await expect(karta).toBeVisible();
  await expect(karta).toContainText("Ramen Ichi");
  await expect(karta).toContainText(copy.raporty.miesiacWspolpracy.replace("{n}", "7"));
  const otworz = karta.locator("[data-otworz-raport]");
  await expect(otworz).toHaveAttribute("href", `${url}-v2`);
  await expect(otworz).toHaveAttribute("target", "_blank");
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.goto(`/p/${link.token}/start`);
  await expect(page.locator("[data-kafel-raport]")).toContainText("Ramen Ichi");

  // zespół: wiersz ze źródłem „webhook"
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KAT1}/raporty`);
    await expect(z.locator(`[data-raport="${p.report_id}"] [data-zrodlo]`)).toHaveText(copy.zespol.raporty.zrodlo.webhook);
  } finally {
    await zespol.close();
  }
});

test("opiekun dodaje raport ręcznie (link, miesiąc, lokal), zły host zablokowany, usunięcie znika u klienta", async ({ page, browser }) => {
  const period = `${rok()}-02`;
  const url = `${prefixUrl()}recznie`;
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KAT1}/raporty`);
    await z.locator("[data-dodaj-raport]").click();
    const dialog = z.locator("[data-dialog-raportu]");
    await expect(dialog).toBeVisible();
    await dialog.locator("#raport-url").fill("https://docs.google.com/raport");
    await dialog.locator("#raport-okres").fill(period);
    await dialog.locator("#raport-lokal").selectOption({ label: "Trattoria Bella" });
    await dialog.locator("[data-zapisz-raport]").click();
    await expect(dialog.locator("[data-blad-akcji]")).toHaveText(copy.zespol.raporty.bledy.link);

    await dialog.locator("#raport-url").fill(url);
    await dialog.locator("[data-zapisz-raport]").click();
    await expect(dialog.locator("[data-wynik-akcji]")).toHaveText(copy.zespol.raporty.dialog.dodano);
    await z.keyboard.press("Escape");
    const wiersz = (await raportyKlienta(KAT1)).find((r) => r.url === url);
    expect(wiersz).toBeTruthy();
    expect(wiersz?.source).toBe("reczne");
    expect(wiersz?.title).toBe(`Raport miesięczny - luty ${rok()}`);
    await expect(z.locator(`[data-raport="${wiersz!.id}"]`)).toContainText("Trattoria Bella");

    await zalogujKlienta(page, link.token, link.pin);
    await page.goto(`/p/${link.token}/raporty`);
    await expect(page.locator(`[data-raport="${wiersz!.id}"]`)).toContainText("Trattoria Bella");

    z.on("dialog", (d) => void d.accept());
    await z.locator(`[data-raport="${wiersz!.id}"] [data-usun-raport]`).click();
    await expect(z.locator(`[data-raport="${wiersz!.id}"]`)).toHaveCount(0);
    await page.reload();
    await expect(page.locator(`[data-raport="${wiersz!.id}"]`)).toHaveCount(0);
  } finally {
    await zespol.close();
  }
});
