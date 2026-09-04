"use client";

import { etykietaWariantu, nazwaLokalu } from "@/components/podglad/reklama/wybor-wariantow";
import { copy } from "@/lib/copy";
import type { KomentarzDto, StronaDto, WariantDto } from "@/lib/dto/materialy";
import type { WyborWariantu } from "@/lib/reklamy/warianty";

function PlakietkaLokalu({ lokale, lokalId, wieleLokali }: { lokale: StronaDto[]; lokalId: string | null; wieleLokali: boolean }) {
  if (!wieleLokali) return null;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${lokalId ? "bg-fiolet-050 text-fiolet-700" : "bg-szary-100 text-szary-600"}`}>{nazwaLokalu(lokale, lokalId)}</span>;
}

function UwagiWariantu({ komentarze }: { komentarze: KomentarzDto[] }) {
  if (komentarze.length === 0) return null;
  return (
    <ul className="mt-1 space-y-1 text-xs text-szary-600" aria-label={copy.pakiet.komentarze.tytul}>
      {komentarze.map((k) => (
        <li key={k.id} className="rounded-md bg-amber-50 px-2 py-1 text-bursztyn">
          <span className="font-medium">{k.autorNazwa}:</span> {k.tresc}
        </li>
      ))}
    </ul>
  );
}

/**
 * „Zobacz wszystkie warianty" (SPEC rozdz. 7.4): siatka miniatur wszystkich grafik oraz listy tekstów
 * i nagłówków obok siebie. Wariant per lokal ma nazwę lokalu, wspólny podpis „wszystkie lokale" (1.4, poz. 15).
 * Komentarz przypięty do wariantu pojawia się przy nim (kryterium 15).
 */
export function WszystkieWarianty({ warianty, lokale, komentarze, wybor, onWybierz }: { warianty: WariantDto[]; lokale: StronaDto[]; komentarze: KomentarzDto[]; wybor: WyborWariantu; onWybierz: (zmiana: Partial<WyborWariantu>) => void }) {
  const p = copy.podglad;
  const wieleLokali = lokale.length > 1;
  const dlaWariantu = (id: string) => komentarze.filter((k) => k.wariantId === id);
  const grupa = (rodzaj: WariantDto["rodzaj"]) => warianty.filter((w) => w.rodzaj === rodzaj).sort((a, b) => (a.lokalId ?? "").localeCompare(b.lokalId ?? "") || a.pozycja - b.pozycja);
  const klucz = (w: WariantDto): keyof WyborWariantu | null => (w.rodzaj === "grafika" ? "grafikaId" : w.rodzaj === "tekst" ? "tekstId" : w.rodzaj === "naglowek" ? "naglowekId" : null);
  const wybierz = (w: WariantDto) => {
    const k = klucz(w);
    if (!k) return;
    onWybierz(w.lokalId !== null && w.lokalId !== wybor.lokalId ? { lokalId: w.lokalId, [k]: w.id } : { [k]: w.id });
  };
  const indeksWGrupie = (w: WariantDto) => warianty.filter((x) => x.rodzaj === w.rodzaj && x.lokalId === w.lokalId).sort((a, b) => a.pozycja - b.pozycja).findIndex((x) => x.id === w.id);

  return (
    <div className="space-y-6" data-wszystkie-warianty>
      <section>
        <h4 className="text-sm font-semibold text-foodie-czern">{p.grafiki}</h4>
        <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {grupa("grafika").map((w) => (
            <li key={w.id} data-wariant={w.id}>
              <button type="button" onClick={() => wybierz(w)} aria-pressed={wybor.grafikaId === w.id} className={`block w-full overflow-hidden rounded-lg ring-2 ${wybor.grafikaId === w.id ? "ring-foodie-fiolet" : "ring-transparent hover:ring-szary-300"}`}>
                {w.plik ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura przez signed URL
                  <img src={w.plik.thumbUrl} alt={etykietaWariantu(w, indeksWGrupie(w))} className="aspect-square w-full object-cover" />
                ) : (
                  <span className="block aspect-square w-full bg-szary-100" />
                )}
              </button>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-foodie-czern">
                {etykietaWariantu(w, indeksWGrupie(w))}
                <PlakietkaLokalu lokale={lokale} lokalId={w.lokalId} wieleLokali={wieleLokali} />
              </p>
              <UwagiWariantu komentarze={dlaWariantu(w.id)} />
            </li>
          ))}
        </ul>
      </section>
      <div className="grid gap-6 sm:grid-cols-2">
        {(["tekst", "naglowek"] as const).map((rodzaj) => (
          <section key={rodzaj}>
            <h4 className="text-sm font-semibold text-foodie-czern">{rodzaj === "tekst" ? p.teksty : p.naglowki}</h4>
            <ul className="mt-2 space-y-2">
              {grupa(rodzaj).map((w) => {
                const aktywny = (rodzaj === "tekst" ? wybor.tekstId : wybor.naglowekId) === w.id;
                return (
                  <li key={w.id} data-wariant={w.id}>
                    <button type="button" onClick={() => wybierz(w)} aria-pressed={aktywny} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${aktywny ? "border-foodie-fiolet bg-fiolet-050" : "border-szary-100 bg-white hover:border-szary-300"}`}>
                      <span className="flex flex-wrap items-center gap-1 text-xs text-szary-600">
                        {etykietaWariantu(w, indeksWGrupie(w))}
                        <PlakietkaLokalu lokale={lokale} lokalId={w.lokalId} wieleLokali={wieleLokali} />
                      </span>
                      <span className="mt-0.5 block whitespace-pre-line text-foodie-czern">{w.tekst}</span>
                    </button>
                    <UwagiWariantu komentarze={dlaWariantu(w.id)} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <section>
        <h4 className="text-sm font-semibold text-foodie-czern">{p.pozostale}</h4>
        <ul className="mt-2 space-y-1 text-sm">
          {(["opis", "cta", "link"] as const).flatMap((rodzaj) =>
            grupa(rodzaj).map((w) => (
              <li key={w.id} data-wariant={w.id} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-szary-600">{p.elementy[rodzaj]}:</span>
                <span className="text-foodie-czern">{w.tekst}</span>
                <PlakietkaLokalu lokale={lokale} lokalId={w.lokalId} wieleLokali={wieleLokali} />
                <UwagiWariantu komentarze={dlaWariantu(w.id)} />
              </li>
            )),
          )}
        </ul>
      </section>
    </div>
  );
}
