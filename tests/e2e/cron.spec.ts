import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { wyliczAutoAkceptacje } from "../../src/lib/pakiety/auto-akceptacja";
import { dodajUwageKlienta, liczbaZdarzenOutbox, liczbaZdarzenPakietu, materialyPakietu, odsunTerminySeedu, okresDlaProjektu, ostatnieZdarzenie, sklonujPakiet, stanPakietu, usunPakiet, ustawUstawienie } from "./pomocnicze/pakiety";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/**
 * Kryterium 11 z SPEC rozdz. 18: cron auto-akceptacji. Tylko jeden projekt Playwrighta: dwa równoległe
 * przebiegi crona dzielą się pakietami (konflikt statusu), a ustawienie dni roboczych jest globalne.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "cron i ustawienia globalne: jeden projekt");
});

const KLIENT = "pierogarnia-babci";
const TRASA = "/api/cron/auto-akceptacja";

function bearer(): string {
  const sekret = process.env.CRON_SECRET;
  if (!sekret) throw new Error("Brak CRON_SECRET w .env.local");
  return `Bearer ${sekret}`;
}

test("11. cron akceptuje po terminie, pomija wyłączone i poprawki, wstrzymuje przy nierozwiązanych uwagach (osobny stan na pulpicie)", async ({ request, browser }) => {
  const projekt = test.info().project.name;
  const [poTerminie, wylaczony, wPoprawkach, zUwagami] = await Promise.all([
    sklonujPakiet(KLIENT, { ...okresDlaProjektu(projekt, "cron", 0), autoZaGodzin: -1 }),
    sklonujPakiet(KLIENT, { ...okresDlaProjektu(projekt, "cron", 1), autoZaGodzin: -1, autoWlaczona: false }),
    sklonujPakiet(KLIENT, { ...okresDlaProjektu(projekt, "cron", 2), status: "poprawki", autoZaGodzin: -1 }),
    sklonujPakiet(KLIENT, { ...okresDlaProjektu(projekt, "cron", 3), autoZaGodzin: -1 }),
  ]);
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const post = (await materialyPakietu(zUwagami.id)).find((m) => m.type === "post");
    await dodajUwageKlienta(zUwagami.id, post!.id, "Nie zgadzam się z ceną w tym poście.", 1);
    await odsunTerminySeedu([poTerminie.id, wylaczony.id, wPoprawkach.id, zUwagami.id]);

    expect((await request.get(TRASA)).status()).toBe(401);
    expect((await request.get(TRASA, { headers: { authorization: "Bearer zly" } })).status()).toBe(401);
    const odp = await request.get(TRASA, { headers: { authorization: bearer() } });
    expect(odp.status()).toBe(200);
    const wynik = (await odp.json()) as { zaakceptowane: string[]; wstrzymane: string[] };
    expect(wynik.zaakceptowane).toContain(poTerminie.id);
    expect(wynik.wstrzymane).toContain(zUwagami.id);

    const a = await stanPakietu(poTerminie.id);
    expect(a.status).toBe("zaakceptowany");
    expect(a.approval_kind).toBe("automatyczna");
    expect(a.approved_by_contact_id).toBeNull();
    expect(await liczbaZdarzenOutbox("pakiet.zaakceptowany_auto", poTerminie.id)).toBe(1);
    expect(await liczbaZdarzenPakietu(poTerminie.id, "auto_zaakceptowany")).toBe(1);

    expect((await stanPakietu(wylaczony.id)).status).toBe("do_akceptacji");
    expect((await stanPakietu(wPoprawkach.id)).status).toBe("poprawki");

    const d = await stanPakietu(zUwagami.id);
    expect(d.status).toBe("do_akceptacji");
    expect(await liczbaZdarzenPakietu(zUwagami.id, "auto_wstrzymana")).toBe(1);
    expect(await liczbaZdarzenOutbox("pakiet.auto_wstrzymana_uwagi", zUwagami.id)).toBe(1);

    // drugi przebieg: bez duplikatów
    expect((await request.get(TRASA, { headers: { authorization: bearer() } })).status()).toBe(200);
    expect(await liczbaZdarzenPakietu(zUwagami.id, "auto_wstrzymana")).toBe(1);
    expect(await liczbaZdarzenOutbox("pakiet.auto_wstrzymana_uwagi", zUwagami.id)).toBe(1);
    expect(await liczbaZdarzenOutbox("pakiet.zaakceptowany_auto", poTerminie.id)).toBe(1);

    // pulpit zespołu: osobny, wyróżniony wiersz z liczbą nieprzeczytanych uwag i akcją (SPEC 1.4, poz. 26)
    const z = await zespol.newPage();
    await z.goto("/zespol");
    const wiersz = z.locator(`[data-pakiet-wiersz="${zUwagami.id}"]`);
    await expect(wiersz).toHaveAttribute("data-wstrzymana", "true");
    await expect(wiersz).toContainText(copy.zespol.pulpitPakiety.wstrzymana);
    await expect(wiersz).toContainText(copy.zespol.pulpitPakiety.nieprzeczytane.replace("{n}", "1"));
    await expect(wiersz.getByRole("link", { name: copy.zespol.pulpitPakiety.odpowiedz })).toBeVisible();
    await expect(z.locator(`[data-pakiet-wiersz="${poTerminie.id}"]`)).toContainText(copy.materialy.status.zaakceptowany);
  } finally {
    await zespol.close();
    await Promise.all([poTerminie, wylaczony, wPoprawkach, zUwagami].map((p) => usunPakiet(p.id)));
  }
});

test("11. przełączenie auto_approve_business_days na true liczy termin w dniach roboczych pon-sob", async ({ browser }) => {
  const p = await sklonujPakiet(KLIENT, { ...okresDlaProjektu(test.info().project.name, "cron", 4), status: "szkic" });
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    await ustawUstawienie("auto_approve_business_days", true);
    const z = await zespol.newPage();
    await z.goto(`/zespol/klienci/${KLIENT}/pakiety/${p.id}`);
    await z.locator('[data-akcja="wyslij"]').click();
    await z.locator("[data-potwierdz-wysylke]").click();
    await expect(z.locator("[data-pasek-zespolu]")).toContainText(copy.zespol.pakietyMaterialow.autoTermin);

    const stan = await stanPakietu(p.id);
    expect(stan.status).toBe("do_akceptacji");
    const wyslano = new Date(stan.submitted_at ?? 0);
    expect(new Date(stan.auto_approve_at ?? 0).toISOString()).toBe(wyliczAutoAkceptacje(wyslano, { godziny: 72, dniRobocze: true }).toISOString());
    const zdarzenie = await ostatnieZdarzenie(p.id, "wyslany");
    expect(zdarzenie?.dni_robocze).toBe(true);
    // niedziela nie liczy się do terminu: 72 h robocze to nigdy mniej niż 72 h kalendarzowe
    expect(new Date(stan.auto_approve_at ?? 0).getTime() - wyslano.getTime()).toBeGreaterThanOrEqual(72 * 3_600_000);
  } finally {
    await ustawUstawienie("auto_approve_business_days", false);
    await zespol.close();
    await usunPakiet(p.id);
  }
});
