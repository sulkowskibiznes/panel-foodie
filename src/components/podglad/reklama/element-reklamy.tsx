import { Globe, MoreHorizontal } from "lucide-react";
import { AwatarStrony } from "@/components/podglad/awatar-strony";
import type { Strona } from "@/components/podglad/typy";
import { copy } from "@/lib/copy";
import { domenaLinku, type ZlozonyWariant } from "@/lib/reklamy/warianty";

/** Wspólne kawałki elementu reklamowego (SPEC rozdz. 7.4): nagłówek ze „Sponsorowane" i pasek z domeną, nagłówkiem, opisem i CTA. */
export function NaglowekReklamy({ strona, instagram = false, komputer = false }: { strona: Strona; instagram?: boolean; komputer?: boolean }) {
  const nazwa = instagram ? (strona.igHandle ?? strona.nazwaStrony) : strona.nazwaStrony;
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-2">
      <AwatarStrony strona={strona} rozmiar={komputer ? 40 : 36} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[15px] font-semibold text-foodie-czern">{nazwa}</p>
        <p className="flex items-center gap-1 text-[12px] text-szary-600">
          {copy.podglad.sponsorowane}
          {instagram ? null : (
            <>
              {" "}
              · <Globe className="size-3" aria-label={copy.podglad.publiczne} />
            </>
          )}
        </p>
      </div>
      <MoreHorizontal className="size-5 text-szary-600" aria-hidden />
    </div>
  );
}

export function tekstCta(wariant: Pick<ZlozonyWariant, "cta">): string {
  return wariant.cta?.trim() || copy.podglad.ctaDomyslne;
}

export function PasekCta({ wariant, komputer = false }: { wariant: ZlozonyWariant; komputer?: boolean }) {
  const domena = domenaLinku(wariant.link) ?? copy.podglad.domenaZastepcza.toUpperCase();
  return (
    <div className={`flex items-center gap-3 bg-szary-100 px-3 ${komputer ? "py-3" : "py-2.5"}`} data-cta>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[12px] uppercase text-szary-600">{domena}</p>
        <p className="line-clamp-2 text-[15px] font-semibold text-foodie-czern" data-naglowek>
          {wariant.naglowek?.tekst ?? ""}
        </p>
        {wariant.opis ? <p className="truncate text-[13px] text-szary-600">{wariant.opis}</p> : null}
      </div>
      <span className="shrink-0 rounded-md bg-szary-300/70 px-3 py-2 text-[14px] font-semibold text-foodie-czern">{tekstCta(wariant)}</span>
    </div>
  );
}
