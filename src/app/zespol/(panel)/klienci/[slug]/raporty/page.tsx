import { notFound } from "next/navigation";
import { DialogRaportu } from "@/components/zespol/raporty/dialog-raportu";
import { ListaRaportow } from "@/components/zespol/raporty/lista-raportow";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { ostatniMiesiacWspolpracyRaportu, pobierzRaportyKlienta } from "@/lib/dane/raporty";
import { kolejnyMiesiacWspolpracy } from "@/lib/harmonogram/kalendarz";
import { dzisLokalnie } from "@/lib/faktury/status";
import { maUprawnienie } from "@/lib/uprawnienia";

/** Zakładka Raporty (SPEC rozdz. 9): lista linków do systemu raportów, ręczne dodawanie dla ról z pełnym prawem. */
export default async function RaportyKlientaZespol({ params }: PageProps<"/zespol/klienci/[slug]/raporty">) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "raporty", "podglad");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const [raporty, ostatniMiesiac] = await Promise.all([pobierzRaportyKlienta(klient.id), ostatniMiesiacWspolpracyRaportu(klient.id)]);
  const t = copy.zespol.raporty;
  const dzis = dzisLokalnie(new Date());
  const podpowiedz = kolejnyMiesiacWspolpracy(ostatniMiesiac, klient.cooperation_started_on, dzis);
  const pelne = maUprawnienie(czlonek.role, "raporty", "pelne");

  return (
    <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6" data-raporty-zespolu>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-naglowek text-xl text-foodie-czern">{t.tytul}</h2>
          <p className="mt-1 max-w-prose text-sm text-szary-600">{t.opis}</p>
        </div>
        {pelne ? <DialogRaportu slug={slug} kategoria={klient.category} lokale={klient.locations.map((l) => ({ id: l.id, name: l.name }))} podpowiedzMiesiaca={podpowiedz} /> : null}
      </div>
      <div className="mt-5">
        <ListaRaportow slug={slug} raporty={raporty} mozeUsuwac={pelne} />
      </div>
    </section>
  );
}
