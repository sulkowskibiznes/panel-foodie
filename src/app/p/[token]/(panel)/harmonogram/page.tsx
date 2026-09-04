import { KalendarzKlienta } from "@/components/harmonogram/kalendarz-klienta";
import { NawigacjaMiesiaca } from "@/components/harmonogram/wspolne";
import { copy } from "@/lib/copy";
import { domyslnyMiesiac, pobierzHarmonogram } from "@/lib/dane/harmonogram";
import { parsujMiesiac } from "@/lib/harmonogram/kalendarz";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";

/** Harmonogram klienta (SPEC rozdz. 5.3): tylko odczyt, dane wyłącznie po clientId z sesji (izolacja z kontekstu). */
export default async function HarmonogramKlienta({ params, searchParams }: PageProps<"/p/[token]/harmonogram">) {
  const { token } = await params;
  const { m } = await searchParams;
  const kontekst = await wymagajKontekstuKlienta(token);
  const okres = parsujMiesiac(typeof m === "string" ? m : null) ?? (await domyslnyMiesiac(kontekst.clientId, { zeSzkicami: false }));
  const harmonogram = await pobierzHarmonogram(kontekst.clientId, okres.rok, okres.miesiac, {
    zeSzkicami: false,
    adresy: { plik: (id, wariant) => `/p/${token}/plik/${id}/${wariant}`, awatar: (id) => `/p/${token}/awatar/${id}` },
  });
  const h = copy.harmonogram;
  return (
    <div className="space-y-4" data-harmonogram-klienta>
      <div>
        <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{h.tytul}</h1>
        <p className="mt-1 text-sm text-szary-600">{h.opis}</p>
      </div>
      <NawigacjaMiesiaca rok={okres.rok} miesiac={okres.miesiac} baza={`/p/${token}/harmonogram`} poprzedni={h.poprzedni} nastepny={h.nastepny} />
      <KalendarzKlienta harmonogram={harmonogram} token={token} />
    </div>
  );
}
