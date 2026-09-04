import { expect, test, type Page } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { usunLinkTestowy, utworzLinkTestowy, wyczyscLimity, type LinkTestowy } from "./pomocnicze/baza";
import { zalogujKlienta } from "./pomocnicze/klient";
import { dodajUwageKlienta, komentarzePakietu, liczbaZdarzenOutbox, materialyPakietu, okresDlaProjektu, oznaczPoprawiony, sklonujPakiet, stanPakietu, usunPakiet, type OpcjeKlonu } from "./pomocnicze/pakiety";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/**
 * Kryteria 7-10, 12, 13 i 16 z SPEC rozdz. 18. Każdy test pracuje na KLONIE pakietu Pierogarni Babci
 * (kat3, 6 postów, 10 relacji, 2 kampanie) w osobnym miesiącu, więc seed zostaje nietknięty.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

const KLIENT = "pierogarnia-babci";
let link: LinkTestowy;

test.beforeAll(async () => {
  await wyczyscLimity();
  link = await utworzLinkTestowy(KLIENT, { label: `E2E akceptacja ${Date.now()}`, zKontaktem: true });
});
test.afterAll(async () => {
  await usunLinkTestowy(link.id);
});

async function klon(przesuniecie: number, opcje: Partial<OpcjeKlonu> = {}) {
  return sklonujPakiet(KLIENT, { ...okresDlaProjektu(test.info().project.name, "akceptacja", przesuniecie), ...opcje });
}

async function otworzPakiet(page: Page, pakietId: string) {
  await zalogujKlienta(page, link.token, link.pin);
  await page.goto(`/p/${link.token}/materialy/${pakietId}`);
  await expect(page.locator("[data-pasek-pakietu]")).toBeVisible();
}

test("7. pakiet 6 postów + 10 relacji + 2 kampanie renderuje się (kryteria 7 i 16: kampanie jako osobne sekcje)", async ({ page }) => {
  const p = await klon(0);
  try {
    await otworzPakiet(page, p.id);
    await expect(page.locator("[data-pasek-pakietu]")).toContainText("6 postów · 10 relacji · 2 kampanie reklamowe");
    await expect(page.locator('[data-material][data-typ="post"]')).toHaveCount(6);
    await expect(page.locator('[data-podglad="post-fb"]').first()).toBeVisible();
    await expect(page.locator('[data-podglad="post-fb"] img').first()).toBeVisible();

    await page.getByRole("tab", { name: "Relacje (10)" }).click();
    await expect(page.locator('[data-podglad="relacja-fb"]')).toBeVisible();
    await expect(page.getByText(copy.podglad.relacja.replace("{n}", "1").replace("{liczba}", "10"))).toBeVisible();
    await page.getByRole("button", { name: copy.podglad.nastepny }).first().click();
    await expect(page.getByText(copy.podglad.relacja.replace("{n}", "2").replace("{liczba}", "10"))).toBeVisible();

    await page.getByRole("tab", { name: "Kampanie (2)" }).click();
    const kampanie = page.locator("[data-kampania]");
    await expect(kampanie).toHaveCount(2);
    await expect(kampanie.nth(0)).toContainText("Kampania standardowa");
    await expect(kampanie.nth(1)).toContainText("Imprezy okolicznościowe");
    await expect(kampanie.nth(1)).toContainText(copy.podglad.cele.leady);
    await expect(page.locator('[data-podglad="reklama-fb-kanal-telefon"]')).toHaveCount(2);
    // jedna decyzja dla całego miesiąca: jeden przycisk akceptacji, nie po jednym na kampanię
    await expect(page.locator('[data-decyzja="akceptuj"]')).toHaveCount(1);
  } finally {
    await usunPakiet(p.id);
  }
});

test(`8. „Akceptuję wszystko" ustawia status, datę, osobę, approval_kind i zdarzenie w outbox; obie kampanie akceptowane razem (kryterium 16)`, async ({ page }) => {
  const p = await klon(1);
  try {
    await otworzPakiet(page, p.id);
    await page.locator('[data-decyzja="akceptuj"]').click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("6 postów, 10 relacji i 2 kampanie reklamowe");
    const potwierdz = dialog.getByRole("button", { name: copy.pakiet.modalAkceptacji.potwierdz });
    await expect(potwierdz).toBeDisabled();
    await dialog.getByRole("checkbox").check();
    await potwierdz.click();

    await expect(page.locator('[data-baner="zaakceptowano"]')).toBeVisible();
    await expect(page.locator("[data-decyzja]")).toHaveCount(0);
    await expect(page.locator("[data-formularz-komentarza]").first()).toBeVisible();

    const stan = await stanPakietu(p.id);
    expect(stan.status).toBe("zaakceptowany");
    expect(stan.approval_kind).toBe("reczna");
    expect(stan.approved_at).not.toBeNull();
    expect(stan.approved_by_contact_id).toBe(link.contactId);
    expect(await liczbaZdarzenOutbox("pakiet.zaakceptowany", p.id)).toBe(1);
  } finally {
    await usunPakiet(p.id);
  }
});

test(`9. „Zgłaszam uwagi" bez komentarza jest zablokowane z podpowiedzią`, async ({ page }) => {
  const p = await klon(2);
  try {
    await otworzPakiet(page, p.id);
    await expect(page.locator('[data-decyzja="uwagi"]')).toBeDisabled();
    await expect(page.locator("[data-podpowiedz-uwag]")).toHaveText(copy.przejscia.odmowa.brak_uwag);
  } finally {
    await usunPakiet(p.id);
  }
});

test(`10. komentarz odblokowuje „Zgłaszam uwagi", a zgłoszenie zatrzymuje licznik auto-akceptacji`, async ({ page }) => {
  const p = await klon(3);
  try {
    await otworzPakiet(page, p.id);
    await expect(page.locator("[data-odliczanie]").first()).toContainText(copy.pakiet.autoAkceptacja);
    const sekcja = page.locator('[data-material][data-typ="post"]').first();
    await sekcja.locator("textarea").fill("Proszę zmienić zdjęcie na jaśniejsze, to jest za ciemne.");
    await sekcja.getByRole("button", { name: copy.pakiet.komentarze.wyslij }).click();
    await expect(sekcja.locator("[data-komentarz]")).toHaveCount(1);
    await expect(sekcja.locator("[data-komentarz]")).toContainText("Proszę zmienić zdjęcie");
    await expect(page.locator('[data-decyzja="uwagi"]')).toBeEnabled();

    await page.locator('[data-decyzja="uwagi"]').click();
    await page.getByRole("dialog").getByRole("button", { name: copy.pakiet.modalUwag.potwierdz }).click();
    await expect(page.locator('[data-baner="poprawki"]')).toBeVisible();
    await expect(page.locator("[data-auto-linia]")).toHaveText(copy.pakiet.licznikZatrzymany);
    await expect(page.locator("[data-decyzja]")).toHaveCount(0);

    const stan = await stanPakietu(p.id);
    expect(stan.status).toBe("poprawki");
    expect(stan.auto_approve_at).toBeNull();
    expect(await liczbaZdarzenOutbox("pakiet.poprawki", p.id)).toBe(1);
    const komentarze = await komentarzePakietu(p.id);
    expect(komentarze).toHaveLength(1);
    expect(komentarze[0]?.author_kind).toBe("klient");
    expect(komentarze[0]?.seen_by_team_at).toBeNull();
  } finally {
    await usunPakiet(p.id);
  }
});

test(`12. „Wyślij v2" podbija rundę, restartuje licznik i pokazuje plakietkę „Poprawione" oraz historię uwag`, async ({ page, browser }) => {
  const p = await klon(4, { status: "poprawki", autoZaGodzin: null });
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const materialy = await materialyPakietu(p.id);
    const post1 = materialy.find((m) => m.type === "post" && m.position === 1);
    expect(post1).toBeTruthy();
    await dodajUwageKlienta(p.id, post1!.id, "Za ciemne zdjęcie, prosimy jaśniejsze.", 1);

    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KLIENT}/pakiety/${p.id}`);
    await expect(z.locator("[data-pasek-zespolu]")).toContainText(copy.zespol.pakietyMaterialow.nierozwiazane.replace("{n}", "1"));
    await z.locator('[data-akcja="wyslij_v2"]').click();
    await z.locator("[data-potwierdz-wysylke]").click();
    await expect(z.locator("[data-pasek-zespolu]")).toContainText("wersja 2");

    const przed = Date.now();
    const stan = await stanPakietu(p.id);
    expect(stan.status).toBe("do_akceptacji");
    expect(stan.round).toBe(2);
    expect(stan.first_opened_at).toBeNull();
    const termin = new Date(stan.auto_approve_at ?? 0).getTime() - przed;
    expect(termin).toBeGreaterThan(71 * 3_600_000);
    expect(termin).toBeLessThan(74 * 3_600_000);
    await oznaczPoprawiony(post1!.id, 2);

    await otworzPakiet(page, p.id);
    await expect(page.locator("[data-pasek-pakietu]")).toContainText(`${copy.pakiet.wersja} 2`);
    await expect(page.locator("[data-odliczanie]").first()).toContainText(/za [23] dni/);
    const sekcja = page.locator(`[data-material="${post1!.id}"]`);
    await expect(sekcja.locator('[data-plakietka="poprawione"]')).toHaveText(copy.pakiet.plakietki.poprawione);
    await expect(sekcja.getByText(copy.pakiet.komentarze.historia.replace("{n}", "1"))).toBeVisible();
    await expect(page.locator('[data-decyzja="uwagi"]')).toBeDisabled();
  } finally {
    await zespol.close();
    await usunPakiet(p.id);
  }
});

test("13. komentarz po akceptacji nie zmienia statusu, ale wysyła zdarzenie i jest oznaczony w panelu zespołu", async ({ page, browser }) => {
  const p = await klon(5, { status: "zaakceptowany", autoZaGodzin: null });
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    await otworzPakiet(page, p.id);
    await expect(page.locator('[data-baner="zaakceptowano"]')).toBeVisible();
    await expect(page.locator("[data-decyzja]")).toHaveCount(0);
    const sekcja = page.locator('[data-material][data-typ="post"]').first();
    await sekcja.locator("textarea").fill("Jednak w tym poście zmieńcie cenę na 39 zł.");
    await sekcja.getByRole("button", { name: copy.pakiet.komentarze.wyslij }).click();
    await expect(sekcja.locator("[data-komentarz]")).toContainText(copy.pakiet.plakietki.uwagaPoAkceptacji);

    const stan = await stanPakietu(p.id);
    expect(stan.status).toBe("zaakceptowany");
    const komentarze = await komentarzePakietu(p.id);
    expect(komentarze[0]?.after_approval).toBe(true);
    expect(await liczbaZdarzenOutbox("komentarz.po_akceptacji", p.id)).toBe(1);

    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KLIENT}/pakiety/${p.id}`);
    await expect(z.locator("[data-komentarz]").first()).toContainText(copy.pakiet.plakietki.uwagaPoAkceptacji);
    await expect(z.locator('[data-akcja="cofnij"]')).toBeVisible();
  } finally {
    await zespol.close();
    await usunPakiet(p.id);
  }
});
