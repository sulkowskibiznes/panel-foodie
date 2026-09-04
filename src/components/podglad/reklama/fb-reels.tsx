import { Heart, MessageCircle, MoreHorizontal, Music, Share2 } from "lucide-react";
import { AwatarStrony } from "@/components/podglad/awatar-strony";
import { Ramka916 } from "@/components/podglad/ramka-9-16";
import { tekstCta } from "@/components/podglad/reklama/element-reklamy";
import type { Strona } from "@/components/podglad/typy";
import { copy } from "@/lib/copy";
import type { ZlozonyWariant } from "@/lib/reklamy/warianty";

/** Reklama w Reels na Facebooku: układ Reels z nazwą strony, „Sponsorowane", tekstem i przyciskiem CTA. */
export function ReklamaFbReels({ strona, wariant }: { strona: Strona; wariant: ZlozonyWariant }) {
  const p = copy.podglad;
  return (
    <div className="mx-auto w-full max-w-[320px]" data-podglad="reklama-fb-reels">
      <Ramka916
        plik={wariant.grafika?.plik ?? null}
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
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[13px] font-semibold">{strona.nazwaStrony}</p>
                  <p className="text-[11px] text-white/80">{p.sponsorowane}</p>
                </div>
              </div>
              {wariant.naglowek?.tekst ? (
                <p className="text-[14px] font-semibold" data-naglowek>
                  {wariant.naglowek.tekst}
                </p>
              ) : null}
              {wariant.tekst?.tekst ? <p className="line-clamp-2 text-[13px] leading-4">{wariant.tekst.tekst}</p> : null}
              <span className="block w-full rounded-md bg-white px-3 py-2 text-center text-[13px] font-semibold text-foodie-czern" data-cta>
                {tekstCta(wariant)}
              </span>
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
