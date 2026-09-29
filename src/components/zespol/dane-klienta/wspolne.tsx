"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { copy } from "@/lib/copy";
import type { WynikAkcji } from "@/lib/dto/wynik";

export const POLE = "mt-1 h-11 w-full rounded-lg border border-szary-300 bg-white px-3 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30 disabled:bg-szary-050 disabled:text-szary-600";
export const ETYKIETA = "block text-sm font-medium text-foodie-czern";

export function Pole({ id, etykieta, podpowiedz, children }: { id: string; etykieta: string; podpowiedz?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={ETYKIETA}>
        {etykieta}
      </label>
      {children}
      {podpowiedz ? <p className="mt-1 text-xs text-szary-600">{podpowiedz}</p> : null}
    </div>
  );
}

export function Sekcja({ tytul, opis, children, dane }: { tytul: string; opis?: string; children: ReactNode; dane: string }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6" data-sekcja={dane}>
      <h2 className="font-naglowek text-xl text-foodie-czern">{tytul}</h2>
      {opis ? <p className="mt-1 max-w-prose text-sm text-szary-600">{opis}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Zapis formularza bez resetu pól (React 19 czyści `<form action>` po akcji): onSubmit, FormData, startTransition.
 * Po sukcesie odświeża stronę i pokazuje „Zapisano", po błędzie komunikat z akcji.
 */
export function useZapis(akcja: (fd: FormData) => Promise<WynikAkcji>, poSukcesie?: () => void) {
  const router = useRouter();
  const [trwa, startTransition] = useTransition();
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisano, setZapisano] = useState(false);

  function wyslij(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBlad(null);
    setZapisano(false);
    startTransition(async () => {
      const w = await akcja(fd);
      if (!w.ok) {
        setBlad(w.blad);
        return;
      }
      setZapisano(true);
      poSukcesie?.();
      router.refresh();
    });
  }
  return { trwa, blad, zapisano, wyslij, setBlad };
}

export function StanZapisu({ blad, zapisano }: { blad: string | null; zapisano: boolean }) {
  if (blad) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p>;
  if (zapisano) return <p role="status" className="text-sm text-zielony" data-zapisano>{copy.zespol.daneKlienta.zapisano}</p>;
  return null;
}
