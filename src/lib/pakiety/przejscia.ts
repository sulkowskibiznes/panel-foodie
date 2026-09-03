/**
 * Maszyna stanów pakietu (SPEC rozdz. 6.8; CLAUDE.md, zasada 9). JEDYNE miejsce, które zmienia
 * `packages.status`, zapisuje `package_events` i wrzuca zdarzenie do `outbox`.
 *
 * Czysta logika z wstrzykiwanymi zależnościami (jak lib/logowanie-klienta.ts): testy jednostkowe
 * sprawdzają wszystkie przejścia, także niedozwolone, bez bazy. Podpięcie do Supabase jest
 * w lib/pakiety/baza.ts (`zmienStatusPakietu`) i tylko przez nie wolno wołać tę maszynę z handlerów.
 */
import { copy } from "@/lib/copy";
import type { Database } from "@/lib/db-types";
import { etykietaOkresu } from "@/lib/format";
import { wyliczAutoAkceptacje, type UstawieniaAutoAkceptacji } from "@/lib/pakiety/auto-akceptacja";
import type { ZdarzenieOutbox } from "@/lib/zdarzenia";

export type StatusPakietu = Database["public"]["Enums"]["package_status"];
export type RodzajZdarzeniaPakietu = Database["public"]["Enums"]["package_event_kind"];
export type RodzajAktora = Database["public"]["Enums"]["actor_kind"];
export type RodzajAkceptacji = Database["public"]["Enums"]["approval_kind"];

export type Aktor =
  | { rodzaj: "klient"; contactId: string | null; linkId: string; label: string; mozeAkceptowac: boolean }
  | { rodzaj: "zespol"; memberId: string; name: string }
  | { rodzaj: "system" };

export type Przejscie =
  /** „Wyślij do akceptacji" (szkic → do_akceptacji, v1). `autoAkceptacja` z checkboxa przy wysyłce; domyślnie z karty klienta. */
  | { typ: "wyslij"; autoAkceptacja?: boolean }
  /** „Wycofaj do szkicu" (zły miesiąc, za wcześnie). */
  | { typ: "wycofaj" }
  /** „Akceptuję wszystko" (klient). */
  | { typ: "akceptuj" }
  /** Cron po upływie `auto_approve_at`. */
  | { typ: "auto_akceptuj" }
  /** „Zgłaszam uwagi" (klient), wymaga co najmniej jednego komentarza w bieżącej rundzie. */
  | { typ: "zglos_uwagi" }
  /** „Wyślij v2" (poprawki → do_akceptacji), `round += 1`, licznik od nowa. Działa też bez zmian w materiałach. */
  | { typ: "wyslij_v2"; autoAkceptacja?: boolean }
  /** „Cofnij do poprawek" z obowiązkowym powodem; klient dostaje baner i zdarzenie (1.4, poz. 31). */
  | { typ: "cofnij_do_poprawek"; powod: string }
  /** „Zaplanowano" po ustawieniu publikacji w Meta Business Suite. */
  | { typ: "zaplanuj" };

export type TypPrzejscia = Przejscie["typ"];

export type Regula = {
  z: readonly StatusPakietu[];
  do: StatusPakietu;
  kto: readonly RodzajAktora[];
  zdarzenie: RodzajZdarzeniaPakietu;
  outbox: ZdarzenieOutbox | null;
};

/** Pełna lista dozwolonych przejść z SPEC rozdz. 6.8. Wszystko inne maszyna odrzuca. */
export const REGULY: Record<TypPrzejscia, Regula> = {
  wyslij: { z: ["szkic"], do: "do_akceptacji", kto: ["zespol"], zdarzenie: "wyslany", outbox: "pakiet.wyslany" },
  wycofaj: { z: ["do_akceptacji"], do: "szkic", kto: ["zespol"], zdarzenie: "wycofany", outbox: "pakiet.wycofany" },
  akceptuj: { z: ["do_akceptacji"], do: "zaakceptowany", kto: ["klient"], zdarzenie: "zaakceptowany", outbox: "pakiet.zaakceptowany" },
  auto_akceptuj: { z: ["do_akceptacji"], do: "zaakceptowany", kto: ["system"], zdarzenie: "auto_zaakceptowany", outbox: "pakiet.zaakceptowany_auto" },
  zglos_uwagi: { z: ["do_akceptacji"], do: "poprawki", kto: ["klient"], zdarzenie: "poprawki", outbox: "pakiet.poprawki" },
  wyslij_v2: { z: ["poprawki"], do: "do_akceptacji", kto: ["zespol"], zdarzenie: "wyslany", outbox: "pakiet.wyslany" },
  cofnij_do_poprawek: { z: ["zaakceptowany", "zaplanowany"], do: "poprawki", kto: ["zespol"], zdarzenie: "cofniety_do_poprawek", outbox: "pakiet.cofniety_do_poprawek" },
  zaplanuj: { z: ["zaakceptowany"], do: "zaplanowany", kto: ["zespol"], zdarzenie: "zaplanowany", outbox: null },
};

