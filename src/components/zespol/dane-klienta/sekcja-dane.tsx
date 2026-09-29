"use client";

import { zapiszDane } from "@/app/zespol/(panel)/klienci/[slug]/ustawienia/dane-akcje";
import { Button } from "@/components/ui/button";
import { Pole, POLE, Sekcja, StanZapisu, useZapis } from "@/components/zespol/dane-klienta/wspolne";
import { copy } from "@/lib/copy";
import type { DaneKlientaZespolu } from "@/lib/dane/dane-klienta";
import { KATEGORIE, TIERY } from "@/lib/klienci/nowy";

/** Dane klienta z umowy (plan 1.2). Slug nieedytowalny; kategoria tylko przed pierwszym pakietem i raportem. */
export function SekcjaDane({ slug, klient }: { slug: string; klient: DaneKlientaZespolu }) {
  const { trwa, blad, zapisano, wyslij } = useZapis((fd) => zapiszDane(slug, fd));
  const t = copy.zespol.nowyKlient.dane;
  const d = copy.zespol.daneKlienta;
  return (
    <Sekcja tytul={d.dane.tytul} opis={d.dane.opis} dane="dane">
      <form onSubmit={wyslij} className="space-y-4" data-formularz-danych>
        <div className="grid gap-4 sm:grid-cols-2">
          <Pole id="dane-name" etykieta={t.nazwa}>
            <input id="dane-name" name="name" required maxLength={120} defaultValue={klient.name} className={POLE} />
          </Pole>
          <Pole id="dane-slug" etykieta={t.slug}>
            <input id="dane-slug" value={klient.slug} disabled readOnly className={POLE} />
          </Pole>
          <Pole id="dane-category" etykieta={t.kategoria} podpowiedz={klient.mozeZmienicKategorie ? undefined : d.dane.kategoriaZablokowana}>
            {klient.mozeZmienicKategorie ? (
              <select id="dane-category" name="category" defaultValue={klient.category} className={POLE}>
                {KATEGORIE.map((k) => (
                  <option key={k} value={k}>{copy.zespol.kategorie[k]}</option>
                ))}
              </select>
            ) : (
              <>
                <input type="hidden" name="category" value={klient.category} />
                <input id="dane-category" value={copy.zespol.kategorie[klient.category]} disabled readOnly className={POLE} />
              </>
            )}
          </Pole>
          <Pole id="dane-tier" etykieta={t.pakiet}>
            <select id="dane-tier" name="tier" defaultValue={klient.tier} className={POLE}>
              {TIERY.map((p) => (
                <option key={p} value={p}>{copy.zespol.pakiety[p]}</option>
              ))}
            </select>
          </Pole>
          <Pole id="dane-kwota" etykieta={t.kwota}>
            <input id="dane-kwota" name="monthly_amount_net" inputMode="decimal" defaultValue={klient.monthly_amount_net ?? ""} className={POLE} />
          </Pole>
          <Pole id="dane-slack" etykieta={t.slack}>
            <input id="dane-slack" name="slack_channel" maxLength={80} placeholder={t.slackPodpowiedz} defaultValue={klient.slack_channel ?? ""} className={POLE} />
          </Pole>
          <Pole id="dane-start" etykieta={t.startWspolpracy}>
            <input id="dane-start" name="cooperation_started_on" type="date" defaultValue={klient.cooperation_started_on ?? ""} className={POLE} />
          </Pole>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={trwa} data-zapisz-dane>
            {trwa ? d.zapisywanie : d.zapisz}
          </Button>
          <StanZapisu blad={blad} zapisano={zapisano} />
        </div>
      </form>
    </Sekcja>
  );
}
