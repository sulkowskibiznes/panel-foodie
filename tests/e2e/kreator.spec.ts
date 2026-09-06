import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { materialyPakietu, okresDlaProjektu, plikiMaterialu, pochodzenieMaterialu, stanMaterialu, szczegolyPakietu, usunPakiet } from "./pomocnicze/pakiety";
import { grafikaTestowa } from "./pomocnicze/pliki";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/**
 * Kreator pakietu na wklejanych linkach (SPEC rozdz. 12.3) i „Dodaj materiał" z komputera (12.6).
 * Klient kat1 (Grupa Smakosz): pakiet per lokal. Okres (cały miesiąc) w roku 2032 zależny od projektu Playwrighta;
 * daty wpisywane ręcznie, numer miesiąca współpracy podpowiadany i edytowalny, zachodzące okresy tylko ostrzegają.
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
    await z.locator("[data-kreator-lokal]").selectOption({ label: "Ramen Ichi" });
    // bez dat nie da się utworzyć; koniec przed początkiem daje ostrzeżenie
    await expect(z.locator("[data-utworz-pakiet]")).toBeDisabled();
    await z.locator("#kreator-od").fill(okres.od);
    await z.locator("#kreator-do").fill(`${okres.rok - 1}-12-31`);
    await expect(z.locator("[data-zly-okres]")).toBeVisible();
    await z.locator("#kreator-do").fill(okres.do);
    await expect(z.locator("[data-zly-okres]")).toHaveCount(0);
    await expect(z.locator("#kreator-tytul")).toHaveValue(/^Materiały \d{2}\.\d{2} - \d{2}\.\d{2}\.\d{4}$/);
    // numer miesiąca współpracy jest podpowiedziany i edytowalny (projekty Playwrighta tworzą pakiety równolegle, więc wpisujemy jawną wartość)
    await expect(z.locator("[data-miesiac-wspolpracy]")).not.toHaveValue("");
    await z.locator("[data-miesiac-wspolpracy]").fill("12");

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
    // Z wklejonymi linkami kreator prowadzi od razu do karty weryfikacyjnej (faza 4); tu linki są zmyślone, więc karty mówią „nie znaleziono"
    await z.waitForURL(/\/pakiety\/[0-9a-f-]{36}\/import$/);
    pakietId = /\/pakiety\/([0-9a-f-]{36})\/import$/.exec(z.url())?.[1] ?? null;
    expect(pakietId).toBeTruthy();
    await expect(z.locator('[data-karta-weryfikacyjna][data-karta-rodzaj="content"]')).toHaveAttribute("data-karta-stan", "nie_znaleziono");
    await expect(z.locator("[data-dalej-mapowanie]")).toBeDisabled();
    await z.goto(`/zespol/klienci/${KLIENT}/pakiety/${pakietId}`);

    const p = await szczegolyPakietu(pakietId!);
    expect(p.status).toBe("szkic");
    expect(p.content_folder_id).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
    expect(p.location_id).not.toBeNull();
    expect(p.cooperation_month).toBe(12);
    expect([p.period_from, p.period_to]).toEqual([okres.od, okres.do]);
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

    // zachodzący okres w tym samym lokalu: kreator ostrzega (z tytułem tamtego pakietu), ale nie blokuje; podpowiedź numeru to 12 + 1
    await z.goto(`/zespol/klienci/${KLIENT}/pakiety/nowy`);
    await z.locator("[data-kreator-lokal]").selectOption({ label: "Ramen Ichi" });
    await z.locator("#kreator-od").fill(`${okres.rok}-${String(okres.miesiac).padStart(2, "0")}-15`);
    await z.locator("#kreator-do").fill(okres.do);
    await expect(z.locator("[data-okres-nachodzi]")).toBeVisible();
    await expect(z.locator("[data-miesiac-wspolpracy]")).toHaveValue("13");
    await expect(z.locator("[data-utworz-pakiet]")).toBeEnabled();
    // inny lokal: brak ostrzeżenia
    await z.locator("[data-kreator-lokal]").selectOption({ label: "Trattoria Bella" });
    await expect(z.locator("[data-okres-nachodzi]")).toHaveCount(0);
  } finally {
    await zespol.close();
    if (pakietId) await usunPakiet(pakietId);
  }
});
