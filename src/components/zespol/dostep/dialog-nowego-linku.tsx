"use client";

import { useState, useTransition } from "react";
import { odnotujSkopiowanie, utworzLink, type WynikNowegoLinku } from "@/app/zespol/(panel)/klienci/[slug]/dostep/akcje";
import { PolaKopiowania } from "@/components/zespol/dostep/pola-kopiowania";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";

type Kontakt = { id: string; name: string; role_label: string | null };
const POLE = "mt-1 h-11 w-full rounded-lg border border-szary-300 bg-white px-3 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30";

export function DialogNowegoLinku({ slug, kontakty }: { slug: string; kontakty: Kontakt[] }) {
  const [otwarty, setOtwarty] = useState(false);
  const [kontaktId, setKontaktId] = useState<string>(kontakty[0]?.id ?? "inna");
  const [wynik, setWynik] = useState<WynikNowegoLinku | null>(null);
  const [trwa, startTransition] = useTransition();
  const d = copy.zespol.dostep;

  function zmienOtwarcie(open: boolean) {
    setOtwarty(open);
    if (!open) setWynik(null);
  }

  function wyslij(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dane = new FormData(e.currentTarget);
    const wybrany = String(dane.get("kontakt") ?? "inna");
    startTransition(async () => {
      const r = await utworzLink(slug, {
        contactId: wybrany === "inna" ? null : wybrany,
        label: String(dane.get("label") ?? ""),
        pinKind: String(dane.get("pinKind") ?? "pin4") as "pin4" | "pin6" | "haslo",
        canApprove: dane.get("canApprove") === "on",
      });
      setWynik(r);
    });
  }

  return (
    <Dialog open={otwarty} onOpenChange={zmienOtwarcie}>
      <DialogTrigger render={<Button size="lg" />}>{d.utworz}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {wynik?.ok ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-naglowek text-lg">{d.gotowy.tytul}</DialogTitle>
              <DialogDescription>{d.gotowy.opis}</DialogDescription>
            </DialogHeader>
            <PolaKopiowania adres={wynik.adres} pin={wynik.pin} onSkopiowano={(co) => void odnotujSkopiowanie(slug, wynik.linkId, co)} />
            <Button type="button" variant="outline" size="lg" onClick={() => zmienOtwarcie(false)}>{d.gotowy.zamknij}</Button>
          </>
        ) : (
          <form onSubmit={wyslij} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-naglowek text-lg">{d.nowy.tytul}</DialogTitle>
            </DialogHeader>
            <div>
              <label htmlFor="kontakt" className="block text-sm font-medium text-foodie-czern">{d.nowy.osoba}</label>
              <select id="kontakt" name="kontakt" value={kontaktId} onChange={(e) => setKontaktId(e.target.value)} className={POLE}>
                {kontakty.map((k) => (
                  <option key={k.id} value={k.id}>{k.role_label ? `${k.name} - ${k.role_label}` : k.name}</option>
                ))}
                <option value="inna">{d.nowy.innaOsoba}</option>
              </select>
            </div>
            <div>
              <label htmlFor="label" className="block text-sm font-medium text-foodie-czern">{d.nowy.etykieta}</label>
              <input id="label" name="label" placeholder={d.nowy.etykietaPodpowiedz} required={kontaktId === "inna"} maxLength={120} className={POLE} />
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-foodie-czern">{d.nowy.rodzajPinu}</legend>
              <div className="mt-1 space-y-1 text-sm">
                {(["pin4", "pin6", "haslo"] as const).map((r) => (
                  <label key={r} className="flex items-center gap-2">
                    <input type="radio" name="pinKind" value={r} defaultChecked={r === "pin4"} className="accent-foodie-fiolet" />
                    {d.nowy[r]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="canApprove" defaultChecked className="mt-0.5 size-4 accent-foodie-fiolet" />
              <span>
                {d.nowy.mozeAkceptowac}
                <span className="block text-xs text-szary-600">{d.nowy.tylkoPodgladOpis}</span>
              </span>
            </label>
            {wynik && !wynik.ok ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{wynik.blad}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => zmienOtwarcie(false)}>{d.nowy.anuluj}</Button>
              <Button type="submit" size="lg" disabled={trwa}>{trwa ? d.nowy.tworzenie : d.nowy.utworz}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
