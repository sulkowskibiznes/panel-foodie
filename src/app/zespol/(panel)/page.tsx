import Link from "next/link";
import { wymagajCzlonka } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientowDla } from "@/lib/dane/klienci-zespolu";
import { formatujKwote } from "@/lib/format";

/** Pulpit (SPEC rozdz. 12.1): w fazie 1 lista klientów wg roli; kolumny statusów pakietów dochodzą w fazie 3. */
export default async function Pulpit() {
  const czlonek = await wymagajCzlonka();
  const klienci = await pobierzKlientowDla(czlonek);
  const k = copy.zespol.pulpit.kolumny;

  return (
    <div>
      <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{copy.zespol.pulpit.tytul}</h1>
      <p className="mt-1 text-sm text-szary-600">{copy.zespol.pulpit.opis}</p>
      {klienci.length === 0 ? (
        <p className="mt-8 rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki">{copy.zespol.pulpit.brakKlientow}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow-miekki">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
              <tr>
                <th className="px-4 py-3">{k.klient}</th>
                <th className="px-4 py-3">{k.kategoria}</th>
                <th className="px-4 py-3">{k.pakiet}</th>
                <th className="px-4 py-3 text-right">{k.doAkceptacji}</th>
                <th className="px-4 py-3 text-right">{k.linki}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {klienci.map((kl) => (
                <tr key={kl.id} className="border-t border-szary-100">
                  <td className="px-4 py-3 font-medium text-foodie-czern">{kl.name}</td>
                  <td className="px-4 py-3 text-szary-600">{copy.zespol.kategorieKrotko[kl.category]}</td>
                  <td className="px-4 py-3 text-szary-600">
                    {copy.zespol.pakiety[kl.tier]}
                    {kl.monthly_amount_net ? ` · ${formatujKwote(kl.monthly_amount_net)} ${copy.zespol.pulpit.miesiecznie}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {kl.doAkceptacji > 0 ? <span className="rounded-full bg-fiolet-050 px-2 py-0.5 font-medium text-fiolet-700">{kl.doAkceptacji}</span> : <span className="text-szary-300">0</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-szary-600">{kl.aktywneLinki}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/zespol/klienci/${kl.slug}`} className="font-medium text-foodie-fiolet hover:underline">
                      {copy.zespol.pulpit.otworz}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
