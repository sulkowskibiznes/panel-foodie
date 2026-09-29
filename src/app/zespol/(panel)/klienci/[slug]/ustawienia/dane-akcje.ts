"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { zapiszAudyt, type AkcjaAudytu } from "@/lib/audyt";
import { assertTeamClientAccess, czyWidziKlienta, wymagajCzlonka, wymagajUprawnienia, type CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import {
  archiwizujKontakt,
  czyLokalKlienta,
  pobierzDaneKlienta,
  ustawAwatarLokalu,
  ustawGlownyKontakt,
  ustawOpiekuna,
  ustawPrzypisania,
  zapiszAkceptacje,
  zapiszDaneKlienta,
  zapiszKontakt,
  zapiszLokal,
  type DaneKlientaZespolu,
} from "@/lib/dane/dane-klienta";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { walidujAkceptacje, walidujDaneKlienta, walidujKontakt, walidujLokal, type BladKlienta } from "@/lib/klienci/nowy";
import { przygotujUploadAwatara, usunAwatar, zakonczUploadAwatara, type WynikPrzygotowaniaAwatara } from "@/lib/pliki/upload";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

/**
 * Zakładka „Dane i współpraca" (plan domknięcia, Etap 1): admin i csm (klienci: pelne), tylko u klientów, których widzą.
 * Id lokalu, osoby i członka zespołu z formularza są niezaufane (argumenty .bind() idą jawnie w ciele akcji):
 * każda funkcja zapisu zawęża je do klienta z autoryzacji i odmawia, gdy wiersz nie należy do klienta.
 */
async function autoryzuj(slug: string): Promise<{ czlonek: CzlonekZespolu; klient: DaneKlientaZespolu }> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "klienci", "pelne");
  const karta = await pobierzKlientaPoSlugu(slug);
  if (!karta) notFound();
  await assertTeamClientAccess(czlonek, karta.id);
  const klient = await pobierzDaneKlienta(karta.id);
  if (!klient) notFound();
  return { czlonek, klient };
}

async function audyt(czlonek: CzlonekZespolu, action: AkcjaAudytu, klientId: string, entity: string, entityId: string | null, meta: Record<string, unknown> = {}) {
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action, entity, entity_id: entityId, client_id: klientId, ip_hash: ipHash, meta });
}

function odswiez(slug: string) {
  revalidatePath(`/zespol/klienci/${slug}`, "layout");
  revalidatePath("/zespol");
}

function blad(kod: BladKlienta): WynikAkcji {
  return { ok: false, blad: copy.zespol.nowyKlient.bledy[kod] };
}

const tekst = (fd: FormData, klucz: string) => {
  const w = fd.get(klucz);
  return typeof w === "string" ? w : "";
};

export async function zapiszDane(slug: string, fd: FormData): Promise<WynikAkcji> {
  const { czlonek, klient } = await autoryzuj(slug);
  const wynik = walidujDaneKlienta(fd);
  if (!wynik.ok) return blad(wynik.blad);
  // Kategoria zmienia sens pakietów i raportów per lokal: po pierwszym pakiecie albo raporcie zostaje stara.
  const dane = klient.mozeZmienicKategorie ? wynik.dane : { ...wynik.dane, category: klient.category };
  await zapiszDaneKlienta(klient.id, dane);
  await audyt(czlonek, "zespol.klient_zmieniony", klient.id, "client", klient.id, { pola: Object.keys(dane), kategoria: dane.category });
  odswiez(slug);
  return { ok: true };
}

/** Nowy lokal (lokalId = null) albo zmiana lokalu tego klienta. */
export async function zapiszLokalKlienta(slug: string, lokalId: string | null, fd: FormData): Promise<WynikAkcji> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (lokalId !== null && !czyUuid(lokalId)) notFound();
  const wynik = walidujLokal({ name: tekst(fd, "name"), city: tekst(fd, "city"), fb_page_name: tekst(fd, "fb_page_name"), ig_handle: tekst(fd, "ig_handle"), address: tekst(fd, "address") });
  if (!wynik.ok) return blad(wynik.blad);
  const id = await zapiszLokal(klient.id, lokalId, wynik.dane, klient.category);
  if (!id) notFound();
  await audyt(czlonek, "zespol.lokal_zmieniony", klient.id, "location", id, { nowy: lokalId === null });
  odswiez(slug);
  return { ok: true };
}

export async function przygotujAwatar(slug: string, lokalId: string, plik: { mime: string; bytes: number }): Promise<WynikPrzygotowaniaAwatara> {
  const { klient } = await autoryzuj(slug);
  if (!czyUuid(lokalId) || !(await czyLokalKlienta(klient.id, lokalId))) notFound();
  return przygotujUploadAwatara(klient.id, plik);
}

