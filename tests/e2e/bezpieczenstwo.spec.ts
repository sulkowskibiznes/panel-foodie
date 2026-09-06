import { expect, test, type Page } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { dyrektywa } from "../../src/lib/csp";
import { pakietKlienta, usunLinkTestowy, utworzLinkTestowy, wyczyscLimity, type LinkTestowy } from "./pomocnicze/baza";
import { zalogujKlienta } from "./pomocnicze/klient";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/**
 * Faza 6, SPEC rozdz. 16.6: nagłówki bezpieczeństwa na każdej stronie, CSP bez `unsafe-inline` dla skryptów,
 * a co ważniejsze: strony NAPRAWDĘ działają pod tą polityką (zero naruszeń w konsoli na ekranach klienta i zespołu,
 * każdy skrypt w HTML z serwera ma nonce). Na końcu dowód, że przeglądarka politykę egzekwuje: wstrzyknięty
 * skrypt bez nonce zostaje odrzucony.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const KLIENT = "burger-brothers";
let link: LinkTestowy;

test.beforeAll(async () => {
  await wyczyscLimity();
  link = await utworzLinkTestowy(KLIENT, { label: `E2E csp ${Date.now()}` });
});

test.afterAll(async () => {
  if (link) await usunLinkTestowy(link.id);
});

function zbierajNaruszenia(page: Page): string[] {
  const naruszenia: string[] = [];
  page.on("console", (m) => {
    const tekst = m.text();
    if (/Content Security Policy|Refused to/i.test(tekst)) naruszenia.push(`${new URL(page.url()).pathname}: ${tekst.slice(0, 300)}`);
  });
  return naruszenia;
}

/** Skrypty w HTML prosto z serwera: każdy musi nieść nonce (Next dokleja go, gdy widzi CSP w żądaniu). */
async function skryptyBezNonce(page: Page, sciezka: string): Promise<string[]> {
  const odp = await page.request.get(sciezka);
  expect(odp.status(), sciezka).toBe(200);
  const html = await odp.text();
  const skrypty = html.match(/<script\b[^>]*>/g) ?? [];
  expect(skrypty.length, `${sciezka}: brak skryptów w HTML`).toBeGreaterThan(0);
  return skrypty.filter((s) => !/\snonce="[^"]+"/.test(s));
}

test("nagłówki bezpieczeństwa i CSP z nonce na stronach publicznych, klienta i zespołu", async ({ page }) => {
  for (const sciezka of ["/", "/regulamin", "/zespol/logowanie", `/p/${link.token}`]) {
    const odp = await page.goto(sciezka);
    expect(odp?.status(), sciezka).toBe(200);
    const h = odp!.headers();
    expect(h["strict-transport-security"], sciezka).toContain("max-age=63072000");
    expect(h["x-content-type-options"], sciezka).toBe("nosniff");
    expect(h["referrer-policy"], sciezka).toBe("strict-origin-when-cross-origin");
    expect(h["x-frame-options"], sciezka).toBe("DENY");
    const csp = h["content-security-policy"];
    expect(csp, `${sciezka}: brak Content-Security-Policy`).toBeTruthy();
    expect(dyrektywa(csp!, "frame-ancestors")).toBe("'none'");
    expect(dyrektywa(csp!, "object-src")).toBe("'none'");
    const scriptSrc = dyrektywa(csp!, "script-src") ?? "";
    expect(scriptSrc, sciezka).toMatch(/'nonce-[A-Za-z0-9+/=]{16,}'/);
    expect(scriptSrc, sciezka).toContain("'strict-dynamic'");
    expect(scriptSrc, sciezka).not.toContain("unsafe-inline");
  }
  // nonce jest inny przy każdym żądaniu
  const a = (await page.request.get("/")).headers()["content-security-policy"];
  const b = (await page.request.get("/")).headers()["content-security-policy"];
  expect(a).not.toBe(b);
});

