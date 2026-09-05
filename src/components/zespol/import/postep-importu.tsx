"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { StanImportu, ZadanieImportuDto } from "@/lib/dto/import";
import type { WynikAkcji } from "@/lib/dto/wynik";

function wstaw(tekst: string, pola: Record<string, string | number>): string {
  return Object.entries(pola).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), tekst);
}

function etykietaZadania(z: ZadanieImportuDto): string {
  const t = copy.zespol.import.postep.rodzaj;
  if (z.rodzaj === "reklamy") return wstaw(t.reklamy, { kampania: z.kampaniaNazwa ?? "" });
  return t[z.rodzaj];
}

/**
 * Pasek postępu importu (SPEC rozdz. 13.4): odpytywanie co 2 s, dopóki coś trwa; ostrzeżenia, błąd z „Ponów",
 * zawieszone zadanie z „Wznów". Po zakończeniu link do pakietu i uzupełnienia dat.
 */
export function PostepImportu({ stan: start, slug, pakietId, adresNowego, odswiez, wznow }: { stan: StanImportu; slug: string; pakietId: string; adresNowego: string; odswiez: () => Promise<StanImportu>; wznow: (jobId: string) => Promise<WynikAkcji> }) {
  const t = copy.zespol.import.postep;
  const [stan, setStan] = useState(start);
  const [poprzedniStart, setPoprzedniStart] = useState(start);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();

  // Nowy stan z serwera (po starcie importu albo odświeżeniu strony) zastępuje ten z odpytywania: stan pochodny z propsa.
  if (start !== poprzedniStart) {
    setPoprzedniStart(start);
    setStan(start);
  }

  useEffect(() => {
    if (!stan.wToku) return;
    let aktywny = true;
    const id = window.setInterval(async () => {
      const nowy = await odswiez().catch(() => null);
      if (aktywny && nowy) setStan(nowy);
    }, 2000);
    return () => {
      aktywny = false;
      window.clearInterval(id);
    };
  }, [stan.wToku, odswiez]);

  const razem = stan.zadania.reduce((s, z) => s + z.razem, 0);
  const gotowe = stan.zadania.reduce((s, z) => s + z.gotowe, 0);
  const procent = razem === 0 ? (stan.zadania.every((z) => z.status === "zakonczony") ? 100 : 0) : Math.round((gotowe / razem) * 100);
  const wszystkoGotowe = stan.zadania.length > 0 && stan.zadania.every((z) => z.status === "zakonczony");

  function ponow(jobId: string) {
    setBlad(null);
    startTransition(async () => {
      const w = await wznow(jobId);
      if (!w.ok) {
        setBlad(w.blad);
        return;
      }
      const nowy = await odswiez().catch(() => null);
      if (nowy) setStan(nowy);
    });
  }

  return (
    <section className="space-y-4 rounded-xl bg-white p-5 shadow-miekki sm:p-6" data-postep-importu data-w-toku={stan.wToku ? "1" : "0"}>
      <div>
        <h3 className="font-naglowek text-lg text-foodie-czern">{t.tytul}</h3>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{t.opis}</p>
      </div>
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foodie-czern">{wstaw(t.pliki, { gotowe, razem })}</span>
          <span className="text-szary-600">{procent}%</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-szary-100" role="progressbar" aria-valuenow={procent} aria-valuemin={0} aria-valuemax={100} data-pasek-postepu>
          <div className={`h-full transition-[width] ${wszystkoGotowe ? "bg-zielony" : "bg-foodie-fiolet"}`} style={{ width: `${procent}%` }} />
        </div>
      </div>
      <ul className="divide-y divide-szary-100">
        {stan.zadania.map((z) => (
          <li key={z.id} className="py-3" data-zadanie-importu={z.id} data-status={z.status} data-zawieszone={z.zawieszone ? "1" : "0"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foodie-czern">{etykietaZadania(z)}</p>
                <p className="text-xs text-szary-600">{z.sciezka.join(" / ")}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-szary-600">{wstaw(t.pliki, { gotowe: z.gotowe, razem: z.razem })}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${z.status === "zakonczony" ? "bg-green-50 text-zielony" : z.status === "blad" ? "bg-red-50 text-czerwony" : "bg-fiolet-050 text-fiolet-700"}`}>{t.status[z.status]}</span>
              </div>
            </div>
            {z.blad ? (
              <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony" data-blad-zadania>
                <p>{z.blad}</p>
                <Button type="button" size="sm" variant="outline" className="mt-2" disabled={trwa} onClick={() => ponow(z.id)} data-ponow-import>{t.ponow}</Button>
              </div>
            ) : null}
            {z.zawieszone ? (
              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-bursztyn" data-zadanie-zawieszone>
                <p>{t.zawieszone}</p>
                <Button type="button" size="sm" variant="outline" className="mt-2" disabled={trwa} onClick={() => ponow(z.id)} data-wznow-import>{t.wznow}</Button>
              </div>
            ) : null}
            {z.ostrzezenia.length > 0 ? (
              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-bursztyn" data-ostrzezenia-zadania>
                <p className="font-medium">{t.ostrzezenia}</p>
                <ul className="mt-1 list-disc pl-5">
                  {z.ostrzezenia.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
      {wszystkoGotowe ? <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-zielony" data-import-gotowy>{t.gotowe}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Link href={`/zespol/klienci/${slug}/pakiety/${pakietId}`} className="inline-flex h-10 items-center rounded-lg bg-foodie-fiolet px-4 text-sm font-medium text-white hover:bg-fiolet-600" data-otworz-pakiet>{t.otworzPakiet}</Link>
        {!stan.wToku ? (
          <Link href={adresNowego} className="inline-flex h-10 items-center rounded-lg border border-szary-300 bg-white px-4 text-sm font-medium text-foodie-czern hover:bg-szary-050" data-nowy-import>{t.nowyImport}</Link>
        ) : null}
      </div>
    </section>
  );
}
