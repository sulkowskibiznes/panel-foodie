"use client";

import { useCallback, useState } from "react";
import { BaneryPakietu } from "@/components/pakiet/banery-pakietu";
import { ObserwatorObejrzenia } from "@/components/pakiet/obserwator-obejrzenia";
import { PasekDecyzji, type AkcjeDecyzji } from "@/components/pakiet/pasek-decyzji";
import { SekcjaKampanii } from "@/components/pakiet/sekcja-kampanii";
import { SekcjaMaterialu } from "@/components/pakiet/sekcja-materialu";
import { SekcjaRelacji } from "@/components/pakiet/sekcja-relacji";
import { WatekKomentarzy, type AkcjeWatku } from "@/components/pakiet/watek-komentarzy";
import { PostFb } from "@/components/podglad/post-fb";
import { ReelsFb } from "@/components/podglad/reels-fb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copy } from "@/lib/copy";
import type { KampaniaDto, MaterialDto, PakietSzczegoly } from "@/lib/dto/materialy";
import type { WynikAkcji } from "@/lib/dto/wynik";
import type { ReactNode } from "react";

export type NarzedziaEkranu = {
  material: (m: MaterialDto) => ReactNode;
  kampania: (k: KampaniaDto) => ReactNode;
};

export type AkcjeEkranu = {
  decyzje: AkcjeDecyzji | null;
  komentarz: ((dane: { materialId: string | null; wariantId: string | null; tresc: string }) => Promise<WynikAkcji>) | null;
  zalatwione: ((komentarzId: string) => Promise<WynikAkcji>) | null;
  obejrzenie: ((materialId: string) => Promise<void>) | null;
};

type Zakladka = "posty" | "relacje" | "kampanie" | "wszystko";

function nieprzeczytane(materialy: MaterialDto[]): number {
  return materialy.reduce((suma, m) => suma + m.komentarze.filter((k) => k.nieprzeczytany).length, 0);
}

/**
 * Ekran pakietu (SPEC rozdz. 6.2): ten sam dla klienta i podglądu zespołu. Zakładki Posty / Relacje / Kampanie /
 * Wszystko z plakietkami nieprzeczytanych odpowiedzi, pasek decyzji, banery, „Obejrzano x z y".
 */
