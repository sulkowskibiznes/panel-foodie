import { ChevronUp, MoreHorizontal, X } from "lucide-react";
import { AwatarStrony } from "@/components/podglad/awatar-strony";
import { Ramka916 } from "@/components/podglad/ramka-9-16";
import { tekstCta } from "@/components/podglad/reklama/element-reklamy";
import type { Strona } from "@/components/podglad/typy";
import { copy } from "@/lib/copy";
import type { ZlozonyWariant } from "@/lib/reklamy/warianty";

/** Reklama w relacjach na Facebooku: grafika na rozmytym tle, tekst pod spodem, CTA na dole. */
export function ReklamaFbRelacja({ strona, wariant }: { strona: Strona; wariant: ZlozonyWariant }) {
  return (
    <div className="mx-auto w-full max-w-[320px]" data-podglad="reklama-fb-relacje">
      <Ramka916
        plik={wariant.grafika?.plik ?? null}
        gora={
          <div className="px-3 pt-2">
            <div className="h-0.5 w-full rounded-full bg-white/80" aria-hidden />
            <div className="mt-2 flex items-center gap-2">
              <AwatarStrony strona={strona} rozmiar={32} />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-semibold">{strona.nazwaStrony}</p>
                <p className="text-[11px] text-white/80">{copy.podglad.sponsorowane}</p>
              </div>
              <MoreHorizontal className="size-5" aria-hidden />
              <X className="size-5" aria-hidden />
            </div>
          </div>
        }
        dol={
          <div className="px-4 pt-10 pb-4 text-center">
            {wariant.naglowek?.tekst ? (
              <p className="mb-1 text-left text-[14px] font-semibold" data-naglowek>
                {wariant.naglowek.tekst}
              </p>
            ) : null}
            {wariant.tekst?.tekst ? <p className="mb-3 line-clamp-2 text-left text-[13px] leading-4">{wariant.tekst.tekst}</p> : null}
            <ChevronUp className="mx-auto size-5" aria-hidden />
            <span className="mt-1 block rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-foodie-czern" data-cta>
              {tekstCta(wariant)}
            </span>
          </div>
        }
      />
    </div>
  );
}
