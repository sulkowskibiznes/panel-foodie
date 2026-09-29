import { expect, test, type Page } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { stanLinku, usunCzlonkaTestowego, utworzCzlonkaTestowego, utworzLinkTestowy, wyczyscLimity } from "./pomocnicze/baza";
import { zalogujKlienta } from "./pomocnicze/klient";
import { daneKlientaTestowego, usunKlientaTestowego, utworzKlientaTestowego, utworzPakietKlienta } from "./pomocnicze/klienci";
import { stanPakietu } from "./pomocnicze/pakiety";
import { grafikaTestowa } from "./pomocnicze/pliki";
import { wpisyAudytuPoEncji } from "./pomocnicze/retencja";
import { PLIK_SESJI_ZESPOLU, zalogujZespol } from "./pomocnicze/zespol";

/**
 * Plan domknięcia, Etap 1: zakładka „Dane i współpraca" karty klienta. Csm (Gosia, opiekun klienta jednorazowego)
 * poprawia dane, lokale ze zdjęciem profilowym, osoby kontaktowe, zespół klienta i akceptację, robi przerwę
 * we współpracy i ją kończy. Każdy test na własnym kliencie jednorazowym, seed zostaje nietknięty.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

function nazwaProjektu(): string {
  return test.info().project.name === "mobile-390" ? "Mobile" : "Desktop";
}

async function otworzUstawienia(z: Page, slug: string) {
  await z.goto(`/zespol/klienci/${slug}`);
  await z.getByRole("link", { name: copy.zespol.karta.zakladki.ustawienia }).click();
  await expect(z.locator("[data-ustawienia-klienta]")).toBeVisible();
}

test("dane, lokale ze zdjęciem profilowym i osoby kontaktowe; cudzy lokal w ciele akcji daje 404", async ({ browser }) => {
  const projekt = test.info().project.name;
  const slug = `e2e-dane-${projekt}`;
  const slugObcy = `e2e-dane-obcy-${projekt}`;
  const nazwa = `Dane Klienta ${nazwaProjektu()} E2E`;
  const klient = await utworzKlientaTestowego(slug, nazwa);
  // klient bez opiekuna i bez przypisań: Gosia (csm) go nie widzi
  const obcy = await utworzKlientaTestowego(slugObcy, `Obcy ${nazwaProjektu()} E2E`, "nikt@foodiemedia.pl");
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const z = await zespol.newPage();

    // Przegląd: karta „Pierwsze kroki" dla świeżego klienta
    await z.goto(`/zespol/klienci/${slug}`);
    await expect(z.locator("[data-pierwsze-kroki]")).toBeVisible();
    await expect(z.locator('[data-krok="zdjecia"]')).toHaveAttribute("data-gotowe", "nie");

    // Dane: nazwa, pakiet, kwota; slug tylko do odczytu
    await otworzUstawienia(z, slug);
    const dane = z.locator('[data-sekcja="dane"]');
    await expect(dane.locator("#dane-slug")).toBeDisabled();
    await dane.locator("#dane-name").fill(`${nazwa} Nowa`);
    await dane.locator("#dane-tier").selectOption("siec");
    await dane.locator("#dane-kwota").fill("4 200,50");
    await dane.locator("[data-zapisz-dane]").click();
    await expect(dane.locator("[data-zapisano]")).toBeVisible();
    await expect.poll(async () => (await daneKlientaTestowego(klient.id)).name).toBe(`${nazwa} Nowa`);
    expect(await daneKlientaTestowego(klient.id)).toMatchObject({ tier: "siec", monthly_amount_net: "4200.50" });
    expect(await wpisyAudytuPoEncji(klient.id, "zespol.klient_zmieniony")).toBe(1);

    // Lokal: nick IG i adres
    const [lokal] = (await daneKlientaTestowego(klient.id)).lokale;
    if (!lokal) throw new Error("Brak lokalu klienta testowego");
    const lokale = z.locator('[data-sekcja="lokale"]');
    await lokale.locator(`[data-edytuj-lokal="${lokal.id}"]`).click();
    const formLokalu = lokale.locator(`[data-formularz-lokalu="${lokal.id}"]`);
    await formLokalu.locator('input[name="ig_handle"]').fill("@nowy.nick");
    await formLokalu.locator('input[name="address"]').fill("ul. Piotrkowska 1");
    await formLokalu.locator("[data-zapisz-lokal]").click();
    await expect(lokale.locator(`[data-lokal="${lokal.id}"]`)).toContainText("@nowy.nick");
    expect((await daneKlientaTestowego(klient.id)).lokale[0]).toMatchObject({ ig_handle: "nowy.nick", address: "ul. Piotrkowska 1" });

    // Nowy lokal przelicza lokale dodatkowe
    await lokale.locator("[data-dodaj-lokal]").click();
    const nowy = lokale.locator('[data-formularz-lokalu="nowy"]');
    await nowy.locator('input[name="name"]').fill(`${nazwa} Manufaktura`);
    await nowy.locator('input[name="fb_page_name"]').fill(nazwa);
    await nowy.locator("[data-zapisz-lokal]").click();
    await expect(lokale.getByText(`${nazwa} Manufaktura`)).toBeVisible();
    await expect.poll(async () => (await daneKlientaTestowego(klient.id)).lokale.length).toBe(2);
    expect((await daneKlientaTestowego(klient.id)).extra_locations_count).toBe(1);

    // Zdjęcie profilowe strony: PNG z przeglądarki, na serwerze WebP bez EXIF, widoczne przez podpisany adres
    const png = await grafikaTestowa("LOGO", "#12855C", 600, 600);
    await lokale.locator(`[data-plik-zdjecia="${lokal.id}"]`).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
    await expect(lokale.locator(`[data-zdjecie-lokalu="${lokal.id}"] [data-awatar-lokalu]`)).toBeVisible();
    const sciezka = (await daneKlientaTestowego(klient.id)).lokale[0]?.avatar_path ?? "";
    expect(sciezka).toMatch(new RegExp(`^${klient.id}/[0-9a-f-]{36}\\.webp$`));
    const awatar = await z.request.get(`/zespol/awatar/${lokal.id}`);
    expect(awatar.status()).toBe(200);
    expect(awatar.headers()["content-type"]).toContain("image/webp");
    await z.goto(`/zespol/klienci/${slug}`);
    await expect(z.locator('[data-krok="zdjecia"]')).toHaveAttribute("data-gotowe", "tak");

    // Osoby kontaktowe: druga osoba, osoba główna, zakończenie z wygaszeniem linku
    const [ola] = (await daneKlientaTestowego(klient.id)).kontakty;
    if (!ola) throw new Error("Brak osoby kontaktowej klienta testowego");
    const linkOli = await utworzLinkTestowy(slug, { label: `E2E dane ${projekt}`, zKontaktem: true });
    await otworzUstawienia(z, slug);
    const kontakty = z.locator('[data-sekcja="kontakty"]');
    await kontakty.locator("[data-dodaj-kontakt]").click();
    const formKontaktu = kontakty.locator('[data-formularz-kontaktu="nowa"]');
    await formKontaktu.locator('input[name="name"]').fill("Kasia Druga");
    await formKontaktu.locator('input[name="phone"]').fill("+48 600 000 000");
    await formKontaktu.locator('input[name="email"]').fill("kasia@example.com");
    await formKontaktu.locator("[data-zapisz-kontakt]").click();
    await expect(kontakty.getByText("Kasia Druga")).toBeVisible();
    const kasia = (await daneKlientaTestowego(klient.id)).kontakty.find((k) => k.name === "Kasia Druga");
    expect(kasia).toMatchObject({ is_primary: false, phone: "+48 600 000 000", email: "kasia@example.com" });

    await kontakty.locator(`[data-ustaw-glowna="${kasia!.id}"]`).click();
    await expect.poll(async () => (await daneKlientaTestowego(klient.id)).kontakty.find((k) => k.id === kasia!.id)?.is_primary).toBe(true);
    expect((await daneKlientaTestowego(klient.id)).kontakty.filter((k) => k.is_primary)).toHaveLength(1);

    await kontakty.locator(`[data-archiwizuj-kontakt="${ola.id}"]`).click();
    await expect(z.locator("[data-wygas-linki-kontaktu]")).toBeChecked();
    await z.locator("[data-potwierdz-archiwizacje]").click();
    await expect(kontakty.locator("[data-byle-kontakty]")).toBeVisible();
    await expect(kontakty.locator(`[data-kontakt="${ola.id}"]`)).toHaveCount(0);
    const olaPo = (await daneKlientaTestowego(klient.id)).kontakty.find((k) => k.id === ola.id);
    expect(olaPo?.archived_at).not.toBeNull();
    expect(olaPo).toMatchObject({ phone: null, email: null, is_primary: false });
    expect((await stanLinku(linkOli.id))?.revoked_at).not.toBeNull();

    // Przegląd pokazuje telefon i e-mail osoby, bez osoby zakończonej
    await z.goto(`/zespol/klienci/${slug}`);
    await expect(z.getByText("kasia@example.com")).toBeVisible();
    await expect(z.getByText("Ola Testowa")).toHaveCount(0);

    // Izolacja: lokal klienta bez dostępu podmieniony w ciele akcji = 404, lokal obcego klienta bez zmian
    const [lokalObcy] = (await daneKlientaTestowego(obcy.id)).lokale;
    if (!lokalObcy) throw new Error("Brak lokalu obcego klienta");
    expect((await z.goto(`/zespol/klienci/${slugObcy}/ustawienia`))?.status()).toBe(404);
    await otworzUstawienia(z, slug);
    await z.route(`**/zespol/klienci/${slug}/ustawienia`, async (route) => {
      const req = route.request();
      const cialo = req.postData();
      if (req.method() === "POST" && req.headers()["next-action"] && cialo?.includes(lokal.id)) {
        await route.continue({ postData: cialo.split(lokal.id).join(lokalObcy.id) });
        return;
      }
      await route.continue();
    });
    await lokale.locator(`[data-edytuj-lokal="${lokal.id}"]`).click();
    await formLokalu.locator('input[name="name"]').fill("Przejęty lokal");
    const [odp] = await Promise.all([
      z.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]),
      formLokalu.locator("[data-zapisz-lokal]").click(),
    ]);
    expect(odp.status()).toBe(404);
    await z.unroute(`**/zespol/klienci/${slug}/ustawienia`);
    expect((await daneKlientaTestowego(obcy.id)).lokale[0]?.name).toBe(lokalObcy.name);
    expect((await daneKlientaTestowego(klient.id)).lokale[0]?.name).toBe(lokal.name);
  } finally {
    await zespol.close();
    await usunKlientaTestowego(slug);
    await usunKlientaTestowego(slugObcy);
  }
});

test("zespół klienta: content creator widzi klienta dopiero po przypisaniu, po odpięciu znowu 404", async ({ page, browser }) => {
  await wyczyscLimity();
  const projekt = test.info().project.name;
  const slug = `e2e-zespol-klienta-${projekt}`;
  const klient = await utworzKlientaTestowego(slug, `Zespół Klienta ${nazwaProjektu()} E2E`);
  const cc = await utworzCzlonkaTestowego(`e2e-cc-dane-${projekt}-${process.env.E2E_SEED ?? "0"}@foodiemedia.pl`, "content_creator");
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    await zalogujZespol(page, cc.email);
    expect((await page.goto(`/zespol/klienci/${slug}`))?.status()).toBe(404);

    const z = await zespol.newPage();
    await otworzUstawienia(z, slug);
    const sekcja = z.locator('[data-sekcja="zespol"]');
    await sekcja.locator(`[data-przypisany="${cc.id}"]`).check();
    await sekcja.locator("[data-zapisz-zespol]").click();
    await expect(sekcja.locator("[data-zapisano]")).toBeVisible();
    expect((await daneKlientaTestowego(klient.id)).przypisani).toContain(cc.id);
    expect(await wpisyAudytuPoEncji(klient.id, "zespol.klient_przypisania")).toBe(1);

    expect((await page.goto(`/zespol/klienci/${slug}`))?.status()).toBe(200);
    // content creator nie ma zakładki „Dane i współpraca" (klienci: podgląd), a adres wprost daje 404
    await expect(page.getByRole("link", { name: copy.zespol.karta.zakladki.ustawienia })).toHaveCount(0);
    expect((await page.goto(`/zespol/klienci/${slug}/ustawienia`))?.status()).toBe(404);

    await sekcja.locator(`[data-przypisany="${cc.id}"]`).uncheck();
    await sekcja.locator("[data-zapisz-zespol]").click();
    await expect.poll(async () => (await daneKlientaTestowego(klient.id)).przypisani).not.toContain(cc.id);
    expect((await page.goto(`/zespol/klienci/${slug}`))?.status()).toBe(404);
  } finally {
    await zespol.close();
    await usunKlientaTestowego(slug);
    await usunCzlonkaTestowego(cc);
  }
});

test("akceptacja per klient i przerwa we współpracy: pakiet wraca do szkicu, link klienta działa, wznowienie", async ({ page, browser }) => {
  await wyczyscLimity();
  const projekt = test.info().project.name;
  const slug = `e2e-przerwa-${projekt}`;
  const nazwa = `Przerwa ${nazwaProjektu()} E2E`;
  const klient = await utworzKlientaTestowego(slug, nazwa);
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const wToku = await utworzPakietKlienta(klient.id, { status: "do_akceptacji", autoZaGodzin: 48 });
    const link = await utworzLinkTestowy(slug, { label: `E2E przerwa ${projekt}` });
    const z = await zespol.newPage();
    await otworzUstawienia(z, slug);

    // Akceptacja: bez auto-akceptacji domyślnie, 96 h zamiast 72 h, godziny publikacji 10 i 19
    const akceptacja = z.locator('[data-sekcja="akceptacja"]');
    await akceptacja.locator('input[name="auto_approve_default"]').uncheck();
    await akceptacja.locator("#akceptacja-godziny").fill("96");
    await akceptacja.locator("#akceptacja-publikacja").fill("19, 10");
    await akceptacja.locator("[data-zapisz-akceptacje]").click();
    await expect(akceptacja.locator("[data-zapisano]")).toBeVisible();
    expect(await daneKlientaTestowego(klient.id)).toMatchObject({ auto_approve_default: false, auto_approve_hours: 96, default_publish_hours: [10, 19] });

    // Przerwa: pakiet czekający na akceptację wraca do szkicu, klient znika z pulpitu, link działa
    z.once("dialog", (dlg) => {
      expect(dlg.message()).toContain(nazwa);
      void dlg.accept();
    });
    await z.locator("[data-przerwa-wspolpracy]").click();
    await expect(z.locator("[data-wspolpraca=wstrzymany]")).toBeVisible();
    await expect(z.locator("[data-przerwa]")).toBeVisible();
    expect((await stanPakietu(wToku.id)).status).toBe("szkic");
    expect(await wpisyAudytuPoEncji(klient.id, "zespol.klient_wstrzymany")).toBe(1);
    await z.goto("/zespol");
    await expect(z.locator(`[data-klient-nieaktywny="${slug}"]`)).toContainText(copy.zespol.karta.statusKlienta.wstrzymany);
    await zalogujKlienta(page, link.token, link.pin);
    await expect(page).toHaveURL(new RegExp(`/p/${link.token}/`));

    // Wznowienie wraca do stanu aktywnego
    await z.goto(`/zespol/klienci/${slug}/ustawienia`);
    await z.locator("[data-wznow-wspolprace]").click();
    await expect(z.locator("[data-wspolpraca=aktywny]")).toBeVisible();
    expect(await wpisyAudytuPoEncji(klient.id, "zespol.klient_wznowiony")).toBe(1);
    await expect(z.locator('[data-sekcja="dane"]')).toBeVisible();
  } finally {
    await zespol.close();
    await usunKlientaTestowego(slug);
  }
});
