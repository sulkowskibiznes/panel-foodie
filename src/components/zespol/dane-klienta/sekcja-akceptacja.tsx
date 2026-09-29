"use client";

import { zapiszAkceptacjeKlienta } from "@/app/zespol/(panel)/klienci/[slug]/ustawienia/dane-akcje";
import { Button } from "@/components/ui/button";
import { Pole, POLE, Sekcja, StanZapisu, useZapis } from "@/components/zespol/dane-klienta/wspolne";
import { copy } from "@/lib/copy";
import type { DaneKlientaZespolu } from "@/lib/dane/dane-klienta";
import { GODZINY_AUTO_MAX, GODZINY_AUTO_MIN } from "@/lib/klienci/nowy";

/** Akceptacja i publikacja per klient (plan 1.6, SPEC 6.4): termin tylko wydłużany (72-720 h), domyślne godziny publikacji. */
export function SekcjaAkceptacja({ slug, klient }: { slug: string; klient: DaneKlientaZespolu }) {
  const { trwa, blad, zapisano, wyslij } = useZapis((fd) => zapiszAkceptacjeKlienta(slug, fd));
  const t = copy.zespol.daneKlienta.akceptacja;
  const a = klient.akceptacja;
  return (
    <Sekcja tytul={t.tytul} opis={t.opis} dane="akceptacja">
      <form onSubmit={wyslij} className="space-y-4" data-formularz-akceptacji>
        <label className="flex items-center gap-2 text-sm text-foodie-czern">
          <input type="checkbox" name="auto_approve_default" defaultChecked={a.auto_approve_default} className="size-4 accent-foodie-fiolet" />
          {t.auto}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Pole id="akceptacja-godziny" etykieta={t.godziny} podpowiedz={t.godzinyPodpowiedz}>
            <input id="akceptacja-godziny" name="auto_approve_hours" type="number" min={GODZINY_AUTO_MIN} max={GODZINY_AUTO_MAX} step={1} defaultValue={a.auto_approve_hours ?? ""} className={POLE} />
          </Pole>
          <Pole id="akceptacja-publikacja" etykieta={t.publikacja} podpowiedz={t.publikacjaPodpowiedz}>
            <input id="akceptacja-publikacja" name="default_publish_hours" required defaultValue={a.default_publish_hours.join(", ")} className={POLE} />
          </Pole>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={trwa} data-zapisz-akceptacje>
            {trwa ? copy.zespol.daneKlienta.zapisywanie : copy.zespol.daneKlienta.zapisz}
          </Button>
          <StanZapisu blad={blad} zapisano={zapisano} />
        </div>
      </form>
    </Sekcja>
  );
}
