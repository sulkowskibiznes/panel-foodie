"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zapiszAudyt } from "@/lib/audyt";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia, type CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu, type KartaKlienta } from "@/lib/dane/klienci-zespolu";
import { adresLinku, utworzLinkDostepu, wygasLinkDostepu, wylogujUrzadzeniaLinku, zresetujPinLinku } from "@/lib/dane/linki";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

async function autoryzuj(slug: string): Promise<{ czlonek: CzlonekZespolu; klient: KartaKlienta }> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "dostep", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  return { czlonek, klient };
}

function odswiez(slug: string) {
  revalidatePath(`/zespol/klienci/${slug}/dostep`);
  revalidatePath("/zespol");
}

const schematNowegoLinku = z.object({
  contactId: z.string().nullable(),
  label: z.string().trim().max(120),
  pinKind: z.enum(["pin4", "pin6", "haslo"]),
  canApprove: z.boolean(),
});

export type WynikNowegoLinku = { ok: true; linkId: string; adres: string; pin: string } | { ok: false; blad: string };

/** „Utwórz link": PIN wraca tylko tym jednym wynikiem, nigdzie indziej nie jest widoczny. */
export async function utworzLink(slug: string, dane: z.input<typeof schematNowegoLinku>): Promise<WynikNowegoLinku> {
  const { czlonek, klient } = await autoryzuj(slug);
  const parsed = schematNowegoLinku.safeParse(dane);
  if (!parsed.success) return { ok: false, blad: copy.zespol.dostep.bledy.brakEtykiety };
  const { contactId, pinKind, canApprove } = parsed.data;
  let label = parsed.data.label;
  let kontaktId: string | null = null;
  if (contactId && czyUuid(contactId)) {
    const kontakt = klient.client_contacts.find((c) => c.id === contactId);
    if (!kontakt) return { ok: false, blad: copy.zespol.dostep.bledy.brakEtykiety };
    kontaktId = kontakt.id;
    if (!label) label = kontakt.role_label ? `${kontakt.name} - ${kontakt.role_label}` : kontakt.name;
  }
  if (!label) return { ok: false, blad: copy.zespol.dostep.bledy.brakEtykiety };

  const { linkId, token, pin } = await utworzLinkDostepu({ clientId: klient.id, contactId: kontaktId, label, pinKind, canApprove, createdBy: czlonek.id });
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "link.utworzony", entity: "access_link", entity_id: linkId, client_id: klient.id, ip_hash: ipHash, meta: { label, pin_kind: pinKind, can_approve: canApprove } });
  odswiez(slug);
  return { ok: true, linkId, adres: adresLinku(token), pin };
}

export async function wygasLink(slug: string, linkId: string): Promise<{ ok: boolean }> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (!czyUuid(linkId)) return { ok: false };
  const ok = await wygasLinkDostepu(linkId, klient.id);
  if (ok) {
    const { ipHash } = await infoZadania();
    await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "link.wygaszony", entity: "access_link", entity_id: linkId, client_id: klient.id, ip_hash: ipHash });
  }
  odswiez(slug);
  return { ok };
}

export async function wylogujUrzadzenia(slug: string, linkId: string): Promise<{ ok: boolean; liczba: number }> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (!czyUuid(linkId)) return { ok: false, liczba: 0 };
  const liczba = await wylogujUrzadzeniaLinku(linkId, klient.id);
  if (liczba === null) return { ok: false, liczba: 0 };
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "link.urzadzenia_wylogowane", entity: "access_link", entity_id: linkId, client_id: klient.id, ip_hash: ipHash, meta: { liczba } });
  odswiez(slug);
  return { ok: true, liczba };
}

export type WynikResetu = { ok: true; adres: string; pin: string } | { ok: false; blad: string };

/** Reset PIN-u: stary przestaje działać, wszystkie urządzenia wylogowane, nowy PIN widoczny raz (SPEC rozdz. 12.4). */
export async function zresetujPin(slug: string, linkId: string): Promise<WynikResetu> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (!czyUuid(linkId)) return { ok: false, blad: copy.zespol.dostep.bledy.ogolny };
  const wynik = await zresetujPinLinku(linkId, klient.id);
  if (!wynik) return { ok: false, blad: copy.zespol.dostep.bledy.ogolny };
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "link.pin_zresetowany", entity: "access_link", entity_id: linkId, client_id: klient.id, ip_hash: ipHash });
  odswiez(slug);
  return { ok: true, adres: adresLinku(wynik.token), pin: wynik.pin };
}

/** Skopiowanie linku albo PIN-u odnotowujemy w audycie (SPEC rozdz. 12.4). */
export async function odnotujSkopiowanie(slug: string, linkId: string, co: "link" | "pin" | "oba"): Promise<void> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (!czyUuid(linkId)) return;
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "link.skopiowany", entity: "access_link", entity_id: linkId, client_id: klient.id, ip_hash: ipHash, meta: { co } });
}
