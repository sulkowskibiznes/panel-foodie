import { expect, test, type Page } from "@playwright/test";
import { copy } from "../../src/lib/copy";
import { wpisyAudytu } from "./pomocnicze/baza";
import { idKlienta, liczbaZdarzenPakietu, materialyPakietu, okresDlaProjektu, pakietyKlientaWOkresie, plikiPakietu, usunPakiet, wariantyMaterialu, wpisyAudytuKlienta, zadaniaImportu } from "./pomocnicze/pakiety";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/**
 * Import z Dysku na atrapie (SPEC rozdz. 13; DRIVE_ATRAPA=1 w playwright.config.ts): kreator prowadzi do karty
 * weryfikacyjnej, obowiązkowe mapowanie, kopiowanie w tle z paskiem postępu, potem „Dodaj materiał" linkiem do pliku.
 * Kryterium 17: folder spoza „Materiałów klientów" blokuje import. Kryterium 18: folder użyty w innym pakiecie
 * pokazuje ostrzeżenie z linkiem do tamtego pakietu. Klient kat2 (Burger Brothers), rok 2034, miesiące wg projektu.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const KLIENT = "burger-brothers";
const folder = (id: string) => `https://drive.google.com/drive/folders/${id}`;
const plik = (id: string) => `https://drive.google.com/file/d/${id}/view?usp=drive_link`;
const start = new Date();
let clientId: string;
let pakietA: string | null = null;
let pakietB: string | null = null;
let pakietC: string | null = null;

test.beforeAll(async () => {
  clientId = await idKlienta(KLIENT);
  const projekt = test.info().project.name;
  const miesiace = [0, 1, 2].map((i) => okresDlaProjektu(projekt, "import", i).miesiac);
  for (const id of await pakietyKlientaWOkresie(KLIENT, 2034, miesiace)) await usunPakiet(id);
});
test.afterAll(async () => {
  for (const id of [pakietA, pakietB, pakietC]) if (id) await usunPakiet(id);
});

/** Kreator na wklejanych linkach; z linkami przekierowuje do /import. Zwraca id pakietu. */
async function utworzKreatorem(z: Page, przesuniecie: number, content: string | null, kampanie: Array<{ nazwa: string; folder: string | null }>): Promise<string> {
  const okres = okresDlaProjektu(test.info().project.name, "import", przesuniecie);
  await z.goto(`/zespol/klienci/${KLIENT}/pakiety/nowy`);
  await expect(z.locator("[data-kreator-pakietu]")).toBeVisible();
  await z.locator("#kreator-rok").fill(String(okres.rok));
  await z.locator("#kreator-miesiac").selectOption(String(okres.miesiac));
  if (content) await z.locator("[data-folder-contentu]").fill(content);
  for (const [i, k] of kampanie.entries()) {
    if (i > 0) await z.locator("[data-dodaj-kampanie-kreator]").click();
    await z.locator(`#kreator-kampania-${i}-nazwa`).fill(k.nazwa);
    if (k.folder) await z.locator(`#kreator-kampania-${i}-folder`).fill(k.folder);
  }
  await z.locator("[data-utworz-pakiet]").click();
  await z.waitForURL(/\/pakiety\/[0-9a-f-]{36}\/import$/);
  const id = /\/pakiety\/([0-9a-f-]{36})\/import$/.exec(z.url())?.[1];
  expect(id).toBeTruthy();
  return id!;
}

