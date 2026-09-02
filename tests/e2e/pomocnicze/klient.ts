import { expect, type Page } from "@playwright/test";
import { copy } from "../../../src/lib/copy";

/** Logowanie klienta przez ekran PIN. */
export async function zalogujKlienta(page: Page, token: string, pin: string): Promise<void> {
  await page.goto(`/p/${token}`);
  await page.getByLabel(copy.pin.etykieta).fill(pin);
  await page.getByRole("button", { name: copy.pin.przycisk }).click();
  await page.waitForURL(`**/p/${token}/start`);
}

/** Wpisuje PIN i oczekuje komunikatu błędu (bez informacji, co było nie tak). */
export async function probaPinu(page: Page, token: string, pin: string): Promise<void> {
  await page.goto(`/p/${token}`);
  await page.getByLabel(copy.pin.etykieta).fill(pin);
  await page.getByRole("button", { name: copy.pin.przycisk }).click();
  await expect(page.locator("#pin-blad")).toHaveText(copy.pin.blad);
  expect(new URL(page.url()).pathname).toBe(`/p/${token}`);
}
