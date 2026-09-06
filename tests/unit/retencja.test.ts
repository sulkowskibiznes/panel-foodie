import { describe, expect, it } from "vitest";
import { czyPoTerminieRetencji, dataOdroczenia, odejmijMiesiace, podzielDoZgloszenia, progAudytu, progRetencji, progSesji, uruchomCronRetencji, type IstniejacyPrzeglad, type PakietDoPrzegladu, type ZaleznosciCronaRetencji } from "@/lib/retencja/przeglad";

const TERAZ = new Date("2026-10-01T05:00:00Z");

function pakiet(id: string, periodTo: string): PakietDoPrzegladu {
  return { id, clientId: "k1", tytul: `Materiały ${id}`, okres: { od: "2024-01-01", do: periodTo }, liczbaPlikow: 3 };
}

function zaleznosci(pakiety: PakietDoPrzegladu[], przeglady: IstniejacyPrzeglad[] = [], miesiace = 24) {
  const zgloszone: string[] = [];
  const ponowione: string[] = [];
  const powiadomienia: number[] = [];
  const d: ZaleznosciCronaRetencji = {
    pobierzMiesiaceRetencji: async () => miesiace,
    pobierzPakietyStarszeNiz: async (prog) => pakiety.filter((p) => czyPoTerminieRetencji(p.okres.do, prog)),
    pobierzPrzeglady: async (ids) => przeglady.filter((p) => ids.includes(p.packageId)),
    zglos: async (p) => {
      zgloszone.push(p.id);
      return true;
    },
    ponow: async (id) => {
      ponowione.push(id);
      return true;
    },
    powiadom: async (n) => {
      powiadomienia.push(n);
    },
    usunStareSesje: async () => 7,
    usunStaryAudyt: async () => 120,
    teraz: () => TERAZ,
  };
  return { d, zgloszone, ponowione, powiadomienia };
}

describe("odejmijMiesiace i progi", () => {
  it("cofa o pełne miesiące i przycina dzień do długości miesiąca", () => {
    expect(odejmijMiesiace("2026-10-01", 24)).toBe("2024-10-01");
    expect(odejmijMiesiace("2026-03-31", 1)).toBe("2026-02-28");
    expect(odejmijMiesiace("2026-01-15", 13)).toBe("2024-12-15");
  });

  it("próg retencji liczy się z daty lokalnej w Warszawie", () => {
    // 01.10 05:00 UTC = 07:00 w Warszawie, więc data lokalna to 1 października
    expect(progRetencji(TERAZ, 24)).toBe("2024-10-01");
    // 30.09 23:30 UTC = 01.10 01:30 w Warszawie
    expect(progRetencji(new Date("2026-09-30T23:30:00Z"), 24)).toBe("2024-10-01");
  });

  it("pakiet kwalifikuje się tylko, gdy koniec okresu jest wcześniejszy niż próg", () => {
    expect(czyPoTerminieRetencji("2024-09-30", "2024-10-01")).toBe(true);
    expect(czyPoTerminieRetencji("2024-10-01", "2024-10-01")).toBe(false);
  });

  it("odroczenie 12 miesięcy, sesje 90 dni, audyt 12 miesięcy", () => {
    expect(dataOdroczenia(TERAZ).toISOString()).toBe("2027-10-01T05:00:00.000Z");
    expect(progSesji(TERAZ).toISOString()).toBe("2026-07-03T05:00:00.000Z");
    expect(progAudytu(TERAZ).toISOString()).toBe("2025-10-01T05:00:00.000Z");
  });
});

describe("podzielDoZgloszenia", () => {
  it("nowe bez przeglądu, ponowne po minionym odroczeniu; otwarte i odroczone pomijane", () => {
    const pakiety = [pakiet("a", "2024-01-31"), pakiet("b", "2024-02-29"), pakiet("c", "2024-03-31"), pakiet("d", "2024-04-30")];
    const przeglady: IstniejacyPrzeglad[] = [
      { packageId: "b", decision: null, keepUntil: null },
      { packageId: "c", decision: "zachowaj", keepUntil: "2026-09-30T00:00:00Z" },
      { packageId: "d", decision: "zachowaj", keepUntil: "2027-01-01T00:00:00Z" },
    ];
    const { nowe, ponowne } = podzielDoZgloszenia(pakiety, przeglady, TERAZ);
    expect(nowe.map((p) => p.id)).toEqual(["a"]);
    expect(ponowne.map((p) => p.id)).toEqual(["c"]);
  });
});

describe("uruchomCronRetencji", () => {
  it("zgłasza pakiety starsze niż próg, nie rusza młodszych, powiadamia raz, sprząta sesje i audyt", async () => {
    const { d, zgloszone, ponowione, powiadomienia } = zaleznosci([pakiet("stary", "2024-09-30"), pakiet("graniczny", "2024-10-01"), pakiet("mlody", "2026-08-31")]);
    const wynik = await uruchomCronRetencji(d);
    expect(wynik.prog).toBe("2024-10-01");
    expect(wynik.miesiace).toBe(24);
    expect(zgloszone).toEqual(["stary"]);
    expect(ponowione).toEqual([]);
    expect(powiadomienia).toEqual([1]);
    expect(wynik).toMatchObject({ sprawdzone: 1, zgloszone: ["stary"], sesjeUsuniete: 7, audytUsuniety: 120 });
  });

  it("drugi przebieg nie zgłasza drugi raz i nie powiadamia, gdy nie ma nic nowego", async () => {
    const { d, zgloszone, powiadomienia } = zaleznosci([pakiet("stary", "2024-09-30")], [{ packageId: "stary", decision: null, keepUntil: null }]);
    const wynik = await uruchomCronRetencji(d);
    expect(zgloszone).toEqual([]);
    expect(powiadomienia).toEqual([]);
    expect(wynik.zgloszone).toEqual([]);
  });

  it("odroczony pakiet wraca po terminie odroczenia jako ponowny", async () => {
    const { d, ponowione, powiadomienia } = zaleznosci([pakiet("stary", "2024-09-30")], [{ packageId: "stary", decision: "zachowaj", keepUntil: "2026-09-01T00:00:00Z" }]);
    const wynik = await uruchomCronRetencji(d);
    expect(ponowione).toEqual(["stary"]);
    expect(powiadomienia).toEqual([1]);
    expect(wynik.ponowione).toEqual(["stary"]);
  });

  it("równoległy przebieg, który przegrał wyścig o wiersz, nie liczy zgłoszenia i nie powiadamia", async () => {
    const { d, powiadomienia } = zaleznosci([pakiet("stary", "2024-09-30")]);
    d.zglos = async () => false;
    const wynik = await uruchomCronRetencji(d);
    expect(wynik.zgloszone).toEqual([]);
    expect(powiadomienia).toEqual([]);
  });

  it("ustawienie retention_months zmienia próg; śmieci w ustawieniu wracają do 24", async () => {
    const krotka = zaleznosci([pakiet("p", "2025-08-31")], [], 12);
    expect((await uruchomCronRetencji(krotka.d)).zgloszone).toEqual(["p"]);
    const zepsute = zaleznosci([pakiet("p", "2025-08-31")], [], Number.NaN);
    const wynik = await uruchomCronRetencji(zepsute.d);
    expect(wynik.miesiace).toBe(24);
    expect(wynik.zgloszone).toEqual([]);
  });
});
