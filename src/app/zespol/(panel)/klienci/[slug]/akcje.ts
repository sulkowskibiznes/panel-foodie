"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { zapiszAudyt } from "@/lib/audyt";
import { assertTeamClientAccess, wymagajCzlonka } from "@/lib/auth-zespol";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { oznaczZainteresowanieZalatwione } from "@/lib/dane/uslugi";
import { kluczPodgladu } from "@/lib/kontekst-klienta";
import { utworzTokenPodgladu } from "@/lib/podglad-zespolu";
import { maUprawnienie, mozeImpersonowac } from "@/lib/uprawnienia";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

/**
 * „Zobacz jak klient" (SPEC rozdz. 2, kryterium 25): admin i csm dla każdego klienta, sales tylko dla klienta demo.
 * Wejście zapisane w audycie; token podpisany, ważny 4 godziny, działa wyłącznie z sesją tego członka zespołu.
 */
export async function rozpocznijPodglad(slug: string): Promise<never> {
  const czlonek = await wymagajCzlonka();
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  if (!mozeImpersonowac(czlonek.role, klient.demo)) notFound();
  const token = utworzTokenPodgladu(kluczPodgladu(), { clientId: klient.id, memberId: czlonek.id });
  const { ipHash, ua } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.podglad_klienta_start", entity: "client", entity_id: klient.id, client_id: klient.id, ip_hash: ipHash, ua });
  redirect(`/p/${token}/start`);
}

/** „Załatwione" przy zgłoszeniu usługi (SPEC rozdz. 5.8): admin i csm (pełne prawo do klientów). */
export async function oznaczZainteresowanie(slug: string, id: string): Promise<void> {
  const czlonek = await wymagajCzlonka();
  if (!maUprawnienie(czlonek.role, "klienci", "pelne") || !czyUuid(id)) notFound();
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  if (await oznaczZainteresowanieZalatwione(id, klient.id, czlonek.id)) {
    await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.zainteresowanie_zalatwione", entity: "service_interest", entity_id: id, client_id: klient.id });
  }
  revalidatePath(`/zespol/klienci/${slug}`);
}
