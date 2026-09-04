import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { zlozDateLokalna } from "../../src/lib/harmonogram/kalendarz";
import { usunLinkTestowy, utworzLinkTestowy, wyczyscLimity, type LinkTestowy } from "./pomocnicze/baza";
import { zalogujKlienta } from "./pomocnicze/klient";
import { materialyPakietu, okresDlaProjektu, sklonujPakiet, stanMaterialu, usunPakiet } from "./pomocnicze/pakiety";

/** postgres.js zwraca timestamptz jako Date; porównujemy w ISO. */
async function publikacja(itemId: string): Promise<string | null> {
  const w = await stanMaterialu(itemId);
  return w?.publish_at ? new Date(w.publish_at).toISOString() : null;
}
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/**
 * Harmonogram (SPEC rozdz. 8): zespół przeciąga i ustawia daty, klient tylko ogląda (kryterium 22).
 * Klony pakietu Pierogarni Babci w roku 2031, miesiące per projekt Playwrighta.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

const KLIENT = "pierogarnia-babci";
let link: LinkTestowy;

test.beforeAll(async () => {
  await wyczyscLimity();
  link = await utworzLinkTestowy(KLIENT, { label: `E2E harmonogram ${Date.now()}` });
});
test.afterAll(async () => {
  await usunLinkTestowy(link.id);
});

const dwie = (n: number) => String(n).padStart(2, "0");

test("zespół: przeciągnięcie na inny dzień, pole daty i godziny, panel Niezaplanowane", async ({ browser }) => {
  const okres = okresDlaProjektu(test.info().project.name, "harmonogram", 0);
  const p = await sklonujPakiet(KLIENT, { ...okres, status: "szkic" });
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU, viewport: { width: 1440, height: 1000 } });
  try {
    // klon dziedziczy daty z września 2026, więc materiały są „poza tym miesiącem"; przenosimy je polem daty
    const post1 = (await materialyPakietu(p.id)).find((m) => m.type === "post" && m.position === 1)!;
    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KLIENT}/harmonogram?m=${okres.rok}-${dwie(okres.miesiac)}`);
    await expect(z.locator("[data-harmonogram-zespolu]")).toBeVisible();
    await expect(z.locator("[data-poza-miesiacem]")).toBeVisible();

    const kafelek = z.locator(`[data-material-kalendarza="${post1.id}"]`);
    await kafelek.locator("[data-otworz-date]").click();
    await kafelek.locator("[data-pole-daty]").fill(`${okres.rok}-${dwie(okres.miesiac)}-10`);
    await kafelek.locator("[data-pole-godziny]").fill("18:30");
    await kafelek.locator("[data-ustaw-date]").click();
    await expect(z.locator(`[data-dzien="${okres.rok}-${dwie(okres.miesiac)}-10"] [data-material-kalendarza="${post1.id}"]`)).toBeVisible();
    await expect.poll(() => publikacja(post1.id)).toBe(zlozDateLokalna(`${okres.rok}-${dwie(okres.miesiac)}-10`, 18, 30).toISOString());
    await z.waitForLoadState("networkidle");

    // przeciągnięcie na dzień 12: dnd-kit (PointerSensor, próg 6 px)
    const uchwyt = z.locator(`[data-dzien="${okres.rok}-${dwie(okres.miesiac)}-10"] [data-material-kalendarza="${post1.id}"] [data-uchwyt]`);
    const cel = z.locator(`[data-dzien="${okres.rok}-${dwie(okres.miesiac)}-12"]`);
    const a = (await uchwyt.boundingBox())!;
    const b = (await cel.boundingBox())!;
    await z.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await z.mouse.down();
    await z.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 6 });
    await z.waitForTimeout(100);
    await z.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
    await z.waitForTimeout(150);
    await z.mouse.up();
    await expect(z.locator(`[data-dzien="${okres.rok}-${dwie(okres.miesiac)}-12"] [data-material-kalendarza="${post1.id}"]`)).toBeVisible();
    // godzina zostaje z materiału, zmienia się dzień
    await expect.poll(() => publikacja(post1.id)).toBe(zlozDateLokalna(`${okres.rok}-${dwie(okres.miesiac)}-12`, 18, 30).toISOString());
    await z.waitForLoadState("networkidle");

    // „Bez daty": materiał ląduje w panelu Niezaplanowane, a wysyłka pakietu byłaby zablokowana (kryterium 21)
    const przeniesiony = z.locator(`[data-material-kalendarza="${post1.id}"]`);
    await przeniesiony.locator("[data-otworz-date]").click();
    await przeniesiony.locator("[data-usun-date]").click();
    await expect(z.locator(`[data-niezaplanowane] [data-material-kalendarza="${post1.id}"]`)).toBeVisible();
    await expect.poll(() => publikacja(post1.id)).toBeNull();
  } finally {
    await zespol.close();
    await usunPakiet(p.id);
  }
});

test("22. klient nie może przesunąć materiału: kalendarz bez uchwytów, bez pól daty, bez endpointu", async ({ page }) => {
  const okres = okresDlaProjektu(test.info().project.name, "harmonogram", 1);
  const p = await sklonujPakiet(KLIENT, okres);
  try {
    // klon ma daty z września 2026 (seed): kalendarz klienta pokazuje ten miesiąc
    await zalogujKlienta(page, link.token, link.pin);
    await page.goto(`/p/${link.token}/harmonogram?m=2026-09`);
    await expect(page.locator("[data-harmonogram-klienta]")).toBeVisible();
    await expect(page.locator("[data-material-kalendarza]").first()).toBeVisible();
    await expect(page.locator("[data-uchwyt]")).toHaveCount(0);
    await expect(page.locator('input[type="date"], input[type="datetime-local"], input[type="time"]')).toHaveCount(0);
    await expect(page.locator("[data-formularz-daty]")).toHaveCount(0);
    await expect(page.locator("[draggable='true']")).toHaveCount(0);
    await expect(page.getByRole("link", { name: copy.harmonogram.skomentuj }).first()).toBeVisible();
    await expect(page.locator("[data-kampanie-miesiaca]")).toContainText("Kampania standardowa");
    // nie ma trasy do przesuwania po stronie klienta
    expect((await page.request.post(`/p/${link.token}/harmonogram/przesun`, { data: {} })).status()).toBe(404);
    // klient nie widzi szkiców w kalendarzu
    await page.goto(`/p/${link.token}/harmonogram?m=${okres.rok}-${dwie(okres.miesiac)}`);
    await expect(page.locator("[data-material-kalendarza]")).toHaveCount(0);
  } finally {
    await usunPakiet(p.id);
  }
});
