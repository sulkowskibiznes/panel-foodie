import { describe, expect, it } from "vitest";
import { wyprowadzKlucz } from "@/lib/krypto";
import { odczytajLadunek, podpiszLadunek } from "@/lib/podpis";
import { czyTokenPodgladu, MS_WAZNOSCI_PODGLADU, odczytajTokenPodgladu, utworzTokenPodgladu } from "@/lib/podglad-zespolu";

const SEKRET = "0123456789abcdef0123456789abcdef0123456789abcdef";
const KLUCZ = wyprowadzKlucz(SEKRET, "podglad");
const INNY = wyprowadzKlucz(SEKRET, "upload");
const TERAZ = new Date("2026-09-04T10:30:00+02:00");
const CLIENT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const MEMBER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("podpisane ładunki", () => {
  it("podpis i odczyt z tym samym kluczem; inny klucz, zmiana treści albo podpisu odpadają", () => {
    const token = podpiszLadunek(KLUCZ, { a: 1, wygasaO: TERAZ.getTime() + 1000 });
    expect(odczytajLadunek(KLUCZ, token, TERAZ)).toEqual({ a: 1, wygasaO: TERAZ.getTime() + 1000 });
    expect(odczytajLadunek(INNY, token, TERAZ)).toBeNull();
    const [dane, podpis] = token.split(".");
    expect(odczytajLadunek(KLUCZ, `${dane}x.${podpis}`, TERAZ)).toBeNull();
    expect(odczytajLadunek(KLUCZ, `${dane}.${"0".repeat(64)}`, TERAZ)).toBeNull();
    expect(odczytajLadunek(KLUCZ, "smieci", TERAZ)).toBeNull();
  });
  it("ładunek po terminie jest nieważny", () => {
    const token = podpiszLadunek(KLUCZ, { wygasaO: TERAZ.getTime() });
    expect(odczytajLadunek(KLUCZ, token, TERAZ)).toBeNull();
    expect(odczytajLadunek(KLUCZ, podpiszLadunek(KLUCZ, { bez: "terminu" }), TERAZ)).toBeNull();
  });
});

describe("token podglądu klienta (SPEC rozdz. 2, kryterium 25)", () => {
  it("niesie klienta i członka zespołu, wygasa po 4 godzinach, nie wygląda jak token linku", () => {
    const token = utworzTokenPodgladu(KLUCZ, { clientId: CLIENT, memberId: MEMBER }, TERAZ);
    expect(czyTokenPodgladu(token)).toBe(true);
    expect(/^[0-9a-f]{32}$/.test(token)).toBe(false);
    expect(odczytajTokenPodgladu(KLUCZ, token, TERAZ)).toMatchObject({ clientId: CLIENT, memberId: MEMBER, wygasaO: TERAZ.getTime() + MS_WAZNOSCI_PODGLADU });
    expect(odczytajTokenPodgladu(KLUCZ, token, new Date(TERAZ.getTime() + MS_WAZNOSCI_PODGLADU + 1))).toBeNull();
    expect(odczytajTokenPodgladu(INNY, token, TERAZ)).toBeNull();
    expect(odczytajTokenPodgladu(KLUCZ, "0123456789abcdef0123456789abcdef", TERAZ)).toBeNull();
    expect(czyTokenPodgladu("0123456789abcdef0123456789abcdef")).toBe(false);
  });
});
