import { copy } from "@/lib/copy";
import { pobierzDokumentyKlienta } from "@/lib/dane/dokumenty";
import { pobierzFakturyKlienta } from "@/lib/dane/faktury";
import type { FakturaDlaKlienta } from "@/lib/dto/klient";
import { dniPoTerminie, dzisLokalnie } from "@/lib/faktury/status";
import { formatujDate, liczebnik } from "@/lib/format";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";

function KomorkaStatusu({ f, dzis }: { f: FakturaDlaKlienta; dzis: string }) {
  const t = copy.faktury;
  if (f.status === "po_terminie") {
    const dni = dniPoTerminie(f.termin, dzis);
    return (
      <span className="font-semibold text-czerwony" data-status-faktury="po_terminie">
        {t.status.po_terminie}
        <span className="block text-xs font-normal">{liczebnik(dni, t.poTerminieDni.jeden, t.poTerminieDni.kilka, t.poTerminieDni.wiele)}</span>
      </span>
    );
  }
  if (f.status === "oplacona") {
    return (
      <span className="font-medium text-zielony" data-status-faktury="oplacona">
        {t.status.oplacona}
        {f.zaplaconoDnia ? <span className="block text-xs font-normal text-szary-600">{t.oplaconaDnia.replace("{data}", formatujDate(f.zaplaconoDnia, { day: "numeric", month: "numeric", year: "numeric" }))}</span> : null}
      </span>
    );
  }
  return <span className="font-medium text-foodie-czern" data-status-faktury="do_zaplaty">{t.status.do_zaplaty}</span>;
}

/** Faktury i dokumenty (SPEC rozdz. 5.6): tabela faktur ze statusem i PDF, pod spodem dokumenty do pobrania. */
export default async function FakturyKlienta({ params }: PageProps<"/p/[token]/faktury">) {
  const { token } = await params;
  const kontekst = await wymagajKontekstuKlienta(token);
  const [faktury, dokumenty] = await Promise.all([pobierzFakturyKlienta(kontekst.clientId), pobierzDokumentyKlienta(kontekst.clientId)]);
  const t = copy.faktury;
  const dzis = dzisLokalnie(new Date());
  const data = (d: string) => formatujDate(d, { day: "numeric", month: "numeric", year: "numeric" });
  const kwota = (k: number) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2 }).format(k);

  return (
    <div className="space-y-6" data-faktury-klienta>
      <div>
        <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{t.tytul}</h1>
        <p className="mt-1 text-sm text-szary-600">{t.opis}</p>
      </div>
      {faktury.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki" data-brak-faktur>{t.brak}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-miekki">
          <table aria-label={t.tytul} className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
              <tr>
                <th className="px-4 py-3">{t.kolumny.numer}</th>
                <th className="hidden px-4 py-3 sm:table-cell">{t.kolumny.wystawiono}</th>
                <th className="px-4 py-3">{t.kolumny.termin}</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">{t.kolumny.netto}</th>
                <th className="px-4 py-3 text-right">{t.kolumny.brutto}</th>
                <th className="px-4 py-3">{t.kolumny.status}</th>
                <th className="px-4 py-3">{t.kolumny.pdf}</th>
              </tr>
            </thead>
            <tbody>
              {faktury.map((f) => (
                <tr key={f.id} data-faktura={f.id} className="border-t border-szary-100 align-top">
                  <td className="px-4 py-3 font-medium text-foodie-czern">{f.numer}</td>
                  <td className="hidden px-4 py-3 text-szary-600 sm:table-cell">{data(f.wystawiono)}</td>
                  <td className="px-4 py-3 text-szary-600">{data(f.termin)}</td>
                  <td className="hidden px-4 py-3 text-right text-szary-600 sm:table-cell">{kwota(f.netto)}</td>
                  <td className="px-4 py-3 text-right font-medium text-foodie-czern">{kwota(f.brutto)}</td>
                  <td className="px-4 py-3">
                    <KomorkaStatusu f={f} dzis={dzis} />
                  </td>
                  <td className="px-4 py-3">
                    {f.maPdf ? (
                      <a href={`/p/${token}/faktura/${f.id}`} className="font-medium text-foodie-fiolet hover:underline" data-pobierz-fakture>
                        {t.pobierz}
                      </a>
                    ) : (
                      <span className="text-xs text-szary-600">{t.bezPdf}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section data-dokumenty-klienta>
        <h2 className="font-naglowek text-xl text-foodie-czern">{t.dokumenty.tytul}</h2>
        <p className="mt-1 text-sm text-szary-600">{t.dokumenty.opis}</p>
        {dokumenty.length === 0 ? (
          <p className="mt-3 rounded-xl bg-white p-5 text-sm text-szary-600 shadow-miekki" data-brak-dokumentow>{t.dokumenty.brak}</p>
        ) : (
          <ul className="mt-3 divide-y divide-szary-100 rounded-xl bg-white shadow-miekki">
            {dokumenty.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-dokument={d.id}>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-szary-600">{t.rodzaje[d.rodzaj]}</p>
                  <p className="font-medium text-foodie-czern">{d.tytul}</p>
                  {d.obowiazujeOd ? <p className="text-xs text-szary-600">{t.dokumenty.obowiazujeOd.replace("{data}", formatujDate(d.obowiazujeOd))}</p> : null}
                </div>
                <a href={`/p/${token}/dokument/${d.id}`} className="font-medium text-foodie-fiolet hover:underline" data-pobierz-dokument>
                  {t.dokumenty.pobierz}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