test("karta weryfikacyjna, mapowanie i kopiowanie w tle: content z dwoma podfolderami plus dwie kampanie; potem Dodaj materiał linkiem", async ({ browser }) => {
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const z = await zespol.newPage();
    pakietA = await utworzKreatorem(z, 0, folder("atrapa-content-5"), [
      { nazwa: "Kampania standardowa", folder: folder("atrapa-reklamy-5") },
      { nazwa: "Imprezy okolicznościowe", folder: folder("atrapa-reklamy-5-imprezy") },
    ]);

    // 1. Karty: pełna ścieżka, liczba plików, pierwsze nazwy; ostrzeżenie o miesiącu (rok 2034 to nie 5. miesiąc współpracy)
    await expect(z.locator('[data-ekran-importu][data-krok="weryfikacja"]')).toBeVisible();
    await expect(z.locator("[data-karta-weryfikacyjna]")).toHaveCount(3);
    const content = z.locator('[data-karta-weryfikacyjna][data-karta-rodzaj="content"]');
    await expect(content).toHaveAttribute("data-karta-stan", "ok");
    await expect(content.locator("[data-karta-sciezka]")).toHaveText("Materiały klientów / Burger Brothers / content / content 5 mies");
    await expect(content.locator("[data-karta-pliki]")).toContainText("13 (9 grafik, 2 wideo, 1 dokumentów, 1 innych)");
    await expect(content.locator("[data-karta-pierwsze]")).toContainText("1. Burger klasyk.png, 2. Nowe menu.png, 3a. Zaplecze.png");
    await expect(content.locator('[data-karta-ostrzezenie="miesiac"]')).toBeVisible();
    await expect(content.locator('[data-karta-ostrzezenie="nieobslugiwane"]')).toContainText("projekt.psd");
    await expect(z.locator('[data-karta-weryfikacyjna][data-karta-rodzaj="reklamy"]')).toHaveCount(2);
    // bez zgody na ostrzeżenia „Dalej" stoi
    await expect(z.locator("[data-dalej-mapowanie]")).toBeDisabled();
    await expect(z.locator("[data-dalej-zgoda]")).toBeVisible();
    for (const karta of await z.locator("[data-karta-weryfikacyjna]").all()) {
      const zgoda = karta.locator("[data-ignoruj-ostrzezenia]");
      if (await zgoda.count()) await zgoda.check();
    }
    await expect(z.locator("[data-dalej-mapowanie]")).toBeEnabled();
    await z.locator("[data-dalej-mapowanie]").click();

    // 2. Mapowanie: 7 postów (w tym karuzela 3a+3b i rolka) + 3 relacje; opisy po numerze; post 10 bez opisu
    await expect(z.locator('[data-ekran-importu][data-krok="mapowanie"]')).toBeVisible({ timeout: 30_000 });
    await expect(z.locator("[data-material-mapowania]")).toHaveCount(10);
    const posty = z.locator('[data-material-mapowania][data-rodzaj="post"]');
    await expect(posty).toHaveCount(6);
    await expect(z.locator('[data-material-mapowania][data-rodzaj="reels"]')).toHaveCount(1);
    await expect(z.locator('[data-material-mapowania][data-rodzaj="relacja"]')).toHaveCount(3);
    await expect(posty.nth(0).locator("[data-mapowanie-tytul]")).toHaveValue("Post 1 - burger klasyk");
    await expect(posty.nth(0).locator("[data-mapowanie-opis]")).toHaveValue(/Klasyk wraca na stałe/);
    await expect(posty.nth(0).locator("[data-mapowanie-dopasowanie]")).toHaveText(copy.zespol.import.mapowanie.dopasowanie.numer);
    await expect(posty.nth(2)).toContainText("Karuzela: 2 slajdów");
    await expect(posty.nth(2).locator("[data-miniatura-mapowania]").first()).toHaveJSProperty("complete", true);
    const post10 = posty.nth(5);
    await expect(post10.locator("[data-mapowanie-tytul]")).toHaveValue("Post 10 - Bonus");
    await expect(post10).toHaveAttribute("data-dopasowanie", "brak");
    await post10.locator("[data-mapowanie-pomin]").click();
    await expect(post10.locator("[data-mapowanie-pomin]")).toHaveText(copy.zespol.import.mapowanie.przywroc);
    // reklamy: 3 grafiki + 3 teksty + 3 nagłówki, opis, przycisk, link; imprezy: 2 grafiki
    const reklamy = z.locator("[data-mapowanie-reklam]");
    await expect(reklamy).toHaveCount(2);
    await expect(reklamy.nth(0).locator("[data-grafika-mapowania]")).toHaveCount(3);
    await expect(reklamy.nth(0).locator("[data-reklama-tekst]")).toHaveCount(3);
    await expect(reklamy.nth(0).locator("[data-reklama-naglowek]")).toHaveCount(3);
    await expect(reklamy.nth(0).locator("[data-reklama-cta]")).toHaveValue("Zamów teraz");
    await expect(reklamy.nth(0).locator("[data-reklama-link]")).toHaveValue("https://burgerbrothers.pl/zamow");
    await expect(reklamy.nth(1).locator("[data-grafika-mapowania]")).toHaveCount(2);
    await expect(z.locator("[data-podsumowanie-mapowania]")).toHaveText("Do importu: 11 materiałów i 15 plików.");
    await z.locator("[data-importuj]").click();

    // 3. Kopiowanie w tle: pasek postępu, trzy zadania, wszystko zakończone
    await expect(z.locator('[data-ekran-importu][data-krok="postep"]')).toBeVisible({ timeout: 30_000 });
    await expect(z.locator("[data-import-gotowy]")).toBeVisible({ timeout: 90_000 });
    await expect(z.locator("[data-zadanie-importu]")).toHaveCount(3);
    for (const zadanie of await z.locator("[data-zadanie-importu]").all()) await expect(zadanie).toHaveAttribute("data-status", "zakonczony");
    await expect(z.locator("[data-pasek-postepu]")).toHaveAttribute("aria-valuenow", "100");

    const zadania = await zadaniaImportu(pakietA);
    expect(zadania.map((x) => [x.kind, x.status, x.files_done, x.error])).toEqual([
      ["content", "zakonczony", 10, null],
      ["reklamy", "zakonczony", 3, null],
      ["reklamy", "zakonczony", 2, null],
    ]);
    const materialy = await materialyPakietu(pakietA);
    expect(materialy.filter((m) => m.type === "post").map((m) => m.title)).toEqual(["Post 1 - burger klasyk", "Post 2 - nowe menu", "Post 3 - karuzela z zapleczem", "Post 5 - happy hours", "Post 6 - weekend"]);
    expect(materialy.filter((m) => m.type === "reels").map((m) => m.title)).toEqual(["Reels 4 - rolka"]);
    expect(materialy.filter((m) => m.type === "relacja")).toHaveLength(3);
    expect(materialy.filter((m) => m.type === "reklama")).toHaveLength(2);
    const pliki = await plikiPakietu(pakietA);
    expect(pliki).toHaveLength(15);
    expect(pliki.every((p) => p.drive_file_id && p.superseded_at === null)).toBe(true);
    const karuzela = materialy.find((m) => m.title === "Post 3 - karuzela z zapleczem")!;
    expect(pliki.filter((p) => p.item_id === karuzela.id).map((p) => [p.position, p.drive_file_id, p.kind])).toEqual([
      [0, "atrapa-p3a", "image"],
      [1, "atrapa-p3b", "image"],
    ]);
    expect(pliki.filter((p) => p.kind === "image").every((p) => p.preview_path && p.thumb_path)).toBe(true);
    expect(pliki.filter((p) => p.kind === "video").map((p) => p.drive_file_id).sort()).toEqual(["atrapa-p4", "atrapa-r3"]);
    const reklama1 = materialy.find((m) => m.type === "reklama" && m.title === "Kampania standardowa")!;
    const warianty = await wariantyMaterialu(reklama1.id);
    const licz = (kind: string) => warianty.filter((w) => w.kind === kind).length;
    expect([licz("grafika"), licz("tekst"), licz("naglowek"), licz("opis"), licz("cta"), licz("link")]).toEqual([3, 3, 3, 1, 1, 1]);
    expect(warianty.find((w) => w.kind === "naglowek" && w.position === 0)?.value_text).toBe("Burger miesiąca");
    expect(await liczbaZdarzenPakietu(pakietA, "zaimportowany")).toBe(3);
    expect(await wpisyAudytuKlienta(clientId, "zespol.import_zakonczony", start)).toBeGreaterThanOrEqual(3);
    expect(await wpisyAudytuKlienta(clientId, "zespol.import_ostrzezenie_zignorowane", start)).toBeGreaterThanOrEqual(3);

    // 4. Pakiet renderuje zaimportowane materiały; „Dodaj materiał" linkiem do pliku: spoza „Materiałów klientów" odpada, z nich wchodzi
    await z.locator("[data-otworz-pakiet]").click();
    await z.waitForURL(new RegExp(`/pakiety/${pakietA}$`));
    await expect(z.getByRole("tab", { name: "Posty (6)" })).toBeVisible();
    await expect(z.getByRole("tab", { name: "Relacje (3)" })).toBeVisible();
    await z.locator("[data-dodaj-material]").click();
    const dialog = z.locator("[data-dialog-nowego-materialu]");
    await dialog.locator("#nowy-typ").selectOption("post");
    await dialog.locator("[data-pole-linku-dysku] input").fill(plik("atrapa-poza-1"));
    await dialog.locator("[data-pobierz-z-dysku]").click();
    await expect(dialog.locator("[data-pole-pliku] [role=alert]")).toHaveText(copy.zespol.import.plikZDysku.bledy.zablokowany);
    await dialog.locator("[data-pole-linku-dysku] input").fill(plik("atrapa-pb1"));
    await dialog.locator("[data-pobierz-z-dysku]").click();
    await expect(dialog.locator("[data-plik-gotowy]")).toContainText("1. Pierogi ruskie.png", { timeout: 30_000 });
    await dialog.locator("[data-dodaj-material-zapisz]").click();
    await expect(dialog).toBeHidden();
    await expect(z.getByRole("tab", { name: "Posty (7)" })).toBeVisible();
    const poDodaniu = await plikiPakietu(pakietA);
    expect(poDodaniu.find((p) => p.drive_file_id === "atrapa-pb1")?.original_name).toBe("1. Pierogi ruskie.png");
    expect((await zadaniaImportu(pakietA)).map((x) => x.kind)).toEqual(["content", "reklamy", "reklamy", "dodatkowy"]);
  } finally {
    await zespol.close();
  }
});