test("każdy skrypt w HTML z serwera ma nonce (strony publiczne, klient, zespół)", async ({ browser, page }) => {
  await zalogujKlienta(page, link.token, link.pin);
  const pakiet = await pakietKlienta(KLIENT);
  for (const sciezka of ["/", "/regulamin", `/p/${link.token}/start`, `/p/${link.token}/materialy/${pakiet}`, `/p/${link.token}/faktury`]) {
    expect(await skryptyBezNonce(page, sciezka), sciezka).toEqual([]);
  }
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  const z = await zespol.newPage();
  for (const sciezka of ["/zespol", `/zespol/klienci/${KLIENT}/materialy`, `/zespol/klienci/${KLIENT}/dostep`, "/zespol/uwagi"]) {
    expect(await skryptyBezNonce(z, sciezka), sciezka).toEqual([]);
  }
  await zespol.close();
});

test("ekrany klienta działają bez naruszeń CSP: PIN, start, pakiet z podglądami, harmonogram, faktury", async ({ page }) => {
  const naruszenia = zbierajNaruszenia(page);
  await zalogujKlienta(page, link.token, link.pin);
  const pakiet = await pakietKlienta(KLIENT);
  await page.goto(`/p/${link.token}/materialy/${pakiet}`);
  await expect(page.locator("[data-formularz-komentarza]").first()).toBeVisible();
  // podglądy ładują obrazy przez 302 na signed URL Supabase (img-src musi obejmować Storage)
  const obrazy = page.locator("img[src*='/plik/']");
  await expect(obrazy.first()).toBeVisible();
  await expect
    .poll(() => obrazy.first().evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0), { message: "obraz podglądu nie załadował się przez signed URL", timeout: 20_000 })
    .toBe(true);
  for (const sciezka of ["harmonogram", "faktury", "raporty", "pakiet", "uslugi"]) {
    await page.goto(`/p/${link.token}/${sciezka}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  expect(naruszenia).toEqual([]);
});

test("ekrany zespołu działają bez naruszeń CSP: logowanie, pulpit, karta klienta, pakiet, dostęp, skrzynka", async ({ browser, page }) => {
  const naruszeniaLogowania = zbierajNaruszenia(page);
  await page.goto("/zespol/logowanie");
  await expect(page.getByLabel(copy.zespol.logowanie.email)).toBeVisible();
  expect(naruszeniaLogowania).toEqual([]);

  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  const z = await zespol.newPage();
  const naruszenia = zbierajNaruszenia(z);
  const pakiet = await pakietKlienta(KLIENT);
  for (const sciezka of ["/zespol", `/zespol/klienci/${KLIENT}`, `/zespol/klienci/${KLIENT}/materialy`, `/zespol/klienci/${KLIENT}/pakiety/${pakiet}`, `/zespol/klienci/${KLIENT}/harmonogram`, `/zespol/klienci/${KLIENT}/dostep`, `/zespol/klienci/${KLIENT}/faktury`, "/zespol/uwagi"]) {
    const odp = await z.goto(sciezka);
    expect(odp?.status(), sciezka).toBe(200);
    await expect(z.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await z.waitForLoadState("networkidle");
  }
  expect(naruszenia).toEqual([]);
  await zespol.close();
});

test("przeglądarka egzekwuje politykę: skrypt bez nonce dopisany do HTML jest odrzucany", async ({ page }) => {
  const naruszenia = zbierajNaruszenia(page);
  // Skrypt wstrzykiwany do HTML z serwera (parser), bez nonce: pod `strict-dynamic` musi zostać zablokowany.
  await page.route("**/regulamin", async (route) => {
    const odp = await route.fetch();
    const html = (await odp.text()).replace("</body>", "<script>window.__csp_test = 'wykonany';</script></body>");
    await route.fulfill({ response: odp, body: html, headers: odp.headers() });
  });
  await page.goto("/regulamin");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __csp_test?: string }).__csp_test)).toBeUndefined();
  await expect.poll(() => naruszenia.length).toBeGreaterThan(0);
  expect(naruszenia[0]).toMatch(/script-src|Content Security Policy/);
});
