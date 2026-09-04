"use client";

import { Media } from "@/components/podglad/media";
import { PasekReakcji } from "@/components/podglad/post-fb";
import { NaglowekReklamy, PasekCta } from "@/components/podglad/reklama/element-reklamy";
import { TekstSkracany } from "@/components/podglad/tekst-skracany";
import { proporcjaWKanale, type Strona } from "@/components/podglad/typy";
import type { ZlozonyWariant } from "@/lib/reklamy/warianty";

/** Reklama w kanale Facebooka na telefonie (375 px) i na komputerze (500 px, karta z zaokrągleniem). */
export function ReklamaFbKanal({ strona, wariant, uklad }: { strona: Strona; wariant: ZlozonyWariant; uklad: "telefon" | "komputer" }) {
  const komputer = uklad === "komputer";
  const plik = wariant.grafika?.plik ?? null;
  return (
    <div className={`mx-auto w-full ${komputer ? "max-w-[500px]" : "max-w-[375px]"}`} data-podglad={komputer ? "reklama-fb-kanal-komputer" : "reklama-fb-kanal-telefon"}>
      <article className={`overflow-hidden bg-white text-foodie-czern ring-1 ring-black/5 ${komputer ? "rounded-xl shadow" : "rounded-lg"}`}>
        <NaglowekReklamy strona={strona} komputer={komputer} />
        <TekstSkracany tekst={wariant.tekst?.tekst ?? null} className="px-3 pb-2" />
        <Media plik={plik} proporcja={proporcjaWKanale(plik)} />
        <PasekCta wariant={wariant} komputer={komputer} />
        <PasekReakcji />
      </article>
    </div>
  );
}