test("17. folder spoza „Materiałów klientów\" blokuje import bez obejścia", async ({ browser }) => {
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const z = await zespol.newPage();
    pakietB = await utworzKreatorem(z, 1, folder("atrapa-poza"), [{ nazwa: "Kampania standardowa", folder: null }]);
    const content = z.locator('[data-karta-weryfikacyjna][data-karta-rodzaj="content"]');
    await expect(content).toHaveAttribute("data-karta-stan", "zablokowany");
    await expect(content.locator("[data-karta-zablokowana]")).toHaveText(copy.zespol.import.karta.zablokowany);
    await expect(content.locator("[data-ignoruj-ostrzezenia]")).toHaveCount(0);
    await expect(content.locator("[data-pomin-folder]")).toHaveCount(0);
    await expect(z.locator('[data-karta-weryfikacyjna][data-karta-rodzaj="reklamy"]')).toHaveAttribute("data-karta-stan", "brak_linku");
    await expect(z.locator("[data-dalej-mapowanie]")).toBeDisabled();
    await expect(z.locator("[data-dalej-brak]")).toBeVisible();
    // poprawka linku na właściwy folder odblokowuje kartę
    await content.locator("[data-zmien-link-karty]").click();
    await content.locator("[data-pole-linku-karty]").fill(folder("atrapa-pierogarnia-3"));
    await content.locator("[data-zapisz-link-karty]").click();
    await expect(z.locator('[data-karta-weryfikacyjna][data-karta-rodzaj="content"]')).toHaveAttribute("data-karta-stan", "ok", { timeout: 20_000 });
    await expect(z.locator('[data-karta-weryfikacyjna][data-karta-rodzaj="content"] [data-karta-ostrzezenie="klient"]')).toContainText("Pierogarnia Babci");
    expect(await zadaniaImportu(pakietB)).toEqual([]);
    expect((await materialyPakietu(pakietB)).map((m) => m.type)).toEqual(["reklama"]);
  } finally {
    await zespol.close();
  }
});

