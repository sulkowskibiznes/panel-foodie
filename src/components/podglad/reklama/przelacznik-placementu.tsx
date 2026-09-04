"use client";

import { PLACEMENTY, placementDostepny, type GrupaPlacementu, type Placement } from "@/components/podglad/reklama/placementy";
import { copy } from "@/lib/copy";

/**
 * Sześć placementów w dwóch grupach (SPEC rozdz. 7.4). Bez nicka IG placementy instagramowe są wyszarzone
 * z podpowiedzią, nie znikają.
 */
export function PrzelacznikPlacementu({ wartosc, onChange, igHandle, podpowiedzBrakIg }: { wartosc: Placement; onChange: (p: Placement) => void; igHandle: string | null; podpowiedzBrakIg: string }) {
  const grupy: GrupaPlacementu[] = ["facebook", "instagram"];
  return (
    <div className="space-y-2" role="group" aria-label={copy.podglad.gdzieZobaczysz}>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {grupy.map((grupa) => (
          <fieldset key={grupa} className="flex flex-wrap items-center gap-1.5">
            <legend className="sr-only">{copy.podglad[grupa]}</legend>
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-szary-600">{copy.podglad[grupa]}</span>
            {PLACEMENTY.filter((p) => p.grupa === grupa).map((p) => {
              const dostepny = placementDostepny(p, igHandle);
              const aktywny = p.id === wartosc;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={aktywny}
                  aria-disabled={!dostepny}
                  disabled={!dostepny}
                  title={dostepny ? undefined : podpowiedzBrakIg}
                  onClick={() => onChange(p.id)}
                  data-placement={p.id}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${aktywny ? "border-foodie-fiolet bg-foodie-fiolet text-white" : "border-szary-300 bg-white text-foodie-czern hover:border-foodie-fiolet"} disabled:cursor-not-allowed disabled:border-szary-100 disabled:bg-szary-100 disabled:text-szary-300`}
                >
                  {copy.podglad.miejsca[p.id]}
                </button>
              );
            })}
          </fieldset>
        ))}
      </div>
      {!igHandle ? <p className="text-xs text-szary-600">{podpowiedzBrakIg}</p> : null}
    </div>
  );
}
