import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { usunLinkTestowy, utworzLinkTestowy, wyczyscLimity, type LinkTestowy } from "./pomocnicze/baza";
import { zalogujKlienta } from "./pomocnicze/klient";
import { flagaPoAkceptacji, idKlienta, liczbaZdarzenOutbox, liczbaZdarzenPakietu, materialyPakietu, okresDlaProjektu, plikiMaterialu, sklonujPakiet, stanMaterialu, stanPakietu, ustawDatePublikacji, usunPakiet, wpisyAudytuKlienta, type OpcjeKlonu } from "./pomocnicze/pakiety";
import { grafikaTestowa } from "./pomocnicze/pliki";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/**
 * Kryteria 19, 20, 21 i 25 z SPEC rozdz. 18: podmiana w zaakceptowanym pakiecie (potwierdzenie, zdarzenie,
 * plakietka, baner), stary plik z superseded_at, wysyłka bez daty zablokowana z listą braków, impersonacja.
 * Klony pakietu Pierogarni Babci (kat3) w osobnym roku; zespół z zapisanej sesji (Gosia, csm).
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const KLIENT = "pierogarnia-babci";
let link: LinkTestowy;

test.beforeAll(async () => {
  await wyczyscLimity();
  link = await utworzLinkTestowy(KLIENT, { label: `E2E zespol ${Date.now()}`, zKontaktem: true });
});
test.afterAll(async () => {
  await usunLinkTestowy(link.id);
});

async function klon(przesuniecie: number, opcje: Partial<OpcjeKlonu> = {}) {
  return sklonujPakiet(KLIENT, { ...okresDlaProjektu(test.info().project.name, "zespol", przesuniecie), ...opcje });
}

test("19 i 20. podmiana w zaakceptowanym pakiecie: potwierdzenie, zdarzenie, plakietka u klienta, baner; stary plik zostaje z superseded_at", async ({ page, browser }) => {
  const p = await klon(0, { status: "zaakceptowany", autoZaGodzin: null });
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const post1 = (await materialyPakietu(p.id)).find((m) => m.type === "post" && m.position === 1);
    expect(post1).toBeTruthy();
    const przed = await plikiMaterialu(post1!.id);
    expect(przed.filter((f) => f.superseded_at === null)).toHaveLength(2);
    const stary = przed[0]!;

    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KLIENT}/pakiety/${p.id}`);
    const sekcja = z.locator(`[data-material="${post1!.id}"]`);
    await sekcja.locator("[data-pliki-materialu]").click();
    const dialog = z.locator("[data-dialog-plikow]");
    await expect(dialog).toBeVisible();
    // Zaakceptowany pakiet: przyciski podmiany są zablokowane, dopóki nie potwierdzisz świadomie
    await expect(dialog.locator("[data-potwierdzenie-po-akceptacji]")).toContainText(copy.zespol.materialy.potwierdzenie.tytul);
    await expect(dialog.locator(`[data-podmien-plik="${stary.id}"]`)).toBeDisabled();
    await dialog.locator("[data-potwierdzam]").check();
    await dialog.locator(`[data-podmien-plik="${stary.id}"]`).click();
    await dialog.locator('input[type="file"]').setInputFiles({ name: "post-1-nowy.png", mimeType: "image/png", buffer: await grafikaTestowa("Nowy 1") });
    await expect(dialog.locator("[data-wynik-akcji]")).toContainText(copy.zespol.materialy.zapisanoPlakietka.poprawione, { timeout: 30_000 });

    // kryterium 20: stary plik istnieje z superseded_at i wskazuje na nowy; nowy jest na tej samej pozycji
    const po = await plikiMaterialu(post1!.id);
    const staryPo = po.find((f) => f.id === stary.id);
    expect(staryPo?.superseded_at).not.toBeNull();
    expect(staryPo?.superseded_by).toBeTruthy();
    const nowy = po.find((f) => f.id === staryPo?.superseded_by);
    expect(nowy?.position).toBe(stary.position);
    expect(nowy?.original_name).toBe("post-1-nowy.png");
    expect(po.filter((f) => f.superseded_at === null)).toHaveLength(2);

    // kryterium 19: zdarzenie, plakietka, flaga, outbox
    expect(await liczbaZdarzenPakietu(p.id, "material_podmieniony")).toBe(1);
    expect((await stanMaterialu(post1!.id))?.updated_in_round).toBe(1);
    expect(await flagaPoAkceptacji(p.id)).toBe(true);
    expect(await liczbaZdarzenOutbox("material.podmieniony_po_akceptacji", p.id)).toBe(1);
    expect((await stanPakietu(p.id)).status).toBe("zaakceptowany");

    // klient widzi baner o podmianie i plakietkę „Poprawione" przy tym poście, a nowy plik w podglądzie
    await zalogujKlienta(page, link.token, link.pin);
    await page.goto(`/p/${link.token}/materialy/${p.id}`);
    await expect(page.locator('[data-baner="podmiana"]')).toBeVisible();
    const uKlienta = page.locator(`[data-material="${post1!.id}"]`);
    await expect(uKlienta.locator('[data-plakietka="poprawione"]')).toHaveText(copy.pakiet.plakietki.poprawione);
    await expect(uKlienta.locator("[data-media]").first()).toHaveAttribute("src", new RegExp(`/plik/${nowy!.id}/`));
  } finally {
    await zespol.close();
    await usunPakiet(p.id);
  }
});

test("21. wysyłka pakietu z postem bez daty publikacji jest zablokowana z listą braków", async ({ browser }) => {
  const p = await klon(1, { status: "szkic" });
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const materialy = await materialyPakietu(p.id);
    const post3 = materialy.find((m) => m.type === "post" && m.position === 3)!;
    const relacja2 = materialy.find((m) => m.type === "relacja" && m.position === 2)!;
    await ustawDatePublikacji(post3.id, null);
    await ustawDatePublikacji(relacja2.id, null);

    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KLIENT}/pakiety/${p.id}`);
    await z.locator('[data-akcja="wyslij"]').click();
    await z.locator("[data-potwierdz-wysylke]").click();
    const braki = z.locator("[data-braki]");
    await expect(braki).toBeVisible();
    await expect(braki).toContainText(copy.wysylka.brakDaty.replace("{tytul}", post3.title ?? ""));
    await expect(braki).toContainText(copy.wysylka.brakDaty.replace("{tytul}", relacja2.title ?? ""));
    await expect(braki.locator("li")).toHaveCount(2);
    expect((await stanPakietu(p.id)).status).toBe("szkic");

    // po uzupełnieniu daty w edycji materiału wysyłka przechodzi
    await z.keyboard.press("Escape");
    const okres = okresDlaProjektu(test.info().project.name, "zespol", 1);
    const data = `${okres.rok}-${String(okres.miesiac).padStart(2, "0")}-15T12:00`;
    for (const m of [post3, relacja2]) {
      if (m.type === "relacja") {
        // seria relacji: jedna ramka, narzędzia dotyczą pokazywanej relacji
        await z.getByRole("tab", { name: "Relacje (10)" }).click();
        await z.getByRole("tab", { name: m.title ?? "" }).click();
      }
      const sekcja = z.locator(`[data-material="${m.id}"]`);
      await expect(sekcja).toBeVisible();
      await sekcja.locator("[data-edytuj-material]").click();
      const dialog = z.locator("[data-dialog-edycji]");
      await dialog.locator("[data-pole-publikacji]").fill(data);
      await dialog.locator("[data-zapisz-material]").click();
      await expect(dialog).toBeHidden();
      await expect.poll(async () => (await stanMaterialu(m.id))?.publish_at).not.toBeNull();
    }
    await z.locator('[data-akcja="wyslij"]').click();
    await z.locator("[data-potwierdz-wysylke]").click();
    await expect(z.locator("[data-pasek-zespolu]")).toContainText(copy.zespol.pakietyMaterialow.autoTermin);
    expect((await stanPakietu(p.id)).status).toBe("do_akceptacji");
  } finally {
    await zespol.close();
    await usunPakiet(p.id);
  }
});

test(`25. „Zobacz jak klient": pasek podglądu, przyciski decyzji zablokowane, brak formularzy uwag, wejście i wyjście w audit_log`, async ({ browser }) => {
  const p = await klon(2);
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const clientId = await idKlienta(KLIENT);
    const od = new Date(Date.now() - 5_000);
    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KLIENT}`);
    await z.locator("[data-zobacz-jak-klient]").click();
    await z.waitForURL(/\/p\/podglad\.[^/]+\/start$/);
    const pasek = z.locator("[data-pasek-podgladu]");
    await expect(pasek).toContainText(copy.podgladKlienta.pasek.replace("{nazwa}", "Pierogarnia Babci"));
    expect(await wpisyAudytuKlienta(clientId, "zespol.podglad_klienta_start", od)).toBe(1);

    const token = /\/p\/([^/]+)\/start$/.exec(z.url())?.[1] ?? "";
    await z.goto(`/p/${token}/materialy/${p.id}`);
    await expect(z.locator("[data-pasek-pakietu]")).toBeVisible();
    await expect(z.locator('[data-decyzja="akceptuj"]')).toBeDisabled();
    await expect(z.locator('[data-decyzja="uwagi"]')).toBeDisabled();
    await expect(z.locator('[data-decyzja="akceptuj"]')).toHaveAttribute("title", copy.podgladKlienta.niedostepne);
    await expect(z.locator("[data-formularz-komentarza]")).toHaveCount(0);
    await expect(z.locator("[data-notka-watku]").first()).toHaveText(copy.podgladKlienta.komentarzeZablokowane);
    // podgląd nie zostawia śladów po stronie klienta
    expect((await stanPakietu(p.id)).first_opened_at).toBeNull();

    await pasek.getByRole("button", { name: copy.podgladKlienta.wyjdz }).click();
    await z.waitForURL(new RegExp(`/zespol/klienci/${KLIENT}$`));
    expect(await wpisyAudytuKlienta(clientId, "zespol.podglad_klienta_koniec", od)).toBe(1);

    // token podglądu bez sesji zespołu = 404
    const obcy = await browser.newContext();
    const strona = await obcy.newPage();
    expect((await strona.goto(`/p/${token}/start`))?.status()).toBe(404);
    await obcy.close();
  } finally {
    await zespol.close();
    await usunPakiet(p.id);
  }
});
