import { notFound } from "next/navigation";
import { DialogNowegoLinku } from "@/components/zespol/dostep/dialog-nowego-linku";
import { HistoriaLogowan } from "@/components/zespol/dostep/historia-logowan";
import { ListaLinkow } from "@/components/zespol/dostep/lista-linkow";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { pobierzHistorieDostepu, pobierzLinkiKlienta } from "@/lib/dane/linki";

/** Zakładka Dostęp (SPEC rozdz. 4.4, 12.4). */
export default async function DostepKlienta({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  // „Utwórz link" z karty klienta (plan 3b) otwiera okno od razu.
  const otworzNowy = (await searchParams).nowy === "1";
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
          {klient.demo || klient.status === "zakonczony" ? null : <DialogNowegoLinku slug={slug} kontakty={klient.client_contacts} otwartyNaStart={otworzNowy} />}
        </div>
        <div className="mt-5 space-y-4">
          {klient.demo ? <p className="rounded-lg bg-fiolet-050 px-3 py-2 text-sm leading-6 text-fiolet-700">{d.demo}</p> : null}
          {klient.status === "zakonczony" ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-bursztyn" data-dostep-zakonczony>{d.zakonczony}</p> : null}
          {klient.demo ? null : <ListaLinkow slug={slug} linki={linki} />}
        </div>
      </section>
      <HistoriaLogowan wpisy={historia} />
    </div>
  );
}
