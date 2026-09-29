import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { progRetencji } from "../../src/lib/retencja/przeglad";
import { usunCzlonkaTestowego, usunLinkTestowy, utworzCzlonkaTestowego, utworzLinkTestowy, wyczyscLimity } from "./pomocnicze/baza";
import { bearerCrona } from "./pomocnicze/faza5";
import { sklonujPakiet, usunPakiet } from "./pomocnicze/pakiety";
import { audytIstnieje, czyObiektIstnieje, liczbaZdarzenRetencjiOd, pakietIstnieje, podmienPlikiKlonu, przegladPoId, przegladyPakietu, sesjaIstnieje, usunAudytTestowy, usunZdarzeniaRetencjiOd, ustawOdroczenie, wpisyAudytuPoEncji, wstawStaraSesje, wstawStaryAudyt } from "./pomocnicze/retencja";
import { PLIK_SESJI_ZESPOLU, zalogujZespol } from "./pomocnicze/zespol";

/**
 * Faza 6, SPEC rozdz. 17: cron miesięczny zgłasza pakiety starsze niż 24 miesiące do decyzji admina i NICZEGO
 * z materiałów nie kasuje; sam sprząta tylko wygasłe sesje (90 dni) i audyt (12 miesięcy). Admin w Ustawienia -> Retencja
 * odracza o 12 miesięcy albo usuwa pakiet z plikami. Klon dostaje okres na początku 2024 roku (osobny miesiąc na projekt; baza nie przyjmuje dat sprzed 2024), pliki
 * klonu są przepięte na własne obiekty w Storage, żeby usunięcie nie ruszyło plików seedu.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const KLIENT = "burger-brothers";
const CRON = "/api/cron/retencja";

test("cron zgłasza stary pakiet raz, admin odracza i usuwa; sesje i audyt sprzątane wg SPEC", async ({ request, page, browser }) => {
  await wyczyscLimity();
  const mobile = test.info().project.name.startsWith("mobile");
  const akcjaAudytu = `e2e.retencja_test_${test.info().project.name}`;
  const start = new Date();
  const klon = await sklonujPakiet(KLIENT, { od: mobile ? "2024-01-01" : "2024-03-01", do: mobile ? "2024-01-31" : "2024-03-31", status: "zaplanowany" });
  const link = await utworzLinkTestowy(KLIENT, { label: `E2E retencja ${test.info().project.name} ${Date.now()}` });
  const admin = await utworzCzlonkaTestowego(`e2e-admin-retencja-${test.info().project.name}-${process.env.E2E_SEED ?? "0"}@foodiemedia.pl`, "admin");
  let pliki: string[] = [];
  try {
    pliki = await podmienPlikiKlonu(klon.id, klon.clientId);
    const staraSesja = await wstawStaraSesje(link.id, 91);
    const swiezaSesja = await wstawStaraSesje(link.id, 10);
    const staryAudyt = await wstawStaryAudyt(13, akcjaAudytu);
    const swiezyAudyt = await wstawStaryAudyt(1, akcjaAudytu);

    // bez nagłówka crona: 401 bez treści
    expect((await request.get(CRON)).status()).toBe(401);
    const pierwszy = await request.get(CRON, { headers: { authorization: bearerCrona() } });
    expect(pierwszy.status()).toBe(200);
    // Dwa projekty Playwrighta wołają cron równolegle, więc stan sprawdzamy w bazie, nie w odpowiedzi jednego przebiegu.
    const wynik1 = (await pierwszy.json()) as { prog: string; miesiace: number; zgloszone: string[]; ponowione: string[]; sesjeUsuniete: number; audytUsuniety: number };
    expect(wynik1.miesiace).toBe(24);
    // próg = dziś minus 24 miesiące (bez daty zaszytej w teście), zawsze po okresie klonu
    expect([progRetencji(start, 24), progRetencji(new Date(), 24)]).toContain(wynik1.prog);
    expect(wynik1.prog > (mobile ? "2024-01-31" : "2024-03-31")).toBe(true);
    expect(Array.isArray(wynik1.zgloszone) && Array.isArray(wynik1.ponowione)).toBe(true);

    // pakiet i pliki są NIETKNIĘTE: cron tylko zgłasza
    expect(await pakietIstnieje(klon.id)).toBe(true);
    expect(await czyObiektIstnieje("materialy", pliki[0]!)).toBe(true);
    const [przeglad] = await przegladyPakietu(klon.id);
    expect(przeglad?.decision).toBeNull();
    expect(przeglad?.files_count).toBeGreaterThan(0);
    expect(await wpisyAudytuPoEncji(klon.id, "system.retencja_zgloszona")).toBe(1);
    expect(await liczbaZdarzenRetencjiOd(start)).toBeGreaterThanOrEqual(1);

    // sprzątanie: stara sesja i stary audyt znikają, świeże zostają
    expect(await sesjaIstnieje(staraSesja)).toBe(false);
    expect(await sesjaIstnieje(swiezaSesja)).toBe(true);
    expect(await audytIstnieje(staryAudyt)).toBe(false);
    expect(await audytIstnieje(swiezyAudyt)).toBe(true);

    // drugi przebieg: bez duplikatu
    const drugi = (await (await request.get(CRON, { headers: { authorization: bearerCrona() } })).json()) as { zgloszone: string[]; ponowione: string[] };
    expect(drugi.zgloszone).not.toContain(klon.id);
    expect(drugi.ponowione).not.toContain(klon.id);
    expect(await przegladyPakietu(klon.id)).toHaveLength(1);

    // csm nie widzi ekranu retencji (ustawienia systemu = admin)
    const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
    const csm = await zespol.newPage();
    expect((await csm.goto("/zespol/ustawienia/retencja"))?.status()).toBe(404);
    await expect(csm.locator("[data-link-retencji]")).toHaveCount(0);
    await zespol.close();

    // admin: zgłoszenie na liście, „Zachowaj 12 miesięcy"
    await zalogujZespol(page, admin.email);
    await page.locator("[data-link-retencji]").click();
    const wiersz = page.locator(`[data-przeglad="${przeglad!.id}"]`);
    await expect(wiersz).toBeVisible();
    await expect(wiersz).toContainText("Burger Brothers");
    await wiersz.locator("[data-zachowaj-materialy]").click();
    await expect(wiersz).toHaveCount(0);
    const poOdroczeniu = await przegladPoId(przeglad!.id);
    expect(poOdroczeniu?.decision).toBe("zachowaj");
    const keepUntil = new Date(poOdroczeniu!.keep_until!).getTime();
    expect(keepUntil).toBeGreaterThan(Date.now() + 360 * 86_400_000);
    expect(keepUntil).toBeLessThan(Date.now() + 370 * 86_400_000);
    await expect(page.locator("[data-historia-retencji] [data-decyzja=zachowaj]").first()).toBeVisible();
    expect(await pakietIstnieje(klon.id)).toBe(true);

    // odroczenie minęło: „Sprawdź teraz" zgłasza pakiet ponownie
    await ustawOdroczenie(przeglad!.id, new Date(Date.now() - 86_400_000));
    await page.locator("[data-sprawdz-retencje]").click();
    await expect(page.locator("[data-wynik-sprawdzenia]")).toBeVisible();
    await expect(wiersz).toBeVisible();
    expect((await przegladPoId(przeglad!.id))?.decision).toBeNull();

    // „Usuń materiały": potwierdzenie, pakiet i pliki znikają, wiersz zostaje jako ślad
    page.once("dialog", (d) => {
      expect(d.message()).toContain("Burger Brothers");
      void d.accept();
    });
    await wiersz.locator("[data-usun-materialy]").click();
    await expect(wiersz).toHaveCount(0);
    await expect(page.locator("[data-historia-retencji] [data-decyzja=usun]").first()).toBeVisible();
    expect(await pakietIstnieje(klon.id)).toBe(false);
    const poUsunieciu = await przegladPoId(przeglad!.id);
    expect(poUsunieciu?.decision).toBe("usun");
    expect(poUsunieciu?.deleted_at).not.toBeNull();
    expect(poUsunieciu?.package_id).toBeNull();
    for (const sciezka of pliki) expect(await czyObiektIstnieje("materialy", sciezka), sciezka).toBe(false);
    expect(await wpisyAudytuPoEncji(przeglad!.id, "zespol.retencja_usunieto")).toBe(1);
    // panel działa dalej, a pakiety seedu (z którymi klon dzielił ścieżki przed podmianą) są na miejscu
    await page.goto("/zespol");
    await expect(page.getByRole("heading", { level: 1, name: copy.zespol.pulpit.tytul })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Burger Brothers", exact: true }).first()).toBeVisible();
  } finally {
    if (await pakietIstnieje(klon.id)) await usunPakiet(klon.id);
    await usunLinkTestowy(link.id);
    await usunCzlonkaTestowego(admin);
    await usunAudytTestowy(akcjaAudytu);
    await usunZdarzeniaRetencjiOd(start);
  }
});
