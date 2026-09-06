"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { WynikAkcji } from "@/lib/dto/wynik";
import type { PakietWKalendarzu } from "@/lib/dto/harmonogram";
import type { Okres } from "@/lib/harmonogram/kalendarz";

const POLE = "mt-1 h-9 w-full rounded-lg border border-szary-300 bg-white px-2 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet";

/** Okres każdego pakietu w widoku (od-do, period_from i period_to) i domyślne godziny publikacji klienta (SPEC rozdz. 8). */
export function UstawieniaHarmonogramu({ pakiety, godziny, zapisz }: { pakiety: PakietWKalendarzu[]; godziny: number[]; zapisz: (dane: { pakietId: string; okres?: Okres; godziny?: string }) => Promise<WynikAkcji> }) {
  const router = useRouter();
  const h = copy.zespol.harmonogram;
  const [okresy, setOkresy] = useState<Record<string, Okres>>(Object.fromEntries(pakiety.map((p) => [p.id, { od: p.okres.od, do: p.okres.do }])));
  const [godzinyTekst, setGodzinyTekst] = useState(godziny.join(", "));
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const pierwszy = pakiety[0];
  if (!pierwszy) return null;

  function wyslij(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBlad(null);
    for (const p of pakiety) {
      const o = okresy[p.id];
      if (o && o.od > o.do) {
        setBlad(h.bledy.zlyOkres);
        return;
      }
    }
    startTransition(async () => {
      for (const p of pakiety) {
        const o = okresy[p.id];
        const zmieniony = o && (o.od !== p.okres.od || o.do !== p.okres.do);
        const w = await zapisz({ pakietId: p.id, ...(zmieniony ? { okres: o } : {}), ...(p.id === pierwszy!.id ? { godziny: godzinyTekst } : {}) });
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
        <div key={p.id} className="mb-3" data-okres-pakietu={p.id}>
          <p className="text-xs font-medium text-szary-600">
            {h.okresPakietu}
            {p.nazwaLokalu ? ` (${p.nazwaLokalu})` : ""}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-szary-600">
              {h.od}
              <input id={`od-${p.id}`} type="date" value={okresy[p.id]?.od ?? ""} onChange={(e) => setOkresy((s) => ({ ...s, [p.id]: { od: e.target.value, do: s[p.id]?.do ?? p.okres.do } }))} className={POLE} data-okres-od />
            </label>
            <label className="text-xs text-szary-600">
              {h.do}
              <input id={`do-${p.id}`} type="date" value={okresy[p.id]?.do ?? ""} min={okresy[p.id]?.od} onChange={(e) => setOkresy((s) => ({ ...s, [p.id]: { od: s[p.id]?.od ?? p.okres.od, do: e.target.value } }))} className={POLE} data-okres-do />
            </label>
          </div>
        </div>
      ))}
      <p className="text-xs text-szary-600">{h.okresPakietuOpis}</p>
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
