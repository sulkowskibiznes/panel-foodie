"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { zapiszAudyt } from "@/lib/audyt";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia, type CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { cofnijOplacenieFaktury, dodajFakture as dodajFaktureDoBazy, oznaczFaktureOplacona, pobierzFaktureKlienta, ustawPdfFaktury, usunFakture as usunFaktureZBazy } from "@/lib/dane/faktury";
import { pobierzKlientaPoSlugu, type KartaKlienta } from "@/lib/dane/klienci-zespolu";
import { czyPoprawnaDataLokalna } from "@/lib/harmonogram/kalendarz";
import { dzisLokalnie, statusNieoplaconej } from "@/lib/faktury/status";
import { odczytajOpisPdf } from "@/lib/pliki/pdf";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

async function autoryzuj(slug: string): Promise<{ czlonek: CzlonekZespolu; klient: KartaKlienta }> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "faktury", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  return { czlonek, klient };
}

function odswiez(slug: string) {
  revalidatePath(`/zespol/klienci/${slug}/faktury`);
}

async function audyt(czlonek: CzlonekZespolu, klient: KartaKlienta, action: "zespol.faktura_dodana" | "zespol.faktura_zmieniona" | "zespol.faktura_usunieta", fakturaId: string, meta: Record<string, unknown>) {
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action, entity: "invoice", entity_id: fakturaId, client_id: klient.id, ip_hash: ipHash, meta });
}

function kwota(wartosc: unknown): number | null {
  const n = Number(String(wartosc ?? "").replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export type DaneFaktury = { numer: string; wystawiono: string; termin: string; netto: string; brutto: string; notatka: string; opisPdf: string | null };
export type WynikFaktury = { ok: true } | { ok: false; blad: string };

/** „Dodaj fakturę" (SPEC rozdz. 10): dane z Fakturowo, status z terminu (cron i tak by go przestawił), PDF wyłącznie z podpisanego opisu. */
export async function dodajFakture(slug: string, dane: DaneFaktury): Promise<WynikFaktury> {
  const { czlonek, klient } = await autoryzuj(slug);
  const b = copy.zespol.faktury.bledy;
  if (klient.demo) return { ok: false, blad: b.klientDemo };
  const numer = String(dane.numer ?? "").trim().slice(0, 100);
  if (!numer) return { ok: false, blad: b.numer };
  const wystawiono = String(dane.wystawiono ?? "");
  const termin = String(dane.termin ?? "");
  if (!czyPoprawnaDataLokalna(wystawiono) || !czyPoprawnaDataLokalna(termin) || termin < wystawiono) return { ok: false, blad: b.daty };
  const netto = kwota(dane.netto);
  const brutto = kwota(dane.brutto);
  if (netto === null || brutto === null || netto <= 0 || brutto < netto || brutto > 99_999_999) return { ok: false, blad: b.kwoty };
  let pdfPath: string | null = null;
  if (dane.opisPdf) {
    const opis = odczytajOpisPdf("faktury", klient.id, String(dane.opisPdf));
    if (!opis) return { ok: false, blad: b.plik };
    pdfPath = opis.sciezka;
  }
  const status = statusNieoplaconej(termin, dzisLokalnie(new Date()));
  const wynik = await dodajFaktureDoBazy({ clientId: klient.id, numer, wystawiono, termin, netto, brutto, status, notatka: String(dane.notatka ?? "").trim().slice(0, 1000) || null, pdfPath });
  if (!wynik.ok) {
    if (wynik.powod === "numerZajety") return { ok: false, blad: b.numerZajety };
    if (wynik.powod === "klientDemo") return { ok: false, blad: b.klientDemo };
    console.error("[faktury] dodajFakture", wynik.blad);
    return { ok: false, blad: b.ogolny };
  }
  await audyt(czlonek, klient, "zespol.faktura_dodana", wynik.id, { numer, termin, brutto, status, pdf: pdfPath !== null });
  odswiez(slug);
  return { ok: true };
}

export async function oznaczOplacona(slug: string, fakturaId: string, dataWplaty: string): Promise<WynikFaktury> {
  const { czlonek, klient } = await autoryzuj(slug);
  const b = copy.zespol.faktury.bledy;
  if (!czyUuid(fakturaId)) return { ok: false, blad: b.ogolny };
  if (!czyPoprawnaDataLokalna(String(dataWplaty ?? ""))) return { ok: false, blad: b.dataWplaty };
  const ok = await oznaczFaktureOplacona(fakturaId, klient.id, dataWplaty);
  if (!ok) return { ok: false, blad: b.ogolny };
  await audyt(czlonek, klient, "zespol.faktura_zmieniona", fakturaId, { status: "oplacona", paid_at: dataWplaty });
  odswiez(slug);
  return { ok: true };
}

/** Cofnięcie opłacenia: status z terminu, jak zrobiłby cron; `po_terminie` nigdy nie jest wpisywane ręcznie wprost. */
export async function cofnijOplacenie(slug: string, fakturaId: string): Promise<WynikFaktury> {
  const { czlonek, klient } = await autoryzuj(slug);
  const b = copy.zespol.faktury.bledy;
  if (!czyUuid(fakturaId)) return { ok: false, blad: b.ogolny };
  const faktura = await pobierzFaktureKlienta(fakturaId, klient.id);
  if (!faktura) return { ok: false, blad: b.ogolny };
  const status = statusNieoplaconej(faktura.termin, dzisLokalnie(new Date()));
  const ok = await cofnijOplacenieFaktury(fakturaId, klient.id, status);
  if (!ok) return { ok: false, blad: b.ogolny };
  await audyt(czlonek, klient, "zespol.faktura_zmieniona", fakturaId, { status, paid_at: null });
  odswiez(slug);
  return { ok: true };
}

export async function ustawPdf(slug: string, fakturaId: string, opisPdf: string): Promise<WynikFaktury> {
  const { czlonek, klient } = await autoryzuj(slug);
  const b = copy.zespol.faktury.bledy;
  if (!czyUuid(fakturaId)) return { ok: false, blad: b.ogolny };
  const opis = odczytajOpisPdf("faktury", klient.id, String(opisPdf ?? ""));
  if (!opis) return { ok: false, blad: b.plik };
  const ok = await ustawPdfFaktury(fakturaId, klient.id, opis.sciezka);
  if (!ok) return { ok: false, blad: b.ogolny };
  await audyt(czlonek, klient, "zespol.faktura_zmieniona", fakturaId, { pdf: true, nazwa: opis.nazwa });
  odswiez(slug);
  return { ok: true };
}

export async function usunFakture(slug: string, fakturaId: string): Promise<WynikFaktury> {
  const { czlonek, klient } = await autoryzuj(slug);
  const b = copy.zespol.faktury.bledy;
  if (!czyUuid(fakturaId)) return { ok: false, blad: b.ogolny };
  const faktura = await pobierzFaktureKlienta(fakturaId, klient.id);
  if (!faktura || !(await usunFaktureZBazy(fakturaId, klient.id))) return { ok: false, blad: b.ogolny };
  await audyt(czlonek, klient, "zespol.faktura_usunieta", fakturaId, { numer: faktura.numer });
  odswiez(slug);
  return { ok: true };
}
