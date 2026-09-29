import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { usunLinkTestowy, utworzLinkTestowy, wyczyscLimity, type LinkTestowy } from "./pomocnicze/baza";
import { outboxPoZnaczniku, usunOutboxTestowe, usunZainteresowaniaTestowe, zainteresowaniaPoNotatce } from "./pomocnicze/faza5";
import { zalogujKlienta } from "./pomocnicze/klient";
import { ustawUstawienie } from "./pomocnicze/pakiety";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/**
 * Faza 5, reszta panelu klienta: „Twój pakiet" (SPEC rozdz. 5.7), „Co jeszcze możemy zrobić" (5.8) z zapisem
 * `service_interests` i zdarzeniem `usluga.zainteresowanie` w outbox, wdrożenie za flagą (rozdz. 11),
 * nawigacja „Więcej" na telefonie. Klient: Pierogarnia Babci (kat3, pakiet Sieć, opiekun Gosia).
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const KLIENT = "pierogarnia-babci";
let link: LinkTestowy;

function znacznik(): string {
  return `e2e-uslugi-${test.info().project.name}-${process.env.E2E_SEED ?? "0"}`;
}

test.beforeAll(async () => {
  await wyczyscLimity();
  link = await utworzLinkTestowy(KLIENT, { label: `E2E pakiet ${Date.now()}`, zKontaktem: true });
});
test.afterAll(async () => {
  await usunOutboxTestowe(znacznik());
  await usunZainteresowaniaTestowe(znacznik());
  await usunLinkTestowy(link.id);
});

test("Twój pakiet: nazwa pakietu, kwota netto, zakres, lokale, opiekun z kanałem kontaktu, start współpracy; bez logo klienta", async ({ page }) => {
  await zalogujKlienta(page, link.token, link.pin);
  await page.goto(`/p/${link.token}/pakiet`);
  const t = copy.twojPakiet;
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.tytul);
  await expect(page.getByText(copy.zespol.pakiety.siec, { exact: true })).toBeVisible();
  await expect(page.locator("[data-kwota-pakietu]")).toContainText("4400");
  for (const punkt of t.zakresPakietow.siec) await expect(page.getByText(punkt, { exact: true })).toBeVisible();
  const lokale = page.locator("[data-lokale-pakietu] li");
  await expect(lokale).toHaveCount(3);
  await expect(lokale.first()).toHaveText("Pierogarnia Babci Łódź");
  const opiekun = page.locator("[data-opiekun]");
  await expect(opiekun).toContainText("Gosia");
  await expect(opiekun).toContainText(t.kontaktAgencji);
  await expect(opiekun).not.toContainText("gosia@foodiemedia.pl");
  await expect(opiekun).toContainText("1 stycznia 2026");
  await expect(page.locator("main img")).toHaveCount(0);
});

test("usługi: karty z tabeli services, modal z jednym polem, zapis service_interests, zdarzenie usluga.zainteresowanie w outbox, potwierdzenie; zespół widzi zgłoszenie na karcie", async ({ page, browser }) => {
  const notatka = `Chcemy sesję zdjęciową nowego menu. ${znacznik()}`;
  await zalogujKlienta(page, link.token, link.pin);
  await page.goto(`/p/${link.token}/uslugi`);
  const u = copy.uslugi;
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(u.tytul);
  await expect(page.locator("[data-usluga]")).toHaveCount(7);
  const karta = page.locator('[data-usluga="sesja-zdjeciowa"]');
  await expect(karta).toContainText("Sesja zdjęciowa");
  await karta.locator("[data-chce-wiedziec-wiecej]").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("[data-formularz-uslugi]")).toBeVisible();
  await expect(dialog.locator("[data-wyslij-zainteresowanie]")).toBeDisabled();
  await dialog.locator("textarea").fill(notatka);
  await dialog.locator("[data-wyslij-zainteresowanie]").click();
  await expect(dialog.locator("[data-potwierdzenie-uslugi]")).toContainText(u.potwierdzenie.opis);

  const zgloszenia = await zainteresowaniaPoNotatce(znacznik());
  expect(zgloszenia).toHaveLength(1);
  expect(zgloszenia[0]).toMatchObject({ note: notatka, service_slug: "sesja-zdjeciowa", handled_at: null, contact_id: link.contactId });
  const outbox = await outboxPoZnaczniku(znacznik());
  expect(outbox).toHaveLength(1);
  expect(outbox[0]?.event).toBe("usluga.zainteresowanie");
  expect(outbox[0]?.payload).toMatchObject({ event: "usluga.zainteresowanie", client_slug: KLIENT, client_name: "Pierogarnia Babci", slack_channel: "#pierogarnia-babci", service: "sesja-zdjeciowa", note: notatka });
  expect(String(outbox[0]?.payload.summary)).toContain("Sesja zdjęciowa");
  expect(String(outbox[0]?.payload.url)).toContain(`/zespol/klienci/${KLIENT}`);

  await dialog.getByRole("button", { name: u.potwierdzenie.zamknij, exact: true }).click();
  await expect(karta.locator("[data-juz-zgloszone]")).toContainText(copy.uslugi.juzZgloszone.split(" ")[0] ?? "Zgłoszone");

  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KLIENT}`);
    const wpis = z.locator(`[data-zainteresowanie="${zgloszenia[0]!.id}"]`);
    await expect(wpis).toContainText(notatka);
    await expect(wpis).toContainText("Sesja zdjęciowa");
    await wpis.locator("[data-zalatwione]").click();
    await expect(wpis.locator("[data-zalatwione]")).toHaveCount(0);
    await expect(wpis).toContainText(copy.zespol.karta.zainteresowania.zalatwilOsoba.split(" ")[0] ?? "załatwione");
    expect((await zainteresowaniaPoNotatce(znacznik()))[0]?.handled_at).not.toBeNull();

    // impersonacja: „Chcę wiedzieć więcej" zablokowane, nic się nie zapisuje (zasada 15)
    await z.goto(`/zespol/klienci/${KLIENT}`);
    await z.locator("[data-zobacz-jak-klient]").click();
    await z.waitForURL(/\/p\/podglad\.[^/]+\/start$/);
    await z.goto(z.url().replace(/\/start$/, "/uslugi"));
    const przycisk = z.locator('[data-usluga="sesja-zdjeciowa"] [data-chce-wiedziec-wiecej]');
    await expect(przycisk).toBeDisabled();
    await expect(przycisk).toHaveAttribute("title", copy.podgladKlienta.niedostepne);
    await z.goto(z.url().replace(/\/uslugi$/, "/podglad/wyjdz"));
  } finally {
    await zespol.close();
  }
  expect(await zainteresowaniaPoNotatce(znacznik())).toHaveLength(1);
});

test("wdrożenie: 404 przy wyłączonej fladze, strona po włączeniu; pozycji nie ma w nawigacji", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop-1440", "ustawienie globalne: jeden projekt");
  await zalogujKlienta(page, link.token, link.pin);
  expect((await page.goto(`/p/${link.token}/wdrozenie`))?.status()).toBe(404);
  await expect(page.getByRole("link", { name: copy.nawigacja.wdrozenie })).toHaveCount(0);
  try {
    await ustawUstawienie("onboarding_enabled", true);
    expect((await page.goto(`/p/${link.token}/wdrozenie`))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.wdrozenie.tytul);
    await expect(page.getByText(copy.wdrozenie.brakKrokow)).toBeVisible();
  } finally {
    await ustawUstawienie("onboarding_enabled", false);
  }
  expect((await page.goto(`/p/${link.token}/wdrozenie`))?.status()).toBe(404);
});

test("nawigacja na telefonie: arkusz „Więcej\" prowadzi do raportów, faktur, pakietu i usług", async ({ page }) => {
  test.skip(!test.info().project.name.startsWith("mobile"), "dolna nawigacja jest tylko na telefonie");
  await zalogujKlienta(page, link.token, link.pin);
  await page.locator("[data-wiecej]").click();
  const lista = page.locator("[data-wiecej-lista]");
  await expect(lista).toBeVisible();
  for (const etykieta of [copy.nawigacja.raporty, copy.nawigacja.faktury, copy.nawigacja.pakiet, copy.nawigacja.uslugi]) {
    await expect(lista.getByRole("link", { name: etykieta })).toBeVisible();
  }
  // bez pozycji „wkrótce" (plan domknięcia, Etap 3): Archiwum wróci do menu, gdy powstanie; „Zmień PIN" jest w arkuszu
  await expect(lista.getByText(copy.nawigacja.archiwum)).toHaveCount(0);
  await expect(lista.locator("[data-zmien-pin-mobile]")).toBeVisible();
  await lista.getByRole("link", { name: copy.nawigacja.faktury }).click();
  await expect(page).toHaveURL(`/p/${link.token}/faktury`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.faktury.tytul);
});
