"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { zapiszAudyt } from "@/lib/audyt";
import { copy } from "@/lib/copy";
import { dodajKomentarz as zapiszKomentarz, oczyscTrescKomentarza, sprawdzMaterialWPakiecie } from "@/lib/dane/komentarze";
import { pobierzPakiet } from "@/lib/dane/pakiety-klienta";
import { assertClientAccess } from "@/lib/dostep";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { pobierzKontekstKlienta, type KontekstKlienta } from "@/lib/kontekst-klienta";
import { zmienStatusPakietu } from "@/lib/pakiety/baza";
import { odnotujObejrzenieMaterialu } from "@/lib/pakiety/otwarcie";
import type { Aktor } from "@/lib/pakiety/przejscia";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

type KontekstZapisu = Extract<KontekstKlienta, { tryb: "klient" }>;

/**
 * Sesja klienta + izolacja (CLAUDE.md, zasada 1): każda akcja zaczyna się tutaj. Cudzy pakiet = 404.
 * Podgląd zespołu („Zobacz jak klient") nie zapisuje niczego: wynik z komunikatem zamiast zmiany.
 */
async function autoryzuj(token: string, pakietId: string): Promise<KontekstZapisu | { ok: false; blad: string }> {
  const kontekst = await pobierzKontekstKlienta(token);
  if (!kontekst || !czyUuid(pakietId)) notFound();
  const pakiet = await pobierzPakiet(pakietId);
  if (!pakiet) notFound();
  assertClientAccess(kontekst.clientId, pakiet.clientId);
  if (kontekst.tryb === "podglad") return { ok: false, blad: copy.podgladKlienta.blad };
  return kontekst;
}

function czyBlad(k: KontekstZapisu | { ok: false; blad: string }): k is { ok: false; blad: string } {
  return "ok" in k;
}

function aktorKlienta(k: KontekstZapisu): Extract<Aktor, { rodzaj: "klient" }> {
  return { rodzaj: "klient", contactId: k.contactId, linkId: k.linkId, label: k.label, mozeAkceptowac: k.canApprove };
}

function odswiez(token: string, pakietId: string) {
  revalidatePath(`/p/${token}/materialy/${pakietId}`);
  revalidatePath(`/p/${token}/materialy`);
  revalidatePath(`/p/${token}/start`);
  revalidatePath("/zespol");
}

/** „Akceptuję wszystko" (SPEC rozdz. 6.3, kryterium 8). */
export async function akceptujPakiet(token: string, pakietId: string, dane: { sprawdzilemDaty: boolean }): Promise<WynikAkcji> {
  const kontekst = await autoryzuj(token, pakietId);
  if (czyBlad(kontekst)) return kontekst;
  if (!dane.sprawdzilemDaty) return { ok: false, blad: copy.pakiet.modalAkceptacji.zaznaczDaty };
  const wynik = await zmienStatusPakietu(pakietId, { typ: "akceptuj" }, aktorKlienta(kontekst));
  if (!wynik.ok) return { ok: false, blad: copy.przejscia.odmowa[wynik.powod] };
  const { ipHash, ua } = await infoZadania();
  await zapiszAudyt({ actor_kind: "klient", actor_id: kontekst.contactId, actor_label: kontekst.label, action: "klient.akceptacja", entity: "package", entity_id: pakietId, client_id: kontekst.clientId, ip_hash: ipHash, ua, meta: { round: wynik.runda } });
  odswiez(token, pakietId);
  return { ok: true };
}

/** „Zgłaszam uwagi" (SPEC rozdz. 6.3, kryteria 9 i 10): wymaga co najmniej jednego komentarza; zatrzymuje licznik. */
export async function zglosUwagi(token: string, pakietId: string): Promise<WynikAkcji> {
  const kontekst = await autoryzuj(token, pakietId);
  if (czyBlad(kontekst)) return kontekst;
  const wynik = await zmienStatusPakietu(pakietId, { typ: "zglos_uwagi" }, aktorKlienta(kontekst));
  if (!wynik.ok) return { ok: false, blad: copy.przejscia.odmowa[wynik.powod] };
  const { ipHash, ua } = await infoZadania();
  await zapiszAudyt({ actor_kind: "klient", actor_id: kontekst.contactId, actor_label: kontekst.label, action: "klient.uwagi", entity: "package", entity_id: pakietId, client_id: kontekst.clientId, ip_hash: ipHash, ua, meta: { round: wynik.runda } });
  odswiez(token, pakietId);
  return { ok: true };
}

export type DaneKomentarza = { materialId: string | null; wariantId: string | null; tresc: string };

/** Komentarz klienta do materiału, wariantu albo całego pakietu (SPEC rozdz. 6.7); po akceptacji nie zmienia statusu (kryterium 13). */
export async function dodajKomentarz(token: string, pakietId: string, dane: DaneKomentarza): Promise<WynikAkcji> {
  const kontekst = await autoryzuj(token, pakietId);
  if (czyBlad(kontekst)) return kontekst;
  const materialId = dane.materialId && czyUuid(dane.materialId) ? dane.materialId : null;
  const wariantId = dane.wariantId && czyUuid(dane.wariantId) ? dane.wariantId : null;
  const tresc = oczyscTrescKomentarza(String(dane.tresc ?? ""));
  if (!tresc.ok) return { ok: false, blad: copy.pakiet.komentarze[tresc.powod] };
  if (!(await sprawdzMaterialWPakiecie(pakietId, materialId, wariantId))) return { ok: false, blad: copy.pakiet.komentarze.blad };
  const zapis = await zapiszKomentarz({ pakietId, materialId, wariantId, tresc: tresc.tresc, aktor: aktorKlienta(kontekst) });
  const { ipHash, ua } = await infoZadania();
  await zapiszAudyt({ actor_kind: "klient", actor_id: kontekst.contactId, actor_label: kontekst.label, action: "klient.komentarz", entity: "comment", entity_id: zapis.id, client_id: kontekst.clientId, ip_hash: ipHash, ua, meta: { package_id: pakietId, item_id: materialId, variant_id: wariantId, after_approval: zapis.poAkceptacji } });
  odswiez(token, pakietId);
  return { ok: true };
}

/** „Obejrzano 12 z 19": materiał był 2 s w polu widzenia. Nie blokuje akceptacji, nic nie zwraca. */
export async function odnotujObejrzenie(token: string, pakietId: string, materialId: string): Promise<void> {
  const kontekst = await autoryzuj(token, pakietId);
  if (czyBlad(kontekst) || !czyUuid(materialId)) return;
  await odnotujObejrzenieMaterialu(pakietId, materialId, kontekst.linkId);
}
