import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { materialyPakietu, okresDlaProjektu, plikiMaterialu, pochodzenieMaterialu, stanMaterialu, szczegolyPakietu, usunPakiet } from "./pomocnicze/pakiety";
import { grafikaTestowa } from "./pomocnicze/pliki";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/**
 * Kreator pakietu na wklejanych linkach (SPEC rozdz. 12.3) i „Dodaj materiał" z komputera (12.6).
 * Klient kat1 (Grupa Smakosz): pakiet per lokal. Miesiąc w roku 2032 zależny od projektu Playwrighta.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

const KLIENT = "grupa-smakosz";
const FOLDER_CONTENTU = "https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz?usp=sharing";
const FOLDER_STANDARD = "https://drive.google.com/drive/folders/1ReklamyStandardowe0000000";
const FOLDER_IMPREZY = "https://drive.google.com/drive/folders/1ReklamyImprezy00000000000";

test("kreator: klient i miesiąc, link do folderu z contentem, dwie kampanie z osobnymi folderami; potem Dodaj materiał", async ({ browser }) => {
  const okres = okresDlaProjektu(test.info().project.name, "kreator", 0);
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  let pakietId: string | null = null;
  try {
    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KLIENT}/materialy`);
    await z.locator("[data-nowy-pakiet]").click();
    await expect(z.locator("[data-kreator-pakietu]")).toBeVisible();
    await z.locator("#kreator-rok").fill(String(okres.rok));
    await z.locator("#kreator-miesiac").selectOption(String(okres.miesiac));
    await z.locator("[data-kreator-lokal]").selectOption({ label: "Ramen Ichi" });

    // zły link nie przechodzi, dobry jest rozpoznany po identyfikatorze folderu
    await z.locator("[data-folder-contentu]").fill("content 5 mies");
    await expect(z.locator("[data-folder-status]")).toHaveText(copy.zespol.kreator.linkNierozpoznany);
    await expect(z.locator("[data-utworz-pakiet]")).toBeDisabled();
    await z.locator("[data-folder-contentu]").fill(FOLDER_CONTENTU);
    await expect(z.locator("[data-folder-status]")).toContainText("1AbCdEfGhIjKlMnOpQrStUvWxYz");

    await z.locator("#kreator-kampania-0-nazwa").fill("Kampania standardowa");
    await z.locator("#kreator-kampania-0-folder").fill(FOLDER_STANDARD);
    await z.locator("[data-dodaj-kampanie-kreator]").click();
    await z.locator("#kreator-kampania-1-nazwa").fill("Imprezy okolicznościowe");
    await z.locator("#kreator-kampania-1-cel").selectOption("leady");
    await z.locator("#kreator-kampania-1-folder").fill(FOLDER_IMPREZY);
    await z.locator("[data-utworz-pakiet]").click();
    await z.waitForURL(/\/pakiety\/[0-9a-f-]{36}$/);
    pakietId = /\/pakiety\/([0-9a-f-]{36})$/.exec(z.url())?.[1] ?? null;
    expect(pakietId).toBeTruthy();

    const p = await szczegolyPakietu(pakietId!);
    expect(p.status).toBe("szkic");
    expect(p.content_folder_id).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
    expect(p.location_id).not.toBeNull();
    expect(p.cooperation_month).toBe((okres.rok - 2026) * 12 + (okres.miesiac - 4) + 1);
    expect(p.kampanie.map((k) => [k.name, k.goal, k.ads_folder_id])).toEqual([
      ["Kampania standardowa", "sprzedaz", "1ReklamyStandardowe0000000"],
      ["Imprezy okolicznościowe", "leady", "1ReklamyImprezy00000000000"],
    ]);
    expect(p.reklamy).toBe(2);
    await expect(z.locator('[data-baner="szkic"]')).toBeVisible();
    await z.getByRole("tab", { name: "Kampanie (2)" }).click();
    await expect(z.locator("[data-kampania]")).toHaveCount(2);

    // „Dodaj materiał": post z komputera, origin = dodatkowy, bez plakietki w szkicu
    await z.locator("[data-dodaj-material]").click();
    const dialog = z.locator("[data-dialog-nowego-materialu]");
    await dialog.locator("#nowy-typ").selectOption("post");
    await dialog.locator("#nowy-tytul").fill("Post 1 - ramen dnia");
    await dialog.locator('input[type="file"]').setInputFiles({ name: "ramen.png", mimeType: "image/png", buffer: await grafikaTestowa("Ramen", "#B42318", 1080, 1080) });
    await expect(dialog.locator("[data-plik-gotowy]")).toBeVisible({ timeout: 30_000 });
    await dialog.locator("[data-dodaj-material-zapisz]").click();
    await expect(dialog).toBeHidden();
    await z.getByRole("tab", { name: "Posty (1)" }).click();
    await expect(z.locator('[data-material][data-typ="post"]')).toHaveCount(1);
    await expect(z.locator('[data-material][data-typ="post"]')).toContainText("Post 1 - ramen dnia");
    await expect(z.locator('[data-material][data-typ="post"] [data-plakietka]')).toHaveCount(0);
    const post = (await materialyPakietu(pakietId!)).find((m) => m.type === "post");
    expect(post).toBeTruthy();
    expect(await pochodzenieMaterialu(post!.id)).toBe("dodatkowy");
    expect((await stanMaterialu(post!.id))?.added_after_submit).toBe(false);
    const pliki = await plikiMaterialu(post!.id);
    expect(pliki).toHaveLength(1);
    expect(pliki[0]?.original_name).toBe("ramen.png");

    // ten sam miesiąc i lokal drugi raz: kreator ostrzega i blokuje
    await z.goto(`/zespol/klienci/${KLIENT}/pakiety/nowy`);
    await z.locator("#kreator-rok").fill(String(okres.rok));
    await z.locator("#kreator-miesiac").selectOption(String(okres.miesiac));
    await z.locator("[data-kreator-lokal]").selectOption({ label: "Ramen Ichi" });
    await expect(z.locator("[data-okres-zajety]")).toBeVisible();
    await expect(z.locator("[data-utworz-pakiet]")).toBeDisabled();
  } finally {
    await zespol.close();
    if (pakietId) await usunPakiet(pakietId);
  }
});
