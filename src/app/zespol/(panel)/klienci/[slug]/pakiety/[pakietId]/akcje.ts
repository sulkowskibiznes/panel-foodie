"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { zapiszAudyt, type AkcjaAudytu } from "@/lib/audyt";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia, type CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { dodajKomentarz as zapiszKomentarz, oczyscTrescKomentarza, oznaczZalatwione as zapiszZalatwione, sprawdzMaterialWPakiecie } from "@/lib/dane/komentarze";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { pobierzPakietDoPrzejscia, zmienStatusPakietu } from "@/lib/pakiety/baza";
import type { Aktor, Przejscie } from "@/lib/pakiety/przejscia";
import type { Poziom } from "@/lib/uprawnienia";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

async function autoryzuj(slug: string, pakietId: string, poziom: Exclude<Poziom, "brak">): Promise<{ czlonek: CzlonekZespolu; clientId: string }> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "materialy", poziom);
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient || !czyUuid(pakietId)) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const pakiet = await pobierzPakietDoPrzejscia(pakietId);
  if (!pakiet || pakiet.clientId !== klient.id) notFound();
  return { czlonek, clientId: klient.id };
}

function aktorZespolu(c: CzlonekZespolu): Extract<Aktor, { rodzaj: "zespol" }> {
  return { rodzaj: "zespol", memberId: c.id, name: c.name };
}

function odswiez(slug: string, pakietId: string) {
  revalidatePath(`/zespol/klienci/${slug}/pakiety/${pakietId}`);
  revalidatePath(`/zespol/klienci/${slug}/materialy`);
  revalidatePath("/zespol");
}

const schematPrzejscia = z.discriminatedUnion("typ", [
  z.object({ typ: z.literal("wyslij"), autoAkceptacja: z.boolean().optional() }),
  z.object({ typ: z.literal("wycofaj") }),
  z.object({ typ: z.literal("wyslij_v2"), autoAkceptacja: z.boolean().optional() }),
  z.object({ typ: z.literal("cofnij_do_poprawek"), powod: z.string().max(2000) }),
  z.object({ typ: z.literal("zaplanuj") }),
]);

const AUDYT_PRZEJSCIA: Record<z.infer<typeof schematPrzejscia>["typ"], AkcjaAudytu> = {
  wyslij: "zespol.pakiet_wyslany",
  wyslij_v2: "zespol.pakiet_wyslany",
  wycofaj: "zespol.pakiet_wycofany",
  cofnij_do_poprawek: "zespol.pakiet_cofniety",
  zaplanuj: "zespol.pakiet_zaplanowany",
};

/** Przejścia zespołu z SPEC rozdz. 6.8 (wyślij, wycofaj, wyślij v2, cofnij do poprawek, zaplanowano) przez maszynę stanów. */
export async function wykonajPrzejscieZespolu(slug: string, pakietId: string, dane: unknown): Promise<WynikAkcji> {
  const { czlonek, clientId } = await autoryzuj(slug, pakietId, "pelne");
  const parsed = schematPrzejscia.safeParse(dane);
  if (!parsed.success) return { ok: false, blad: copy.przejscia.odmowa.niedozwolone_ze_statusu };
  const przejscie: Przejscie = parsed.data;
  const wynik = await zmienStatusPakietu(pakietId, przejscie, aktorZespolu(czlonek));
  if (!wynik.ok) return { ok: false, blad: copy.przejscia.odmowa[wynik.powod], braki: wynik.braki, ostrzezenia: wynik.ostrzezenia };
  const { ipHash, ua } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: AUDYT_PRZEJSCIA[przejscie.typ], entity: "package", entity_id: pakietId, client_id: clientId, ip_hash: ipHash, ua, meta: { typ: przejscie.typ, status: wynik.status, round: wynik.runda, ...(przejscie.typ === "cofnij_do_poprawek" ? { powod: przejscie.powod } : {}) } });
  odswiez(slug, pakietId);
  return { ok: true };
}

export type DaneOdpowiedzi = { materialId: string | null; wariantId: string | null; tresc: string };

/** Odpowiedź zespołu w wątku (SPEC rozdz. 6.7): klient widzi ją w tym samym miejscu. */
export async function odpowiedzNaKomentarz(slug: string, pakietId: string, dane: DaneOdpowiedzi): Promise<WynikAkcji> {
  const { czlonek, clientId } = await autoryzuj(slug, pakietId, "podglad");
  const materialId = dane.materialId && czyUuid(dane.materialId) ? dane.materialId : null;
  const wariantId = dane.wariantId && czyUuid(dane.wariantId) ? dane.wariantId : null;
  const tresc = oczyscTrescKomentarza(String(dane.tresc ?? ""));
  if (!tresc.ok) return { ok: false, blad: copy.pakiet.komentarze[tresc.powod] };
  if (!(await sprawdzMaterialWPakiecie(pakietId, materialId, wariantId))) return { ok: false, blad: copy.pakiet.komentarze.blad };
  const zapis = await zapiszKomentarz({ pakietId, materialId, wariantId, tresc: tresc.tresc, aktor: aktorZespolu(czlonek) });
  const { ipHash, ua } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.komentarz", entity: "comment", entity_id: zapis.id, client_id: clientId, ip_hash: ipHash, ua, meta: { package_id: pakietId, item_id: materialId, variant_id: wariantId } });
  odswiez(slug, pakietId);
  return { ok: true };
}

/** „Załatwione": uwaga klienta przestaje wstrzymywać auto-akceptację (SPEC rozdz. 6.4, 6.7). */
export async function oznaczZalatwione(slug: string, pakietId: string, komentarzId: string): Promise<WynikAkcji> {
  const { czlonek, clientId } = await autoryzuj(slug, pakietId, "podglad");
  if (!czyUuid(komentarzId)) return { ok: false, blad: copy.pakiet.komentarze.blad };
  const ok = await zapiszZalatwione(pakietId, komentarzId, czlonek.id);
  if (!ok) return { ok: false, blad: copy.pakiet.komentarze.blad };
  const { ipHash, ua } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.uwaga_zalatwiona", entity: "comment", entity_id: komentarzId, client_id: clientId, ip_hash: ipHash, ua, meta: { package_id: pakietId } });
  odswiez(slug, pakietId);
  return { ok: true };
}
