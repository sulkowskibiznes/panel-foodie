import { notFound } from "next/navigation";
import { DialogFaktury } from "@/components/zespol/faktury/dialog-faktury";
import { ListaFaktur } from "@/components/zespol/faktury/lista-faktur";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzFakturyZespolu } from "@/lib/dane/faktury";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { dzisLokalnie } from "@/lib/faktury/status";
import { maUprawnienie } from "@/lib/uprawnienia";

/** Zakładka Faktury (SPEC rozdz. 10). Rola bez prawa do faktur dostaje 404 (kryterium 23). */
export default async function FakturyKlienta({ params }: PageProps<"/zespol/klienci/[slug]/faktury">) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "faktury", "podglad");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const faktury = await pobierzFakturyZespolu(klient.id);
  const t = copy.zespol.faktury;
  const pelne = maUprawnienie(czlonek.role, "faktury", "pelne");
  const dzis = dzisLokalnie(new Date());

  return (
    <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6" data-faktury-zespolu>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-naglowek text-xl text-foodie-czern">{t.tytul}</h2>
          <p className="mt-1 max-w-prose text-sm text-szary-600">{t.opis}</p>
        </div>
        {pelne && !klient.demo ? <DialogFaktury slug={slug} dzis={dzis} kwotaNetto={klient.monthly_amount_net} /> : null}
      </div>
      <div className="mt-5">
        {klient.demo ? <p className="rounded-lg bg-fiolet-050 px-3 py-2 text-sm leading-6 text-fiolet-700">{t.demo}</p> : <ListaFaktur slug={slug} faktury={faktury} mozeZmieniac={pelne} dzis={dzis} />}
      </div>
    </section>
  );
}
