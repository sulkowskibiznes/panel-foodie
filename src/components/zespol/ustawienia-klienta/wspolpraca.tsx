"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { wznowWspolprace, zakonczWspolprace } from "@/app/zespol/(panel)/klienci/[slug]/ustawienia/akcje";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { StanWspolpracy } from "@/lib/dane/offboarding";
import { formatujDateCzas } from "@/lib/format";

/** Stan współpracy i przyciski „Zakończ współpracę" (z potwierdzeniem) oraz „Wznów współpracę" (SPEC rozdz. 17). */
export function Wspolpraca({ slug, nazwa, stan }: { slug: string; nazwa: string; stan: StanWspolpracy }) {
  const router = useRouter();
  const [trwa, startTransition] = useTransition();
  const [blad, setBlad] = useState<string | null>(null);
  const u = copy.zespol.ustawieniaKlienta;

  function wykonaj(fn: () => Promise<{ ok: boolean; blad?: string }>) {
    setBlad(null);
    startTransition(async () => {
      const w = await fn();
      if (!w.ok) setBlad(w.blad ?? u.bledy.ogolny);
      router.refresh();
    });
  }

  function zakoncz() {
    if (!window.confirm(u.zakonczPotwierdz.replace("{klient}", nazwa))) return;
    wykonaj(() => zakonczWspolprace(slug));
  }

  return (
    <div className="space-y-3" data-wspolpraca={stan.status}>
      <p className="text-sm font-medium text-foodie-czern">{copy.zespol.karta.statusKlienta[stan.status]}</p>
      {stan.status === "zakonczony" ? (
        <>
          <p className="text-sm text-szary-600" data-zakonczono>{stan.zakonczonoO ? u.zakonczono.replace("{data}", formatujDateCzas(stan.zakonczonoO)) : copy.zespol.karta.statusKlienta.zakonczony}</p>
          <p className="text-sm text-szary-600">{u.wznowOpis}</p>
          <Button type="button" variant="outline" size="lg" disabled={trwa} onClick={() => wykonaj(() => wznowWspolprace(slug))} data-wznow-wspolprace>
            {u.wznow}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-szary-600" data-aktywne-linki={stan.aktywneLinki}>{u.aktywneLinki.replace("{n}", String(stan.aktywneLinki))}</p>
          <Button type="button" variant="destructive" size="lg" disabled={trwa} onClick={zakoncz} data-zakoncz-wspolprace>
            {u.zakoncz}
          </Button>
        </>
      )}
      {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
    </div>
  );
}
