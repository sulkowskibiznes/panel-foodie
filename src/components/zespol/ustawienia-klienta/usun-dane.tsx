"use client";

import { useState, useTransition } from "react";
import { usunDaneKlienta } from "@/app/zespol/(panel)/klienci/[slug]/ustawienia/akcje";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

const POLE = "mt-1 h-11 w-full max-w-md rounded-lg border border-szary-300 bg-white px-3 text-sm text-foodie-czern outline-none focus:border-czerwony focus:ring-2 focus:ring-czerwony/30";

/** „Usuń dane klienta" z potwierdzeniem przez przepisanie nazwy (SPEC rozdz. 17). Serwer sprawdza nazwę drugi raz. */
export function UsunDaneKlienta({ slug, nazwa }: { slug: string; nazwa: string }) {
  const [wpisana, setWpisana] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const u = copy.zespol.ustawieniaKlienta.usuwanie;
  const zgodna = wpisana.trim() === nazwa.trim();

  function usun(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!zgodna) return;
    setBlad(null);
    startTransition(async () => {
      // Po sukcesie akcja przekierowuje na pulpit; tu ląduje tylko odmowa.
      const w = await usunDaneKlienta(slug, wpisana);
      if (!w.ok) setBlad(w.blad);
    });
  }

  return (
    <form onSubmit={usun} className="space-y-3" data-formularz-usuniecia>
      <label htmlFor="potwierdzenie-nazwy" className="block text-sm font-medium text-foodie-czern">
        {u.przepisz} <span className="font-semibold">{nazwa}</span>
      </label>
      <input id="potwierdzenie-nazwy" name="potwierdzenie" value={wpisana} onChange={(e) => setWpisana(e.target.value)} placeholder={u.podpowiedz} autoComplete="off" className={POLE} />
      <Button type="submit" variant="destructive" size="lg" disabled={!zgodna || trwa} data-usun-dane-klienta>
        {trwa ? u.usuwanie : u.przycisk}
      </Button>
      {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
    </form>
  );
}
