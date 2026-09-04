"use client";

import { useEffect, useState, type ReactNode } from "react";
import { WatekKomentarzy, type AkcjeWatku } from "@/components/pakiet/watek-komentarzy";
import { RelacjaFb, type RelacjaWSerii } from "@/components/podglad/relacja-fb";
import { copy } from "@/lib/copy";
import type { MaterialDto, StronaDto } from "@/lib/dto/materialy";
import { formatujDate } from "@/lib/format";

/** Seria relacji: jedna ramka 9:16 z nawigacją przez cały pakiet; wątek uwag dotyczy pokazywanej relacji. */
export function SekcjaRelacji({ relacje, strona, runda, tryb, akcje, onObejrzano, notka, narzedzia }: { relacje: MaterialDto[]; strona: StronaDto | null; runda: number; tryb: "klient" | "zespol"; akcje: ((materialId: string) => AkcjeWatku | null) | null; onObejrzano?: (id: string) => void; notka?: string; narzedzia?: (m: MaterialDto) => ReactNode }) {
  const [biezacaId, setBiezacaId] = useState<string | null>(relacje[0]?.id ?? null);
  const biezaca = relacje.find((r) => r.id === biezacaId) ?? relacje[0] ?? null;
  const seria: RelacjaWSerii[] = relacje.map((r) => ({ id: r.id, tytul: r.tytul, plik: r.pliki[0] ?? null }));

  useEffect(() => {
    if (!biezaca || !onObejrzano) return;
    const id = window.setTimeout(() => onObejrzano(biezaca.id), 2000);
    return () => window.clearTimeout(id);
  }, [biezaca, onObejrzano]);

  if (!biezaca) return null;
  return (
    <section id={`material-${biezaca.id}`} data-material={biezaca.id} data-typ="relacja" className="rounded-xl bg-white p-4 shadow-miekki sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="font-naglowek text-lg text-foodie-czern">{biezaca.tytul}</h2>
        {biezaca.poprawiony ? <span data-plakietka="poprawione" className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-bursztyn">{copy.pakiet.plakietki.poprawione}</span> : null}
        {biezaca.nowy ? <span data-plakietka="nowe" className="rounded-full bg-fiolet-050 px-2 py-0.5 text-[11px] font-medium text-fiolet-700">{copy.pakiet.plakietki.nowe}</span> : null}
        <span className="ml-auto text-sm text-szary-600">
          {copy.podglad.publikacja} <span className="font-medium text-foodie-czern">{biezaca.publikacjaO ? formatujDate(biezaca.publikacjaO, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : copy.podglad.bezDaty}</span>
        </span>
      </header>
      {narzedzia ? <div className="mb-3">{narzedzia(biezaca)}</div> : null}
      <RelacjaFb strona={strona ?? { nazwaStrony: "", igHandle: null, avatarUrl: null }} relacje={seria} onZmiana={(r) => setBiezacaId(r.id)} />
      <div className="mt-5 border-t border-szary-100 pt-4">
        <WatekKomentarzy id={`watek-${biezaca.id}`} komentarze={biezaca.komentarze} runda={runda} tryb={tryb} akcje={akcje ? akcje(biezaca.id) : null} notka={notka} />
      </div>
    </section>
  );
}
