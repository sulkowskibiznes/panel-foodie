import { expect, test, type Page } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import {
  aktywneSesje,
  nowyPinKlienta,
  przesunSesje,
  przygotujDrugaBlokade,
  sesjeLinku,
  stanPinuLinku,
  usunLinkTestowy,
  utworzLinkTestowy,
  wpisyAudytu,
  wyczyscLimity,
  zdarzeniaLinku,
  type LinkTestowy,
} from "./pomocnicze/baza";
import { probaPinu, wpiszNowyPin, zalogujKlienta, zalogujKodemStartowym } from "./pomocnicze/klient";
import { anulujOkno, PLIK_SESJI_ZESPOLU, potwierdzOkno } from "./pomocnicze/zespol";

/**
 * Etap 2 planu domknięcia: własny PIN klienta. Zespół wydaje jednorazowy kod startowy (6 cyfr, 7 dni), klient po nim
 * ustawia własny PIN (4-6 cyfr, polityka bez dat i ciągów) i może go zmienić. Serial: limit prób na IP jest wspólny.
 * PIN-y „klienta" pochodzą z generatora z ziarnem (zasada 5); literały tylko jako wartości, które mają zostać odrzucone.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

const KLIENT_A = "burger-brothers";
const KLIENT_B = "pierogarnia-babci";

const utworzone: string[] = [];
async function link(slug = KLIENT_A, opcje: Parameters<typeof utworzLinkTestowy>[1] = {}): Promise<LinkTestowy> {
  const l = await utworzLinkTestowy(slug, { label: `E2E PIN ${test.info().project.name} ${Date.now()}`, ...opcje });
  utworzone.push(l.id);
  return l;
}

test.beforeEach(async () => {
  await wyczyscLimity();
});

test.afterAll(async () => {
  for (const id of utworzone) await usunLinkTestowy(id);
});

function wierszLinku(page: Page, label: string) {
  return page.getByRole("table", { name: copy.zespol.dostep.tytul }).locator("tr", { hasText: label });
}

test("zespół tworzy link z kodem startowym, klient ustawia własny PIN, kod działa tylko raz", async ({ page, browser }) => {
  const label = `E2E kod ${test.info().project.name} ${Date.now()}`;
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  await zespol.grantPermissions(["clipboard-read", "clipboard-write"]);
  const z = await zespol.newPage();
  let adres = "";
  let kod = "";
  try {
    await z.goto(`/zespol/klienci/${KLIENT_A}/dostep`);
    await z.getByRole("button", { name: copy.zespol.dostep.utworz }).click();
    const dialog = z.getByRole("dialog");
    await dialog.locator("#kontakt").selectOption("inna");
    await dialog.locator("#label").fill(label);
    await dialog.getByRole("button", { name: copy.zespol.dostep.nowy.utworz }).click();
    await expect(dialog.getByRole("heading", { name: copy.zespol.dostep.gotowy.tytul })).toBeVisible();
    adres = await dialog.getByLabel(copy.zespol.dostep.gotowy.link).inputValue();
    kod = await dialog.getByLabel(copy.zespol.dostep.gotowy.pin).inputValue();
    expect(kod).toMatch(/^\d{6}$/);

    // zamknięcie bez skopiowania kodu pyta o potwierdzenie; po skopiowaniu już nie
    await dialog.getByRole("button", { name: copy.zespol.dostep.gotowy.zamknij }).click();
    await anulujOkno(z, copy.zespol.dostep.gotowy.zamknijBezKopiowania);
    await expect(dialog).toBeVisible();
    await dialog.locator("[data-kopiuj-kod]").click();
    await expect(dialog.locator("[data-kopiuj-kod]")).toHaveText(copy.zespol.dostep.gotowy.skopiowano);
    await dialog.getByRole("button", { name: copy.zespol.dostep.gotowy.zamknij }).click();
    await expect(dialog).toHaveCount(0);
    await expect(wierszLinku(z, label).locator('[data-stan-pinu="czeka"]')).toBeVisible();
  } finally {
    await zespol.close();
  }

  const token = new URL(adres).pathname.split("/").pop() ?? "";
  const linkId = await linkPoEtykiecie(label);
  utworzone.push(linkId);
  expect(await stanPinuLinku(linkId)).toMatchObject({ pin_temporary: true, pin_pepper: true, pin_version: 1 });

  // kod startowy nie daje sesji: tylko ekran ustawienia PIN-u
  await zalogujKodemStartowym(page, token, kod);
  expect(await aktywneSesje(linkId)).toBe(0);
  expect((await page.request.get(`/p/${token}/start`, { maxRedirects: 0 })).status()).toBe(307);

  // polityka PIN-u: słaby, różne powtórzenia, równy kodowi
  await wpiszNowyPin(page, "1234", "1234", copy.ustawPin.bledy.slaby);
  await wpiszNowyPin(page, "1985", "1985", copy.ustawPin.bledy.slaby);
  const pin = nowyPinKlienta();
  const inny = nowyPinKlienta();
  await wpiszNowyPin(page, pin, inny === pin ? `${pin}9` : inny, copy.ustawPin.bledy.rozne);
  await wpiszNowyPin(page, kod, kod, copy.ustawPin.bledy.jakKod);

  await wpiszNowyPin(page, pin);
  await expect(page.locator("[data-baner-pinu]")).toHaveText(copy.klientStart.pinUstawiony);
  expect(await aktywneSesje(linkId)).toBe(1);
  const stan = await stanPinuLinku(linkId);
  expect(stan).toMatchObject({ pin_temporary: false, pin_temporary_expires_at: null, pin_version: 2 });
  expect(stan?.pin_set_at).not.toBeNull();
  expect(await wpisyAudytu(linkId, "klient.pin_ustawiony")).toBe(1);
  expect(await zdarzeniaLinku(linkId, "klient.pin_ustawiony")).toBe(1);

  // kod startowy już nie działa, własny PIN tak (także na nowym urządzeniu)
  const drugie = await browser.newContext();
  const d = await drugie.newPage();
  await probaPinu(d, token, kod);
  await zalogujKlienta(d, token, pin);
  await drugie.close();

  // zespół widzi „PIN ustawiony przez klienta"
  const zespol2 = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  const z2 = await zespol2.newPage();
  await z2.goto(`/zespol/klienci/${KLIENT_A}/dostep`);
  await expect(wierszLinku(z2, label).locator('[data-stan-pinu="ustawiony"]')).toBeVisible();
  await zespol2.close();
});

async function linkPoEtykiecie(label: string): Promise<string> {
  const { default: postgres } = await import("postgres");
  const s = postgres(process.env.E2E_DB_URL!, { max: 1 });
  try {
    const [w] = await s<{ id: string }[]>`select id from public.access_links where label = ${label}`;
    if (!w) throw new Error(`Brak linku ${label}`);
    return w.id;
  } finally {
    await s.end();
  }
}

test("wygasły kod startowy: podpowiedź zamiast sesji; bez pozwolenia ekran ustawienia PIN-u wraca do logowania", async ({ page }) => {
  const wygasly = await link(KLIENT_A, { kodStartowy: true, kodWygasaZaGodzin: -1 });
  await page.goto(`/p/${wygasly.token}`);
  await page.getByLabel(copy.pin.etykieta).fill(wygasly.pin);
  await page.getByRole("button", { name: copy.pin.przycisk }).click();
  await expect(page.locator("#pin-blad")).toHaveText(copy.pin.kodWygasl);
  expect(new URL(page.url()).pathname).toBe(`/p/${wygasly.token}`);
  expect(await aktywneSesje(wygasly.id)).toBe(0);

  // wejście wprost na /ustaw-pin bez kodu: z powrotem do ekranu PIN
  await page.goto(`/p/${wygasly.token}/ustaw-pin`);
  await expect(page).toHaveURL(`/p/${wygasly.token}`);
});

test("pozwolenie linku A nie działa pod tokenem B, także podmienione w ciele akcji", async ({ page }) => {
  const a = await link(KLIENT_A, { kodStartowy: true });
  const b = await link(KLIENT_B, { kodStartowy: true });
  await zalogujKodemStartowym(page, a.token, a.pin);

  // pozwolenie jest związane z linkiem A: pod adresem B ekran ustawienia PIN-u się nie otwiera
  await page.goto(`/p/${b.token}/ustaw-pin`);
  await expect(page).toHaveURL(`/p/${b.token}`);

  // podmiana tokenu w ciele akcji (argumenty nie są szyfrowane): serwer bierze link z pozwolenia i odrzuca obcy token
  await page.goto(`/p/${a.token}/ustaw-pin`);
  await page.route(`**/p/${a.token}/ustaw-pin`, async (route) => {
    const req = route.request();
    const cialo = req.postData();
    if (req.method() === "POST" && req.headers()["next-action"] && cialo?.includes(a.token)) {
      await route.continue({ postData: cialo.split(a.token).join(b.token) });
      return;
    }
    await route.continue();
  });
  const pin = nowyPinKlienta();
  await page.getByLabel(copy.ustawPin.nowy).fill(pin);
  await page.getByLabel(copy.ustawPin.powtorz).fill(pin);
  await page.locator("[data-formularz-pinu] button[type=submit]").click();
  await expect(page).toHaveURL(`/p/${b.token}`);
  await page.unroute(`**/p/${a.token}/ustaw-pin`);
  expect(await stanPinuLinku(a.id)).toMatchObject({ pin_temporary: true, pin_version: 1 });
  expect(await stanPinuLinku(b.id)).toMatchObject({ pin_temporary: true, pin_version: 1 });
  expect(await aktywneSesje(b.id)).toBe(0);
});

test("Zmień PIN: zły obecny liczy się do blokad, trzeci błąd kończy sesję; zmiana wylogowuje inne urządzenia", async ({ page, browser }) => {
  const l = await link();
  await zalogujKlienta(page, l.token, l.pin);
  const drugie = await browser.newContext();
  const d = await drugie.newPage();
  await zalogujKlienta(d, l.token, l.pin);
  expect(await aktywneSesje(l.id)).toBe(2);

  const zlyObecny = l.pin === "0000" ? "0001" : "0000";
  const nowy = nowyPinKlienta();
  const zmien = async (obecny: string, pin: string) => {
    await page.goto(`/p/${l.token}/pin`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.zmianaPinu.tytul);
    await page.getByLabel(copy.zmianaPinu.obecny).fill(obecny);
    await page.getByLabel(copy.ustawPin.nowy).fill(pin);
    await page.getByLabel(copy.ustawPin.powtorz).fill(pin);
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]),
      page.locator("[data-formularz-pinu] button[type=submit]").click(),
    ]);
  };

  for (let i = 1; i <= 2; i++) {
    await zmien(zlyObecny, nowy);
    await expect(page.locator("#pin-blad")).toHaveText(copy.zmianaPinu.bledy.obecny);
    expect((await stanPinuLinku(l.id))?.failed_attempts).toBe(i);
  }
  await zmien(zlyObecny, nowy);
  await expect(page).toHaveURL(`/p/${l.token}`);
  expect(await aktywneSesje(l.id)).toBe(1);
  expect(await wpisyAudytu(l.id, "klient.zmiana_pinu_blad")).toBe(3);

  // ponowne logowanie i poprawna zmiana: to urządzenie zostaje zalogowane, drugie wylatuje, stary PIN przestaje działać
  await zalogujKlienta(page, l.token, l.pin);
  await zmien(l.pin, l.pin);
  await expect(page.locator("#pin-blad")).toBeVisible();
  await zmien(l.pin, nowy);
  await page.waitForURL(`**/p/${l.token}/start?pin=zmieniony`);
  await expect(page.locator("[data-baner-pinu]")).toHaveText(copy.klientStart.pinZmieniony);
  await page.goto(`/p/${l.token}/harmonogram`);
  await expect(page).toHaveURL(`/p/${l.token}/harmonogram`);
  await d.goto(`/p/${l.token}/start`);
  await expect(d).toHaveURL(`/p/${l.token}`);
  await probaPinu(d, l.token, l.pin);
  await zalogujKlienta(d, l.token, nowy);
  await drugie.close();
  expect(await wpisyAudytu(l.id, "klient.pin_zmieniony")).toBe(1);
  expect(await zdarzeniaLinku(l.id, "klient.pin_zmieniony")).toBe(1);
});

test("druga blokada 24 h w ciągu 30 dni zamraża link; nowy kod od zespołu go odmraża", async ({ page, browser }) => {
  const l = await link();
  await przygotujDrugaBlokade(l.id, 10);
  const zly = l.pin === "0000" ? "0001" : "0000";
  await probaPinu(page, l.token, zly);
  const stan = await stanPinuLinku(l.id);
  expect(stan?.failed_attempts).toBe(10);
  expect(stan?.frozen_at).not.toBeNull();
  await expect.poll(() => wpisyAudytu(l.id, "klient.link_zamrozony")).toBe(1);
  await expect.poll(() => zdarzeniaLinku(l.id, "bezpieczenstwo.link_zamrozony")).toBe(1);
  await expect.poll(() => zdarzeniaLinku(l.id, "bezpieczenstwo.blokada")).toBe(1);

  // kolejna zła próba nie wysyła drugiego alarmu; dobry PIN też nie wpuszcza
  await probaPinu(page, l.token, zly);
  await probaPinu(page, l.token, l.pin);
  expect(await wpisyAudytu(l.id, "klient.blokada_24h")).toBe(1);
  expect(await aktywneSesje(l.id)).toBe(0);

  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  const z = await zespol.newPage();
  try {
    await z.goto(`/zespol/klienci/${KLIENT_A}/dostep`);
    const wiersz = wierszLinku(z, l.label);
    await expect(wiersz.locator("[data-zamrozony]")).toBeVisible();
    await wiersz.getByRole("button", { name: copy.zespol.dostep.akcje.resetujPin }).click();
    await potwierdzOkno(z, copy.zespol.dostep.akcje.resetujPotwierdz);
    const dialog = z.getByRole("dialog");
    const kod = await dialog.getByLabel(copy.zespol.dostep.gotowy.pin).inputValue();
    expect(kod).toMatch(/^\d{6}$/);
    expect(await stanPinuLinku(l.id)).toMatchObject({ frozen_at: null, failed_attempts: 0, locked_until: null, pin_temporary: true });
    await zespol.close();
    await zalogujKodemStartowym(page, l.token, kod);
  } finally {
    await zespol.close().catch(() => undefined);
  }
});

test("bez „Zapamiętaj mnie”: cookie sesyjne także po rotacji i koniec po 12 godzinach; z zapamiętaniem 90 dni", async ({ page, context, browser }) => {
  const l = await link();
  await page.goto(`/p/${l.token}`);
  await page.getByLabel(copy.pin.etykieta).fill(l.pin);
  await page.getByLabel(copy.pin.zapamietaj).uncheck();
  await page.getByRole("button", { name: copy.pin.przycisk }).click();
  await page.waitForURL(`**/p/${l.token}/start`);
  const [sesja] = await sesjeLinku(l.id);
  expect(sesja?.remember).toBe(false);
  const doKonca = new Date(sesja!.expires_at).getTime() - Date.now();
  expect(doKonca).toBeGreaterThan(11 * 3_600_000);
  expect(doKonca).toBeLessThanOrEqual(12 * 3_600_000 + 60_000);
  expect((await context.cookies()).find((c) => c.name === "fm_sesja")?.expires).toBe(-1);

  // rotacja po 24 h (sesja utworzona 2 h temu) zostawia cookie sesyjne
  await przesunSesje(l.id, { utworzenieGodzin: 2, rotacjaGodzin: 25 });
  const przed = (await context.cookies()).find((c) => c.name === "fm_sesja")?.value;
  await page.goto(`/p/${l.token}/start`);
  await expect(page).toHaveURL(`/p/${l.token}/start`);
  const po = (await context.cookies()).find((c) => c.name === "fm_sesja");
  expect(po?.value).not.toBe(przed);
  expect(po?.expires).toBe(-1);

  // 12 h od zalogowania: koniec sesji niezależnie od aktywności
  await przesunSesje(l.id, { utworzenieGodzin: 11 });
  await page.goto(`/p/${l.token}/start`);
  await expect(page).toHaveURL(`/p/${l.token}`);

  // z zapamiętaniem: 90 dni i trwałe cookie
  const inne = await browser.newContext();
  const p2 = await inne.newPage();
  await zalogujKlienta(p2, l.token, l.pin);
  const zapamietana = (await sesjeLinku(l.id)).find((s) => s.remember && !s.revoked_at);
  const dni = (new Date(zapamietana!.expires_at).getTime() - Date.now()) / 86_400_000;
  expect(dni).toBeGreaterThan(89);
  expect(dni).toBeLessThanOrEqual(90.01);
  const ciastko = (await inne.cookies()).find((c) => c.name === "fm_sesja");
  expect(ciastko!.expires * 1000 - Date.now()).toBeGreaterThan(89 * 86_400_000);
  await inne.close();
});

test("podgląd zespołu nie ma „Zmień PIN” ani ekranu ustawienia PIN-u (404)", async ({ browser }) => {
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  const z = await zespol.newPage();
  try {
    await z.goto(`/zespol/klienci/${KLIENT_A}`);
    await z.locator("[data-zobacz-jak-klient]").click();
    await z.waitForURL(/\/p\/podglad\.[^/]+\/start$/);
    const token = new URL(z.url()).pathname.split("/")[2] ?? "";
    await expect(z.locator("[data-zmien-pin]")).toHaveCount(0);
    expect((await z.goto(`/p/${token}/pin`))?.status()).toBe(404);
    expect((await z.goto(`/p/${token}/ustaw-pin`))?.status()).toBe(404);
  } finally {
    await zespol.close();
  }
});
