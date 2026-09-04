"use client";

import type { ReactNode } from "react";
import { copy } from "@/lib/copy";
import type { MaterialDto } from "@/lib/dto/materialy";

/** Karta materiału: tytuł, plakietki „Poprawione" / „Nowe" / „Reels" (SPEC rozdz. 6.2, 6.5), podgląd i wątek uwag. */
export function SekcjaMaterialu({ material, podglad, watek }: { material: MaterialDto; podglad: ReactNode; watek: ReactNode }) {
  const p = copy.pakiet.plakietki;
  return (
    <section id={`material-${material.id}`} data-material={material.id} data-typ={material.typ} className="rounded-xl bg-white p-4 shadow-miekki sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="font-naglowek text-lg text-foodie-czern">{material.tytul}</h2>
        {material.typ === "reels" ? <span className="rounded-full bg-szary-100 px-2 py-0.5 text-[11px] font-medium text-szary-600">{p.reels}</span> : null}
        {material.poprawiony ? <span data-plakietka="poprawione" className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-bursztyn">{p.poprawione}</span> : null}
        {material.nowy ? <span data-plakietka="nowe" className="rounded-full bg-fiolet-050 px-2 py-0.5 text-[11px] font-medium text-fiolet-700">{p.nowe}</span> : null}
      </header>
      {podglad}
      <div className="mt-5 border-t border-szary-100 pt-4">{watek}</div>
    </section>
  );
}
