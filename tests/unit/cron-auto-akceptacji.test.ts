import { describe, expect, it } from "vitest";
import { uruchomCronAutoAkceptacji, type PakietWCronie, type ZaleznosciCrona } from "@/lib/pakiety/cron-auto-akceptacji";
import type { NoweZdarzenie, WynikPrzejscia } from "@/lib/pakiety/przejscia";

const TERAZ = new Date("2026-09-07T12:00:00+02:00");
const H = 3_600_000;

function pakiet(id: string, nadpisania: Partial<PakietWCronie> = {}): PakietWCronie {
  return {
    id,
    clientId: "k1",
    status: "do_akceptacji",
    round: 1,
    tytul: "Materiały - wrzesień 2026",
    okres: { rok: 2026, miesiac: 9 },
    autoApproveEnabled: true,
    autoApproveAt: new Date(TERAZ.getTime() + 48 * H).toISOString(),
    submittedAt: new Date(TERAZ.getTime() - 24 * H).toISOString(),
    firstOpenedAt: new Date(TERAZ.getTime() - 20 * H).toISOString(),
    klient: { slug: "nova-sushi", name: "Nova Sushi", slackChannel: "#nova-sushi", autoApproveHours: null, autoApproveDefault: true },
    ...nadpisania,
  };
}

function zaleznosci(pakiety: PakietWCronie[], odpowiedzi: Record<string, WynikPrzejscia> = {}, wyslane: string[] = []) {
  const outbox: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const zdarzenia: NoweZdarzenie[] = [];
  const wywolania: string[] = [];
  const juzWyslane = new Set(wyslane);
  const d: ZaleznosciCrona = {
    pobierzDoAkceptacji: async () => pakiety,
    autoAkceptuj: async (id) => {
      wywolania.push(id);
      return odpowiedzi[id] ?? { ok: true, status: "zaakceptowany", runda: 1, autoApproveAt: null };
    },
    czyWyslano: async (event, id, runda) => juzWyslane.has(`${event}/${id}/${runda}`),
    dodajDoOutbox: async (event, payload) => {
      outbox.push({ event, payload });
      juzWyslane.add(`${event}/${String(payload.package_id)}/${String(payload.round)}`);
    },
    dodajZdarzenie: async (z) => {
      zdarzenia.push(z);
    },
    adresPakietu: (p) => `https://panel.test/zespol/klienci/${p.klient.slug}/pakiety/${p.id}`,
    teraz: () => TERAZ,
  };
  return { d, outbox, zdarzenia, wywolania };
}

