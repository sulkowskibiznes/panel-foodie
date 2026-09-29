import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { przypiszDoKlienta, usunCzlonkaTestowego, utworzCzlonkaTestowego, wyczyscLimity } from "./pomocnicze/baza";
import { zalogujZespol } from "./pomocnicze/zespol";

/** Kryteria 23 i 24 z SPEC rozdz. 18 (role zespołu). Serial: limit OTP na IP jest wspólny. */
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const PRZYPISANY = "burger-brothers";
const OBCY = "pierogarnia-babci";

test("23. content_creator dostaje 404 na trasie faktur, ale otwiera materiały", async ({ page }) => {
  await wyczyscLimity();
  const czlonek = await utworzCzlonkaTestowego(`e2e-cc-faktury-${test.info().project.name}-${process.env.E2E_SEED ?? "0"}@foodiemedia.pl`, "content_creator");
  try {
    await przypiszDoKlienta(czlonek.id, PRZYPISANY);
    await zalogujZespol(page, czlonek.email);
    // pulpit content creatora to „Moja praca" z kafelkami pilności; kafelek filtruje tabelę (plan 3b)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.zespol.pulpit.tytulMojaPraca);
    await expect(page.locator("[data-kafelki] [data-kafelek]").first()).toHaveAttribute("data-kafelek", "poprawki");
    await page.locator('[data-kafelek="szkice"]').click();
    await expect(page).toHaveURL(/\/zespol\?kafelek=szkice$/);
    await expect(page.locator('[data-kafelek="szkice"]')).toHaveAttribute("aria-current", "true");
    // karta klienta: szybka akcja „Nowy pakiet", bez „Utwórz link" (content creator nie zarządza dostępem)
    await page.goto(`/zespol/klienci/${PRZYPISANY}`);
    await expect(page.locator("[data-szybki-nowy-pakiet]")).toBeVisible();
    await expect(page.locator("[data-szybki-link]")).toHaveCount(0);
    expect((await page.goto(`/zespol/klienci/${PRZYPISANY}/materialy`))?.status()).toBe(200);
    expect((await page.goto(`/zespol/klienci/${PRZYPISANY}/faktury`))?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.nieZnaleziono.tytul);
    // faza 5: dokumenty też są poza zasięgiem content creatora (SPEC rozdz. 2), raporty tylko do podglądu
    expect((await page.goto(`/zespol/klienci/${PRZYPISANY}/dokumenty`))?.status()).toBe(404);
    expect((await page.goto(`/zespol/klienci/${PRZYPISANY}/raporty`))?.status()).toBe(200);
    await expect(page.locator("[data-dodaj-raport]")).toHaveCount(0);
    // zakładki Faktury i Dokumenty nie pojawiają się w karcie klienta
    await page.goto(`/zespol/klienci/${PRZYPISANY}`);
    await expect(page.getByRole("link", { name: copy.zespol.karta.zakladki.faktury })).toHaveCount(0);
    await expect(page.getByRole("link", { name: copy.zespol.karta.zakladki.dokumenty })).toHaveCount(0);
  } finally {
    await usunCzlonkaTestowego(czlonek);
  }
});

test("24. csm widzi tylko przypisanych klientów: pulpit, karta, pakiety i pliki cudzego klienta dają 404", async ({ page }) => {
  await wyczyscLimity();
  const csm = await utworzCzlonkaTestowego(`e2e-csm-${test.info().project.name}-${process.env.E2E_SEED ?? "0"}@foodiemedia.pl`, "csm");
  try {
    await przypiszDoKlienta(csm.id, PRZYPISANY);
    await zalogujZespol(page, csm.email);
    await expect(page.getByRole("cell", { name: "Burger Brothers", exact: true }).first()).toBeVisible();
    await expect(page.getByText("Pierogarnia Babci")).toHaveCount(0);
    await expect(page.getByText("Grupa Smakosz")).toHaveCount(0);
    expect((await page.goto(`/zespol/klienci/${PRZYPISANY}`))?.status()).toBe(200);
    expect((await page.goto(`/zespol/klienci/${OBCY}`))?.status()).toBe(404);
    expect((await page.goto(`/zespol/klienci/${OBCY}/materialy`))?.status()).toBe(404);
    expect((await page.goto(`/zespol/klienci/${OBCY}/dostep`))?.status()).toBe(404);
    expect((await page.goto(`/zespol/klienci/${OBCY}/harmonogram`))?.status()).toBe(404);
    // pulpit: filtr „wszyscy klienci" nie istnieje dla csm (widzi tylko swoich)
    await page.goto("/zespol");
    await expect(page.locator('[name="zakres"]')).toHaveCount(0);
    // lista klientów i „Przejdź do klienta" (plan 3b): tylko przypisani, cudzy klient nie istnieje nawet w wyszukiwarce
    await page.goto("/zespol/klienci?status=wszystkie");
    await expect(page.locator(`[data-klient-wiersz="${PRZYPISANY}"]`)).toBeVisible();
    await expect(page.locator(`[data-klient-wiersz="${OBCY}"]`)).toHaveCount(0);
    await page.goto("/zespol");
    await page.locator("[data-przejdz-do-klienta] input[name=q]").fill("pierogarnia");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/zespol\/klienci\?idz=1&q=pierogarnia$/);
    await expect(page.locator("[data-liczba-klientow]")).toHaveAttribute("data-liczba-klientow", "0");
    await page.locator("[data-przejdz-do-klienta] input[name=q]").fill("burger");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`/zespol/klienci/${PRZYPISANY}`);
  } finally {
    await usunCzlonkaTestowego(csm);
  }
});
