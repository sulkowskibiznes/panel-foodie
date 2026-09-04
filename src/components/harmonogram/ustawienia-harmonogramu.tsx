"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { WynikAkcji } from "@/lib/dto/wynik";
import type { PakietWKalendarzu } from "@/lib/dto/harmonogram";

const POLE = "mt-1 h-9 w-full rounded-lg border border-szary-300 bg-white px-2 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet";

/** Dzień zakończenia pakietu (period_to) i domyślne godziny publikacji klienta (SPEC rozdz. 8). */
export function UstawieniaHarmonogramu({ pakiety, godziny, zapisz }: { pakiety: PakietWKalendarzu[]; godziny: number[]; zapisz: (dane: { pakietId: string; koniecOkresu?: string | null; godziny?: string }) => Promise<WynikAkcji> }) {
  const router = useRouter();
  const h = copy.zespol.harmonogram;
  const [koniec, setKoniec] = useState<Record<string, string>>(Object.fromEntries(pakiety.map((p) => [p.id, p.koniecOkresu ?? ""])));
  const [godzinyTekst, setGodzinyTekst] = useState(godziny.join(", "));
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const pierwszy = pakiety[0];
  if (!pierwszy) return null;

  function wyslij(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBlad(null);
    startTransition(async () => {
      for (const p of pakiety) {
        const w = await zapisz({ pakietId: p.id, koniecOkresu: koniec[p.id] || null, ...(p.id === pierwszy!.id ? { godziny: godzinyTekst } : {}) });
        if (!w.ok) {
          setBlad(w.blad);
          return;
        }
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={wyslij} className="rounded-xl bg-white p-3 shadow-miekki" data-ustawienia-harmonogramu>
      {pakiety.map((p) => (
        <div key={p.id} className="mb-3">
          <label htmlFor={`koniec-${p.id}`} className="block text-xs font-medium text-szary-600">
            {h.dzienZakonczenia}
            {p.nazwaLokalu ? ` (${p.nazwaLokalu})` : ""}
          </label>
          <input id={`koniec-${p.id}`} type="date" value={koniec[p.id] ?? ""} onChange={(e) => setKoniec((s) => ({ ...s, [p.id]: e.target.value }))} className={POLE} />
        </div>
      ))}
      <p className="text-xs text-szary-600">{h.dzienZakonczeniaOpis}</p>
      <div className="mt-3">
        <label htmlFor="godziny-domyslne" className="block text-xs font-medium text-szary-600">{h.godzinyDomyslne}</label>
        <input id="godziny-domyslne" value={godzinyTekst} onChange={(e) => setGodzinyTekst(e.target.value)} className={POLE} />
        <p className="mt-1 text-xs text-szary-600">{h.godzinyDomyslneOpis}</p>
      </div>
      {blad ? <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-czerwony">{blad}</p> : null}
      <Button type="submit" size="sm" className="mt-3" disabled={trwa}>{copy.zespol.materialy.edycja.zapisz}</Button>
    </form>
  );
}
