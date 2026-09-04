"use client";

import { useState, type ReactNode } from "react";
import { ReklamaFbKanal } from "@/components/podglad/reklama/fb-kanal";
import { ReklamaFbReels } from "@/components/podglad/reklama/fb-reels";
import { ReklamaFbRelacja } from "@/components/podglad/reklama/fb-relacja";
import { ReklamaIgKanal } from "@/components/podglad/reklama/ig-kanal";
import { ReklamaIgRelacja } from "@/components/podglad/reklama/ig-relacja";
import { DOMYSLNY_PLACEMENT, PLACEMENTY, placementDostepny, type Placement } from "@/components/podglad/reklama/placementy";
import { PrzelacznikPlacementu } from "@/components/podglad/reklama/przelacznik-placementu";
import { WszystkieWarianty } from "@/components/podglad/reklama/wszystkie-warianty";
import { WyborWariantow, nazwaLokalu } from "@/components/podglad/reklama/wybor-wariantow";
import type { Strona } from "@/components/podglad/typy";
import { copy } from "@/lib/copy";
import type { KomentarzDto, MaterialDto, StronaDto } from "@/lib/dto/materialy";
import { domyslnyWybor, liczbaKombinacji, zlozWariant, type WyborWariantu, type ZlozonyWariant } from "@/lib/reklamy/warianty";

export type StanReklamy = { placement: Placement; wybor: WyborWariantu; zlozony: ZlozonyWariant; strona: StronaDto | null };

const BRAK_STRONY: Strona = { nazwaStrony: "", igHandle: null, avatarUrl: null };

function Ramka({ placement, strona, zlozony }: { placement: Placement; strona: Strona; zlozony: ZlozonyWariant }) {
  switch (placement) {
    case "fb_kanal_telefon":
      return <ReklamaFbKanal strona={strona} wariant={zlozony} uklad="telefon" />;
    case "fb_kanal_komputer":
      return <ReklamaFbKanal strona={strona} wariant={zlozony} uklad="komputer" />;
    case "fb_relacje":
      return <ReklamaFbRelacja strona={strona} wariant={zlozony} />;
    case "fb_reels":
      return <ReklamaFbReels strona={strona} wariant={zlozony} />;
    case "ig_kanal":
      return <ReklamaIgKanal strona={strona} wariant={zlozony} />;
    case "ig_relacje_reels":
      return <ReklamaIgRelacja strona={strona} wariant={zlozony} />;
  }
}

function opisZrodel(zlozony: ZlozonyWariant, lokal: string): string | null {
  const e = copy.podglad.elementy;
  const zLokalu = (Object.keys(zlozony.zrodla) as Array<keyof typeof e>).filter((k) => zlozony.zrodla[k] === "lokal").map((k) => e[k]);
  const wspolne = (Object.keys(zlozony.zrodla) as Array<keyof typeof e>).filter((k) => zlozony.zrodla[k] === "wspolny").map((k) => e[k]);
  if (zLokalu.length === 0) return copy.podglad.zrodla.wszystkoWspolne;
  const czesci = [copy.podglad.zrodla.wersjaDlaLokalu.replace("{lokal}", lokal).replace("{elementy}", zLokalu.join(", "))];
  if (wspolne.length > 0) czesci.push(copy.podglad.zrodla.wspolne.replace("{elementy}", wspolne.join(", ")));
  return czesci.join(" ");
}

/**
 * Ekran reklamy (SPEC rozdz. 7.4): jedno miejsce ze stanem placementu i wyboru wariantów. Zmiana dowolnej
 * listy przerysowuje ramkę natychmiast, bez przeładowania. Lokal zmienia stronę (nazwa, nick, awatar)
 * i warianty per lokal; domyślnie pierwszy lokal (decyzja 2026-09-04). `dzieci` dostaje bieżący stan,
 * żeby formularz uwagi mógł przypiąć komentarz do konkretnego wariantu.
 */
export function PodgladReklamy({ reklama, lokale, tryb, dzieci }: { reklama: MaterialDto; lokale: StronaDto[]; tryb: "klient" | "zespol"; dzieci?: (stan: StanReklamy) => ReactNode }) {
  const [placement, setPlacement] = useState<Placement>(DOMYSLNY_PLACEMENT);
  const [wybor, setWybor] = useState<WyborWariantu>(() => domyslnyWybor(reklama.warianty, lokale[0]?.lokalId ?? null));
  const [wszystkie, setWszystkie] = useState(false);

  const strona = lokale.find((l) => l.lokalId === wybor.lokalId) ?? lokale[0] ?? null;
  const igHandle = strona?.igHandle ?? null;
  const opisPlacementu = PLACEMENTY.find((p) => p.id === placement);
  const placementWidoczny = opisPlacementu && placementDostepny(opisPlacementu, igHandle) ? placement : DOMYSLNY_PLACEMENT;
  const zlozony = zlozWariant(reklama.warianty, wybor);
  const wieleLokali = lokale.length > 1;
  const komentarzeWariantow: KomentarzDto[] = reklama.komentarze.filter((k) => k.wariantId !== null);
  const kombinacje = liczbaKombinacji(reklama.warianty, wybor.lokalId);

  return (
    <div className="space-y-4" data-reklama={reklama.id}>
      <PrzelacznikPlacementu wartosc={placementWidoczny} onChange={setPlacement} igHandle={igHandle} podpowiedzBrakIg={copy.podglad.brakIg[tryb]} />
      <WyborWariantow idPrefix={`reklama-${reklama.id}`} warianty={reklama.warianty} wybor={wybor} onChange={setWybor} lokale={lokale} pokazLokal={wieleLokali} />
      <p className="text-xs text-szary-600">{copy.podglad.warianty.kombinacje.replace("{n}", String(kombinacje))}</p>
      <div className="rounded-2xl bg-szary-100 p-3 sm:p-6" data-placement-aktywny={placementWidoczny}>
        <Ramka placement={placementWidoczny} strona={strona ?? BRAK_STRONY} zlozony={zlozony} />
      </div>
      {wieleLokali ? (
        <p className="text-sm text-szary-600" data-zrodla>
          {wybor.lokalId === null ? copy.podglad.zrodla.wszystkoWspolne : opisZrodel(zlozony, nazwaLokalu(lokale, wybor.lokalId))}
        </p>
      ) : null}
      <button type="button" onClick={() => setWszystkie((w) => !w)} aria-expanded={wszystkie} className="text-sm font-medium text-foodie-fiolet hover:underline">
        {wszystkie ? copy.podglad.ukryjWarianty : copy.podglad.wszystkieWarianty}
      </button>
      {wszystkie ? <WszystkieWarianty warianty={reklama.warianty} lokale={lokale} komentarze={komentarzeWariantow} wybor={wybor} onWybierz={(zmiana) => setWybor((w) => ({ ...w, ...zmiana }))} /> : null}
      {dzieci?.({ placement: placementWidoczny, wybor, zlozony, strona })}
    </div>
  );
}
