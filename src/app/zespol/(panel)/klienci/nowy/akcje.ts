"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { zapiszAudyt } from "@/lib/audyt";
import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { utworzKlienta as utworzWBazie, pobierzOpiekunow } from "@/lib/dane/klienci-nowi";
import { waliduj } from "@/lib/klienci/nowy";
import { infoZadania } from "@/lib/zadanie";

export type StanNowegoKlienta = { blad?: string };

/** „Nowy klient" (panel zespołu): admin i csm. Po utworzeniu przekierowanie na kartę klienta. */
export async function utworzKlienta(_poprzedni: StanNowegoKlienta, formData: FormData): Promise<StanNowegoKlienta> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "klienci", "pelne");
  const b = copy.zespol.nowyKlient.bledy;
  const opiekunowie = new Set((await pobierzOpiekunow()).map((o) => o.id));
  const wynik = waliduj(formData, opiekunowie);
  if (!wynik.ok) return { blad: b[wynik.blad] };
  const utworzony = await utworzWBazie(wynik.dane, czlonek);
  if (!utworzony.ok) return { blad: utworzony.powod === "slugZajety" ? b.slugZajety : b.ogolny };
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.klient_utworzony", entity: "client", entity_id: utworzony.id, client_id: utworzony.id, ip_hash: ipHash, meta: { slug: wynik.dane.slug, lokale: wynik.dane.lokale.length, kontakty: wynik.dane.kontakty.length } });
  revalidatePath("/zespol");
  redirect(`/zespol/klienci/${wynik.dane.slug}`);
}
