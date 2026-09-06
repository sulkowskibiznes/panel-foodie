import type { ReactNode } from "react";
import { copy } from "@/lib/copy";
import type { MaterialWKalendarzu } from "@/lib/dto/harmonogram";
import type { StatusPakietu } from "@/lib/dto/materialy";
import { etykietaOkresu, NAZWY_MIESIECY } from "@/lib/format";
import { siatkaOkresu, type DzienSiatki, type Okres } from "@/lib/harmonogram/kalendarz";

/** Kolory statusów w kalendarzu (SPEC rozdz. 5.3): szary szkic, fiolet do akceptacji, zielony zaakceptowany, bursztyn poprawki, czarny zaplanowany. */
export const KLASA_STATUSU: Record<StatusPakietu, string> = {
  szkic: "border-szary-300 bg-szary-100 text-szary-600",
  do_akceptacji: "border-fiolet-100 bg-fiolet-050 text-fiolet-700",
  poprawki: "border-amber-200 bg-amber-50 text-bursztyn",
  zaakceptowany: "border-green-200 bg-green-50 text-zielony",
  zaplanowany: "border-foodie-czern bg-foodie-czern text-white",
};

const PRZYCISK = "rounded-lg border border-szary-300 px-3 py-1.5 text-sm font-medium text-foodie-czern hover:bg-szary-050";
const WYLACZONY = "rounded-lg border border-szary-100 px-3 py-1.5 text-sm font-medium text-szary-300";

/** Nawigacja po pakietach klienta (poprzedni i następny po dacie startu); nagłówek to okres pakietu od-do. */
export function NawigacjaOkresu({ okres, baza, poprzedniId, nastepnyId, poprzedni, nastepny }: { okres: Okres; baza: string; poprzedniId: string | null; nastepnyId: string | null; poprzedni: string; nastepny: string }) {
  return (
    <div className="flex items-center justify-between gap-2" data-nawigacja-okresu>
      {poprzedniId ? (
        <a href={`${baza}?p=${poprzedniId}`} className={PRZYCISK} aria-label={poprzedni} data-poprzedni-pakiet>
          ‹
        </a>
      ) : (
        <span aria-disabled className={WYLACZONY}>‹</span>
      )}
      <h2 className="font-naglowek text-lg text-foodie-czern" data-okres={`${okres.od}..${okres.do}`}>
        {etykietaOkresu(okres.od, okres.do)}
      </h2>
      {nastepnyId ? (
        <a href={`${baza}?p=${nastepnyId}`} className={PRZYCISK} aria-label={nastepny} data-nastepny-pakiet>
          ›
        </a>
      ) : (
        <span aria-disabled className={WYLACZONY}>›</span>
      )}
    </div>
  );
}

/** Podpis dnia w siatce: numer, a na pierwszym dniu miesiąca (i w pierwszej komórce) skrót nazwy miesiąca, bo okres bywa na styku dwóch miesięcy. */
export function podpisDnia(dzien: DzienSiatki): string {
  if (!dzien.nowyMiesiac) return String(dzien.dzien);
  const miesiac = Number(dzien.data.slice(5, 7));
  return `${dzien.dzien} ${(NAZWY_MIESIECY[miesiac - 1] ?? "").slice(0, 3)}`;
}

/** Siatka okresu pakietu: nagłówki dni tygodnia i komórki od poniedziałku przed startem do niedzieli po końcu; zawartość komórki daje wywołujący. */
export function SiatkaOkresu({ okres, komorka }: { okres: Okres; komorka: (dzien: DzienSiatki) => ReactNode }) {
  const tygodnie = siatkaOkresu(okres.od, okres.do);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]" role="grid" data-siatka-okresu={`${okres.od}..${okres.do}`}>
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

export function EtykietaMaterialu({ m, zLokalem = false }: { m: MaterialWKalendarzu; zLokalem?: boolean }) {
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
        {zLokalem && m.nazwaLokalu ? <span className="text-[10px]"> · {m.nazwaLokalu}</span> : null}
      </span>
    </span>
  );
}
