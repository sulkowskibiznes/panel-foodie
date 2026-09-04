"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Media } from "@/components/podglad/media";
import { copy } from "@/lib/copy";
import type { PlikDto } from "@/lib/dto/materialy";

/** Karuzela posta: strzałki i kropki jak na Facebooku (SPEC rozdz. 7.1). Jeden plik = bez nawigacji. */
export function Karuzela({ pliki, proporcja }: { pliki: PlikDto[]; proporcja: (plik: PlikDto | null) => number }) {
  const [indeks, setIndeks] = useState(0);
  const biezacy = pliki[Math.min(indeks, Math.max(0, pliki.length - 1))] ?? null;
  const wiele = pliki.length > 1;
  const idz = (delta: number) => setIndeks((i) => (i + delta + pliki.length) % pliki.length);
  const etykieta = copy.podglad.slajd.replace("{n}", String(indeks + 1)).replace("{liczba}", String(pliki.length));

  return (
    <div className="relative" aria-roledescription="karuzela" aria-label={wiele ? etykieta : undefined}>
      <Media plik={biezacy} proporcja={proporcja(biezacy)} />
      {wiele ? (
        <>
          <button type="button" aria-label={copy.podglad.poprzedni} onClick={() => idz(-1)} className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-foodie-czern shadow hover:bg-white">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" aria-label={copy.podglad.nastepny} onClick={() => idz(1)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-foodie-czern shadow hover:bg-white">
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5" aria-hidden>
            {pliki.map((p, i) => (
              <span key={p.id} className={`size-1.5 rounded-full ${i === indeks ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
