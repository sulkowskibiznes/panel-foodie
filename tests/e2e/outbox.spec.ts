import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { usunCzlonkaTestowego, utworzCzlonkaTestowego, wyczyscLimity } from "./pomocnicze/baza";
import { bearerCrona, odsunKolejkeSeedu, stanOutbox, usunOutboxTestowe, ustawOutbox, wstawOutbox } from "./pomocnicze/faza5";
import { zalogujZespol } from "./pomocnicze/zespol";

/**
 * Faza 5, outbox do Zapiera (SPEC rozdz. 15): cron co minutę, jeden generyczny webhook, 5 prób z narastającym
 * odstępem, po piątej `failed`, „Ponów" w Ustawieniach -> Powiadomienia (admin). Atrapa Zapiera to serwer HTTP
 * na porcie z ZAPIER_WEBHOOK_URL (playwright.config.ts). Jeden projekt: port i kolejka są wspólne.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "wspólny port atrapy i globalna kolejka: jeden projekt");
});

const CRON = "/api/cron/outbox";
const ADRES = new URL(process.env.ZAPIER_WEBHOOK_URL ?? "http://127.0.0.1:3190/zapier");

function znacznik(): string {
  return `e2e-outbox-${process.env.E2E_SEED ?? "0"}`;
}

type Odebrane = { sciezka: string; cialo: Record<string, unknown> };

function atrapaZapiera(): Promise<{ serwer: Server; odebrane: Odebrane[]; zamknij: () => Promise<void> }> {
  const odebrane: Odebrane[] = [];
  const serwer = createServer((req, res) => {
    let dane = "";
    req.on("data", (kawalek) => (dane += kawalek));
    req.on("end", () => {
      odebrane.push({ sciezka: req.url ?? "", cialo: JSON.parse(dane || "{}") as Record<string, unknown> });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "success" }));
    });
  });
  return new Promise((resolve, reject) => {
    serwer.once("error", reject);
    serwer.listen(Number(ADRES.port), ADRES.hostname, () => resolve({ serwer, odebrane, zamknij: () => new Promise((r) => serwer.close(() => r())) }));
  });
}

test.afterAll(async () => {
  await usunOutboxTestowe(znacznik());
});

test("cron wysyła zdarzenie do Zapiera z ciałem z rozdz. 15, nieudane próby dostają narastający odstęp, piąta = failed, „Ponów\" wraca do kolejki", async ({ request, page }) => {
  expect((await request.get(CRON)).status()).toBe(401);
  const naglowki = { authorization: bearerCrona() };
  const payload = { event: "pakiet.otwarty", client_slug: "nova-sushi", client_name: "Nova Sushi", slack_channel: "#nova-sushi", period: "2026-09", period_from: "2026-09-20", period_to: "2026-10-19", actor: "Marek (właściciel)", url: "https://panel.foodiemedia.pl/zespol/klienci/nova-sushi", summary: "Test E2E", e2e: znacznik() };

  // 1. atrapa działa: wysłane za pierwszym razem
  const atrapa = await atrapaZapiera();
  let idWyslane: number;
  try {
    idWyslane = await wstawOutbox("pakiet.otwarty", payload);
    await odsunKolejkeSeedu([idWyslane]);
    const odp = await request.get(CRON, { headers: naglowki });
    expect(odp.status()).toBe(200);
    const wynik = (await odp.json()) as { brakAdresu: boolean; wyslane: number[] };
    expect(wynik.brakAdresu).toBe(false);
    expect(wynik.wyslane).toContain(idWyslane);
    const stan = await stanOutbox(idWyslane);
    expect(stan).toMatchObject({ status: "sent", attempts: 1, last_error: null });
    expect(stan?.sent_at).not.toBeNull();
    expect(atrapa.odebrane).toHaveLength(1);
    expect(atrapa.odebrane[0]?.sciezka).toBe(ADRES.pathname);
    expect(atrapa.odebrane[0]?.cialo).toMatchObject({ event: "pakiet.otwarty", client_slug: "nova-sushi", slack_channel: "#nova-sushi", period: "2026-09", period_from: "2026-09-20", period_to: "2026-10-19", summary: "Test E2E" });
  } finally {
    await atrapa.zamknij();
  }

  // 2. atrapa nie odpowiada: próba 1 nieudana, następna za minutę, drugi przebieg od razu jej nie rusza
  const idNieudane = await wstawOutbox("pakiet.otwarty", { ...payload, summary: "Test E2E nieudane" });
  await odsunKolejkeSeedu([idNieudane]);
  const przed = Date.now();
  const drugi = (await (await request.get(CRON, { headers: naglowki })).json()) as { ponowione: number[] };
  expect(drugi.ponowione).toContain(idNieudane);
  const poPierwszej = await stanOutbox(idNieudane);
  expect(poPierwszej).toMatchObject({ status: "pending", attempts: 1 });
  expect(poPierwszej?.last_error).toBeTruthy();
  expect(new Date(poPierwszej!.next_attempt_at).getTime()).toBeGreaterThanOrEqual(przed + 55_000);
  const trzeci = (await (await request.get(CRON, { headers: naglowki })).json()) as { sprawdzone: number; ponowione: number[]; wyslane: number[] };
  expect(trzeci.ponowione).not.toContain(idNieudane);
  expect((await stanOutbox(idNieudane))?.attempts).toBe(1);

  // 3. po czterech nieudanych piąta próba kończy się statusem failed
  await ustawOutbox(idNieudane, { attempts: 4, nextAttemptAt: new Date(Date.now() - 1000) });
  const czwarty = (await (await request.get(CRON, { headers: naglowki })).json()) as { porzucone: number[] };
  expect(czwarty.porzucone).toContain(idNieudane);
  expect(await stanOutbox(idNieudane)).toMatchObject({ status: "failed", attempts: 5 });

  // 4. admin widzi kolejkę i klika „Ponów"; z atrapą z powrotem zdarzenie dochodzi
  await wyczyscLimity();
  const admin = await utworzCzlonkaTestowego(`e2e-admin-outbox-${process.env.E2E_SEED ?? "0"}@foodiemedia.pl`, "admin");
  try {
    await zalogujZespol(page, admin.email);
    await page.locator("[data-link-ustawien]").click();
    // Ustawienia → Ogólne: tylko odczyt, bez wartości sekretów (plan 3a)
    await page.locator("[data-link-ogolne]").click();
    await expect(page.locator("[data-ustawienia-ogolne]")).toBeVisible();
    await expect(page.locator('[data-ustawienie="zapier"]')).toContainText(copy.zespol.ustawienia.ogolne.skonfigurowane);
    await expect(page.locator('[data-ustawienie="pieprz"]')).toContainText(copy.zespol.ustawienia.ogolne.skonfigurowane);
    await expect(page.locator("[data-link-ogolne]")).toHaveAttribute("aria-current", "page");
    await page.locator("[data-link-powiadomien]").click();
    await expect(page).toHaveURL(/\/zespol\/ustawienia\/powiadomienia$/);
    await expect(page.locator("[data-adres-zapiera]")).toHaveAttribute("data-adres-zapiera", "tak");
    const wiersz = page.locator(`[data-powiadomienie="${idNieudane}"]`);
    await expect(wiersz).toHaveAttribute("data-status", "failed");
    await expect(wiersz).toContainText(copy.zespol.powiadomienia.status.failed);
    await wiersz.locator("[data-ponow]").click();
    await expect(wiersz).toHaveAttribute("data-status", "pending");
    expect(await stanOutbox(idNieudane)).toMatchObject({ status: "pending", attempts: 0 });

    const atrapa2 = await atrapaZapiera();
    try {
      const piaty = (await (await request.get(CRON, { headers: naglowki })).json()) as { wyslane: number[] };
      expect(piaty.wyslane).toContain(idNieudane);
      expect((await stanOutbox(idNieudane))?.status).toBe("sent");
      expect(atrapa2.odebrane.map((o) => o.cialo.summary)).toContain("Test E2E nieudane");
    } finally {
      await atrapa2.zamknij();
    }
    await page.reload();
    await expect(page.locator(`[data-powiadomienie="${idNieudane}"]`)).toHaveAttribute("data-status", "sent");
  } finally {
    await usunCzlonkaTestowego(admin);
  }
});
