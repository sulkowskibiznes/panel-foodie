"use client";

import type { OpcjaCelu } from "@/components/pakiet/formularz-komentarza";
import { WatekKomentarzy, type AkcjeWatku } from "@/components/pakiet/watek-komentarzy";
import { PodgladReklamy } from "@/components/podglad/reklama/podglad-reklamy";
import { etykietaWariantu, nazwaLokalu } from "@/components/podglad/reklama/wybor-wariantow";
import { copy } from "@/lib/copy";
import type { KampaniaDto, StronaDto, WariantDto } from "@/lib/dto/materialy";

/**
 * Kampania jako osobna sekcja z nazwą, celem i zdaniem od zespołu (SPEC rozdz. 6.2, kryterium 16).
 * Formularz uwagi dostaje bieżący stan podglądu, żeby przypiąć komentarz do konkretnego wariantu (kryterium 15).
 */
export function SekcjaKampanii({ kampania, numer, liczba, lokale, runda, tryb, akcje }: { kampania: KampaniaDto; numer: number; liczba: number; lokale: StronaDto[]; runda: number; tryb: "klient" | "zespol"; akcje: AkcjeWatku | null }) {
  const reklama = kampania.reklama;
  const p = copy.pakiet;
  const lokaleReklamy = reklama && reklama.lokaleIds.length > 0 ? lokale.filter((l) => reklama.lokaleIds.includes(l.lokalId)) : lokale;

  const etykieta = (wariantId: string): string => {
    const w = reklama?.warianty.find((x) => x.id === wariantId);
    if (!w) return "";
    const wGrupie = (reklama?.warianty ?? []).filter((x: WariantDto) => x.rodzaj === w.rodzaj && x.lokalId === w.lokalId).sort((a, b) => a.pozycja - b.pozycja).findIndex((x) => x.id === w.id);
    const nazwa = etykietaWariantu(w, Math.max(0, wGrupie));
    return w.lokalId ? `${nazwa} (${nazwaLokalu(lokaleReklamy, w.lokalId)})` : nazwa;
  };

  return (
    <section id={`kampania-${kampania.id}`} data-kampania={kampania.id} className="rounded-xl bg-white p-4 shadow-miekki sm:p-6">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-szary-600">{p.kampania.ktora.replace("{n}", String(numer)).replace("{liczba}", String(liczba))}</p>
        <h2 className="mt-1 font-naglowek text-lg text-foodie-czern">{kampania.nazwa}</h2>
        {kampania.cel ? (
          <p className="mt-1 text-sm text-szary-600">
            {p.kampania.cel} <span className="text-foodie-czern">{copy.podglad.cele[kampania.cel]}</span>
          </p>
        ) : null}
        {kampania.notatka ? <p className="mt-2 text-sm leading-6 text-foodie-czern">{kampania.notatka}</p> : null}
      </header>
      {reklama ? (
        <PodgladReklamy
          reklama={reklama}
          lokale={lokaleReklamy}
          tryb={tryb}
          dzieci={(stan) => {
            const opcje: OpcjaCelu[] = [{ wartosc: null, etykieta: p.komentarze.calaReklama }];
            if (stan.zlozony.grafika) opcje.push({ wartosc: stan.zlozony.grafika.id, etykieta: `${p.komentarze.taGrafika} (${etykieta(stan.zlozony.grafika.id)})` });
            if (stan.zlozony.tekst) opcje.push({ wartosc: stan.zlozony.tekst.id, etykieta: `${p.komentarze.tenTekst} (${etykieta(stan.zlozony.tekst.id)})` });
            if (stan.zlozony.naglowek) opcje.push({ wartosc: stan.zlozony.naglowek.id, etykieta: `${p.komentarze.tenNaglowek} (${etykieta(stan.zlozony.naglowek.id)})` });
            return (
              <div className="mt-2 border-t border-szary-100 pt-4">
                <WatekKomentarzy id={`watek-${reklama.id}`} komentarze={reklama.komentarze} runda={runda} tryb={tryb} akcje={akcje} opcjeCelu={opcje} etykietaWariantu={etykieta} />
              </div>
            );
          }}
        />
      ) : null}
    </section>
  );
}
