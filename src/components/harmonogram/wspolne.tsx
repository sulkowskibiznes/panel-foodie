import type { ReactNode } from "react";
import { copy } from "@/lib/copy";
import type { MaterialWKalendarzu } from "@/lib/dto/harmonogram";
import type { StatusPakietu } from "@/lib/dto/materialy";
import { kluczMiesiaca, przesunMiesiac, siatkaMiesiaca, type DzienSiatki } from "@/lib/harmonogram/kalendarz";
import { etykietaOkresu } from "@/lib/format";

/** Kolory statusów w kalendarzu (SPEC rozdz. 5.3): szary szkic, fiolet do akceptacji, zielony zaakceptowany, bursztyn poprawki, czarny zaplanowany. */
export const KLASA_STATUSU: Record<StatusPakietu, string> = {
  szkic: "border-szary-300 bg-szary-100 text-szary-600",
  do_akceptacji: "border-fiolet-100 bg-fiolet-050 text-fiolet-700",
  poprawki: "border-amber-200 bg-amber-50 text-bursztyn",
  zaakceptowany: "border-green-200 bg-green-50 text-zielony",
  zaplanowany: "border-foodie-czern bg-foodie-czern text-white",
};

export function NawigacjaMiesiaca({ rok, miesiac, baza, poprzedni, nastepny }: { rok: number; miesiac: number; baza: string; poprzedni: string; nastepny: string }) {
  const p = przesunMiesiac(rok, miesiac, -1);
  const n = przesunMiesiac(rok, miesiac, 1);
  return (
    <div className="flex items-center justify-between gap-2" data-nawigacja-miesiaca>
      <a href={`${baza}?m=${kluczMiesiaca(p.rok, p.miesiac)}`} className="rounded-lg border border-szary-300 px-3 py-1.5 text-sm font-medium text-foodie-czern hover:bg-szary-050" aria-label={poprzedni}>
        ‹
      </a>
      <h2 className="font-naglowek text-lg text-foodie-czern capitalize" data-miesiac={kluczMiesiaca(rok, miesiac)}>
        {etykietaOkresu(rok, miesiac)}
      </h2>
      <a href={`${baza}?m=${kluczMiesiaca(n.rok, n.miesiac)}`} className="rounded-lg border border-szary-300 px-3 py-1.5 text-sm font-medium text-foodie-czern hover:bg-szary-050" aria-label={nastepny}>
        ›
      </a>
    </div>
  );
}

/** Siatka miesiąca: nagłówki dni tygodnia i komórki; zawartość komórki daje wywołujący. */
export function SiatkaMiesiaca({ rok, miesiac, komorka }: { rok: number; miesiac: number; komorka: (dzien: DzienSiatki) => ReactNode }) {
  const tygodnie = siatkaMiesiaca(rok, miesiac);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]" role="grid" data-siatka-miesiaca>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-szary-600" role="row">
          {copy.harmonogram.dniTygodnia.map((d) => (
            <div key={d} role="columnheader" className="py-1">
              {d}
            </div>
          ))}
        </div>
        {tygodnie.map((tydzien, i) => (
          <div key={i} className="mt-1 grid grid-cols-7 gap-1" role="row">
            {tydzien.map((dzien) => komorka(dzien))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EtykietaMaterialu({ m }: { m: MaterialWKalendarzu }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {m.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura przez signed URL (decyzja D3)
        <img src={m.thumbUrl} alt="" width={20} height={20} loading="lazy" className="size-5 shrink-0 rounded bg-szary-100 object-cover" />
      ) : (
        <span className="size-5 shrink-0 rounded bg-szary-100" aria-hidden />
      )}
      <span className="min-w-0 truncate">
        {m.godzina ? <span className="font-semibold">{m.godzina} </span> : null}
        <span className="text-[10px] uppercase">{copy.harmonogram.typ[m.typ]}</span> {m.tytul}
      </span>
    </span>
  );
}
