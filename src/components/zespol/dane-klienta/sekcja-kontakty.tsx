"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiwizujKontaktKlienta, ustawGlowna, zapiszKontaktKlienta } from "@/app/zespol/(panel)/klienci/[slug]/ustawienia/dane-akcje";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pole, POLE, Sekcja, StanZapisu, useZapis } from "@/components/zespol/dane-klienta/wspolne";
import { copy } from "@/lib/copy";
import type { DaneKlientaZespolu, KontaktKlienta } from "@/lib/dane/dane-klienta";

function FormularzKontaktu({ slug, kontakt, onKoniec }: { slug: string; kontakt: KontaktKlienta | null; onKoniec: () => void }) {
  const { trwa, blad, zapisano, wyslij } = useZapis((fd) => zapiszKontaktKlienta(slug, kontakt?.id ?? null, fd), onKoniec);
  const t = copy.zespol.nowyKlient.kontakty;
  const d = copy.zespol.daneKlienta;
  const id = kontakt?.id ?? "nowa";
  return (
    <form onSubmit={wyslij} className="space-y-3 rounded-lg border border-szary-100 p-3" data-formularz-kontaktu={id}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Pole id={`kontakt-${id}-name`} etykieta={t.imie}>
          <input id={`kontakt-${id}-name`} name="name" required maxLength={120} defaultValue={kontakt?.name ?? ""} className={POLE} />
        </Pole>
        <Pole id={`kontakt-${id}-rola`} etykieta={t.rola}>
          <input id={`kontakt-${id}-rola`} name="role_label" maxLength={60} placeholder={t.rolaPodpowiedz} defaultValue={kontakt?.role_label ?? ""} className={POLE} />
        </Pole>
        <Pole id={`kontakt-${id}-telefon`} etykieta={t.telefon}>
          <input id={`kontakt-${id}-telefon`} name="phone" type="tel" maxLength={40} defaultValue={kontakt?.phone ?? ""} className={POLE} />
        </Pole>
        <Pole id={`kontakt-${id}-email`} etykieta={t.email}>
          <input id={`kontakt-${id}-email`} name="email" type="email" maxLength={120} defaultValue={kontakt?.email ?? ""} className={POLE} />
        </Pole>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" disabled={trwa} data-zapisz-kontakt>
          {trwa ? d.zapisywanie : d.zapisz}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={onKoniec}>
          {d.anuluj}
        </Button>
        <StanZapisu blad={blad} zapisano={zapisano} />
      </div>
    </form>
  );
}

/** Osoba przestaje współpracować (plan 1.5): dialog z opcją wygaszenia jej linków, domyślnie zaznaczoną. */
function ArchiwizacjaKontaktu({ slug, kontakt }: { slug: string; kontakt: KontaktKlienta }) {
  const router = useRouter();
  const [otwarty, setOtwarty] = useState(false);
  const [wygas, setWygas] = useState(true);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const t = copy.zespol.daneKlienta.kontakty;
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOtwarty(true)} data-archiwizuj-kontakt={kontakt.id}>
        {t.archiwizuj}
      </Button>
      <Dialog open={otwarty} onOpenChange={setOtwarty}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{t.archiwizujTytul.replace("{osoba}", kontakt.name)}</DialogTitle>
            <DialogDescription>{t.archiwizujOpis}</DialogDescription>
          </DialogHeader>
          {kontakt.aktywneLinki > 0 ? (
            <label className="flex items-center gap-2 text-sm text-foodie-czern">
              <input type="checkbox" checked={wygas} onChange={(e) => setWygas(e.target.checked)} className="size-4 accent-foodie-fiolet" data-wygas-linki-kontaktu />
              {t.wygasLinki.replace("{n}", String(kontakt.aktywneLinki))}
            </label>
          ) : null}
          {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setOtwarty(false)}>
              {copy.zespol.daneKlienta.anuluj}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              disabled={trwa}
              data-potwierdz-archiwizacje
              onClick={() =>
                startTransition(async () => {
                  const w = await archiwizujKontaktKlienta(slug, kontakt.id, kontakt.aktywneLinki > 0 && wygas);
                  if (!w.ok) return setBlad(w.blad);
                  setOtwarty(false);
                  router.refresh();
                })
              }
            >
              {t.archiwizujPotwierdz}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Osoby kontaktowe (plan 1.5): edycja, dodanie, osoba główna, zakończenie współpracy z osobą. */
export function SekcjaKontakty({ slug, klient }: { slug: string; klient: DaneKlientaZespolu }) {
  const router = useRouter();
  const [edytowany, setEdytowany] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const t = copy.zespol.daneKlienta.kontakty;
  const aktywne = klient.kontakty.filter((k) => !k.archived_at);
  const byle = klient.kontakty.filter((k) => k.archived_at);
  return (
    <Sekcja tytul={t.tytul} opis={t.opis} dane="kontakty">
      <ul className="space-y-3">
        {aktywne.map((k) => (
          <li key={k.id} className="rounded-lg border border-szary-100 p-3" data-kontakt={k.id}>
            {edytowany === k.id ? (
              <FormularzKontaktu slug={slug} kontakt={k} onKoniec={() => setEdytowany(null)} />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-medium text-foodie-czern">
                    {k.name}
                    {k.role_label ? <span className="text-szary-600"> · {k.role_label}</span> : null}
                    {k.is_primary ? <span className="ml-2 rounded-full bg-fiolet-050 px-2 py-0.5 text-xs font-medium text-fiolet-700">{t.glowna}</span> : null}
                  </p>
                  <p className="text-szary-600">{[k.phone, k.email].filter(Boolean).join(" · ")}</p>
                  <p className="text-xs text-szary-600">{t.linki.replace("{n}", String(k.aktywneLinki))}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEdytowany(k.id)} data-edytuj-kontakt={k.id}>
                    {copy.zespol.daneKlienta.edytuj}
                  </Button>
                  {!k.is_primary ? (
                    <Button type="button" variant="ghost" size="sm" disabled={trwa} onClick={() => startTransition(async () => { await ustawGlowna(slug, k.id); router.refresh(); })} data-ustaw-glowna={k.id}>
                      {t.ustawGlowna}
                    </Button>
                  ) : null}
                  <ArchiwizacjaKontaktu slug={slug} kontakt={k} />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3">
        {edytowany === "nowa" ? (
          <FormularzKontaktu slug={slug} kontakt={null} onKoniec={() => setEdytowany(null)} />
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setEdytowany("nowa")} data-dodaj-kontakt>
            {t.dodaj}
          </Button>
        )}
      </div>
      {byle.length > 0 ? (
        <details className="mt-4 text-sm text-szary-600" data-byle-kontakty>
          <summary className="cursor-pointer">{t.zarchiwizowane} ({byle.length})</summary>
          <ul className="mt-2 space-y-1 pl-4">
            {byle.map((k) => (
              <li key={k.id}>{k.name}{k.role_label ? ` · ${k.role_label}` : ""}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </Sekcja>
  );
}
