"use client";

import { Globe, MessageCircle, MoreHorizontal, Share2, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { AwatarStrony } from "@/components/podglad/awatar-strony";
import { Karuzela } from "@/components/podglad/karuzela";
import { PrzelacznikLokalu } from "@/components/podglad/przelacznik-lokalu";
import { TekstSkracany } from "@/components/podglad/tekst-skracany";
import { proporcjaWKanale } from "@/components/podglad/typy";
import { copy } from "@/lib/copy";
import type { PlikDto, StronaDto } from "@/lib/dto/materialy";
import { formatujDate } from "@/lib/format";

export function PasekReakcji() {
  const p = copy.podglad;
  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 text-[13px] text-szary-600">
        <span className="flex items-center gap-1.5">
          <span className="flex -space-x-1" aria-hidden>
            <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-[#1877f2] ring-2 ring-white">
              <ThumbsUp className="size-2.5 text-white" />
            </span>
            <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-[#f33e58] ring-2 ring-white text-[10px] text-white">♥</span>
          </span>
          {p.reakcje}
        </span>
        <span>
          {p.komentarze} · {p.udostepnienia}
        </span>
      </div>
      <div className="mx-3 grid grid-cols-3 border-t border-szary-100 py-1 text-[13px] font-semibold text-szary-600">
        <span className="flex items-center justify-center gap-1.5 py-1.5">
          <ThumbsUp className="size-4" aria-hidden /> {p.lubieTo}
        </span>
        <span className="flex items-center justify-center gap-1.5 py-1.5">
          <MessageCircle className="size-4" aria-hidden /> {p.komentarz}
        </span>
        <span className="flex items-center justify-center gap-1.5 py-1.5">
          <Share2 className="size-4" aria-hidden /> {p.udostepnij}
        </span>
      </div>
    </>
  );
}

export function NaglowekStrony({ strona, drugaLinia, komputer = false }: { strona: StronaDto | { nazwaStrony: string; igHandle: string | null; avatarUrl: string | null }; drugaLinia: string; komputer?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-2">
      <AwatarStrony strona={strona} rozmiar={komputer ? 40 : 36} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[15px] font-semibold text-foodie-czern">{strona.nazwaStrony}</p>
        <p className="flex items-center gap-1 text-[12px] text-szary-600">
          {drugaLinia} · <Globe className="size-3" aria-label={copy.podglad.publiczne} />
        </p>
      </div>
      <MoreHorizontal className="size-5 text-szary-600" aria-hidden />
    </div>
  );
}

export function dataPublikacjiFb(iso: string | null): string {
  if (!iso) return copy.podglad.bezDaty;
  return formatujDate(iso, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/**
 * Post na stronie na Facebooku (SPEC rozdz. 7.1): nagłówek strony, tekst nad grafiką z „Zobacz więcej",
 * grafika w proporcji z pliku (Facebook nie przycina), karuzela, pasek reakcji, Lubię to! Komentarz Udostępnij.
 * Dla kat3 przełącznik profilu: ten sam post na różnych stronach.
 */
export function PostFb({ lokale, tekst, pliki, publikacjaO, className = "" }: { lokale: StronaDto[]; tekst: string | null; pliki: PlikDto[]; publikacjaO: string | null; className?: string }) {
  const [lokalId, setLokalId] = useState<string | null>(lokale[0]?.lokalId ?? null);
  const strona = lokale.find((l) => l.lokalId === lokalId) ?? lokale[0] ?? { nazwaStrony: "", igHandle: null, avatarUrl: null };
  // Przełącznik profilu tylko wtedy, gdy lokale mają RÓŻNE strony (kat3); w kat2 jeden profil, więc nie ma czego przełączać.
  const rozneStrony = new Set(lokale.map((l) => l.nazwaStrony)).size > 1;
  return (
    <div className={`mx-auto w-full max-w-[500px] ${className}`}>
      {rozneStrony ? (
        <div className="mb-3">
          <PrzelacznikLokalu id={`profil-${pliki[0]?.id ?? "post"}`} lokale={lokale} wartosc={lokalId} onChange={setLokalId} zWersjaWspolna={false} />
        </div>
      ) : null}
      <p className="mb-2 text-sm text-szary-600">
        {copy.podglad.publikacja} <span className="font-medium text-foodie-czern">{publikacjaO ? formatujDate(publikacjaO, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : copy.podglad.bezDaty}</span>
      </p>
      <article data-podglad="post-fb" className="overflow-hidden rounded-xl bg-white text-foodie-czern shadow ring-1 ring-black/5">
        <NaglowekStrony strona={strona} drugaLinia={dataPublikacjiFb(publikacjaO)} />
        <TekstSkracany tekst={tekst} className="px-3 pb-2" />
        <Karuzela pliki={pliki} proporcja={proporcjaWKanale} />
        <PasekReakcji />
      </article>
    </div>
  );
}