export async function zapiszAwatar(slug: string, lokalId: string, pozwolenie: string): Promise<WynikAkcji> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (!czyUuid(lokalId) || !(await czyLokalKlienta(klient.id, lokalId))) notFound();
  const b = copy.zespol.daneKlienta.lokale.zdjecieBledy;
  const wynik = await zakonczUploadAwatara(klient.id, pozwolenie);
  if (!wynik.ok) return { ok: false, blad: wynik.powod === "nieobslugiwany" ? b.nieobslugiwany : wynik.powod === "zaDuzy" ? b.zaDuzy.replace("{limit}", "5 MB") : b.ogolny };
  const zmiana = await ustawAwatarLokalu(klient.id, lokalId, wynik.sciezka);
  if (!zmiana) {
    await usunAwatar(wynik.sciezka);
    notFound();
  }
  if (zmiana.poprzednia) await usunAwatar(zmiana.poprzednia);
  await audyt(czlonek, "zespol.lokal_zmieniony", klient.id, "location", lokalId, { zdjecie: true });
  odswiez(slug);
  return { ok: true };
}

/** Nowa osoba (kontaktId = null) albo zmiana aktywnej osoby tego klienta. */
export async function zapiszKontaktKlienta(slug: string, kontaktId: string | null, fd: FormData): Promise<WynikAkcji> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (kontaktId !== null && !czyUuid(kontaktId)) notFound();
  const wynik = walidujKontakt({ name: tekst(fd, "name"), role_label: tekst(fd, "role_label"), phone: tekst(fd, "phone"), email: tekst(fd, "email") });
  if (!wynik.ok) return blad(wynik.blad);
  const id = await zapiszKontakt(klient.id, kontaktId, wynik.dane);
  if (!id) notFound();
  await audyt(czlonek, "zespol.kontakt_zmieniony", klient.id, "client_contact", id, { nowy: kontaktId === null });
  odswiez(slug);
  return { ok: true };
}

export async function ustawGlowna(slug: string, kontaktId: string): Promise<WynikAkcji> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (!czyUuid(kontaktId) || !(await ustawGlownyKontakt(klient.id, kontaktId))) notFound();
  await audyt(czlonek, "zespol.kontakt_zmieniony", klient.id, "client_contact", kontaktId, { glowna: true });
  odswiez(slug);
  return { ok: true };
}

/** Osoba przestaje współpracować; opcjonalnie wygaszenie jej linków i wylogowanie urządzeń (zgoda Szymona, plan 1.5). */
export async function archiwizujKontaktKlienta(slug: string, kontaktId: string, wygasLinki: boolean): Promise<WynikAkcji> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (!czyUuid(kontaktId)) notFound();
  const wynik = await archiwizujKontakt(klient.id, kontaktId, wygasLinki === true);
  if (!wynik) notFound();
  await audyt(czlonek, "zespol.kontakt_zmieniony", klient.id, "client_contact", kontaktId, { zarchiwizowany: true, wygaszone_linki: wynik.wygaszone });
  odswiez(slug);
  revalidatePath(`/zespol/klienci/${slug}/dostep`);
  return { ok: true };
}

export type WynikZespolu = WynikAkcji | { ok: true; przekierowanie: string };

/**
 * Opiekun i przypisania (plan 1.1). Csm może oddać opiekę; gdy przez to straci dostęp do klienta, wraca na pulpit.
 */
export async function zapiszZespolKlienta(slug: string, fd: FormData): Promise<WynikZespolu> {
  const { czlonek, klient } = await autoryzuj(slug);
  const opiekun = tekst(fd, "opiekun_id").trim();
  if (opiekun && !czyUuid(opiekun)) return { ok: false, blad: copy.zespol.daneKlienta.bledy.opiekun };
  const przypisani = fd
    .getAll("przypisany")
    .map((w) => (typeof w === "string" ? w : ""))
    .filter((id) => czyUuid(id));
  if (!(await ustawOpiekuna(klient.id, opiekun || null))) return { ok: false, blad: copy.zespol.daneKlienta.bledy.opiekun };
  const zmiana = await ustawPrzypisania(klient.id, przypisani);
  await audyt(czlonek, "zespol.klient_przypisania", klient.id, "client", klient.id, { opiekun: opiekun || null, dodani: zmiana.dodani, usunieci: zmiana.usunieci });
  odswiez(slug);
  if (!(await czyWidziKlienta(czlonek, klient.id))) return { ok: true, przekierowanie: "/zespol" };
  return { ok: true };
}

export async function zapiszAkceptacjeKlienta(slug: string, fd: FormData): Promise<WynikAkcji> {
  const { czlonek, klient } = await autoryzuj(slug);
  const wynik = walidujAkceptacje(fd);
  if (!wynik.ok) return blad(wynik.blad);
  await zapiszAkceptacje(klient.id, wynik.dane);
  await audyt(czlonek, "zespol.klient_zmieniony", klient.id, "client", klient.id, { akceptacja: wynik.dane });
  odswiez(slug);
  return { ok: true };
}
