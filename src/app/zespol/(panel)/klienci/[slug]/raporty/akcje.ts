"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { zapiszAudyt } from "@/lib/audyt";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia, type CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu, type KartaKlienta } from "@/lib/dane/klienci-zespolu";
import { usunRaport as usunRaportZBazy, zapiszRaport } from "@/lib/dane/raporty";
import { czyAdresRaportu, domyslnyTytulRaportu, MAKS_MIESIAC_WSPOLPRACY, parsujOkresRaportu, wybierzLokalRaportu } from "@/lib/raporty/walidacja";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

async function autoryzuj(slug: string): Promise<{ czlonek: CzlonekZespolu; klient: KartaKlienta }> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "raporty", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  return { czlonek, klient };
}

function odswiez(slug: string) {
  revalidatePath(`/zespol/klienci/${slug}/raporty`);
}

export type DaneRaportu = { url: string; okres: string; lokalId: string | null; tytul: string; miesiacWspolpracy: string };
export type WynikRaportu = { ok: true; utworzony: boolean } | { ok: false; blad: string };

/** „Dodaj raport" (SPEC rozdz. 9, droga 1): CSM wkleja link i wybiera miesiąc; ten sam miesiąc i lokal nadpisuje link. */
export async function dodajRaport(slug: string, dane: DaneRaportu): Promise<WynikRaportu> {
  const { czlonek, klient } = await autoryzuj(slug);
  const b = copy.zespol.raporty.bledy;
  const url = String(dane.url ?? "").trim();
  if (!czyAdresRaportu(url) || url.length > 500) return { ok: false, blad: b.link };
  const okres = parsujOkresRaportu(dane.okres);
  if (!okres) return { ok: false, blad: b.miesiac };
  const lokalNazwa = dane.lokalId && czyUuid(dane.lokalId) ? (klient.locations.find((l) => l.id === dane.lokalId)?.name ?? null) : null;
  const lokal = wybierzLokalRaportu(klient.category, klient.locations, lokalNazwa);
  if (!lokal.ok) return { ok: false, blad: b.lokal };
  const surowyMiesiac = String(dane.miesiacWspolpracy ?? "").trim();
  let miesiacWspolpracy: number | null = null;
  if (surowyMiesiac) {
    const n = Number(surowyMiesiac);
    if (!Number.isInteger(n) || n < 1 || n > MAKS_MIESIAC_WSPOLPRACY) return { ok: false, blad: b.miesiacWspolpracy };
    miesiacWspolpracy = n;
  }
  const tytul = String(dane.tytul ?? "").trim().slice(0, 200) || null;
  try {
    const zapis = await zapiszRaport({ clientId: klient.id, locationId: lokal.locationId, rok: okres.rok, miesiac: okres.miesiac, tytul, domyslnyTytul: domyslnyTytulRaportu(okres), url, miesiacWspolpracy, zrodlo: "reczne" });
    const { ipHash } = await infoZadania();
    await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.raport_dodany", entity: "report", entity_id: zapis.id, client_id: klient.id, ip_hash: ipHash, meta: { period: dane.okres, location_id: lokal.locationId, utworzony: zapis.utworzony } });
    odswiez(slug);
    return { ok: true, utworzony: zapis.utworzony };
  } catch (blad) {
    console.error("[raporty] dodajRaport", blad instanceof Error ? blad.message : blad);
    return { ok: false, blad: b.ogolny };
  }
}

export async function usunRaport(slug: string, raportId: string): Promise<{ ok: boolean }> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (!czyUuid(raportId)) return { ok: false };
  const ok = await usunRaportZBazy(raportId, klient.id);
  if (ok) {
    const { ipHash } = await infoZadania();
    await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.raport_usuniety", entity: "report", entity_id: raportId, client_id: klient.id, ip_hash: ipHash });
  }
  odswiez(slug);
  return { ok };
}