export type PowodOdmowy = keyof typeof copy.przejscia.odmowa;

export type PakietDoPrzejscia = {
  id: string;
  clientId: string;
  status: StatusPakietu;
  round: number;
  tytul: string;
  okres: { rok: number; miesiac: number };
  autoApproveEnabled: boolean;
  autoApproveAt: string | null;
  submittedAt: string | null;
  klient: { slug: string; name: string; slackChannel: string | null; autoApproveHours: number | null; autoApproveDefault: boolean };
};

export type ZmianyPakietu = Partial<
  Pick<
    Database["public"]["Tables"]["packages"]["Update"],
    "status" | "round" | "submitted_at" | "auto_approve_enabled" | "auto_approve_at" | "approved_at" | "approved_by_contact_id" | "approval_kind" | "changed_after_approval"
  >
>;

export type NoweZdarzenie = {
  package_id: string;
  kind: RodzajZdarzeniaPakietu;
  actor_kind: RodzajAktora;
  actor_id: string | null;
  payload: Record<string, unknown>;
};

export type KontrolaWysylki = { braki: string[]; ostrzezenia: string[] };

export type ZaleznosciPrzejsc = {
  pobierzPakiet(id: string): Promise<PakietDoPrzejscia | null>;
  /** Zapis z warunkiem na status wyjściowy. `false` = ktoś w międzyczasie zmienił status (konflikt). */
  zapiszPakiet(id: string, zeStatusu: StatusPakietu, zmiany: ZmianyPakietu): Promise<boolean>;
  dodajZdarzenie(zdarzenie: NoweZdarzenie): Promise<void>;
  dodajDoOutbox(event: ZdarzenieOutbox, payload: Record<string, unknown>): Promise<void>;
  /** Komentarze klienta w danej rundzie; `tylkoNierozwiazane` = bez `resolved_at`. */
  liczUwagiKlienta(pakietId: string, runda: number, tylkoNierozwiazane: boolean): Promise<number>;
  /** Walidacja z rozdz. 8: braki blokują wysyłkę, ostrzeżenia idą do zdarzenia. */
  sprawdzPrzedWysylka(pakietId: string): Promise<KontrolaWysylki>;
  /** Migawka materiałów do zdarzenia `zaakceptowany`: dowód, co dokładnie zaakceptowano (SPEC rozdz. 3). */
  pobierzMigawke(pakietId: string): Promise<Record<string, unknown>>;
  ustawienia(): Promise<UstawieniaAutoAkceptacji>;
  adresPakietu(pakiet: PakietDoPrzejscia): string;
  teraz(): Date;
};

export type WynikPrzejscia =
  | { ok: true; status: StatusPakietu; runda: number; autoApproveAt: string | null }
  | { ok: false; powod: PowodOdmowy; braki?: string[]; ostrzezenia?: string[]; uwagi?: number };

/** Sama tabela przejść: czy z tego statusu, tym przejściem, ten aktor. Bez warunków dodatkowych. */
export function sprawdzRegule(status: StatusPakietu, przejscie: Przejscie, aktor: Aktor): { ok: true; regula: Regula } | { ok: false; powod: PowodOdmowy } {
  const regula = REGULY[przejscie.typ];
  if (!regula.z.includes(status)) return { ok: false, powod: "niedozwolone_ze_statusu" };
  if (!regula.kto.includes(aktor.rodzaj)) return { ok: false, powod: "niewlasciwy_aktor" };
  if (przejscie.typ === "akceptuj" && aktor.rodzaj === "klient" && !aktor.mozeAkceptowac) return { ok: false, powod: "link_tylko_do_podgladu" };
  return { ok: true, regula };
}