describe("cron auto-akceptacji (kryterium 11)", () => {
  it("akceptuje pakiet po terminie, a przed terminem nie rusza", async () => {
    const poTerminie = pakiet("p1", { autoApproveAt: new Date(TERAZ.getTime() - 1).toISOString() });
    const przedTerminem = pakiet("p2", { autoApproveAt: new Date(TERAZ.getTime() + 30 * H).toISOString() });
    const { d, wywolania } = zaleznosci([poTerminie, przedTerminem]);
    const wynik = await uruchomCronAutoAkceptacji(d);
    expect(wynik.sprawdzone).toBe(2);
    expect(wynik.zaakceptowane).toEqual(["p1"]);
    expect(wywolania).toEqual(["p1"]);
  });

  it("pomija pakiet z wyłączoną flagą, nawet po terminie", async () => {
    const { d, wywolania, outbox } = zaleznosci([pakiet("p1", { autoApproveEnabled: false, autoApproveAt: new Date(TERAZ.getTime() - H).toISOString() })]);
    const wynik = await uruchomCronAutoAkceptacji(d);
    expect(wynik.zaakceptowane).toEqual([]);
    expect(wywolania).toEqual([]);
    expect(outbox).toEqual([]);
  });

  it("nierozwiązane uwagi: zdarzenie auto_wstrzymana i pakiet.auto_wstrzymana_uwagi tylko raz na rundę", async () => {
    const p = pakiet("p1", { autoApproveAt: new Date(TERAZ.getTime() - H).toISOString() });
    const { d, outbox, zdarzenia } = zaleznosci([p], { p1: { ok: false, powod: "nierozwiazane_uwagi", uwagi: 2 } });
    const pierwszy = await uruchomCronAutoAkceptacji(d);
    expect(pierwszy.wstrzymane).toEqual(["p1"]);
    expect(zdarzenia).toEqual([expect.objectContaining({ package_id: "p1", kind: "auto_wstrzymana", actor_kind: "system", payload: expect.objectContaining({ round: 1, uwagi: 2 }) })]);
    expect(outbox).toEqual([expect.objectContaining({ event: "pakiet.auto_wstrzymana_uwagi", payload: expect.objectContaining({ package_id: "p1", uwagi: 2 }) })]);
    expect(String(outbox[0]?.payload.summary)).toContain("nierozwiązane uwagi");

    const drugi = await uruchomCronAutoAkceptacji(d);
    expect(drugi.wstrzymane).toEqual(["p1"]);
    expect(zdarzenia).toHaveLength(1);
    expect(outbox).toHaveLength(1);
  });

  it("24 godziny przed terminem wysyła pakiet.auto_za_24h raz na rundę", async () => {
    const p = pakiet("p1", { autoApproveAt: new Date(TERAZ.getTime() + 20 * H).toISOString() });
    const { d, outbox } = zaleznosci([p]);
    expect((await uruchomCronAutoAkceptacji(d)).za24h).toEqual(["p1"]);
    expect(outbox).toEqual([expect.objectContaining({ event: "pakiet.auto_za_24h" })]);
    expect((await uruchomCronAutoAkceptacji(d)).za24h).toEqual([]);
    expect(outbox).toHaveLength(1);
  });

  it("nie wysyła auto_za_24h, gdy do terminu zostało więcej niż 24 h", async () => {
    const { d, outbox } = zaleznosci([pakiet("p1", { autoApproveAt: new Date(TERAZ.getTime() + 25 * H).toISOString() })]);
    await uruchomCronAutoAkceptacji(d);
    expect(outbox).toEqual([]);
  });

  it("pakiet nieotwarty 24 h po wysyłce: pakiet.nieotwarty_po_24h raz; otwarty nie dostaje zdarzenia", async () => {
    const nieotwarty = pakiet("p1", { firstOpenedAt: null, submittedAt: new Date(TERAZ.getTime() - 25 * H).toISOString() });
    const otwarty = pakiet("p2", { submittedAt: new Date(TERAZ.getTime() - 25 * H).toISOString() });
    const swiezy = pakiet("p3", { firstOpenedAt: null, submittedAt: new Date(TERAZ.getTime() - 2 * H).toISOString() });
    const { d, outbox } = zaleznosci([nieotwarty, otwarty, swiezy]);
    expect((await uruchomCronAutoAkceptacji(d)).nieotwarte).toEqual(["p1"]);
    expect(outbox.map((o) => o.event)).toEqual(["pakiet.nieotwarty_po_24h"]);
    expect((await uruchomCronAutoAkceptacji(d)).nieotwarte).toEqual([]);
  });

  it("błąd jednego pakietu nie zatrzymuje pozostałych", async () => {
    const a = pakiet("p1", { autoApproveAt: new Date(TERAZ.getTime() - H).toISOString() });
    const b = pakiet("p2", { autoApproveAt: new Date(TERAZ.getTime() - H).toISOString() });
    const { d } = zaleznosci([a, b], { p1: { ok: false, powod: "konflikt" } });
    const wynik = await uruchomCronAutoAkceptacji(d);
    expect(wynik.bledy).toEqual([{ pakietId: "p1", powod: "konflikt" }]);
    expect(wynik.zaakceptowane).toEqual(["p2"]);
  });
});
