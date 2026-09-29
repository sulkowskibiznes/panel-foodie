"use client";

import { useState, useTransition } from "react";
import { utworzKlienta, type StanNowegoKlienta } from "@/app/zespol/(panel)/klienci/nowy/akcje";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { Opiekun } from "@/lib/dane/klienci-nowi";
import { KATEGORIE, slugZNazwy, TIERY } from "@/lib/klienci/nowy";

const POLE = "mt-1 h-11 w-full rounded-lg border border-szary-300 bg-white px-3 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30";
const ETYKIETA = "block text-sm font-medium text-foodie-czern";

function Pole({ id, etykieta, children }: { id: string; etykieta: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={ETYKIETA}>
        {etykieta}
      </label>
      {children}
    </div>
  );
}

/**
 * Formularz nowego klienta: dane, lokale i osoby w dynamicznych wierszach, zespół klienta. Walidacja po stronie serwera.
 * onSubmit + startTransition zamiast `<form action>`: React 19 czyści formularz po akcji, a błąd (np. zajęty slug)
 * nie może kasować wpisanych lokali i osób (plan 1.8).
 */
export function FormularzKlienta({ opiekunowie, zespol, domyslnyOpiekunId }: { opiekunowie: Opiekun[]; zespol: Array<Opiekun & { role: "content_creator" | "media_buyer" }>; domyslnyOpiekunId: string | null }) {
  const [stan, setStan] = useState<StanNowegoKlienta>({});
  const [trwa, startTransition] = useTransition();
  const [nazwa, setNazwa] = useState("");
  const [slug, setSlug] = useState("");
  const [slugReczny, setSlugReczny] = useState(false);
  const [lokale, setLokale] = useState([0]);
  const [kontakty, setKontakty] = useState([0]);
  const t = copy.zespol.nowyKlient;

  function wyslij(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStan({});
    startTransition(async () => {
      // Sukces kończy się przekierowaniem na kartę klienta; tu wraca tylko odmowa.
      setStan(await utworzKlienta(fd));
    });
  }

  function zmienNazwe(w: string) {
    setNazwa(w);
    if (!slugReczny) setSlug(slugZNazwy(w));
  }

  return (
    <form onSubmit={wyslij} className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
        <h2 className="font-naglowek text-lg text-foodie-czern">{t.dane.naglowek}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Pole id="name" etykieta={t.dane.nazwa}>
            <input id="name" name="name" required maxLength={120} value={nazwa} onChange={(e) => zmienNazwe(e.target.value)} placeholder={t.dane.nazwaPodpowiedz} className={POLE} />
          </Pole>
          <Pole id="slug" etykieta={t.dane.slug}>
            <input
              id="slug"
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlugReczny(true);
                setSlug(e.target.value);
              }}
              pattern="[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?"
              className={POLE}
            />
            <p className="mt-1 text-xs text-szary-600">{t.dane.slugOpis}</p>
          </Pole>
          <Pole id="category" etykieta={t.dane.kategoria}>
            <select id="category" name="category" defaultValue="kat1" className={POLE}>
              {KATEGORIE.map((k) => (
                <option key={k} value={k}>{copy.zespol.kategorie[k]}</option>
              ))}
            </select>
          </Pole>
          <Pole id="tier" etykieta={t.dane.pakiet}>
            <select id="tier" name="tier" defaultValue="foodie_one" className={POLE}>
              {TIERY.map((p) => (
                <option key={p} value={p}>{copy.zespol.pakiety[p]}</option>
              ))}
            </select>
          </Pole>
          <Pole id="monthly_amount_net" etykieta={t.dane.kwota}>
            <input id="monthly_amount_net" name="monthly_amount_net" inputMode="decimal" className={POLE} />
          </Pole>
          <Pole id="slack_channel" etykieta={t.dane.slack}>
            <input id="slack_channel" name="slack_channel" placeholder={t.dane.slackPodpowiedz} maxLength={80} className={POLE} />
          </Pole>
          <Pole id="cooperation_started_on" etykieta={t.dane.startWspolpracy}>
            <input id="cooperation_started_on" name="cooperation_started_on" type="date" className={POLE} />
          </Pole>
          <Pole id="opiekun_id" etykieta={t.dane.opiekun}>
            <select id="opiekun_id" name="opiekun_id" defaultValue={domyslnyOpiekunId ?? ""} className={POLE}>
              <option value="">{t.dane.bezOpiekuna}</option>
              {opiekunowie.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </Pole>
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6" data-lokale>
        <h2 className="font-naglowek text-lg text-foodie-czern">{t.lokale.naglowek}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{t.lokale.opis}</p>
        <div className="mt-3 space-y-4">
          {lokale.map((k, i) => (
            <fieldset key={k} className="grid gap-3 rounded-lg border border-szary-100 p-3 sm:grid-cols-4" data-lokal={i}>
              <Pole id={`lokal-${k}-name`} etykieta={t.lokale.nazwa}>
                <input id={`lokal-${k}-name`} name="lokal_name" required maxLength={120} className={POLE} />
              </Pole>
              <Pole id={`lokal-${k}-city`} etykieta={t.lokale.miasto}>
                <input id={`lokal-${k}-city`} name="lokal_city" maxLength={80} className={POLE} />
              </Pole>
              <Pole id={`lokal-${k}-fb`} etykieta={t.lokale.fb}>
                <input id={`lokal-${k}-fb`} name="lokal_fb" required maxLength={120} className={POLE} />
              </Pole>
              <Pole id={`lokal-${k}-ig`} etykieta={t.lokale.ig}>
                <input id={`lokal-${k}-ig`} name="lokal_ig" placeholder={t.lokale.igPodpowiedz} maxLength={60} className={POLE} />
              </Pole>
              {lokale.length > 1 ? (
                <div className="sm:col-span-4">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLokale(lokale.filter((x) => x !== k))}>
                    {t.lokale.usun}
                  </Button>
                </div>
              ) : null}
            </fieldset>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setLokale([...lokale, (lokale[lokale.length - 1] ?? 0) + 1])} data-dodaj-lokal>
          {t.lokale.dodaj}
        </Button>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6" data-kontakty>
        <h2 className="font-naglowek text-lg text-foodie-czern">{t.kontakty.naglowek}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{t.kontakty.opis}</p>
        <div className="mt-3 space-y-4">
          {kontakty.map((k, i) => (
            <fieldset key={k} className="grid gap-3 rounded-lg border border-szary-100 p-3 sm:grid-cols-4" data-kontakt={i}>
              <Pole id={`kontakt-${k}-name`} etykieta={t.kontakty.imie}>
                <input id={`kontakt-${k}-name`} name="kontakt_name" required maxLength={120} className={POLE} />
              </Pole>
              <Pole id={`kontakt-${k}-rola`} etykieta={t.kontakty.rola}>
                <input id={`kontakt-${k}-rola`} name="kontakt_rola" placeholder={t.kontakty.rolaPodpowiedz} maxLength={60} className={POLE} />
              </Pole>
              <Pole id={`kontakt-${k}-telefon`} etykieta={t.kontakty.telefon}>
                <input id={`kontakt-${k}-telefon`} name="kontakt_telefon" type="tel" maxLength={40} className={POLE} />
              </Pole>
              <Pole id={`kontakt-${k}-email`} etykieta={t.kontakty.email}>
                <input id={`kontakt-${k}-email`} name="kontakt_email" type="email" maxLength={120} className={POLE} />
              </Pole>
              {kontakty.length > 1 ? (
                <div className="sm:col-span-4">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setKontakty(kontakty.filter((x) => x !== k))}>
                    {t.kontakty.usun}
                  </Button>
                </div>
              ) : null}
            </fieldset>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setKontakty([...kontakty, (kontakty[kontakty.length - 1] ?? 0) + 1])} data-dodaj-kontakt>
          {t.kontakty.dodaj}
        </Button>
      </section>

      {zespol.length > 0 ? (
        <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6" data-przypisani-nowego>
          <h2 className="font-naglowek text-lg text-foodie-czern">{t.dane.przypisani}</h2>
          <p className="mt-1 max-w-prose text-sm text-szary-600">{t.dane.przypisaniOpis}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {zespol.map((o) => (
              <li key={o.id}>
                <label className="flex items-center gap-2 text-sm text-foodie-czern">
                  <input type="checkbox" name="przypisany" value={o.id} className="size-4 accent-foodie-fiolet" />
                  {o.name} <span className="text-szary-600">· {copy.zespol.role[o.role]}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {stan.blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{stan.blad}</p> : null}
      <Button type="submit" size="lg" disabled={trwa} data-utworz-klienta>
        {trwa ? t.tworzenie : t.utworz}
      </Button>
    </form>
  );
}
