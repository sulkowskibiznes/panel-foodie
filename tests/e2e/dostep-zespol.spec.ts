import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { przypiszDoKlienta, usunCzlonkaTestowego, usunLinkTestowy, utworzCzlonkaTestowego, utworzLinkTestowy, wpisyAudytu, wyczyscLimity } from "./pomocnicze/baza";
import { PLIK_SESJI_ZESPOLU, zalogujZespol } from "./pomocnicze/zespol";

/** Kryteria 27 i 28 z SPEC rozdz. 18 (dopisane w 1.4). Serial: limit OTP na IP jest wspólny. */
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const KLIENT_A = "burger-brothers";
const DEMO = "demo-bistro";

test("27. lista linków nie niesie tokenu, a Pokaż link (csm) odszyfrowuje go z osobnym wpisem w audycie", async ({ browser }) => {
  const l = await utworzLinkTestowy(KLIENT_A, { label: `E2E pokaz ${test.info().project.name} ${Date.now()}` });
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  const page = await zespol.newPage();
  try {
    await page.goto(`/zespol/klienci/${KLIENT_A}/dostep`);
    const wiersz = page.getByRole("table", { name: copy.zespol.dostep.tytul }).locator("tr", { hasText: l.label });
    await expect(wiersz).toBeVisible();
    expect(await page.content()).not.toContain(l.token);
    expect(await wpisyAudytu(l.id, "link.odszyfrowany")).toBe(0);

    await wiersz.getByRole("button", { name: copy.zespol.dostep.akcje.pokazLink }).click();
    const pole = wiersz.getByRole("textbox", { name: copy.zespol.dostep.gotowy.link });
    await expect(pole).toHaveValue(new RegExp(`/p/${l.token}$`));
    expect(await wpisyAudytu(l.id, "link.odszyfrowany")).toBe(1);

    await wiersz.getByRole("button", { name: copy.zespol.dostep.akcje.ukryjLink }).click();
    await expect(pole).toHaveCount(0);
    await wiersz.getByRole("button", { name: copy.zespol.dostep.akcje.pokazLink }).click();
    await expect(wiersz.getByRole("textbox", { name: copy.zespol.dostep.gotowy.link })).toBeVisible();
    expect(await wpisyAudytu(l.id, "link.odszyfrowany")).toBe(2);
  } finally {
    await zespol.close();
    await usunLinkTestowy(l.id);
  }
});

test("27. content_creator przypisany do klienta widzi kartę, ale zakładka Dostęp daje 404", async ({ page }) => {
  await wyczyscLimity();
  const czlonek = await utworzCzlonkaTestowego(`e2e-content-${test.info().project.name}-${process.env.E2E_SEED ?? "0"}@foodiemedia.pl`, "content_creator");
  try {
    await przypiszDoKlienta(czlonek.id, KLIENT_A);
    await zalogujZespol(page, czlonek.email);
    expect((await page.goto(`/zespol/klienci/${KLIENT_A}`))?.status()).toBe(200);
    expect((await page.goto(`/zespol/klienci/${KLIENT_A}/dostep`))?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.nieZnaleziono.tytul);
  } finally {
    await usunCzlonkaTestowego(czlonek);
  }
});

test("28. klient demonstracyjny: notka zamiast przycisku Utwórz link, a baza odrzuca link", async ({ page }) => {
  await wyczyscLimity();
  const admin = await utworzCzlonkaTestowego(`e2e-admin-${test.info().project.name}-${process.env.E2E_SEED ?? "0"}@foodiemedia.pl`, "admin");
  try {
    await zalogujZespol(page, admin.email);
    await page.goto(`/zespol/klienci/${DEMO}/dostep`);
    await expect(page.getByText(copy.zespol.karta.demo, { exact: true })).toBeVisible();
    await expect(page.getByText(copy.zespol.dostep.demo)).toBeVisible();
    await expect(page.getByRole("button", { name: copy.zespol.dostep.utworz })).toHaveCount(0);
    await expect(utworzLinkTestowy(DEMO)).rejects.toThrow(/demonstracyjny/);
  } finally {
    await usunCzlonkaTestowego(admin);
  }
});
