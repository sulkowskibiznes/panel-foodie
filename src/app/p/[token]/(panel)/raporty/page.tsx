import { ExternalLink } from "lucide-react";
import { copy } from "@/lib/copy";
import { pobierzRaportyKlienta } from "@/lib/dane/raporty";
import { etykietaMiesiaca, formatujDate } from "@/lib/format";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";

/** Raporty (SPEC rozdz. 5.5): karty z linkiem do systemu raportów w nowej karcie, bez iframe. */
export default async function RaportyKlienta({ params }: PageProps<"/p/[token]/raporty">) {
  const { token } = await params;
  const kontekst = await wymagajKontekstuKlienta(token);
  const raporty = await pobierzRaportyKlienta(kontekst.clientId);
  const r = copy.raporty;
  return (
    <div className="space-y-4" data-raporty-klienta>
      <div>
        <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{r.tytul}</h1>
        <p className="mt-1 text-sm text-szary-600">{r.opis}</p>
      </div>
      {raporty.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki" data-brak-raportow>{r.brak}</p>
      ) : (
        <ul className="space-y-3">
          {raporty.map((rap) => (
            <li key={rap.id} className="rounded-xl bg-white p-5 shadow-miekki" data-raport={rap.id}>
              <p className="text-xs font-medium uppercase tracking-wide text-szary-600">
                {etykietaMiesiaca(rap.rok, rap.miesiac)}
                {rap.miesiacWspolpracy ? ` · ${r.miesiacWspolpracy.replace("{n}", String(rap.miesiacWspolpracy))}` : ""}
              </p>
              <h2 className="mt-1 font-naglowek text-xl text-foodie-czern">
                {rap.tytul}
                {rap.nazwaLokalu ? <span className="ml-2 text-base text-szary-600">{rap.nazwaLokalu}</span> : null}
              </h2>
              <p className="mt-1 text-sm text-szary-600">{r.opublikowano.replace("{data}", formatujDate(rap.opublikowanoO))}</p>
              <a href={rap.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-foodie-fiolet px-5 text-sm font-medium text-white hover:bg-fiolet-600" data-otworz-raport>
                {r.otworz}
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
