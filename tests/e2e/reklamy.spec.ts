import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { pakietKlienta, usunLinkTestowy, utworzLinkTestowy, wyczyscLimity, type LinkTestowy } from "./pomocnicze/baza";
import { zalogujKlienta } from "./pomocnicze/klient";
import { komentarzePakietu, materialyPakietu, okresDlaProjektu, sklonujPakiet, usunPakiet, wariantyMaterialu } from "./pomocnicze/pakiety";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/** Kryteria 14 i 15 z SPEC rozdz. 18 (ekran reklamy). */
test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

const KAT2 = "burger-brothers";
const KAT3 = "pierogarnia-babci";
const PLACEMENTY = ["fb_kanal_telefon", "fb_kanal_komputer", "fb_relacje", "fb_reels", "ig_kanal", "ig_relacje_reels"] as const;

let linkKat2: LinkTestowy;
let linkKat3: LinkTestowy;

test.beforeAll(async () => {
  await wyczyscLimity();
  linkKat2 = await utworzLinkTestowy(KAT2, { label: `E2E reklamy kat2 ${Date.now()}`, zKontaktem: true });
  linkKat3 = await utworzLinkTestowy(KAT3, { label: `E2E reklamy kat3 ${Date.now()}` });
});
test.afterAll(async () => {
  await usunLinkTestowy(linkKat2.id);
  await usunLinkTestowy(linkKat3.id);
});

test("14. 6 grafik × 3 teksty × 3 nagłówki = 54 kombinacje w każdym z sześciu placementów, bez przeładowania", async ({ page }) => {
  const pakietId = await pakietKlienta(KAT2);
  const reklama = (await materialyPakietu(pakietId)).find((m) => m.type === "reklama");
  expect(reklama).toBeTruthy();
  const warianty = await wariantyMaterialu(reklama!.id);
  const wspolne = (rodzaj: string) => warianty.filter((w) => w.kind === rodzaj && w.location_id === null).sort((a, b) => a.position - b.position);
  const grafiki = wspolne("grafika");
  const teksty = wspolne("tekst");
  const naglowki = wspolne("naglowek");
  expect(grafiki).toHaveLength(6);
  expect(teksty).toHaveLength(3);
  expect(naglowki).toHaveLength(3);

  await zalogujKlienta(page, linkKat2.token, linkKat2.pin);
  await page.goto(`/p/${linkKat2.token}/materialy/${pakietId}`);
  await page.getByRole("tab", { name: "Kampanie (1)" }).click();
  const sekcja = page.locator("[data-kampania]").first();
  await expect(sekcja.locator("[data-placement-aktywny]")).toBeVisible();
  await expect(sekcja.getByText(copy.podglad.warianty.kombinacje.replace("{n}", "54"))).toBeVisible();
  const adres = page.url();
  await page.evaluate(() => {
    (window as unknown as { __bezPrzeladowania: number }).__bezPrzeladowania = 1;
  });

  let sprawdzone = 0;
  for (const placement of PLACEMENTY) {
    await sekcja.locator(`[data-placement="${placement}"]`).click();
    const kontener = sekcja.locator("[data-placement-aktywny]");
    await expect(kontener).toHaveAttribute("data-placement-aktywny", placement);
    const ramka = kontener.locator("[data-podglad]");
    for (const g of grafiki) {
      await sekcja.locator('select[data-lista="grafika"]').selectOption(g.id);
      for (const t of teksty) {
        await sekcja.locator('select[data-lista="tekst"]').selectOption(t.id);
        for (const n of naglowki) {
          await sekcja.locator('select[data-lista="naglowek"]').selectOption(n.id);
          await expect(ramka.locator("[data-media]")).toHaveAttribute("src", new RegExp(`/plik/${g.asset_id}/`));
          await expect(ramka).toContainText((t.value_text ?? "").slice(0, 24));
          await expect(ramka.locator("[data-naglowek]")).toContainText(n.value_text ?? "");
          sprawdzone += 1;
        }
      }
    }
  }
  expect(sprawdzone).toBe(54 * PLACEMENTY.length);
  expect(page.url()).toBe(adres);
  expect(await page.evaluate(() => (window as unknown as { __bezPrzeladowania?: number }).__bezPrzeladowania)).toBe(1);
});

