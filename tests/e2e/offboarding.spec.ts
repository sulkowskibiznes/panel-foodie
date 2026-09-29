import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { usunCzlonkaTestowego, utworzCzlonkaTestowego, utworzLinkTestowy, wyczyscLimity } from "./pomocnicze/baza";
import { probaPinu, zalogujKlienta } from "./pomocnicze/klient";
import { bearerCrona } from "./pomocnicze/faza5";
import { klientIstnieje, stanKlienta, usunKlientaTestowego, ustawStatusKlienta, ustawTerminAutoAkceptacji, utworzKlientaTestowego, utworzPakietKlienta } from "./pomocnicze/klienci";
import { odsunTerminySeedu, stanPakietu } from "./pomocnicze/pakiety";
import { czyObiektIstnieje, wgrajObiektTestowy, wpisyAudytuPoEncji } from "./pomocnicze/retencja";
import { PLIK_SESJI_ZESPOLU, zalogujZespol } from "./pomocnicze/zespol";

/**
 * Faza 6, SPEC rozdz. 17: offboarding. „Zakończ współpracę" (admin i csm) wygasza linki, wylogowuje urządzenia
 * i ustawia status zakonczony; klient znika z pulpitu, ale karta działa i da się wznowić. „Usuń dane klienta" (tylko admin,
 * tylko po zakończeniu, po przepisaniu nazwy) kasuje wiersz klienta z kaskadą i pliki ze wszystkich bucketów.
 * Klient jednorazowy per projekt Playwrighta, opiekunem jest Gosia (sesja zespołu z projektu przygotowawczego).
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

test("zakończenie współpracy wylogowuje klienta i wygasza linki; wznowienie i usunięcie danych działają wg ról", async ({ page, browser }) => {
  await wyczyscLimity();
  const projekt = test.info().project.name;
  const slug = `e2e-offboarding-${projekt}`;
  const nazwa = `Offboarding ${projekt === "mobile-390" ? "Mobile" : "Desktop"} E2E`;
  const klient = await utworzKlientaTestowego(slug, nazwa);
  const obiekty = [
    ["materialy", `${klient.id}/e2e-test/thumb.png`],
    ["awatary", `${klient.id}/lokal.png`],
    ["faktury", `${klient.id}/faktura.pdf`],
    ["dokumenty", `${klient.id}/umowa.pdf`],
  ] as const;
  const admin = await utworzCzlonkaTestowego(`e2e-admin-offboarding-${projekt}-${process.env.E2E_SEED ?? "0"}@foodiemedia.pl`, "admin");
  try {
    for (const [bucket, sciezka] of obiekty) await wgrajObiektTestowy(bucket, sciezka);
    const link = await utworzLinkTestowy(slug, { label: `E2E offboarding ${projekt}` });
    await zalogujKlienta(page, link.token, link.pin);
    expect(await stanKlienta(klient.id)).toMatchObject({ status: "aktywny", aktywne_linki: 1, aktywne_sesje: 1 });

    // csm (Gosia): widzi zakładkę Ustawienia, kończy współpracę, ale sekcja usuwania jest tylko dla admina
    const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${slug}`);
    await z.getByRole("link", { name: copy.zespol.karta.zakladki.ustawienia }).click();
    await expect(z.locator("[data-wspolpraca=aktywny]")).toBeVisible();
    await expect(z.locator("[data-aktywne-linki]")).toHaveAttribute("data-aktywne-linki", "1");
    await expect(z.locator("[data-usuwanie-tylko-admin]")).toBeVisible();
    await expect(z.locator("[data-formularz-usuniecia]")).toHaveCount(0);
    z.once("dialog", (d) => {
      expect(d.message()).toContain(nazwa);
      void d.accept();
    });
    await z.locator("[data-zakoncz-wspolprace]").click();
    await expect(z.locator("[data-wspolpraca=zakonczony]")).toBeVisible();
    await expect(z.locator("[data-zakonczono]")).toBeVisible();
    await expect(z.locator("[data-status-klienta=zakonczony]")).toBeVisible();
    const poZakonczeniu = await stanKlienta(klient.id);
    expect(poZakonczeniu).toMatchObject({ status: "zakonczony", aktywne_linki: 0, aktywne_sesje: 0 });
    expect(poZakonczeniu?.ended_at).not.toBeNull();
    expect(await wpisyAudytuPoEncji(klient.id, "zespol.klient_zakonczony")).toBe(1);

    // klient: następne żądanie kończy się na ekranie PIN, a PIN już nie działa (link wygaszony)
    await page.goto(`/p/${link.token}/start`);
    await expect(page).toHaveURL(`/p/${link.token}`);
    await probaPinu(page, link.token, link.pin);

    // pulpit: klient poza główną listą, na liście zakończonych; Dostęp bez „Utwórz link"
    await z.goto("/zespol");
    await expect(z.getByRole("cell", { name: nazwa, exact: true })).toHaveCount(0);
    await expect(z.locator(`[data-klient-nieaktywny="${slug}"]`)).toContainText(copy.zespol.karta.statusKlienta.zakonczony);
    await z.goto(`/zespol/klienci/${slug}/dostep`);
    await expect(z.locator("[data-dostep-zakonczony]")).toBeVisible();
    await expect(z.getByRole("button", { name: copy.zespol.dostep.utworz })).toHaveCount(0);

    // wznowienie przywraca klienta na pulpit; potem kończymy jeszcze raz, żeby sprawdzić usuwanie
    await z.goto(`/zespol/klienci/${slug}/ustawienia`);
    await z.locator("[data-wznow-wspolprace]").click();
    await expect(z.locator("[data-wspolpraca=aktywny]")).toBeVisible();
    expect((await stanKlienta(klient.id))?.status).toBe("aktywny");
    expect(await wpisyAudytuPoEncji(klient.id, "zespol.klient_wznowiony")).toBe(1);
    await z.goto("/zespol");
    await expect(z.getByRole("cell", { name: nazwa, exact: true })).toBeVisible();
    await z.goto(`/zespol/klienci/${slug}/ustawienia`);
    z.once("dialog", (d) => void d.accept());
    await z.locator("[data-zakoncz-wspolprace]").click();
    await expect(z.locator("[data-wspolpraca=zakonczony]")).toBeVisible();
    await zespol.close();

    // admin: przycisk odblokowany dopiero po przepisaniu nazwy; usunięcie kasuje wiersz i pliki, zostaje audyt
    await zalogujZespol(page, admin.email);
    await page.goto(`/zespol/klienci/${slug}/ustawienia`);
    const formularz = page.locator("[data-formularz-usuniecia]");
    await expect(formularz).toBeVisible();
    const przycisk = formularz.locator("[data-usun-dane-klienta]");
    await expect(przycisk).toBeDisabled();
    await formularz.locator("#potwierdzenie-nazwy").fill(`${nazwa} X`);
    await expect(przycisk).toBeDisabled();
    await formularz.locator("#potwierdzenie-nazwy").fill(nazwa);
    await expect(przycisk).toBeEnabled();
    await przycisk.click();
    await expect(page).toHaveURL(/\/zespol\?usunieto=/);
    await expect(page.locator("[data-usunieto-klienta]")).toContainText(nazwa);
    expect(await klientIstnieje(klient.id)).toBe(false);
    for (const [bucket, sciezka] of obiekty) expect(await czyObiektIstnieje(bucket, sciezka), `${bucket}/${sciezka}`).toBe(false);
    expect(await wpisyAudytuPoEncji(klient.id, "zespol.klient_usuniety")).toBe(1);
    expect((await page.goto(`/zespol/klienci/${slug}`))?.status()).toBe(404);
  } finally {
    await usunKlientaTestowego(slug);
    await usunCzlonkaTestowego(admin);
  }
});

test("klient nieaktywny: cron go nie akceptuje, pulpit i skrzynka go pomijają, zakończenie wycofuje pakiet w toku, a wysyłka jest odmówiona", async ({ browser, request }) => {
  const projekt = test.info().project.name;
  const slug = `e2e-offb-pakiet-${projekt}`;
  const nazwa = `Pakiet w toku ${projekt === "mobile-390" ? "Mobile" : "Desktop"} E2E`;
  const znacznik = `uwaga-offboarding-${projekt}-${Date.now()}`;
  const klient = await utworzKlientaTestowego(slug, nazwa);
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const wToku = await utworzPakietKlienta(klient.id, { status: "do_akceptacji", autoZaGodzin: 48 });
    const szkic = await utworzPakietKlienta(klient.id, { status: "szkic", uwagaKlienta: znacznik });
    const z = await zespol.newPage();

    // kontrola: klient aktywny jest na pulpicie i w skrzynce
    await z.goto("/zespol");
    await expect(z.locator(`[data-pakiet-wiersz="${wToku.id}"]`)).toBeVisible();
    await z.goto("/zespol/uwagi");
    await expect(z.getByText(znacznik)).toBeVisible();

    // klient wstrzymany (stan z bazy): znika z pulpitu i skrzynki, a cron nie akceptuje przeterminowanego pakietu
    await ustawStatusKlienta(klient.id, "wstrzymany");
    await ustawTerminAutoAkceptacji(wToku.id, -1);
    await odsunTerminySeedu([wToku.id]);
    await z.goto("/zespol");
    await expect(z.getByRole("heading", { level: 1, name: copy.zespol.pulpit.tytul })).toBeVisible();
    await expect(z.locator(`[data-pakiet-wiersz="${wToku.id}"]`)).toHaveCount(0);
    await z.goto("/zespol/uwagi");
    await expect(z.getByText(znacznik)).toHaveCount(0);
    const cron = await request.get("/api/cron/auto-akceptacja", { headers: { authorization: bearerCrona() } });
    expect(cron.status()).toBe(200);
    expect((await stanPakietu(wToku.id)).status).toBe("do_akceptacji");

    // „Zakończ współpracę" wycofuje pakiet w toku do szkicu przez maszynę stanów
    await z.goto(`/zespol/klienci/${slug}/ustawienia`);
    z.once("dialog", (d) => void d.accept());
    await z.locator("[data-zakoncz-wspolprace]").click();
    await expect(z.locator("[data-wspolpraca=zakonczony]")).toBeVisible();
    const poZakonczeniu = await stanPakietu(wToku.id);
    expect(poZakonczeniu.status).toBe("szkic");
    expect(poZakonczeniu.auto_approve_at).toBeNull();
    expect(await wpisyAudytuPoEncji(wToku.id, "zespol.pakiet_wycofany")).toBe(1);

    // wysyłka pakietu zakończonego klienta: odmowa z podpowiedzią, pakiet zostaje w szkicu
    await z.goto(`/zespol/klienci/${slug}/pakiety/${szkic.id}`);
    await z.locator('[data-akcja="wyslij"]').click();
    await z.locator("[data-potwierdz-wysylke]").click();
    await expect(z.getByRole("dialog").getByText(copy.przejscia.odmowa.klient_nieaktywny)).toBeVisible();
    expect((await stanPakietu(szkic.id)).status).toBe("szkic");
  } finally {
    await zespol.close();
    await usunKlientaTestowego(slug);
  }
});
