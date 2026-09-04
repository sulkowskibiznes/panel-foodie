"use client";

import { Bookmark, ChevronRight, Heart, MessageCircle, Send } from "lucide-react";
import { Media } from "@/components/podglad/media";
import { NaglowekReklamy, tekstCta } from "@/components/podglad/reklama/element-reklamy";
import { TekstSkracany } from "@/components/podglad/tekst-skracany";
import { proporcjaWKanale, type Strona } from "@/components/podglad/typy";
import type { ZlozonyWariant } from "@/lib/reklamy/warianty";

/** Reklama w kanale Instagramu: nick, „Sponsorowane", grafika, przycisk CTA nad opisem, tekst pod grafiką. */
export function ReklamaIgKanal({ strona, wariant }: { strona: Strona; wariant: ZlozonyWariant }) {
  const plik = wariant.grafika?.plik ?? null;
  const nick = strona.igHandle ?? strona.nazwaStrony;
  return (
    <div className="mx-auto w-full max-w-[375px]" data-podglad="reklama-ig-kanal">
      <article className="overflow-hidden rounded-lg bg-white text-foodie-czern ring-1 ring-black/5">
        <NaglowekReklamy strona={strona} instagram />
        <Media plik={plik} proporcja={proporcjaWKanale(plik)} />
        <div className="flex items-center justify-between bg-[#0095f6] px-3 py-2.5 text-[14px] font-semibold text-white" data-cta>
          <span>{tekstCta(wariant)}</span>
          <ChevronRight className="size-4" aria-hidden />
        </div>
        <div className="flex items-center gap-4 px-3 py-2.5" aria-hidden>
          <Heart className="size-6" />
          <MessageCircle className="size-6" />
          <Send className="size-6" />
          <Bookmark className="ml-auto size-6" />
        </div>
        <div className="px-3 pb-3">
          <p className="text-[14px] font-semibold" data-naglowek>
            {wariant.naglowek?.tekst ?? ""}
          </p>
          <TekstSkracany tekst={wariant.tekst?.tekst ? `${nick} ${wariant.tekst.tekst}` : null} linie={2} kolorOdnosnika="text-[#00376b]" />
        </div>
      </article>
    </div>
  );
}