test("18. folder użyty w innym pakiecie: ostrzeżenie z linkiem do tamtego pakietu i datą importu", async ({ browser }) => {
  expect(pakietA).toBeTruthy();
  const zespol = await browser.newContext({ storageState: PLIK_SESJI_ZESPOLU });
  try {
    const z = await zespol.newPage();
    pakietC = await utworzKreatorem(z, 2, folder("atrapa-content-5"), [{ nazwa: "Kampania standardowa", folder: folder("atrapa-reklamy-5") }]);
    const content = z.locator('[data-karta-weryfikacyjna][data-karta-rodzaj="content"]');
    await expect(content).toHaveAttribute("data-karta-stan", "ok");
    const powtorny = content.locator(`[data-karta-ostrzezenie="powtorny"]:has(a[href$="/pakiety/${pakietA}"])`);
    await expect(powtorny).toBeVisible();
    await expect(powtorny).toContainText(", import ");
    await expect(powtorny.locator("[data-link-poprzedniego-pakietu]")).toHaveAttribute("href", `/zespol/klienci/${KLIENT}/pakiety/${pakietA}`);
    await expect(z.locator(`[data-karta-weryfikacyjna][data-karta-rodzaj="reklamy"] [data-karta-ostrzezenie="powtorny"]:has(a[href$="/pakiety/${pakietA}"])`)).toBeVisible();
    // ostrzeżenie da się świadomie zignorować i zaimportować drugi raz (audyt po stronie serwera, osobny wpis na zadanie)
    for (const karta of await z.locator("[data-karta-weryfikacyjna]").all()) await karta.locator("[data-ignoruj-ostrzezenia]").check();
    await z.locator("[data-dalej-mapowanie]").click();
    await expect(z.locator('[data-ekran-importu][data-krok="mapowanie"]')).toBeVisible({ timeout: 30_000 });
    // dla szybkości zostaje jeden post i reklama
    const materialy = z.locator("[data-material-mapowania]");
    for (const m of (await materialy.all()).slice(1)) await m.locator("[data-mapowanie-pomin]").click();
    await expect(z.locator("[data-podsumowanie-mapowania]")).toHaveText("Do importu: 2 materiałów i 4 plików.");
    await z.locator("[data-importuj]").click();
    await expect(z.locator("[data-import-gotowy]")).toBeVisible({ timeout: 90_000 });
    const zadania = await zadaniaImportu(pakietC);
    expect(zadania.map((x) => [x.kind, x.status])).toEqual([
      ["content", "zakonczony"],
      ["reklamy", "zakonczony"],
    ]);
    for (const zadanie of zadania) expect(await wpisyAudytu(zadanie.id, "zespol.import_ostrzezenie_zignorowane")).toBe(1);
  } finally {
    await zespol.close();
  }
});