export function idAktora(aktor: Aktor): string | null {
  switch (aktor.rodzaj) {
    case "klient":
      return aktor.contactId;
    case "zespol":
      return aktor.memberId;
    case "system":
      return null;
  }
}

export function etykietaAktora(aktor: Aktor): string {
  switch (aktor.rodzaj) {
    case "klient":
      return aktor.label;
    case "zespol":
      return aktor.name;
    case "system":
      return copy.zdarzenia.system;
  }
}

function wypelnij(szablon: string, wartosci: Record<string, string | number | null | undefined>): string {
  return szablon.replace(/\{(\w+)\}/g, (_, klucz: string) => String(wartosci[klucz] ?? ""));
}

export function okresPakietu(pakiet: Pick<PakietDoPrzejscia, "okres">): string {
  return `${pakiet.okres.rok}-${String(pakiet.okres.miesiac).padStart(2, "0")}`;
}

/** Ciało webhooka z SPEC rozdz. 15 + pola pomocnicze (package_id, round) do deduplikacji w cronie. */
export function zbudujPayloadOutbox(
  event: ZdarzenieOutbox,
  pakiet: PakietDoPrzejscia,
  aktor: Aktor,
  runda: number,
  url: string,
  dodatkowe: Record<string, unknown> = {},
): Record<string, unknown> {
  const osoba = etykietaAktora(aktor);
  const summary = wypelnij(copy.zdarzenia.podsumowanie[event as keyof typeof copy.zdarzenia.podsumowanie] ?? event, {
    klient: pakiet.klient.name,
    okres: etykietaOkresu(pakiet.okres.rok, pakiet.okres.miesiac),
    osoba,
    wersja: runda,
    uwagi: typeof dodatkowe.uwagi === "number" ? dodatkowe.uwagi : undefined,
    powod: typeof dodatkowe.powod === "string" ? dodatkowe.powod : undefined,
  });
  return {
    event,
    client_slug: pakiet.klient.slug,
    client_name: pakiet.klient.name,
    slack_channel: pakiet.klient.slackChannel,
    period: okresPakietu(pakiet),
    actor: osoba,
    url,
    summary,
    package_id: pakiet.id,
    round: runda,
    ...dodatkowe,
  };
}

/**
 * Wykonuje przejście: sprawdza regułę i warunki dodatkowe, zapisuje pakiet (z warunkiem na status
 * wyjściowy), zdarzenie w `package_events` i, gdy rozdz. 15 tego wymaga, wiersz w `outbox`.
 * Audyt (z IP i UA) zostaje po stronie akcji, bo maszyna nie zna żądania HTTP.
 */
