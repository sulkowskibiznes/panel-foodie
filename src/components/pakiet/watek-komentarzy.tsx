"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FormularzKomentarza, type OpcjaCelu } from "@/components/pakiet/formularz-komentarza";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { KomentarzDto } from "@/lib/dto/materialy";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { formatujDateCzas } from "@/lib/format";

export type AkcjeWatku = {
  dodaj: (tresc: string, wariantId: string | null) => Promise<WynikAkcji>;
  zalatwione?: (komentarzId: string) => Promise<WynikAkcji>;
};

function Plakietka({ children, ton }: { children: React.ReactNode; ton: "zielony" | "bursztyn" | "fiolet" }) {
  const klasy = { zielony: "bg-green-50 text-zielony", bursztyn: "bg-amber-50 text-bursztyn", fiolet: "bg-fiolet-050 text-fiolet-700" }[ton];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${klasy}`}>{children}</span>;
}

function Komentarz({ k, tryb, etykietaWariantu, onZalatwione, trwa }: { k: KomentarzDto; tryb: "klient" | "zespol"; etykietaWariantu?: (id: string) => string; onZalatwione?: (id: string) => void; trwa: boolean }) {
  const p = copy.pakiet.plakietki;
  const zespol = k.autor === "zespol";
  return (
    <li data-komentarz={k.id} data-wariant-komentarza={k.wariantId ?? undefined} className={`rounded-lg px-3 py-2 text-sm ${zespol ? "ml-4 bg-fiolet-050/60" : "bg-szary-050"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-szary-600">
        <span className="font-medium text-foodie-czern">{zespol ? `${k.autorNazwa} · ${copy.pakiet.komentarze.odpowiedzZespolu}` : k.autorNazwa}</span>
        <span>{formatujDateCzas(k.utworzonoO)}</span>
        {k.wariantId && etykietaWariantu ? <span>{copy.pakiet.komentarze.dotyczy.replace("{co}", etykietaWariantu(k.wariantId))}</span> : null}
        {k.poAkceptacji && !zespol ? <Plakietka ton="bursztyn">{p.uwagaPoAkceptacji}</Plakietka> : null}
        {k.zalatwionoO && !zespol ? <Plakietka ton="zielony">{p.zalatwione}</Plakietka> : null}
        {k.nieprzeczytany ? <Plakietka ton="fiolet">{tryb === "zespol" ? p.nieprzeczytanaUwaga : p.nieprzeczytane}</Plakietka> : null}
      </div>
      <p className="mt-1 whitespace-pre-line text-foodie-czern">{k.tresc}</p>
      {tryb === "zespol" && !zespol && !k.zalatwionoO && onZalatwione ? (
        <Button type="button" variant="outline" size="sm" className="mt-2" disabled={trwa} onClick={() => onZalatwione(k.id)}>
          {copy.zespol.pakietyMaterialow.zalatwione}
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Wątek pod materiałem (SPEC rozdz. 6.7): komentarze bieżącej rundy, poprzednie zwinięte w „Historia uwag (runda n)",
 * odpowiedzi zespołu w tym samym miejscu, „Załatwione" po stronie zespołu.
 */
export function WatekKomentarzy({ id, komentarze, runda, tryb, akcje, opcjeCelu, etykietaWariantu, tytul, etykietaPola }: { id: string; komentarze: KomentarzDto[]; runda: number; tryb: "klient" | "zespol"; akcje: AkcjeWatku | null; opcjeCelu?: OpcjaCelu[]; etykietaWariantu?: (id: string) => string; tytul?: string; etykietaPola?: string }) {
  const router = useRouter();
  const [trwa, startTransition] = useTransition();
  const k = copy.pakiet.komentarze;
  const biezace = komentarze.filter((x) => x.runda === runda);
  const poprzednieRundy = [...new Set(komentarze.filter((x) => x.runda < runda).map((x) => x.runda))].sort((a, b) => b - a);

  function zalatwione(komentarzId: string) {
    if (!akcje?.zalatwione) return;
    startTransition(async () => {
      const w = await akcje.zalatwione!(komentarzId);
      if (w.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3" data-watek={id}>
      <h3 className="text-sm font-semibold text-foodie-czern">{tytul ?? k.tytul}</h3>
      {biezace.length === 0 ? <p className="text-sm text-szary-600">{k.brak}</p> : null}
      {biezace.length > 0 ? (
        <ul className="space-y-2">
          {biezace.map((x) => (
            <Komentarz key={x.id} k={x} tryb={tryb} etykietaWariantu={etykietaWariantu} onZalatwione={akcje?.zalatwione ? zalatwione : undefined} trwa={trwa} />
          ))}
        </ul>
      ) : null}
      {poprzednieRundy.map((r) => (
        <details key={r} className="rounded-lg border border-szary-100 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-szary-600">{k.historia.replace("{n}", String(r))}</summary>
          <ul className="mt-2 space-y-2">
            {komentarze
              .filter((x) => x.runda === r)
              .map((x) => (
                <Komentarz key={x.id} k={x} tryb={tryb} etykietaWariantu={etykietaWariantu} trwa={trwa} />
              ))}
          </ul>
        </details>
      ))}
      {akcje ? (
        <FormularzKomentarza
          id={id}
          onWyslij={akcje.dodaj}
          etykieta={etykietaPola ?? (tryb === "klient" ? k.dodaj : copy.zespol.pakietyMaterialow.odpowiedz)}
          podpowiedz={tryb === "klient" ? k.podpowiedz : copy.zespol.pakietyMaterialow.odpowiedzPodpowiedz}
          przycisk={tryb === "klient" ? k.wyslij : copy.zespol.pakietyMaterialow.wyslijOdpowiedz}
          opcjeCelu={opcjeCelu}
        />
      ) : null}
    </div>
  );
}
