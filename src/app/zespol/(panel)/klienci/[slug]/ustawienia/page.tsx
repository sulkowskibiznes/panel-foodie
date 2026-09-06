import { notFound } from "next/navigation";
import { UsunDaneKlienta } from "@/components/zespol/ustawienia-klienta/usun-dane";
import { Wspolpraca } from "@/components/zespol/ustawienia-klienta/wspolpraca";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { pobierzStanWspolpracy } from "@/lib/dane/offboarding";
import { maUprawnienie } from "@/lib/uprawnienia";

/** Zakładka Ustawienia karty klienta (SPEC rozdz. 12.2, 17): zakończenie i wznowienie współpracy, usunięcie danych. */
export default async function UstawieniaKlienta({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "klienci", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const stan = await pobierzStanWspolpracy(klient.id);
  if (!stan) notFound();
  const u = copy.zespol.ustawieniaKlienta;

  return (
    <div className="space-y-6" data-ustawienia-klienta>
      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
        <h2 className="font-naglowek text-xl text-foodie-czern">{u.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{u.opis}</p>
        <div className="mt-4">
          <Wspolpraca slug={slug} nazwa={klient.name} stan={stan} />
        </div>
      </section>
      <section className="rounded-xl border border-red-100 bg-white p-5 shadow-miekki sm:p-6" data-usuwanie-danych>
        <h2 className="font-naglowek text-xl text-czerwony">{u.usuwanie.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{u.usuwanie.opis}</p>
        <div className="mt-4">
          {klient.demo ? (
            <p className="text-sm text-szary-600">{u.usuwanie.klientDemo}</p>
          ) : !maUprawnienie(czlonek.role, "ustawienia", "pelne") ? (
            <p className="text-sm text-szary-600" data-usuwanie-tylko-admin>{u.usuwanie.tylkoAdmin}</p>
          ) : stan.status !== "zakonczony" ? (
            <p className="text-sm text-szary-600" data-usuwanie-najpierw-zakoncz>{u.usuwanie.najpierwZakoncz}</p>
          ) : (
            <UsunDaneKlienta slug={slug} nazwa={klient.name} />
          )}
        </div>
      </section>
    </div>
  );
}
