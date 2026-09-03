import { describe, expect, it } from "vitest";
import type { UstawieniaAutoAkceptacji } from "@/lib/pakiety/auto-akceptacja";
import {
  REGULY,
  sprawdzRegule,
  wykonajPrzejscie,
  zbudujPayloadOutbox,
  type Aktor,
  type NoweZdarzenie,
  type PakietDoPrzejscia,
  type Przejscie,
  type StatusPakietu,
  type TypPrzejscia,
  type ZaleznosciPrzejsc,
  type ZmianyPakietu,
} from "@/lib/pakiety/przejscia";

const TERAZ = new Date("2026-09-04T10:30:00+02:00"); // piątek
const PAKIET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const KONTAKT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const KLIENT: Aktor = { rodzaj: "klient", contactId: KONTAKT_ID, linkId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", label: "Marek - właściciel", mozeAkceptowac: true };
const PODGLAD: Aktor = { ...KLIENT, mozeAkceptowac: false };
const ZESPOL: Aktor = { rodzaj: "zespol", memberId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Gosia" };
const SYSTEM: Aktor = { rodzaj: "system" };

function pakiet(nadpisania: Partial<PakietDoPrzejscia> = {}): PakietDoPrzejscia {
  return {
    id: PAKIET_ID,
    clientId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    status: "szkic",
    round: 1,
    tytul: "Materiały - wrzesień 2026",
    okres: { rok: 2026, miesiac: 9 },
    autoApproveEnabled: true,
    autoApproveAt: null,
    submittedAt: null,
    klient: { slug: "nova-sushi", name: "Nova Sushi", slackChannel: "#nova-sushi", autoApproveHours: null, autoApproveDefault: true },
    ...nadpisania,
  };
}

type Opcje = { uwagi?: number; nierozwiazane?: number; braki?: string[]; ostrzezenia?: string[]; konflikt?: boolean; ustawienia?: UstawieniaAutoAkceptacji };

function zaleznosci(p: PakietDoPrzejscia | null, opcje: Opcje = {}) {
  const zdarzenia: NoweZdarzenie[] = [];
  const outbox: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const zapisy: Array<{ zeStatusu: StatusPakietu; zmiany: ZmianyPakietu }> = [];
  const d: ZaleznosciPrzejsc = {
    pobierzPakiet: async () => p,
    zapiszPakiet: async (_id, zeStatusu, zmiany) => {
      if (opcje.konflikt) return false;
      zapisy.push({ zeStatusu, zmiany });
      return true;
    },
    dodajZdarzenie: async (z) => {
      zdarzenia.push(z);
    },
    dodajDoOutbox: async (event, payload) => {
      outbox.push({ event, payload });
    },
    liczUwagiKlienta: async (_id, _runda, tylkoNierozwiazane) => (tylkoNierozwiazane ? (opcje.nierozwiazane ?? 0) : (opcje.uwagi ?? 0)),
    sprawdzPrzedWysylka: async () => ({ braki: opcje.braki ?? [], ostrzezenia: opcje.ostrzezenia ?? [] }),
    pobierzMigawke: async () => ({ materialy: [{ id: "m1" }, { id: "m2" }] }),
    ustawienia: async () => opcje.ustawienia ?? { godziny: 72, dniRobocze: false },
    adresPakietu: (pk) => `https://panel.test/zespol/klienci/${pk.klient.slug}/pakiety/${pk.id}`,
    teraz: () => TERAZ,
  };
  return { d, zdarzenia, outbox, zapisy };
}

const STATUSY: StatusPakietu[] = ["szkic", "do_akceptacji", "poprawki", "zaakceptowany", "zaplanowany"];
const PRZEJSCIA: Przejscie[] = [
  { typ: "wyslij" },
  { typ: "wycofaj" },
  { typ: "akceptuj" },
  { typ: "auto_akceptuj" },
  { typ: "zglos_uwagi" },
  { typ: "wyslij_v2" },
  { typ: "cofnij_do_poprawek", powod: "Zła cena w poście 3" },
  { typ: "zaplanuj" },
];
const AKTORZY: Aktor[] = [KLIENT, ZESPOL, SYSTEM];

/** Dokładnie dziewięć wierszy tabeli z SPEC rozdz. 6.8. */
const DOZWOLONE: Array<[StatusPakietu, TypPrzejscia, Aktor["rodzaj"], StatusPakietu]> = [
  ["szkic", "wyslij", "zespol", "do_akceptacji"],
  ["do_akceptacji", "wycofaj", "zespol", "szkic"],
  ["do_akceptacji", "akceptuj", "klient", "zaakceptowany"],
  ["do_akceptacji", "auto_akceptuj", "system", "zaakceptowany"],
  ["do_akceptacji", "zglos_uwagi", "klient", "poprawki"],
  ["poprawki", "wyslij_v2", "zespol", "do_akceptacji"],
  ["zaakceptowany", "cofnij_do_poprawek", "zespol", "poprawki"],
  ["zaakceptowany", "zaplanuj", "zespol", "zaplanowany"],
  ["zaplanowany", "cofnij_do_poprawek", "zespol", "poprawki"],
];

describe("tabela przejść (SPEC rozdz. 6.8): 5 statusów × 8 przejść × 3 aktorów", () => {
  it("dopuszcza dokładnie dziewięć kombinacji i odrzuca pozostałe 111", () => {
    const dopuszczone: string[] = [];
    for (const status of STATUSY) {
      for (const przejscie of PRZEJSCIA) {
        for (const aktor of AKTORZY) {
          const wynik = sprawdzRegule(status, przejscie, aktor);
          const klucz = `${status}/${przejscie.typ}/${aktor.rodzaj}`;
          const oczekiwane = DOZWOLONE.find(([s, t, a]) => s === status && t === przejscie.typ && a === aktor.rodzaj);
          if (oczekiwane) {
            expect(wynik.ok, klucz).toBe(true);
            if (wynik.ok) expect(wynik.regula.do, klucz).toBe(oczekiwane[3]);
            dopuszczone.push(klucz);
          } else {
            expect(wynik.ok, klucz).toBe(false);
          }
        }
      }
    }
    expect(dopuszczone).toHaveLength(9);
  });

  it("rozróżnia zły status od złego aktora", () => {
    expect(sprawdzRegule("szkic", { typ: "akceptuj" }, KLIENT)).toMatchObject({ ok: false, powod: "niedozwolone_ze_statusu" });
    expect(sprawdzRegule("do_akceptacji", { typ: "akceptuj" }, ZESPOL)).toMatchObject({ ok: false, powod: "niewlasciwy_aktor" });
    expect(sprawdzRegule("do_akceptacji", { typ: "auto_akceptuj" }, KLIENT)).toMatchObject({ ok: false, powod: "niewlasciwy_aktor" });
    expect(sprawdzRegule("do_akceptacji", { typ: "wycofaj" }, KLIENT)).toMatchObject({ ok: false, powod: "niewlasciwy_aktor" });
  });

  it("link tylko do podglądu (can_approve = false) nie akceptuje, ale może zgłosić uwagi", () => {
    expect(sprawdzRegule("do_akceptacji", { typ: "akceptuj" }, PODGLAD)).toMatchObject({ ok: false, powod: "link_tylko_do_podgladu" });
    expect(sprawdzRegule("do_akceptacji", { typ: "zglos_uwagi" }, PODGLAD).ok).toBe(true);
  });

  it("round rośnie wyłącznie na poprawki → do_akceptacji, a zaplanowany nie ma wyjścia poza cofnięciem", () => {
    expect(REGULY.wyslij_v2.z).toEqual(["poprawki"]);
    expect(Object.values(REGULY).filter((r) => r.z.includes("zaplanowany")).map((r) => r.do)).toEqual(["poprawki"]);
  });
});

describe("wykonajPrzejscie: skutki każdego przejścia", () => {
  it("nie znaleziono pakietu", async () => {
    const { d } = zaleznosci(null);
    expect(await wykonajPrzejscie(PAKIET_ID, { typ: "wyslij" }, ZESPOL, d)).toEqual({ ok: false, powod: "nie_znaleziono" });
  });

  it("wyślij: submitted_at, auto_approve_at = teraz + 72 h (pełna godzina w górę), zdarzenie wyslany i pakiet.wyslany", async () => {
    const { d, zdarzenia, outbox, zapisy } = zaleznosci(pakiet());
    const wynik = await wykonajPrzejscie(PAKIET_ID, { typ: "wyslij" }, ZESPOL, d);
    expect(wynik).toMatchObject({ ok: true, status: "do_akceptacji", runda: 1 });
    expect(zapisy[0]?.zeStatusu).toBe("szkic");
    expect(zapisy[0]?.zmiany).toMatchObject({ status: "do_akceptacji", round: 1, submitted_at: TERAZ.toISOString(), auto_approve_enabled: true, auto_approve_at: new Date("2026-09-07T11:00:00+02:00").toISOString() });
    expect(zdarzenia).toHaveLength(1);
    expect(zdarzenia[0]).toMatchObject({ package_id: PAKIET_ID, kind: "wyslany", actor_kind: "zespol", actor_id: ZESPOL.rodzaj === "zespol" ? ZESPOL.memberId : null });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ event: "pakiet.wyslany", payload: { client_slug: "nova-sushi", client_name: "Nova Sushi", slack_channel: "#nova-sushi", period: "2026-09", actor: "Gosia", round: 1 } });
    expect(String(outbox[0]?.payload.url)).toContain("/zespol/klienci/nova-sushi/pakiety/");
    expect(String(outbox[0]?.payload.summary)).toContain("Nova Sushi");
  });

  it("wyślij liczy termin w dniach roboczych pon-sob po przełączeniu ustawienia (kryterium 11)", async () => {
    const { d, zapisy } = zaleznosci(pakiet(), { ustawienia: { godziny: 72, dniRobocze: true } });
    await wykonajPrzejscie(PAKIET_ID, { typ: "wyslij" }, ZESPOL, d);
    expect(zapisy[0]?.zmiany.auto_approve_at).toBe(new Date("2026-09-08T11:00:00+02:00").toISOString());
  });

  it("wyślij bierze godziny per klient zamiast globalnych", async () => {
    const { d, zapisy } = zaleznosci(pakiet({ klient: { ...pakiet().klient, autoApproveHours: 24 } }));
    await wykonajPrzejscie(PAKIET_ID, { typ: "wyslij" }, ZESPOL, d);
    expect(zapisy[0]?.zmiany.auto_approve_at).toBe(new Date("2026-09-05T11:00:00+02:00").toISOString());
  });

  it("wyślij z wyłączoną auto-akceptacją (checkbox albo karta klienta) nie ustawia terminu", async () => {
    const a = zaleznosci(pakiet());
    await wykonajPrzejscie(PAKIET_ID, { typ: "wyslij", autoAkceptacja: false }, ZESPOL, a.d);
    expect(a.zapisy[0]?.zmiany).toMatchObject({ auto_approve_enabled: false, auto_approve_at: null });
    const b = zaleznosci(pakiet({ klient: { ...pakiet().klient, autoApproveDefault: false } }));
    await wykonajPrzejscie(PAKIET_ID, { typ: "wyslij" }, ZESPOL, b.d);
    expect(b.zapisy[0]?.zmiany).toMatchObject({ auto_approve_enabled: false, auto_approve_at: null });
  });

  it("wyślij z brakami (post bez daty) jest zablokowane z listą braków, bez zapisu i bez zdarzeń (kryterium 21)", async () => {
    const { d, zdarzenia, outbox, zapisy } = zaleznosci(pakiet(), { braki: ["Post 3 - tiramisu: brak daty publikacji"], ostrzezenia: ["bez kampanii"] });
    const wynik = await wykonajPrzejscie(PAKIET_ID, { typ: "wyslij" }, ZESPOL, d);
    expect(wynik).toEqual({ ok: false, powod: "braki_w_materialach", braki: ["Post 3 - tiramisu: brak daty publikacji"], ostrzezenia: ["bez kampanii"] });
    expect(zapisy).toHaveLength(0);
    expect(zdarzenia).toHaveLength(0);
    expect(outbox).toHaveLength(0);
  });

  it("wyślij z samymi ostrzeżeniami (pakiet bez kampanii) przechodzi, ostrzeżenie ląduje w zdarzeniu", async () => {
    const { d, zdarzenia } = zaleznosci(pakiet(), { ostrzezenia: ["bez kampanii"] });
    expect((await wykonajPrzejscie(PAKIET_ID, { typ: "wyslij" }, ZESPOL, d)).ok).toBe(true);
    expect(zdarzenia[0]?.payload).toMatchObject({ ostrzezenia: ["bez kampanii"] });
  });

  it("wycofaj do szkicu zeruje submitted_at i auto_approve_at, round bez zmian, zdarzenie wycofany i pakiet.wycofany", async () => {
    const { d, zdarzenia, outbox, zapisy } = zaleznosci(pakiet({ status: "do_akceptacji", round: 2, submittedAt: TERAZ.toISOString(), autoApproveAt: "2026-09-07T11:00:00.000Z" }));
    const wynik = await wykonajPrzejscie(PAKIET_ID, { typ: "wycofaj" }, ZESPOL, d);
    expect(wynik).toMatchObject({ ok: true, status: "szkic", runda: 2, autoApproveAt: null });
    expect(zapisy[0]?.zmiany).toEqual({ status: "szkic", submitted_at: null, auto_approve_at: null });
    expect(zdarzenia[0]?.kind).toBe("wycofany");
    expect(outbox[0]?.event).toBe("pakiet.wycofany");
  });

  it("akceptuję wszystko: status, data, osoba, approval_kind reczna, migawka w zdarzeniu, pakiet.zaakceptowany (kryterium 8)", async () => {
    const { d, zdarzenia, outbox, zapisy } = zaleznosci(pakiet({ status: "do_akceptacji", autoApproveAt: "2026-09-07T09:00:00.000Z" }), { nierozwiazane: 2 });
    const wynik = await wykonajPrzejscie(PAKIET_ID, { typ: "akceptuj" }, KLIENT, d);
    expect(wynik).toMatchObject({ ok: true, status: "zaakceptowany" });
    expect(zapisy[0]?.zmiany).toEqual({ status: "zaakceptowany", approved_at: TERAZ.toISOString(), approved_by_contact_id: KONTAKT_ID, approval_kind: "reczna" });
    expect(zdarzenia[0]).toMatchObject({ kind: "zaakceptowany", actor_kind: "klient", actor_id: KONTAKT_ID });
    expect(zdarzenia[0]?.payload).toMatchObject({ migawka: { materialy: [{ id: "m1" }, { id: "m2" }] }, nierozwiazane_uwagi: 2 });
    expect(outbox[0]).toMatchObject({ event: "pakiet.zaakceptowany", payload: { actor: "Marek - właściciel", nierozwiazane_uwagi: 2 } });
  });

  it("nierozwiązane uwagi nie blokują ręcznej akceptacji (tylko ostrzegają), ale blokują automatyczną", async () => {
    const reczna = zaleznosci(pakiet({ status: "do_akceptacji" }), { nierozwiazane: 3 });
    expect((await wykonajPrzejscie(PAKIET_ID, { typ: "akceptuj" }, KLIENT, reczna.d)).ok).toBe(true);
    const auto = zaleznosci(pakiet({ status: "do_akceptacji", autoApproveAt: "2026-09-04T07:00:00.000Z" }), { nierozwiazane: 3 });
    expect(await wykonajPrzejscie(PAKIET_ID, { typ: "auto_akceptuj" }, SYSTEM, auto.d)).toEqual({ ok: false, powod: "nierozwiazane_uwagi", uwagi: 3 });
    expect(auto.zapisy).toHaveLength(0);
  });

  it("auto-akceptacja po terminie: approval_kind automatyczna, bez osoby, zdarzenie auto_zaakceptowany i pakiet.zaakceptowany_auto (kryterium 11)", async () => {
    const { d, zdarzenia, outbox, zapisy } = zaleznosci(pakiet({ status: "do_akceptacji", autoApproveAt: "2026-09-04T08:00:00.000Z" }));
    const wynik = await wykonajPrzejscie(PAKIET_ID, { typ: "auto_akceptuj" }, SYSTEM, d);
    expect(wynik).toMatchObject({ ok: true, status: "zaakceptowany" });
    expect(zapisy[0]?.zmiany).toEqual({ status: "zaakceptowany", approved_at: TERAZ.toISOString(), approved_by_contact_id: null, approval_kind: "automatyczna" });
    expect(zdarzenia[0]).toMatchObject({ kind: "auto_zaakceptowany", actor_kind: "system", actor_id: null });
    expect(outbox[0]?.event).toBe("pakiet.zaakceptowany_auto");
  });

  it("auto-akceptacja nie rusza pakietu z wyłączoną flagą ani przed terminem (kryterium 11)", async () => {
    const wylaczona = zaleznosci(pakiet({ status: "do_akceptacji", autoApproveEnabled: false, autoApproveAt: null }));
    expect(await wykonajPrzejscie(PAKIET_ID, { typ: "auto_akceptuj" }, SYSTEM, wylaczona.d)).toEqual({ ok: false, powod: "auto_wylaczona" });
    const przedTerminem = zaleznosci(pakiet({ status: "do_akceptacji", autoApproveAt: "2026-09-07T09:00:00.000Z" }));
    expect(await wykonajPrzejscie(PAKIET_ID, { typ: "auto_akceptuj" }, SYSTEM, przedTerminem.d)).toEqual({ ok: false, powod: "termin_nie_minal" });
    const wPoprawkach = zaleznosci(pakiet({ status: "poprawki", autoApproveAt: "2026-09-04T08:00:00.000Z" }));
    expect(await wykonajPrzejscie(PAKIET_ID, { typ: "auto_akceptuj" }, SYSTEM, wPoprawkach.d)).toEqual({ ok: false, powod: "niedozwolone_ze_statusu" });
  });

  it("zgłaszam uwagi bez komentarza jest zablokowane z podpowiedzią (kryterium 9)", async () => {
    const { d, zapisy } = zaleznosci(pakiet({ status: "do_akceptacji" }), { uwagi: 0 });
    expect(await wykonajPrzejscie(PAKIET_ID, { typ: "zglos_uwagi" }, KLIENT, d)).toEqual({ ok: false, powod: "brak_uwag" });
    expect(zapisy).toHaveLength(0);
  });

  it("zgłaszam uwagi zatrzymuje licznik: auto_approve_at = null, status poprawki, pakiet.poprawki z liczbą uwag (kryterium 10)", async () => {
    const { d, zdarzenia, outbox, zapisy } = zaleznosci(pakiet({ status: "do_akceptacji", autoApproveAt: "2026-09-07T09:00:00.000Z" }), { uwagi: 2 });
    const wynik = await wykonajPrzejscie(PAKIET_ID, { typ: "zglos_uwagi" }, KLIENT, d);
    expect(wynik).toEqual({ ok: true, status: "poprawki", runda: 1, autoApproveAt: null });
    expect(zapisy[0]?.zmiany).toEqual({ status: "poprawki", auto_approve_at: null });
    expect(zdarzenia[0]).toMatchObject({ kind: "poprawki", payload: { uwagi: 2 } });
    expect(outbox[0]).toMatchObject({ event: "pakiet.poprawki", payload: { uwagi: 2 } });
    expect(String(outbox[0]?.payload.summary)).toContain("2");
  });

  it("wyślij v2 podbija round, restartuje licznik i zeruje ślady poprzedniej akceptacji (kryterium 12)", async () => {
    const { d, zdarzenia, outbox, zapisy } = zaleznosci(pakiet({ status: "poprawki", round: 1, autoApproveAt: null, autoApproveEnabled: true }));
    const wynik = await wykonajPrzejscie(PAKIET_ID, { typ: "wyslij_v2" }, ZESPOL, d);
    expect(wynik).toMatchObject({ ok: true, status: "do_akceptacji", runda: 2, autoApproveAt: new Date("2026-09-07T11:00:00+02:00").toISOString() });
    expect(zapisy[0]?.zmiany).toMatchObject({ round: 2, submitted_at: TERAZ.toISOString(), approved_at: null, approval_kind: null, changed_after_approval: false });
    expect(zdarzenia[0]).toMatchObject({ kind: "wyslany", payload: { round: 2 } });
    expect(outbox[0]?.payload).toMatchObject({ event: "pakiet.wyslany", round: 2 });
    expect(String(outbox[0]?.payload.summary)).toContain("wersja 2");
  });

  it("wyślij v2 zachowuje wyłączoną auto-akceptację z poprzedniej rundy, chyba że zespół ją włączy", async () => {
    const a = zaleznosci(pakiet({ status: "poprawki", autoApproveEnabled: false }));
    await wykonajPrzejscie(PAKIET_ID, { typ: "wyslij_v2" }, ZESPOL, a.d);
    expect(a.zapisy[0]?.zmiany).toMatchObject({ auto_approve_enabled: false, auto_approve_at: null });
    const b = zaleznosci(pakiet({ status: "poprawki", autoApproveEnabled: false }));
    await wykonajPrzejscie(PAKIET_ID, { typ: "wyslij_v2", autoAkceptacja: true }, ZESPOL, b.d);
    expect(b.zapisy[0]?.zmiany.auto_approve_enabled).toBe(true);
    expect(b.zapisy[0]?.zmiany.auto_approve_at).not.toBeNull();
  });

  it("cofnij do poprawek wymaga powodu", async () => {
    const { d, zapisy } = zaleznosci(pakiet({ status: "zaakceptowany" }));
    expect(await wykonajPrzejscie(PAKIET_ID, { typ: "cofnij_do_poprawek", powod: "   " }, ZESPOL, d)).toEqual({ ok: false, powod: "brak_powodu" });
    expect(zapisy).toHaveLength(0);
  });

  it("cofnij do poprawek (z zaakceptowany i z zaplanowany) kasuje akceptację, zapisuje powód i wysyła pakiet.cofniety_do_poprawek (1.4, poz. 31)", async () => {
    for (const status of ["zaakceptowany", "zaplanowany"] as const) {
      const { d, zdarzenia, outbox, zapisy } = zaleznosci(pakiet({ status, autoApproveAt: "2026-09-07T09:00:00.000Z" }));
      const wynik = await wykonajPrzejscie(PAKIET_ID, { typ: "cofnij_do_poprawek", powod: "Zła cena w poście 3" }, ZESPOL, d);
      expect(wynik).toMatchObject({ ok: true, status: "poprawki", autoApproveAt: null });
      expect(zapisy[0]?.zmiany).toEqual({ status: "poprawki", auto_approve_at: null, approved_at: null, approved_by_contact_id: null, approval_kind: null });
      expect(zdarzenia[0]).toMatchObject({ kind: "cofniety_do_poprawek", payload: { powod: "Zła cena w poście 3", ze_statusu: status } });
      expect(outbox[0]).toMatchObject({ event: "pakiet.cofniety_do_poprawek", payload: { powod: "Zła cena w poście 3" } });
      expect(String(outbox[0]?.payload.summary)).toContain("Zła cena w poście 3");
    }
  });

  it("zaplanowano: zdarzenie zaplanowany, bez wpisu w outbox (nie ma go w rozdz. 15)", async () => {
    const { d, zdarzenia, outbox } = zaleznosci(pakiet({ status: "zaakceptowany" }));
    expect(await wykonajPrzejscie(PAKIET_ID, { typ: "zaplanuj" }, ZESPOL, d)).toMatchObject({ ok: true, status: "zaplanowany" });
    expect(zdarzenia[0]?.kind).toBe("zaplanowany");
    expect(outbox).toHaveLength(0);
  });

  it("konflikt: gdy status zmienił się w międzyczasie, nie ma zdarzeń ani outboxu", async () => {
    const { d, zdarzenia, outbox } = zaleznosci(pakiet({ status: "do_akceptacji" }), { konflikt: true });
    expect(await wykonajPrzejscie(PAKIET_ID, { typ: "akceptuj" }, KLIENT, d)).toEqual({ ok: false, powod: "konflikt" });
    expect(zdarzenia).toHaveLength(0);
    expect(outbox).toHaveLength(0);
  });

  it("każde zdarzenie niesie status wyjściowy, docelowy i etykietę aktora", async () => {
    const { d, zdarzenia } = zaleznosci(pakiet({ status: "do_akceptacji", autoApproveAt: "2026-09-04T08:00:00.000Z" }));
    await wykonajPrzejscie(PAKIET_ID, { typ: "auto_akceptuj" }, SYSTEM, d);
    expect(zdarzenia[0]?.payload).toMatchObject({ ze_statusu: "do_akceptacji", do_statusu: "zaakceptowany", aktor: "panel (automatycznie)" });
  });
});

describe("ciało webhooka (SPEC rozdz. 15)", () => {
  it("ma wszystkie pola z przykładu w spec-u", () => {
    const payload = zbudujPayloadOutbox("pakiet.zaakceptowany", pakiet(), KLIENT, 1, "https://panel.test/x");
    expect(payload).toMatchObject({
      event: "pakiet.zaakceptowany",
      client_slug: "nova-sushi",
      client_name: "Nova Sushi",
      slack_channel: "#nova-sushi",
      period: "2026-09",
      actor: "Marek - właściciel",
      url: "https://panel.test/x",
      summary: "Marek - właściciel (Nova Sushi) zaakceptował(a) materiały na wrzesień 2026.",
      package_id: PAKIET_ID,
      round: 1,
    });
  });
});
