import { notFound } from "next/navigation";
import { DialogNowegoLinku } from "@/components/zespol/dostep/dialog-nowego-linku";
import { HistoriaLogowan } from "@/components/zespol/dostep/historia-logowan";
import { ListaLinkow } from "@/components/zespol/dostep/lista-linkow";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { pobierzHistorieDostepu, pobierzLinkiKlienta } from "@/lib/dane/linki";

/** Zakładka Dostęp (SPEC rozdz. 4.4, 12.4). */
export default async function DostepKlienta({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "dostep", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const [linki, historia] = await Promise.all([pobierzLinkiKlienta(klient.id), pobierzHistorieDostepu(klient.id)]);
  const d = copy.zespol.dostep;

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-naglowek text-xl text-foodie-czern">{d.tytul}</h2>
            <p className="mt-1 max-w-prose text-sm text-szary-600">{d.opis}</p>
          </div>
          <DialogNowegoLinku slug={slug} kontakty={klient.client_contacts} />
        </div>
        <div className="mt-5">
          <ListaLinkow slug={slug} linki={linki} />
        </div>
      </section>
      <HistoriaLogowan wpisy={historia} />
    </div>
  );
}