export function EkranPakietu({ pakiet, teraz, tryb, mozeAkceptowac, akcje, blokada = null, narzedzia }: { pakiet: PakietSzczegoly; teraz: string; tryb: "klient" | "zespol"; mozeAkceptowac: boolean; akcje: AkcjeEkranu; /** Podgląd zespołu: przyciski decyzji wyszarzone z tą podpowiedzią, formularze uwag zastąpione notką. */ blokada?: string | null; /** Zespół: przyciski nad materiałem („Edytuj", „Podmień") i nad kampanią. */ narzedzia?: NarzedziaEkranu }) {
  const [zakladka, setZakladka] = useState<Zakladka>(pakiet.kampanie.length > 0 && pakiet.posty.length === 0 ? "kampanie" : "posty");
  const [obejrzane, setObejrzane] = useState<Set<string>>(() => new Set(pakiet.obejrzane));
  const z = copy.pakiet.zakladki;
  const stronaGlowna = pakiet.lokale[0] ?? null;

  const odnotuj = useCallback(
    (id: string) => {
      setObejrzane((s) => {
        if (s.has(id)) return s;
        const n = new Set(s);
        n.add(id);
        return n;
      });
      void akcje.obejrzenie?.(id);
    },
    [akcje],
  );

  const akcjeWatku = (materialId: string | null): AkcjeWatku | null =>
    akcje.komentarz
      ? {
          dodaj: (tresc, wariantId) => akcje.komentarz!({ materialId, wariantId, tresc }),
          zalatwione: akcje.zalatwione ?? undefined,
        }
      : null;
  const notkaWatku = blokada ? copy.podgladKlienta.komentarzeZablokowane : undefined;

  const sledzenie = tryb === "klient" && akcje.obejrzenie !== null;
  const liczniki = { posty: nieprzeczytane(pakiet.posty), relacje: nieprzeczytane(pakiet.relacje), kampanie: nieprzeczytane(pakiet.kampanie.map((k) => k.reklama).filter((m): m is MaterialDto => m !== null)) };

  const Posty = (
    <div className="space-y-4">
      {pakiet.posty.map((m) => {
        const lokale = m.lokaleIds.length > 0 ? pakiet.lokale.filter((l) => m.lokaleIds.includes(l.lokalId)) : pakiet.lokale;
        return (
          <ObserwatorObejrzenia key={m.id} id={m.id} aktywny={sledzenie && !obejrzane.has(m.id)} onObejrzano={odnotuj}>
            <SekcjaMaterialu
              material={m}
              narzedzia={narzedzia?.material(m)}
              podglad={m.typ === "reels" ? <ReelsFb strona={stronaGlowna ?? { nazwaStrony: "", igHandle: null, avatarUrl: null }} plik={m.pliki[0] ?? null} tekst={m.opis} /> : <PostFb lokale={lokale.length > 0 ? lokale : pakiet.lokale} tekst={m.opis} pliki={m.pliki} publikacjaO={m.publikacjaO} />}
              watek={<WatekKomentarzy id={`watek-${m.id}`} komentarze={m.komentarze} runda={pakiet.runda} tryb={tryb} akcje={akcjeWatku(m.id)} notka={notkaWatku} />}
            />
          </ObserwatorObejrzenia>
        );
      })}
    </div>
  );
  const Relacje = pakiet.relacje.length > 0 ? <SekcjaRelacji relacje={pakiet.relacje} strona={stronaGlowna} runda={pakiet.runda} tryb={tryb} akcje={akcje.komentarz ? akcjeWatku : null} onObejrzano={sledzenie ? odnotuj : undefined} notka={notkaWatku} narzedzia={narzedzia?.material} /> : null;
  const Kampanie = (
    <div className="space-y-4">
      {pakiet.kampanie.map((k, i) => (
        <ObserwatorObejrzenia key={k.id} id={k.reklama?.id ?? k.id} aktywny={sledzenie && !!k.reklama && !obejrzane.has(k.reklama.id)} onObejrzano={odnotuj}>
          <SekcjaKampanii kampania={k} numer={i + 1} liczba={pakiet.kampanie.length} lokale={pakiet.lokale} runda={pakiet.runda} tryb={tryb} akcje={k.reklama ? akcjeWatku(k.reklama.id) : null} notka={notkaWatku} narzedzia={narzedzia?.kampania(k)} />
        </ObserwatorObejrzenia>
      ))}
    </div>
  );

  const etykieta = (nazwa: string, liczba: number, nowe: number) => (
    <span className="flex items-center gap-1.5">
      {nazwa} ({liczba}){nowe > 0 ? <span className="rounded-full bg-foodie-fiolet px-1.5 text-[11px] font-semibold text-white" aria-label={copy.pakiet.noweOdpowiedzi.replace("{n}", String(nowe))}>{nowe}</span> : null}
    </span>
  );

  return (
    <div className="space-y-4">
      <PasekDecyzji pakiet={pakiet} teraz={teraz} tryb={tryb} mozeAkceptowac={mozeAkceptowac} obejrzane={obejrzane.size} akcje={akcje.decyzje} blokada={blokada} />
      <BaneryPakietu pakiet={pakiet} />
      <Tabs value={zakladka} onValueChange={(v) => setZakladka(v as Zakladka)} className="gap-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-white p-1 shadow-miekki group-data-horizontal/tabs:h-auto" aria-label={copy.nawigacja.materialy}>
          <TabsTrigger value="posty" className="h-9 flex-none whitespace-nowrap px-3">{etykieta(z.posty, pakiet.posty.length, liczniki.posty)}</TabsTrigger>
          <TabsTrigger value="relacje" className="h-9 flex-none whitespace-nowrap px-3">{etykieta(z.relacje, pakiet.relacje.length, liczniki.relacje)}</TabsTrigger>
          <TabsTrigger value="kampanie" className="h-9 flex-none whitespace-nowrap px-3">{etykieta(z.kampanie, pakiet.kampanie.length, liczniki.kampanie)}</TabsTrigger>
          <TabsTrigger value="wszystko" className="h-9 flex-none whitespace-nowrap px-3">{z.wszystko}</TabsTrigger>
        </TabsList>
        <TabsContent value="posty">{Posty}</TabsContent>
        <TabsContent value="relacje">{Relacje}</TabsContent>
        <TabsContent value="kampanie">{Kampanie}</TabsContent>
        <TabsContent value="wszystko">
          <div className="space-y-4">
            {Posty}
            {Relacje}
            {Kampanie}
          </div>
        </TabsContent>
      </Tabs>
      <section className="rounded-xl bg-white p-4 shadow-miekki sm:p-6" data-uwagi-pakietu>
        <WatekKomentarzy id="watek-pakiet" komentarze={pakiet.komentarzePakietu} runda={pakiet.runda} tryb={tryb} akcje={akcjeWatku(null)} tytul={copy.pakiet.komentarze.doPakietu} etykietaPola={tryb === "klient" ? copy.pakiet.komentarze.doPakietuOpis : undefined} notka={notkaWatku} />
      </section>
    </div>
  );
}
