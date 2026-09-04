import { expect, test, type Locator, type Page } from "@playwright/test";
import { pakietKlienta, usunLinkTestowy, utworzLinkTestowy, wyczyscLimity, type LinkTestowy } from "./pomocnicze/baza";
import { zalogujKlienta } from "./pomocnicze/klient";

/**
 * Kryterium 26 z SPEC rozdz. 18: zrzuty każdej z dziewięciu ramek (post, relacja, Reels na Facebooku;
 * reklama w sześciu placementach) na 390 px i 1440 px, porównywane ze wzorcami. Pakiet Burger Brothers z seedu,
 * tylko odczyt. Wzorce aktualizujemy świadomie (`pnpm test:e2e -- podglady --update-snapshots`), nigdy w ciemno.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const KLIENT = "burger-brothers";
const PLACEMENTY = ["fb_kanal_telefon", "fb_kanal_komputer", "fb_relacje", "fb_reels", "ig_kanal", "ig_relacje_reels"] as const;
let link: LinkTestowy;

test.beforeAll(async () => {
  await wyczyscLimity();
  link = await utworzLinkTestowy(KLIENT, { label: `E2E podglady ${Date.now()}` });
});
test.afterAll(async () => {
  await usunLinkTestowy(link.id);
});

/** Obrazy w ramce ładują się leniwie (loading="lazy"), więc najpierw przewijamy ramkę do widoku, potem czekamy na wszystkie <img>. */
async function poczekajNaObrazy(ramka: Locator) {
  await ramka.scrollIntoViewIfNeeded();
  await expect
    .poll(() => ramka.evaluate((el) => [...el.querySelectorAll("img")].every((img) => img.complete && img.naturalWidth > 0)), { timeout: 15_000 })
    .toBe(true);
}

async function zrzut(ramka: Locator, nazwa: string) {
  await expect(ramka).toBeVisible();
  await poczekajNaObrazy(ramka);
  // Playwright sam dokleja nazwę projektu i platformę: post-fb-mobile-390-darwin.png
  await expect(ramka).toHaveScreenshot(`${nazwa}.png`, { animations: "disabled", maxDiffPixelRatio: 0.01 });
}

async function otworz(page: Page) {
  const pakietId = await pakietKlienta(KLIENT);
  await zalogujKlienta(page, link.token, link.pin);
  await page.goto(`/p/${link.token}/materialy/${pakietId}`);
  await expect(page.locator("[data-pasek-pakietu]")).toBeVisible();
}

test("26. post, relacja i Reels na Facebooku zgodne ze wzorcami", async ({ page }) => {
  await otworz(page);
  await zrzut(page.locator('[data-material][data-typ="post"] [data-podglad="post-fb"]').first(), "post-fb");
  await zrzut(page.locator('[data-material][data-typ="reels"] [data-podglad="reels-fb"]').first(), "reels-fb");
  await page.getByRole("tab", { name: "Relacje (10)" }).click();
  await zrzut(page.locator('[data-podglad="relacja-fb"]'), "relacja-fb");
});

test("26. reklama w sześciu placementach zgodna ze wzorcami", async ({ page }) => {
  await otworz(page);
  await page.getByRole("tab", { name: "Kampanie (1)" }).click();
  const sekcja = page.locator("[data-kampania]").first();
  for (const placement of PLACEMENTY) {
    await sekcja.locator(`[data-placement="${placement}"]`).click();
    await expect(sekcja.locator("[data-placement-aktywny]")).toHaveAttribute("data-placement-aktywny", placement);
    await zrzut(sekcja.locator("[data-placement-aktywny] [data-podglad]"), `reklama-${placement.replace(/_/g, "-")}`);
  }
});
