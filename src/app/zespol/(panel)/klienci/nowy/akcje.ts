"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { zapiszAudyt } from "@/lib/audyt";
import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzOpiekunow, pobierzZespolDoPrzypisania, utworzKlienta as utworzWBazie } from "@/lib/dane/klienci-nowi";
import { waliduj } from "@/lib/klienci/nowy";
import { infoZadania } from "@/lib/zadanie";

export type StanNowegoKlienta = { blad?: string };

/**
 * „Nowy klient" (panel zespołu): admin i csm. Po utworzeniu przekierowanie na kartę klienta. Wołane z onSubmit
 * (nie z `<form action>`), żeby błąd, np. zajęty slug, nie czyścił wpisanych lokali i osób.
 */
export async function utworzKlienta(formData: FormData): Promise<StanNowegoKlienta> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "klienci", "pelne");
  const b = copy.zespol.nowyKlient.bledy;
  const [opiekunowie, doPrzypisania] = await Promise.all([pobierzOpiekunow(), pobierzZespolDoPrzypisania()]);
  const wynik = waliduj(formData, new Set(opiekunowie.map((o) => o.id)), new Set(doPrzypisania.map((o) => o.id)));
  if (!wynik.ok) return { blad: b[wynik.blad] };
  const utworzony = await utworzWBazie(wynik.dane, czlonek);
  if (!utworzony.ok) return { blad: utworzony.powod === "slugZajety" ? b.slugZajety : b.ogolny };
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.klient_utworzony", entity: "client", entity_id: utworzony.id, client_id: utworzony.id, ip_hash: ipHash, meta: { slug: wynik.dane.slug, lokale: wynik.dane.lokale.length, kontakty: wynik.dane.kontakty.length, przypisani: wynik.dane.przypisani.length } });
  revalidatePath("/zespol");
  redirect(`/zespol/klienci/${wynik.dane.slug}`);
}
