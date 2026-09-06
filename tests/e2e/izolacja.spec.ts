import { expect, test } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { pakietKlienta, usunLinkTestowy, utworzLinkTestowy, wyczyscLimity, type LinkTestowy } from "./pomocnicze/baza";
import { raportyKlienta } from "./pomocnicze/faza5";
import { dokumentyKlienta, fakturyKlienta, komentarzeZTrescia, lokalKlienta, plikKlienta } from "./pomocnicze/izolacja";
import { zalogujKlienta } from "./pomocnicze/klient";
import { komentarzePakietu, materialyPakietu, okresDlaProjektu, sklonujPakiet, usunPakiet, wariantyMaterialu } from "./pomocnicze/pakiety";

/**
 * Faza 6, SPEC rozdz. 16.4: klient A (Burger Brothers) próbuje sięgnąć po KAŻDY rodzaj zasobu klienta B
 * (Pierogarnia Babci): pakiet, harmonogram pakietu, plik przez signed URL (także z podmienioną ścieżką w podpisanym
 * adresie), zdjęcie profilowe, fakturę, dokument, raport i komentarz przypięty do cudzego materiału. Wszędzie 404
 * albo odmowa, nigdy 403 i nigdy cudze dane na liście. Kryterium 4 rozszerzone na resztę zasobów.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const KLIENT_A = "burger-brothers";
const KLIENT_B = "pierogarnia-babci";

let link: LinkTestowy;

test.beforeAll(async () => {
  await wyczyscLimity();
  link = await utworzLinkTestowy(KLIENT_A, { label: `E2E izolacja ${Date.now()}` });
});

test.afterAll(async () => {
  if (link) await usunLinkTestowy(link.id);
});

test("pakiet i harmonogram klienta B: 404 z sesją klienta A i bez sesji", async ({ page, browser }) => {
  await zalogujKlienta(page, link.token, link.pin);
  const [pakietA, pakietB] = await Promise.all([pakietKlienta(KLIENT_A), pakietKlienta(KLIENT_B)]);

  expect((await page.goto(`/p/${link.token}/materialy/${pakietB}`))?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.nieZnaleziono.tytul);
  expect((await page.goto(`/p/${link.token}/harmonogram?p=${pakietB}`))?.status()).toBe(404);
  // własny pakiet działa, więc 404 wyżej nie bierze się z błędu strony
  expect((await page.goto(`/p/${link.token}/materialy/${pakietA}`))?.status()).toBe(200);
  expect((await page.goto(`/p/${link.token}/harmonogram?p=${pakietA}`))?.status()).toBe(200);

  const bezSesji = await browser.newContext();
  const odp = await bezSesji.request.get(`/p/${link.token}/materialy/${pakietB}`, { maxRedirects: 0 });
  expect([302, 307, 404]).toContain(odp.status());
  expect(odp.status() === 404 || (odp.headers()["location"] ?? "").endsWith(`/p/${link.token}`)).toBe(true);
  await bezSesji.close();
});

test("plik przez signed URL: cudzy plik 404 w każdym wariancie, podmieniona ścieżka w podpisanym adresie odrzucona przez Storage", async ({ page }) => {
  await zalogujKlienta(page, link.token, link.pin);
  const [plikA, plikB, lokalB] = await Promise.all([plikKlienta(KLIENT_A), plikKlienta(KLIENT_B), lokalKlienta(KLIENT_B)]);

  for (const wariant of ["thumb", "preview", "original"]) {
    const odp = await page.request.get(`/p/${link.token}/plik/${plikB.id}/${wariant}`, { maxRedirects: 0 });
    expect(odp.status(), `plik B, wariant ${wariant}`).toBe(404);
  }
  expect((await page.request.get(`/p/${link.token}/awatar/${lokalB}`, { maxRedirects: 0 })).status()).toBe(404);

  // własny plik: 302 na signed URL, który naprawdę działa
  const wlasny = await page.request.get(`/p/${link.token}/plik/${plikA.id}/thumb`, { maxRedirects: 0 });
  expect(wlasny.status()).toBe(302);
  const podpisany = wlasny.headers()["location"]!;
  expect(podpisany).toContain("/storage/v1/object/sign/materialy/");
  const pobrany = await page.request.get(podpisany, { maxRedirects: 0 });
  expect(pobrany.status()).toBe(200);

  // ten sam podpis, ale ścieżka klienta B: Storage nie wyda pliku
  const sciezkaA = plikA.thumb_path ?? plikA.storage_path;
  const sciezkaB = plikB.thumb_path ?? plikB.storage_path;
  expect(podpisany).toContain(sciezkaA);
  const podrobiony = podpisany.replace(sciezkaA, sciezkaB);
  expect(podrobiony).not.toBe(podpisany);
  const odmowa = await page.request.get(podrobiony, { maxRedirects: 0 });
  expect(odmowa.status(), "Storage przyjął podpis dla cudzej ścieżki").toBeGreaterThanOrEqual(400);
});

test("faktura i dokument klienta B: 404, a listy klienta A nie zawierają cudzych pozycji", async ({ page }) => {
  await zalogujKlienta(page, link.token, link.pin);
  const [fakturyA, fakturyB, dokumentyA, dokumentyB] = await Promise.all([fakturyKlienta(KLIENT_A), fakturyKlienta(KLIENT_B), dokumentyKlienta(KLIENT_A), dokumentyKlienta(KLIENT_B)]);
  expect(fakturyB.length).toBeGreaterThan(0);
  expect(dokumentyB.length).toBeGreaterThan(0);

  for (const id of fakturyB) expect((await page.request.get(`/p/${link.token}/faktura/${id}`, { maxRedirects: 0 })).status(), `faktura ${id}`).toBe(404);
  for (const id of dokumentyB) expect((await page.request.get(`/p/${link.token}/dokument/${id}`, { maxRedirects: 0 })).status(), `dokument ${id}`).toBe(404);

  await page.goto(`/p/${link.token}/faktury`);
  await expect(page.locator("[data-faktura]").first()).toBeVisible();
  const widoczneFaktury = await page.locator("[data-faktura]").evaluateAll((el) => el.map((e) => e.getAttribute("data-faktura")));
  const widoczneDokumenty = await page.locator("[data-dokument]").evaluateAll((el) => el.map((e) => e.getAttribute("data-dokument")));
  expect(widoczneFaktury).toEqual(expect.arrayContaining(fakturyA));
  for (const id of fakturyB) expect(widoczneFaktury).not.toContain(id);
  expect(widoczneDokumenty).toEqual(expect.arrayContaining(dokumentyA));
  for (const id of dokumentyB) expect(widoczneDokumenty).not.toContain(id);
  // własna faktura z PDF-em przechodzi przez signed URL (10 minut)
  const wlasna = await page.request.get(`/p/${link.token}/faktura/${fakturyA[0]}`, { maxRedirects: 0 });
  expect([302, 404]).toContain(wlasna.status());
});

test("raporty: lista klienta A nie zawiera raportów klienta B", async ({ page }) => {
  await zalogujKlienta(page, link.token, link.pin);
  const [raportyA, raportyB] = await Promise.all([raportyKlienta(KLIENT_A), raportyKlienta(KLIENT_B)]);
  expect(raportyB.length).toBeGreaterThan(0);
  await page.goto(`/p/${link.token}/raporty`);
  await expect(page.locator("[data-raport]").first()).toBeVisible();
  const widoczne = await page.locator("[data-raport]").evaluateAll((el) => el.map((e) => e.getAttribute("data-raport")));
  expect(widoczne).toEqual(expect.arrayContaining(raportyA.map((r) => r.id)));
  for (const r of raportyB) expect(widoczne).not.toContain(r.id);
  const adresy = await page.locator("[data-otworz-raport]").evaluateAll((el) => el.map((e) => e.getAttribute("href")));
  for (const r of raportyB) expect(adresy).not.toContain(r.url);
});

test("komentarz: podmiana materiału, wariantu, pakietu albo tokenu na cudze w ciele akcji jest odrzucona", async ({ page }) => {
  const okres = okresDlaProjektu(test.info().project.name, "izolacja", 0);
  const klon = await sklonujPakiet(KLIENT_A, { od: okres.od, do: okres.do, status: "do_akceptacji" });
  const linkB = await utworzLinkTestowy(KLIENT_B, { label: `E2E izolacja B ${Date.now()}` });
  const znacznik = `izolacja-${test.info().project.name}-${Date.now()}`;
  try {
    await zalogujKlienta(page, link.token, link.pin);
    const pakietB = await pakietKlienta(KLIENT_B);
    const [materialyB, materialyA] = await Promise.all([materialyPakietu(pakietB), materialyPakietu(klon.id)]);
    const postB = materialyB.find((m) => m.type === "post")!;
    const reklamaB = materialyB.find((m) => m.type === "reklama")!;
    const wariantB = (await wariantyMaterialu(reklamaB.id)).find((w) => w.kind === "tekst")!;
    const postA = materialyA.find((m) => m.type === "post")!;
    expect(postB && reklamaB && wariantB && postA).toBeTruthy();
    const komentarzyBPrzed = (await komentarzePakietu(pakietB)).length;

    // Ciało akcji to JSON: ["<token>", "<pakietId>", {materialId, wariantId, tresc}]. Argumenty związane przez bind
    // NIE są szyfrowane, więc atakujący może podmienić każdy z nich; serwer musi wszystko sprawdzić od nowa.
    let podmiany: Array<{ z: string; na: string }> = [];
    let przechwycone = 0;
    await page.route(`**/p/${link.token}/materialy/${klon.id}`, async (route) => {
      const req = route.request();
      const cialo = req.postData();
      if (req.method() === "POST" && req.headers()["next-action"] && cialo && podmiany.length > 0) {
        przechwycone++;
        let nowe = cialo;
        for (const p of podmiany) {
          expect(nowe, `ciało akcji nie zawiera „${p.z}"`).toContain(p.z);
          nowe = nowe.split(p.z).join(p.na);
        }
        await route.continue({ postData: nowe });
        return;
      }
      await route.continue();
    });

    const otworz = async () => {
      await page.goto(`/p/${link.token}/materialy/${klon.id}`);
      const sekcja = page.locator(`[data-material="${postA.id}"]`);
      await expect(sekcja).toBeVisible();
      return sekcja;
    };
    const wyslij = async (sekcja: ReturnType<typeof page.locator>, tresc: string) => {
      await sekcja.locator("textarea").fill(tresc);
      const [odp] = await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"] && r.url().includes(klon.id)),
        sekcja.getByRole("button", { name: copy.pakiet.komentarze.wyslij }).click(),
      ]);
      return odp;
    };

    // 1) materiał klienta B zamiast własnego posta: odmowa z komunikatem
    let sekcja = await otworz();
    podmiany = [{ z: postA.id, na: postB.id }];
    await wyslij(sekcja, `${znacznik} cudzy material`);
    await expect(sekcja.locator("[role=alert]")).toBeVisible();

    // 2) wariant reklamy klienta B pod własnym materiałem: odmowa (wariant musi należeć do materiału)
    podmiany = [{ z: '"wariantId":null', na: `"wariantId":"${wariantB.id}"` }];
    await wyslij(sekcja, `${znacznik} cudzy wariant`);
    await expect(sekcja.locator("[role=alert]")).toBeVisible();
    expect(przechwycone).toBe(2);

    // 3) cudzy pakiet i cudzy materiał: 404, jak przy wejściu na cudzy adres
    podmiany = [
      { z: klon.id, na: pakietB },
      { z: postA.id, na: postB.id },
    ];
    expect((await wyslij(sekcja, `${znacznik} cudzy pakiet`)).status()).toBe(404);

    // 4) token linku klienta B (np. przechwycony bez PIN-u) z sesją klienta A: 404
    sekcja = await otworz();
    podmiany = [
      { z: link.token, na: linkB.token },
      { z: klon.id, na: pakietB },
      { z: postA.id, na: postB.id },
    ];
    expect((await wyslij(sekcja, `${znacznik} cudzy token`)).status()).toBe(404);
    expect(przechwycone).toBe(4);

    // żaden z tych komentarzy nie istnieje: ani u klienta B, ani w klonie klienta A
    expect(await komentarzeZTrescia(znacznik)).toEqual([]);
    expect(await komentarzePakietu(klon.id)).toEqual([]);
    expect((await komentarzePakietu(pakietB)).length).toBe(komentarzyBPrzed);

    // kontrola: bez podmian ten sam formularz zapisuje komentarz we własnym pakiecie
    sekcja = await otworz();
    podmiany = [];
    await wyslij(sekcja, `${znacznik} wlasny`);
    await expect(sekcja.locator("[data-komentarz]")).toHaveCount(1);
    const zapisane = await komentarzeZTrescia(znacznik);
    expect(zapisane).toHaveLength(1);
    expect(zapisane[0]?.package_id).toBe(klon.id);
    expect(zapisane[0]?.item_id).toBe(postA.id);
  } finally {
    await usunPakiet(klon.id);
    await usunLinkTestowy(linkB.id);
  }
});
