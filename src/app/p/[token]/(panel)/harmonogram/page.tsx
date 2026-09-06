import { notFound } from "next/navigation";
import { KalendarzKlienta } from "@/components/harmonogram/kalendarz-klienta";
import { NawigacjaOkresu } from "@/components/harmonogram/wspolne";
import { copy } from "@/lib/copy";
import { domyslnyPakiet, pobierzHarmonogramOkresu } from "@/lib/dane/harmonogram";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";
import { czyUuid } from "@/lib/walidacja";

/**
 * Harmonogram klienta (SPEC rozdz. 5.3): widok okresu pakietu (`?p=`), tylko odczyt, dane wyłącznie po clientId
 * z sesji (izolacja z kontekstu). Szkic albo cudzy pakiet daje 404, nigdy 403.
 */
export default async function HarmonogramKlienta({ params, searchParams }: PageProps<"/p/[token]/harmonogram">) {
  const { token } = await params;
  const { p } = await searchParams;
  const kontekst = await wymagajKontekstuKlienta(token);
  const zadany = typeof p === "string" && czyUuid(p) ? p : null;
  const pakietId = zadany ?? (await domyslnyPakiet(kontekst.clientId, { zeSzkicami: false }));
  const harmonogram = pakietId
    ? await pobierzHarmonogramOkresu(kontekst.clientId, pakietId, { zeSzkicami: false, adresy: { plik: (id, wariant) => `/p/${token}/plik/${id}/${wariant}`, awatar: (id) => `/p/${token}/awatar/${id}` } })
    : null;
  if (zadany && !harmonogram) notFound();
  const h = copy.harmonogram;
  return (
    <div className="space-y-4" data-harmonogram-klienta>
      <div>
        <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{h.tytul}</h1>
        <p className="mt-1 text-sm text-szary-600">{h.opis}</p>
      </div>
      {harmonogram ? (
        <>
          <NawigacjaOkresu okres={harmonogram.pakiet.okres} baza={`/p/${token}/harmonogram`} poprzedniId={harmonogram.nawigacja.poprzedniId} nastepnyId={harmonogram.nawigacja.nastepnyId} poprzedni={h.poprzedni} nastepny={h.nastepny} />
          <KalendarzKlienta harmonogram={harmonogram} token={token} />
        </>
      ) : (
        <p className="rounded-xl bg-white p-5 text-sm text-szary-600 shadow-miekki" data-brak-pakietu>{h.brakPakietu}</p>
      )}
    </div>
  );
}
