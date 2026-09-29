"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { wstrzymajWspolprace, wznowWspolprace, zakonczWspolprace } from "@/app/zespol/(panel)/klienci/[slug]/ustawienia/akcje";
import { Button } from "@/components/ui/button";
import { usePotwierdzenie } from "@/components/zespol/potwierdzenie";
import { copy } from "@/lib/copy";
import type { StanWspolpracy } from "@/lib/dane/offboarding";
import { formatujDateCzas } from "@/lib/format";

/**
 * Stan współpracy (SPEC rozdz. 17, plan 1.7): „Przerwa we współpracy" (linki działają), „Zakończ współpracę"
 * (linki wygaszone) i „Wznów współpracę". Obie decyzje wycofują pakiety czekające na akceptację do szkicu.
 */
export function Wspolpraca({ slug, nazwa, stan }: { slug: string; nazwa: string; stan: StanWspolpracy }) {
  const router = useRouter();
  const [trwa, startTransition] = useTransition();
  const [blad, setBlad] = useState<string | null>(null);
  const { potwierdz, okno } = usePotwierdzenie();
  const u = copy.zespol.ustawieniaKlienta;

  function wykonaj(fn: () => Promise<{ ok: boolean; blad?: string }>) {
    setBlad(null);
    startTransition(async () => {
      const w = await fn();
      if (!w.ok) setBlad(w.blad ?? u.bledy.ogolny);
      router.refresh();
    });
  }

  async function zakoncz() {
    if (!(await potwierdz({ tresc: u.zakonczPotwierdz.replace("{klient}", nazwa), przycisk: u.zakoncz, niebezpieczne: true }))) return;
    wykonaj(() => zakonczWspolprace(slug));
  }

  async function przerwa() {
    if (!(await potwierdz({ tresc: u.przerwaPotwierdz.replace("{klient}", nazwa), przycisk: u.przerwa }))) return;
    wykonaj(() => wstrzymajWspolprace(slug));
  }

  const zakonczButton = (
    <Button type="button" variant="destructive" size="lg" disabled={trwa} onClick={() => void zakoncz()} data-zakoncz-wspolprace>
      {u.zakoncz}
    </Button>
  );
  const wznowButton = (
    <Button type="button" variant="outline" size="lg" disabled={trwa} onClick={() => wykonaj(() => wznowWspolprace(slug))} data-wznow-wspolprace>
      {u.wznow}
    </Button>
  );

  return (
    <div className="space-y-3" data-wspolpraca={stan.status}>
      <p className="text-sm font-medium text-foodie-czern">{copy.zespol.karta.statusKlienta[stan.status]}</p>
      {stan.status === "zakonczony" ? (
        <>
          <p className="text-sm text-szary-600" data-zakonczono>{stan.zakonczonoO ? u.zakonczono.replace("{data}", formatujDateCzas(stan.zakonczonoO)) : copy.zespol.karta.statusKlienta.zakonczony}</p>
          <p className="text-sm text-szary-600">{u.wznowOpis}</p>
          {wznowButton}
        </>
      ) : stan.status === "wstrzymany" ? (
        <>
          <p className="text-sm text-szary-600" data-przerwa>{u.przerwaTrwa}</p>
          <p className="text-sm text-szary-600">{u.wznowOpisPrzerwa}</p>
          <div className="flex flex-wrap gap-2">
            {wznowButton}
            {zakonczButton}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-szary-600" data-aktywne-linki={stan.aktywneLinki}>{u.aktywneLinki.replace("{n}", String(stan.aktywneLinki))}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="lg" disabled={trwa} onClick={() => void przerwa()} data-przerwa-wspolpracy>
              {u.przerwa}
            </Button>
            {zakonczButton}
          </div>
        </>
      )}
      {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
      {okno}
    </div>
  );
}
