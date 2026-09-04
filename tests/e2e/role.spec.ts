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
    expect((await page.goto(`/zespol/klienci/${PRZYPISANY}/materialy`))?.status()).toBe(200);
    expect((await page.goto(`/zespol/klienci/${PRZYPISANY}/faktury`))?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.nieZnaleziono.tytul);
    // zakładka Faktury nie pojawia się w karcie klienta
    await page.goto(`/zespol/klienci/${PRZYPISANY}`);
    await expect(page.getByRole("link", { name: copy.zespol.karta.zakladki.faktury })).toHaveCount(0);
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
  } finally {
    await usunCzlonkaTestowego(csm);
  }
});
