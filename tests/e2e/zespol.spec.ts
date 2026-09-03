import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { ustawAktywnosc, usunCzlonkaTestowego, utworzCzlonkaTestowego, wyczyscLimity } from "./pomocnicze/baza";
import { zalogujZespol } from "./pomocnicze/zespol";

/**
 * Logowanie zespołu poza kryteriami 1-6: konto Auth bez aktywnego wiersza w team_members
 * dostaje odmowę (wylogowanie + komunikat), nie pusty panel. Serial: limit OTP na IP jest wspólny.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test("dezaktywowany członek zespołu dostaje odmowę przy następnym wejściu, a jego sesja Auth znika", async ({ page, context }) => {
  await wyczyscLimity();
  const email = `e2e-odmowa-${test.info().project.name}-${process.env.E2E_SEED ?? "0"}@foodiemedia.pl`;
  const czlonek = await utworzCzlonkaTestowego(email);
  try {
    await zalogujZespol(page, czlonek.email);
    const cookiesPrzed = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
    expect(cookiesPrzed.length).toBeGreaterThan(0);

    await ustawAktywnosc(czlonek.id, false);
    await page.goto("/zespol");
    await expect(page).toHaveURL(/\/zespol\/logowanie\?odmowa=1$/);
    // Next renders swój <next-route-announcer role="alert">, więc celujemy w komunikat po treści.
    await expect(page.getByRole("alert").filter({ hasText: copy.zespol.logowanie.brakDostepu })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.zespol.logowanie.tytul);
    const cookiesPo = (await context.cookies()).filter((c) => c.name.startsWith("sb-") && c.value);
    expect(cookiesPo).toEqual([]);

    await page.goto("/zespol");
    await expect(page).toHaveURL(/\/zespol\/logowanie$/);
    await expect(page.getByText(copy.zespol.logowanie.brakDostepu)).toHaveCount(0);

    await ustawAktywnosc(czlonek.id, true);
    await wyczyscLimity();
    await zalogujZespol(page, czlonek.email);
  } finally {
    await usunCzlonkaTestowego(czlonek);
  }
});
