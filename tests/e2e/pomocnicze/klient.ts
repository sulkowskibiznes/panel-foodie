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

/** Kod startowy od zespołu: zamiast sesji ekran ustawienia własnego PIN-u (Etap 2). */
export async function zalogujKodemStartowym(page: Page, token: string, kod: string, opcje: { zapamietaj?: boolean } = {}): Promise<void> {
  await page.goto(`/p/${token}`);
  await page.getByLabel(copy.pin.etykieta).fill(kod);
  if (opcje.zapamietaj === false) await page.getByLabel(copy.pin.zapamietaj).uncheck();
  await page.getByRole("button", { name: copy.pin.przycisk }).click();
  await page.waitForURL(`**/p/${token}/ustaw-pin`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.ustawPin.tytul);
}

/** Wpisuje własny PIN dwa razy na ekranie ustawienia; `oczekiwanyBlad` = zostajemy na ekranie z komunikatem. */
export async function wpiszNowyPin(page: Page, pin: string, powtorz = pin, oczekiwanyBlad?: string): Promise<void> {
  await page.getByLabel(copy.ustawPin.nowy).fill(pin);
  await page.getByLabel(copy.ustawPin.powtorz).fill(powtorz);
  if (oczekiwanyBlad) {
    // Czekamy na odpowiedź akcji: dwa kolejne błędy z tym samym tekstem nie mogą przejść na starym komunikacie.
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]),
      page.locator("[data-formularz-pinu] button[type=submit]").click(),
    ]);
    await expect(page.locator("#pin-blad")).toHaveText(oczekiwanyBlad);
    await expect(page.locator("[data-formularz-pinu] button[type=submit]")).toBeEnabled();
    return;
  }
  await page.locator("[data-formularz-pinu] button[type=submit]").click();
  await page.waitForURL(/\/start\?pin=(ustawiony|zmieniony)$/);
}