export async function wykonajPrzejscie(pakietId: string, przejscie: Przejscie, aktor: Aktor, d: ZaleznosciPrzejsc): Promise<WynikPrzejscia> {
  const pakiet = await d.pobierzPakiet(pakietId);
  if (!pakiet) return { ok: false, powod: "nie_znaleziono" };
  const sprawdzenie = sprawdzRegule(pakiet.status, przejscie, aktor);
  if (!sprawdzenie.ok) return sprawdzenie;
  const { regula } = sprawdzenie;
  const teraz = d.teraz();
  const zmiany: ZmianyPakietu = { status: regula.do };
  const payload: Record<string, unknown> = {};
  const doOutbox: Record<string, unknown> = {};
  let runda = pakiet.round;

  switch (przejscie.typ) {
    case "wyslij":
    case "wyslij_v2": {
      const kontrola = await d.sprawdzPrzedWysylka(pakiet.id);
      if (kontrola.braki.length > 0) return { ok: false, powod: "braki_w_materialach", braki: kontrola.braki, ostrzezenia: kontrola.ostrzezenia };
      if (przejscie.typ === "wyslij_v2") runda = pakiet.round + 1;
      const autoWlaczona = przejscie.autoAkceptacja ?? (przejscie.typ === "wyslij" ? pakiet.klient.autoApproveDefault : pakiet.autoApproveEnabled);
      const globalne = await d.ustawienia();
      const ustawienia: UstawieniaAutoAkceptacji = { godziny: pakiet.klient.autoApproveHours ?? globalne.godziny, dniRobocze: globalne.dniRobocze };
      const termin = autoWlaczona ? wyliczAutoAkceptacje(teraz, ustawienia).toISOString() : null;
      Object.assign(zmiany, {
        round: runda,
        submitted_at: teraz.toISOString(),
        auto_approve_enabled: autoWlaczona,
        auto_approve_at: termin,
        approved_at: null,
        approved_by_contact_id: null,
        approval_kind: null,
        changed_after_approval: false,
      } satisfies ZmianyPakietu);
      Object.assign(payload, { round: runda, auto_approve_at: termin, dni_robocze: ustawienia.dniRobocze, godziny: ustawienia.godziny, ostrzezenia: kontrola.ostrzezenia });
      Object.assign(doOutbox, { auto_approve_at: termin });
      break;
    }
    case "wycofaj": {
      Object.assign(zmiany, { submitted_at: null, auto_approve_at: null } satisfies ZmianyPakietu);
      break;
    }
    case "akceptuj": {
      const nierozwiazane = await d.liczUwagiKlienta(pakiet.id, pakiet.round, true);
      const migawka = await d.pobierzMigawke(pakiet.id);
      Object.assign(zmiany, {
        approved_at: teraz.toISOString(),
        approved_by_contact_id: aktor.rodzaj === "klient" ? aktor.contactId : null,
        approval_kind: "reczna",
      } satisfies ZmianyPakietu);
      Object.assign(payload, { migawka, nierozwiazane_uwagi: nierozwiazane, link_id: aktor.rodzaj === "klient" ? aktor.linkId : null });
      Object.assign(doOutbox, { nierozwiazane_uwagi: nierozwiazane });
      break;
    }
    case "auto_akceptuj": {
      if (!pakiet.autoApproveEnabled || !pakiet.autoApproveAt) return { ok: false, powod: "auto_wylaczona" };
      if (new Date(pakiet.autoApproveAt).getTime() > teraz.getTime()) return { ok: false, powod: "termin_nie_minal" };
      const nierozwiazane = await d.liczUwagiKlienta(pakiet.id, pakiet.round, true);
      if (nierozwiazane > 0) return { ok: false, powod: "nierozwiazane_uwagi", uwagi: nierozwiazane };
      const migawka = await d.pobierzMigawke(pakiet.id);
      Object.assign(zmiany, { approved_at: teraz.toISOString(), approved_by_contact_id: null, approval_kind: "automatyczna" } satisfies ZmianyPakietu);
      Object.assign(payload, { migawka, termin: pakiet.autoApproveAt });
      break;
    }
    case "zglos_uwagi": {
      const uwagi = await d.liczUwagiKlienta(pakiet.id, pakiet.round, false);
      if (uwagi === 0) return { ok: false, powod: "brak_uwag" };
      Object.assign(zmiany, { auto_approve_at: null } satisfies ZmianyPakietu);
      Object.assign(payload, { uwagi, link_id: aktor.rodzaj === "klient" ? aktor.linkId : null });
      Object.assign(doOutbox, { uwagi });
      break;
    }
    case "cofnij_do_poprawek": {
      const powod = przejscie.powod.trim();
      if (!powod) return { ok: false, powod: "brak_powodu" };
      Object.assign(zmiany, { auto_approve_at: null, approved_at: null, approved_by_contact_id: null, approval_kind: null } satisfies ZmianyPakietu);
      Object.assign(payload, { powod, ze_statusu: pakiet.status });
      Object.assign(doOutbox, { powod });
      break;
    }
    case "zaplanuj":
      break;
  }

  const zapisano = await d.zapiszPakiet(pakiet.id, pakiet.status, zmiany);
  if (!zapisano) return { ok: false, powod: "konflikt" };

  await d.dodajZdarzenie({
    package_id: pakiet.id,
    kind: regula.zdarzenie,
    actor_kind: aktor.rodzaj,
    actor_id: idAktora(aktor),
    payload: { ...payload, aktor: etykietaAktora(aktor), ze_statusu: pakiet.status, do_statusu: regula.do },
  });
  if (regula.outbox) {
    await d.dodajDoOutbox(regula.outbox, zbudujPayloadOutbox(regula.outbox, pakiet, aktor, runda, d.adresPakietu(pakiet), doOutbox));
  }
  return {
    ok: true,
    status: regula.do,
    runda,
    autoApproveAt: "auto_approve_at" in zmiany ? (zmiany.auto_approve_at ?? null) : pakiet.autoApproveAt,
  };
}
