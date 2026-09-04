"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import type { PakietSzczegoly } from "@/lib/dto/materialy";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { formatujDateCzas } from "@/lib/format";
import type { Przejscie } from "@/lib/pakiety/przejscia";

type Dialogowe = "wyslij" | "wyslij_v2" | "cofnij" | null;

/**
 * Akcje zespołu nad pakietem (SPEC rozdz. 6.8, 12.3 pkt 7): wyślij (z checkboxem auto-akceptacji), wycofaj,
 * wyślij v2, cofnij do poprawek (z obowiązkowym powodem), zaplanowano. Braki z walidacji wypisane wprost.
 */
export function PasekZespolu({ pakiet, teraz, mozeZmieniac, wykonaj }: { pakiet: PakietSzczegoly; teraz: string; mozeZmieniac: boolean; wykonaj: (przejscie: Przejscie) => Promise<WynikAkcji> }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialogowe>(null);
  const [auto, setAuto] = useState(pakiet.status === "szkic" ? pakiet.autoDomyslnaKlienta : pakiet.autoWlaczona);
  const [powod, setPowod] = useState("");
  const [wynik, setWynik] = useState<WynikAkcji | null>(null);
  const [trwa, startTransition] = useTransition();
  const t = copy.zespol.pakietyMaterialow;
  const a = t.akcje;
  const wstrzymana = pakiet.status === "do_akceptacji" && pakiet.autoAkceptacjaO !== null && new Date(pakiet.autoAkceptacjaO).getTime() <= new Date(teraz).getTime() && pakiet.nierozwiazaneUwagiKlienta > 0;

  function uruchom(przejscie: Przejscie, potwierdzenie?: string) {
    if (potwierdzenie && !window.confirm(potwierdzenie)) return;
    setWynik(null);
    startTransition(async () => {
      const w = await wykonaj(przejscie);
      setWynik(w);
      if (w.ok) {
        setDialog(null);
        setPowod("");
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-miekki sm:p-5" data-pasek-zespolu>
      <h2 className="font-naglowek text-lg text-foodie-czern">{a.tytul}</h2>
      <dl className="mt-2 space-y-1 text-sm text-szary-600">
        {pakiet.wyslanoO ? <div>{t.wyslanoV.replace("{data}", formatujDateCzas(pakiet.wyslanoO)).replace("{n}", String(pakiet.runda))}</div> : null}
        {pakiet.status === "do_akceptacji" ? <div>{pakiet.autoAkceptacjaO ? `${t.autoTermin} ${formatujDateCzas(pakiet.autoAkceptacjaO)}` : t.autoWylaczona}</div> : null}
        {pakiet.zaakceptowanoO && pakiet.rodzajAkceptacji ? <div>{t.zaakceptowano.replace("{data}", formatujDateCzas(pakiet.zaakceptowanoO)).replace("{rodzaj}", t.rodzajAkceptacji[pakiet.rodzajAkceptacji]).replace("{osoba}", pakiet.zaakceptowal ?? t.nikt)}</div> : null}
        {pakiet.nierozwiazaneUwagiKlienta > 0 ? <div className="font-medium text-bursztyn">{t.nierozwiazane.replace("{n}", String(pakiet.nierozwiazaneUwagiKlienta))}</div> : null}
      </dl>
      {wstrzymana ? (
        <p role="status" data-wstrzymana className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-bursztyn">
          <span className="font-semibold">{t.wstrzymana}.</span> {t.wstrzymanaOpis}
        </p>
      ) : null}
      {mozeZmieniac ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {pakiet.status === "szkic" ? <Button type="button" size="lg" disabled={trwa} onClick={() => setDialog("wyslij")} data-akcja="wyslij">{a.wyslij}</Button> : null}
          {pakiet.status === "do_akceptacji" ? <Button type="button" variant="outline" size="lg" disabled={trwa} onClick={() => uruchom({ typ: "wycofaj" }, a.wycofajPotwierdz)} data-akcja="wycofaj">{a.wycofaj}</Button> : null}
          {pakiet.status === "poprawki" ? <Button type="button" size="lg" disabled={trwa} onClick={() => setDialog("wyslij_v2")} data-akcja="wyslij_v2">{a.wyslijV2.replace("{n}", String(pakiet.runda + 1))}</Button> : null}
          {pakiet.status === "zaakceptowany" ? <Button type="button" size="lg" disabled={trwa} onClick={() => uruchom({ typ: "zaplanuj" }, a.zaplanowanoPotwierdz)} data-akcja="zaplanuj">{a.zaplanowano}</Button> : null}
          {pakiet.status === "zaakceptowany" || pakiet.status === "zaplanowany" ? <Button type="button" variant="outline" size="lg" disabled={trwa} onClick={() => setDialog("cofnij")} data-akcja="cofnij">{a.cofnij}</Button> : null}
        </div>
      ) : null}
      {wynik && !wynik.ok ? (
        <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony" data-blad-przejscia>
          <p>{wynik.blad}</p>
          {wynik.braki && wynik.braki.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {wynik.braki.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Dialog open={dialog === "wyslij" || dialog === "wyslij_v2"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{dialog === "wyslij_v2" ? a.wyslijV2.replace("{n}", String(pakiet.runda + 1)) : a.wyslij}</DialogTitle>
            {dialog === "wyslij_v2" ? <DialogDescription>{a.wyslanoV2Info}</DialogDescription> : null}
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm text-foodie-czern">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-0.5 size-4 accent-foodie-fiolet" data-auto-checkbox />
            <span>
              {a.autoCheckbox}
              <span className="block text-xs text-szary-600">{a.autoOpis}</span>
            </span>
          </label>
          {wynik && !wynik.ok ? (
            <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">
              <p>{wynik.blad}</p>
              {wynik.braki && wynik.braki.length > 0 ? (
                <>
                  <p className="mt-1 font-medium">{t.braki}</p>
                  <ul className="list-disc pl-5" data-braki>
                    {wynik.braki.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setDialog(null)}>{a.anuluj}</Button>
            <Button type="button" size="lg" disabled={trwa} onClick={() => uruchom(dialog === "wyslij_v2" ? { typ: "wyslij_v2", autoAkceptacja: auto } : { typ: "wyslij", autoAkceptacja: auto })} data-potwierdz-wysylke>
              {trwa ? a.trwa : dialog === "wyslij_v2" ? a.wyslijV2.replace("{n}", String(pakiet.runda + 1)) : a.wyslij}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "cofnij"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{a.cofnij}</DialogTitle>
            <DialogDescription>{a.powodOpis}</DialogDescription>
          </DialogHeader>
          <label htmlFor="powod-cofniecia" className="block text-sm font-medium text-foodie-czern">
            {a.powod}
          </label>
          <textarea id="powod-cofniecia" value={powod} onChange={(e) => setPowod(e.target.value.slice(0, 2000))} placeholder={a.powodPodpowiedz} rows={3} className="w-full rounded-lg border border-szary-300 px-3 py-2 text-sm outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30" />
          {wynik && !wynik.ok ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{wynik.blad}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setDialog(null)}>{a.anuluj}</Button>
            <Button type="button" size="lg" disabled={trwa || powod.trim().length === 0} onClick={() => uruchom({ typ: "cofnij_do_poprawek", powod })} data-potwierdz-cofniecie>
              {trwa ? a.trwa : a.potwierdzCofniecie}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
