"use client";

import { ChevronLeft, ChevronRight, Heart, MoreHorizontal, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AwatarStrony } from "@/components/podglad/awatar-strony";
import { Ramka916 } from "@/components/podglad/ramka-9-16";
import type { Strona } from "@/components/podglad/typy";
import { copy } from "@/lib/copy";
import type { PlikDto } from "@/lib/dto/materialy";

export type RelacjaWSerii = { id: string; tytul: string; plik: PlikDto | null };

/**
 * Relacja na Facebooku 9:16 (SPEC rozdz. 7.2): pasek segmentów (tyle, ile relacji w pakiecie),
 * awatar + nazwa + „2 godz.", pole „Odpowiedz" na dole, nawigacja strzałkami i tapnięciem przez całą serię.
 */
export function RelacjaFb({ strona, relacje, start = 0, onZmiana, className = "" }: { strona: Strona; relacje: RelacjaWSerii[]; start?: number; onZmiana?: (relacja: RelacjaWSerii, indeks: number) => void; className?: string }) {
  const [indeks, setIndeks] = useState(Math.min(start, Math.max(0, relacje.length - 1)));
  const biezaca = relacje[indeks] ?? null;
  const p = copy.podglad;

  useEffect(() => {
    if (biezaca) onZmiana?.(biezaca, indeks);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- powiadamiamy tylko o zmianie indeksu
  }, [indeks]);

  const idz = (delta: number) => setIndeks((i) => Math.max(0, Math.min(relacje.length - 1, i + delta)));
  if (!biezaca) return null;

  return (
    <div className={`mx-auto w-full max-w-[320px] ${className}`}>
      <p className="mb-2 text-center text-sm text-szary-600">{p.relacja.replace("{n}", String(indeks + 1)).replace("{liczba}", String(relacje.length))}</p>
      <div data-podglad="relacja-fb" className="relative">
        <Ramka916
          plik={biezaca.plik}
          gora={
            <div className="px-3 pt-2">
              <div className="flex gap-1" aria-hidden>
                {relacje.map((r, i) => (
                  <span key={r.id} className={`h-0.5 flex-1 rounded-full ${i <= indeks ? "bg-white" : "bg-white/40"}`} />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <AwatarStrony strona={strona} rozmiar={32} />
                <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                  {strona.nazwaStrony} <span className="font-normal text-white/80">{p.godzinTemu}</span>
                </p>
                <MoreHorizontal className="size-5" aria-hidden />
                <X className="size-5" aria-hidden />
              </div>
            </div>
          }
          dol={
            <div className="flex items-center gap-3 px-3 pt-8 pb-3">
              <span className="flex-1 rounded-full border border-white/70 px-4 py-2 text-[13px] text-white/90">{p.odpowiedz}</span>
              <Heart className="size-6" aria-hidden />
              <Send className="size-6" aria-hidden />
            </div>
          }
        >
          <button type="button" aria-label={p.poprzedni} onClick={() => idz(-1)} disabled={indeks === 0} className="absolute inset-y-16 left-0 w-1/3 cursor-pointer disabled:cursor-default" />
          <button type="button" aria-label={p.nastepny} onClick={() => idz(1)} disabled={indeks === relacje.length - 1} className="absolute inset-y-16 right-0 w-1/3 cursor-pointer disabled:cursor-default" />
        </Ramka916>
        {relacje.length > 1 ? (
          <>
            <button type="button" aria-label={p.poprzedni} onClick={() => idz(-1)} disabled={indeks === 0} className="absolute top-1/2 -left-4 hidden -translate-y-1/2 rounded-full bg-white p-1.5 text-foodie-czern shadow disabled:opacity-30 sm:block">
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" aria-label={p.nastepny} onClick={() => idz(1)} disabled={indeks === relacje.length - 1} className="absolute top-1/2 -right-4 hidden -translate-y-1/2 rounded-full bg-white p-1.5 text-foodie-czern shadow disabled:opacity-30 sm:block">
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        ) : null}
      </div>
      {relacje.length > 1 ? (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={copy.pakiet.zakladki.relacje}>
          {relacje.map((r, i) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={i === indeks}
              aria-label={r.tytul}
              onClick={() => setIndeks(i)}
              className={`h-14 w-8 shrink-0 overflow-hidden rounded-md ring-2 ${i === indeks ? "ring-foodie-fiolet" : "ring-transparent"}`}
            >
              {r.plik ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura przez signed URL
                <img src={r.plik.thumbUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="block h-full w-full bg-szary-300" />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
