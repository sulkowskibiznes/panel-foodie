import { Heart, MessageCircle, MoreHorizontal, Music, Share2 } from "lucide-react";
import { AwatarStrony } from "@/components/podglad/awatar-strony";
import { Ramka916 } from "@/components/podglad/ramka-9-16";
import type { Strona } from "@/components/podglad/typy";
import { copy } from "@/lib/copy";
import type { PlikDto } from "@/lib/dto/materialy";

/** Reels na Facebooku (SPEC rozdz. 7.3): opis na dole po lewej, kolumna ikon po prawej, pasek audio. */
export function ReelsFb({ strona, plik, tekst, className = "" }: { strona: Strona; plik: PlikDto | null; tekst: string | null; className?: string }) {
  const p = copy.podglad;
  return (
    <div className={`mx-auto w-full max-w-[320px] ${className}`} data-podglad="reels-fb">
      <Ramka916
        plik={plik}
        gora={
          <div className="flex items-center justify-between px-3 py-3 text-[15px] font-semibold">
            <span>{p.reels}</span>
            <MoreHorizontal className="size-5" aria-hidden />
          </div>
        }
        dol={
          <div className="flex items-end gap-3 px-3 pt-10 pb-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <AwatarStrony strona={strona} rozmiar={32} />
                <span className="truncate text-[13px] font-semibold">{strona.nazwaStrony}</span>
                <span className="rounded-md border border-white/80 px-2 py-0.5 text-[12px] font-semibold">{p.obserwuj}</span>
              </div>
              {tekst ? <p className="line-clamp-2 text-[13px] leading-4">{tekst}</p> : null}
              <p className="flex items-center gap-1.5 truncate text-[12px] text-white/90">
                <Music className="size-3.5 shrink-0" aria-hidden />
                {p.oryginalnyDzwiek} · {strona.nazwaStrony}
              </p>
            </div>
            <div className="flex flex-col items-center gap-4 pb-1" aria-hidden>
              <Heart className="size-6" />
              <MessageCircle className="size-6" />
              <Share2 className="size-6" />
              <MoreHorizontal className="size-6" />
            </div>
          </div>
        }
      />
    </div>
  );
}
