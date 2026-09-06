"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { oznaczZainteresowanie } from "@/app/zespol/(panel)/klienci/[slug]/akcje";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { ZainteresowanieZespolu } from "@/lib/dane/uslugi";
import { formatujDateCzas } from "@/lib/format";

/** Zgłoszenia „Chcę wiedzieć więcej" na karcie klienta (SPEC rozdz. 5.8): kto, kiedy, o co; „Załatwione" dla admina i csm. */
export function ListaZainteresowan({ slug, zainteresowania, mozeZalatwiac }: { slug: string; zainteresowania: ZainteresowanieZespolu[]; mozeZalatwiac: boolean }) {
  const router = useRouter();
  const [trwa, startTransition] = useTransition();
  const t = copy.zespol.karta.zainteresowania;
  if (zainteresowania.length === 0) return <p className="text-sm text-szary-600">{t.brak}</p>;
  return (
    <ul className="divide-y divide-szary-100">
      {zainteresowania.map((z) => (
        <li key={z.id} className="flex flex-wrap items-start justify-between gap-3 py-3" data-zainteresowanie={z.id}>
          <div className="min-w-0">
            <p className="font-medium text-foodie-czern">{z.usluga}</p>
            <p className="text-xs text-szary-600">{t.ktoZglosil.replace("{osoba}", z.osoba ?? copy.zespol.pakietyMaterialow.nikt).replace("{data}", formatujDateCzas(z.zgloszonoO))}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-foodie-czern">{z.notatka ?? t.bezNotatki}</p>
          </div>
          {z.zalatwionoO ? (
            <span className="text-xs font-medium text-zielony">{t.zalatwilOsoba.replace("{data}", formatujDateCzas(z.zalatwionoO))}</span>
          ) : mozeZalatwiac ? (
            <Button type="button" variant="outline" size="sm" disabled={trwa} onClick={() => startTransition(async () => { await oznaczZainteresowanie(slug, z.id); router.refresh(); })} data-zalatwione>
              {t.oznacz}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