test("14. przełącznik lokalu: link per lokal i brak nicka IG wyszarza placementy instagramowe z podpowiedzią", async ({ page }) => {
  const pakietId = await pakietKlienta(KAT3);
  await zalogujKlienta(page, linkKat3.token, linkKat3.pin);
  await page.goto(`/p/${linkKat3.token}/materialy/${pakietId}`);
  await page.getByRole("tab", { name: "Kampanie (2)" }).click();
  const sekcja = page.locator("[data-kampania]").first();
  const lokal = sekcja.locator('select[id$="-lokal"]');
  await expect(lokal).toBeVisible();
  // Łódź ma nick: placementy IG dostępne, link z wersji dla Łodzi
  await lokal.selectOption({ label: "Pierogarnia Babci Łódź" });
  await expect(sekcja.locator('[data-placement="ig_kanal"]')).toBeEnabled();
  await expect(sekcja.locator("[data-zrodla]")).toContainText("Pierogarnia Babci Łódź");
  await expect(sekcja.locator("[data-zrodla]")).toContainText(copy.podglad.elementy.link);
  await sekcja.locator('[data-placement="ig_kanal"]').click();
  await expect(sekcja.locator("[data-placement-aktywny]")).toHaveAttribute("data-placement-aktywny", "ig_kanal");
  await expect(sekcja.locator('[data-podglad="reklama-ig-kanal"]')).toContainText("pierogarniababci.lodz");
  // Kraków bez nicka: IG wyszarzone z podpowiedzią, nie ukryte; podgląd wraca do kanału FB
  await lokal.selectOption({ label: "Pierogarnia Babci Kraków" });
  await expect(sekcja.locator('[data-placement="ig_kanal"]')).toBeDisabled();
  await expect(sekcja.locator('[data-placement="ig_relacje_reels"]')).toBeDisabled();
  await expect(sekcja.getByText(copy.podglad.brakIg.klient)).toBeVisible();
  await expect(sekcja.locator("[data-placement-aktywny]")).toHaveAttribute("data-placement-aktywny", "fb_kanal_telefon");
  await expect(sekcja.locator('[data-podglad="reklama-fb-kanal-telefon"]')).toContainText("Pierogarnia Babci Kraków");
  // wersja wspólna: tylko elementy wspólne, link per lokal znika
  await lokal.selectOption({ value: "" });
  await expect(sekcja.locator("[data-zrodla]")).toHaveText(copy.podglad.zrodla.wszystkoWspolne);
});

test("15. komentarz przypięty do wariantu wraca w panelu zespołu przy tym wariancie", async ({ page, browser }) => {
  const p = await sklonujPakiet(KAT2, okresDlaProjektu(test.info().project.name, "reklamy", 0));
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const reklama = (await materialyPakietu(p.id)).find((m) => m.type === "reklama");
    const grafiki = (await wariantyMaterialu(reklama!.id)).filter((w) => w.kind === "grafika").sort((a, b) => a.position - b.position);
    const trzecia = grafiki[2]!;

    await zalogujKlienta(page, linkKat2.token, linkKat2.pin);
    await page.goto(`/p/${linkKat2.token}/materialy/${p.id}`);
    await page.getByRole("tab", { name: "Kampanie (1)" }).click();
    const sekcja = page.locator("[data-kampania]").first();
    await sekcja.locator('select[data-lista="grafika"]').selectOption(trzecia.id);
    const formularz = sekcja.locator("[data-formularz-komentarza]");
    await formularz.locator('select[id$="-cel"]').selectOption(trzecia.id);
    await formularz.locator("textarea").fill("Na tej grafice logo jest za małe.");
    await formularz.getByRole("button", { name: copy.pakiet.komentarze.wyslij }).click();
    await expect(sekcja.locator(`[data-wariant-komentarza="${trzecia.id}"]`)).toContainText("logo jest za małe");
    await expect(sekcja.locator(`[data-wariant-komentarza="${trzecia.id}"]`)).toContainText("Grafika 3");

    const komentarze = await komentarzePakietu(p.id);
    expect(komentarze).toHaveLength(1);
    expect(komentarze[0]?.variant_id).toBe(trzecia.id);
    expect(komentarze[0]?.item_id).toBe(reklama!.id);

    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KAT2}/pakiety/${p.id}`);
    await z.getByRole("tab", { name: "Kampanie (1)" }).click();
    const sekcjaZespolu = z.locator("[data-kampania]").first();
    await expect(sekcjaZespolu.locator(`[data-wariant-komentarza="${trzecia.id}"]`)).toContainText("logo jest za małe");
    await sekcjaZespolu.getByRole("button", { name: copy.podglad.wszystkieWarianty }).click();
    await expect(sekcjaZespolu.locator(`[data-wariant="${trzecia.id}"]`)).toContainText("logo jest za małe");
    await expect(sekcjaZespolu.locator(`[data-wariant="${grafiki[0]!.id}"]`)).not.toContainText("logo jest za małe");
  } finally {
    await zespol.close();
    await usunPakiet(p.id);
  }
});
