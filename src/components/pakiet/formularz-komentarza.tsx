"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { POLE_WYBORU } from "@/components/podglad/przelacznik-lokalu";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { WynikAkcji } from "@/lib/dto/wynik";

export type OpcjaCelu = { wartosc: string | null; etykieta: string };

/** Pole uwagi (SPEC rozdz. 6.7): do 4000 znaków, bez HTML, opcjonalnie „Do czego" (wariant reklamy). */
export function FormularzKomentarza({ id, onWyslij, etykieta, podpowiedz, przycisk, opcjeCelu }: { id: string; onWyslij: (tresc: string, cel: string | null) => Promise<WynikAkcji>; etykieta: string; podpowiedz?: string; przycisk: string; opcjeCelu?: OpcjaCelu[] }) {
  const router = useRouter();
  const [tresc, setTresc] = useState("");
  const [cel, setCel] = useState<string>("");
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const k = copy.pakiet.komentarze;

  function wyslij(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBlad(null);
    startTransition(async () => {
      const w = await onWyslij(tresc, cel === "" ? null : cel);
      if (!w.ok) {
        setBlad(w.blad);
        return;
      }
      setTresc("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={wyslij} className="space-y-2" data-formularz-komentarza>
      {opcjeCelu && opcjeCelu.length > 0 ? (
        <div>
          <label htmlFor={`${id}-cel`} className="block text-xs font-medium text-szary-600">
            {k.doCzego}
          </label>
          <select id={`${id}-cel`} value={cel} onChange={(e) => setCel(e.target.value)} className={`mt-1 ${POLE_WYBORU}`}>
            {opcjeCelu.map((o) => (
              <option key={o.wartosc ?? "calosc"} value={o.wartosc ?? ""}>
                {o.etykieta}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <label htmlFor={`${id}-tresc`} className="block text-sm font-medium text-foodie-czern">
        {etykieta}
      </label>
      <textarea
        id={`${id}-tresc`}
        value={tresc}
        onChange={(e) => setTresc(e.target.value.slice(0, 4000))}
        placeholder={podpowiedz}
        rows={3}
        maxLength={4000}
        className="w-full rounded-lg border border-szary-300 bg-white px-3 py-2 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-szary-600">{k.licznik.replace("{n}", String(tresc.length))}</span>
        <Button type="submit" size="lg" disabled={trwa || tresc.trim().length === 0}>
          {trwa ? k.wysylanie : przycisk}
        </Button>
      </div>
      {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
    </form>
  );
}
