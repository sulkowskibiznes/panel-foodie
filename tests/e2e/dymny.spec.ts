import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";

test.describe("strony publiczne", () => {
  test("strona startowa jest w brandzie Foodie Media i używa Cal Sans", async ({ page }) => {
    const odpowiedz = await page.goto("/");
    expect(odpowiedz?.status()).toBe(200);
    expect(odpowiedz?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.start.tytul);
    await expect(page.getByRole("img", { name: copy.marka.nazwa }).first()).toBeVisible();
    await expect(page.getByText(copy.start.jakWejsc)).toBeVisible();
    const font = await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toContain("Cal Sans");
    await expect(page).toHaveScreenshot("start.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
  });

  test("regulamin i polityka prywatności odpowiadają 200 z nagłówkami", async ({ page }) => {
    await page.goto("/regulamin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.regulamin.tytul);
    await expect(page.getByRole("heading", { name: copy.regulamin.sekcje[3].naglowek })).toBeVisible();
    await page.goto("/prywatnosc");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.prywatnosc.tytul);
  });

  test("robots.txt blokuje /p/ i /zespol/", async ({ request }) => {
    const odpowiedz = await request.get("/robots.txt");
    expect(odpowiedz.status()).toBe(200);
    const tresc = await odpowiedz.text();
    expect(tresc).toContain("Disallow: /p/");
    expect(tresc).toContain("Disallow: /zespol/");
  });

  test("nieznana strona pokazuje 404 w brandzie", async ({ page }) => {
    const odpowiedz = await page.goto("/nie-ma-takiej-strony");
    expect(odpowiedz?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.nieZnaleziono.tytul);
  });
});
