"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { zapiszZespolKlienta } from "@/app/zespol/(panel)/klienci/[slug]/ustawienia/dane-akcje";
import { Button } from "@/components/ui/button";
import { Pole, POLE, Sekcja, StanZapisu } from "@/components/zespol/dane-klienta/wspolne";
import { copy } from "@/lib/copy";
import type { CzlonekKlienta, DaneKlientaZespolu } from "@/lib/dane/dane-klienta";
import type { Rola } from "@/lib/uprawnienia";

const KOLEJNOSC_ROL: Rola[] = ["content_creator", "media_buyer", "csm", "admin"];

/** Zespół klienta (plan 1.1): opiekun i przypisania. Bez przypisania content creator i media buyer nie widzą klienta. */
export function SekcjaZespol({ slug, klient }: { slug: string; klient: DaneKlientaZespolu }) {
  const router = useRouter();
  const [trwa, startTransition] = useTransition();
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisano, setZapisano] = useState(false);
  const t = copy.zespol.daneKlienta.zespol;
  const przypisani = new Set(klient.przypisani.map((p) => p.id));
  const opiekunowie = klient.zespol.filter((c) => c.role === "admin" || c.role === "csm");
  const wgRol = KOLEJNOSC_ROL.map((rola) => ({ rola, osoby: klient.zespol.filter((c): c is CzlonekKlienta => c.role === rola) })).filter((g) => g.osoby.length > 0);

  function wyslij(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBlad(null);
    setZapisano(false);
    startTransition(async () => {
      const w = await zapiszZespolKlienta(slug, fd);
      if (!w.ok) return setBlad(w.blad);
      if ("przekierowanie" in w) {
        router.push(w.przekierowanie);
        return;
      }
      setZapisano(true);
      router.refresh();
    });
  }

  return (
    <Sekcja tytul={t.tytul} opis={t.opis} dane="zespol">
      <form onSubmit={wyslij} className="space-y-4" data-formularz-zespolu>
        <div className="max-w-sm">
          <Pole id="zespol-opiekun" etykieta={t.opiekun}>
            <select id="zespol-opiekun" name="opiekun_id" defaultValue={klient.opiekunId ?? ""} className={POLE}>
              <option value="">{t.bezOpiekuna}</option>
              {opiekunowie.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </Pole>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-foodie-czern">{t.przypisani}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {wgRol.map((g) => (
              <div key={g.rola}>
                <p className="text-xs font-medium uppercase tracking-wide text-szary-600">{copy.zespol.role[g.rola]}</p>
                <ul className="mt-1 space-y-1">
                  {g.osoby.map((o) => (
                    <li key={o.id}>
                      <label className="flex items-center gap-2 text-sm text-foodie-czern">
                        <input type="checkbox" name="przypisany" value={o.id} defaultChecked={przypisani.has(o.id)} className="size-4 accent-foodie-fiolet" data-przypisany={o.id} />
                        {o.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={trwa} data-zapisz-zespol>
            {trwa ? copy.zespol.daneKlienta.zapisywanie : copy.zespol.daneKlienta.zapisz}
          </Button>
          <StanZapisu blad={blad} zapisano={zapisano} />
        </div>
      </form>
    </Sekcja>
  );
}
