import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { dodajUwageKlienta, komentarzePakietu, materialyPakietu, okresDlaProjektu, sklonujPakiet, usunPakiet } from "./pomocnicze/pakiety";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/** Skrzynka uwag (SPEC rozdz. 12.5): jedna lista nierozwiązanych uwag, filtr po kliencie i rodzaju, odpowiedź i „Załatwione" stąd. */
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const KLIENT = "pierogarnia-babci";

test("skrzynka: uwaga klienta widoczna, odpowiedź trafia do wątku, Załatwione zdejmuje ją z listy", async ({ browser }) => {
  const p = await sklonujPakiet(KLIENT, okresDlaProjektu(test.info().project.name, "skrzynka", 0));
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const post = (await materialyPakietu(p.id)).find((m) => m.type === "post" && m.position === 2)!;
    const uwagaId = await dodajUwageKlienta(p.id, post.id, `Skrzynka E2E ${test.info().project.name}: proszę zmienić cenę.`, 1);

    const z = await zespol.newPage();
    await z.goto("/zespol");
    await expect(z.locator("[data-link-skrzynki]")).toBeVisible();
    await z.locator("[data-link-skrzynki]").click();
    await z.waitForURL(/\/zespol\/uwagi$/);
    const karta = z.locator(`[data-uwaga-skrzynki="${uwagaId}"]`);
    await expect(karta).toBeVisible();
    await expect(karta).toContainText("Pierogarnia Babci");
    await expect(karta).toContainText(post.title ?? "");
    await expect(karta).toContainText(copy.zespol.skrzynka.nieprzeczytana);

    // filtr po rodzaju: relacje nie pokazują tej uwagi, posty tak
    await z.goto("/zespol/uwagi?typ=relacja");
    await expect(z.locator(`[data-uwaga-skrzynki="${uwagaId}"]`)).toHaveCount(0);
    await z.goto("/zespol/uwagi?typ=post");
    await expect(z.locator(`[data-uwaga-skrzynki="${uwagaId}"]`)).toBeVisible();

    // odpowiedź stąd = odpowiedź zespołu w wątku materiału
    const k = z.locator(`[data-uwaga-skrzynki="${uwagaId}"]`);
    await k.locator("textarea").fill("Zmieniamy cenę na 39 zł, poprawiony post wyślemy dziś.");
    await k.getByRole("button", { name: copy.zespol.pakietyMaterialow.wyslijOdpowiedz }).click();
    await expect.poll(async () => (await komentarzePakietu(p.id)).filter((x) => x.author_kind === "zespol" && x.item_id === post.id).length).toBe(1);
    await expect(k).toContainText(copy.zespol.skrzynka.odpowiedzi.replace("{n}", "1"));

    await k.locator("[data-zalatwione]").click();
    await expect(z.locator(`[data-uwaga-skrzynki="${uwagaId}"]`)).toHaveCount(0);
    const uwaga = (await komentarzePakietu(p.id)).find((x) => x.id === uwagaId);
    expect(uwaga?.resolved_at).not.toBeNull();
    expect(uwaga?.seen_by_team_at).not.toBeNull();
  } finally {
    await zespol.close();
    await usunPakiet(p.id);
  }
});
