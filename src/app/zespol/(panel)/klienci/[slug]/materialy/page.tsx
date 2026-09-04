import Link from "next/link";
import { notFound } from "next/navigation";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { pobierzPakietyKlienta } from "@/lib/dane/materialy";
import { etykietaOkresu, formatujDateCzas, tekstOdliczania } from "@/lib/format";
import { maUprawnienie } from "@/lib/uprawnienia";

/** Zakładka Materiały (SPEC rozdz. 12.2): lista pakietów klienta ze statusami i wejście do kreatora (12.3). */
export default async function MaterialyKlientaZespol({ params }: PageProps<"/zespol/klienci/[slug]/materialy">) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "materialy", "podglad");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const pakiety = await pobierzPakietyKlienta(klient.id, { zeSzkicami: true });
  const t = copy.zespol.pakietyMaterialow;
  const teraz = new Date();

  return (
    <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-naglowek text-xl text-foodie-czern">{t.tytul}</h2>
          <p className="mt-1 max-w-prose text-sm text-szary-600">{t.opis}</p>
        </div>
        {maUprawnienie(czlonek.role, "materialy", "pelne") ? (
          <Link href={`/zespol/klienci/${slug}/pakiety/nowy`} className="inline-flex h-9 items-center rounded-lg bg-foodie-fiolet px-3 text-sm font-medium text-white hover:bg-fiolet-600" data-nowy-pakiet>
            {copy.zespol.kreator.nowyPakiet}
          </Link>
        ) : null}
      </div>
      {pakiety.length === 0 ? (
        <p className="mt-5 text-sm text-szary-600">{t.brak}</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table aria-label={t.tytul} className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
              <tr>
                <th className="py-2 pr-4">{t.kolumny.miesiac}</th>
                <th className="py-2 pr-4">{t.kolumny.status}</th>
                <th className="py-2 pr-4">{t.kolumny.wyslano}</th>
                <th className="py-2 pr-4">{t.kolumny.auto}</th>
                <th className="py-2 pr-4 text-right">{t.kolumny.uwagi}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {pakiety.map((p) => (
                <tr key={p.id} className="border-t border-szary-100">
                  <td className="py-3 pr-4 font-medium text-foodie-czern">
                    {etykietaOkresu(p.okres.rok, p.okres.miesiac)}
                    {p.nazwaLokalu ? <span className="block text-xs font-normal text-szary-600">{p.nazwaLokalu}</span> : null}
                  </td>
                  <td className="py-3 pr-4 text-szary-600">
                    {copy.materialy.status[p.status]}
                    {p.runda > 1 ? ` v${p.runda}` : ""}
                  </td>
                  <td className="py-3 pr-4 text-szary-600">{p.wyslanoO ? formatujDateCzas(p.wyslanoO) : copy.zespol.pulpitPakiety.auto.brak}</td>
                  <td className="py-3 pr-4 text-szary-600">{p.status === "do_akceptacji" ? (p.autoAkceptacjaO ? tekstOdliczania(p.autoAkceptacjaO, teraz) : copy.zespol.pulpitPakiety.auto.wylaczona) : p.status === "poprawki" ? copy.zespol.pulpitPakiety.auto.zatrzymane : copy.zespol.pulpitPakiety.auto.brak}</td>
                  <td className="py-3 pr-4 text-right text-szary-600">{p.nierozwiazaneUwagi > 0 ? <span className="font-medium text-bursztyn">{p.nierozwiazaneUwagi}</span> : "0"}</td>
                  <td className="py-3 text-right">
                    <Link href={`/zespol/klienci/${slug}/pakiety/${p.id}`} className="font-medium text-foodie-fiolet hover:underline">
                      {t.otworz}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
