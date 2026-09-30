"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LinkiDoWyslania } from "@/components/zespol/pulpit/linki-do-wyslania";
import { PokazLinkPulpit } from "@/components/zespol/pulpit/pokaz-link";
import { usePotwierdzenie } from "@/components/zespol/potwierdzenie";
import { toast } from "sonner";
import { copy } from "@/lib/copy";
import type { PakietSzczegoly } from "@/lib/dto/materialy";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { formatujDateCzas, liczebnik } from "@/lib/format";
import type { KontrolaWysylki, Przejscie } from "@/lib/pakiety/przejscia";

type Dialogowe = "wyslij" | "wyslij_v2" | "cofnij" | "wyslano" | null;

/** Lista kontrolna przed wysyłką (SPEC rozdz. 8): braki blokują, ostrzeżenia nie. Widoczna, zanim ktoś kliknie „Wyślij". */
function ListaKontrolna({ kontrola, adresHarmonogramu }: { kontrola: KontrolaWysylki; adresHarmonogramu: string }) {
  const t = copy.zespol.pakietyMaterialow;
  if (kontrola.braki.length === 0 && kontrola.ostrzezenia.length === 0) {
    return <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-zielony" data-kontrola-gotowe>{t.akcje.kontrolaGotowe}</p>;
  }
  return (
    <div className="space-y-2" data-kontrola-wysylki>
      {kontrola.braki.length > 0 ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">
          <p className="font-medium">{t.braki}</p>
          <ul className="mt-1 list-disc pl-5" data-braki>
            {kontrola.braki.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <Link href={adresHarmonogramu} className="mt-1 inline-block font-medium underline underline-offset-4">{t.akcje.ustawDaty}</Link>
        </div>
      ) : null}
      {kontrola.ostrzezenia.length > 0 ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-bursztyn" data-ostrzezenia>
          <p className="font-medium">{t.ostrzezenia}</p>
          <ul className="mt-1 list-disc pl-5">
            {kontrola.ostrzezenia.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Akcje zespołu nad pakietem (SPEC rozdz. 6.8, 12.3 pkt 7): wyślij (z checkboxem auto-akceptacji i listą kontrolną),
 * wycofaj, wyślij v2, cofnij do poprawek (z obowiązkowym powodem), zaplanowano. Po wysyłce admin i csm od razu dostają
 * krok „link dla klienta" (plan domknięcia, Etap 3b), a przy pakiecie czekającym na klienta przycisk „Link dla klienta".
 */
export function PasekZespolu({
  pakiet,
  teraz,
  mozeZmieniac,
  wykonaj,
  slug,
  nazwaKlienta,
  mozePokazacLink,
  kontrola,
  adresHarmonogramu,
}: {
  pakiet: PakietSzczegoly;
  teraz: string;
  mozeZmieniac: boolean;
  wykonaj: (przejscie: Przejscie) => Promise<WynikAkcji>;
  slug: string;
  nazwaKlienta: string;
  mozePokazacLink: boolean;
  kontrola: KontrolaWysylki | null;
  adresHarmonogramu: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialogowe>(null);
  const [auto, setAuto] = useState(pakiet.status === "szkic" ? pakiet.autoDomyslnaKlienta : pakiet.autoWlaczona);
  const [powod, setPowod] = useState("");
  const [wynik, setWynik] = useState<WynikAkcji | null>(null);
  const [trwa, startTransition] = useTransition();
  const { potwierdz, okno } = usePotwierdzenie();
  const t = copy.zespol.pakietyMaterialow;
  const a = t.akcje;
  const wstrzymana = pakiet.status === "do_akceptacji" && pakiet.autoAkceptacjaO !== null && new Date(pakiet.autoAkceptacjaO).getTime() <= new Date(teraz).getTime() && pakiet.nierozwiazaneUwagiKlienta > 0;

  async function uruchom(przejscie: Przejscie, potwierdzenie?: string) {
    if (potwierdzenie && !(await potwierdz({ tresc: potwierdzenie }))) return;
    setWynik(null);
    startTransition(async () => {
      const w = await wykonaj(przejscie);
      setWynik(w);
      if (w.ok) {
        // Po wysyłce: od razu link dla klienta (admin i csm), zamiast zamykać okno i szukać linku osobno.
        setDialog((przejscie.typ === "wyslij" || przejscie.typ === "wyslij_v2") && mozePokazacLink ? "wyslano" : null);
        setPowod("");
        const toasty = copy.zespol.toasty.przejscia;
        // Content creator nie widzi linków (bez zakładki Dostęp): nie każemy mu wysyłać czegoś, czego nie ma.
        toast.success(przejscie.typ === "wyslij" && !mozePokazacLink ? toasty.wyslijBezLinku : (toasty[przejscie.typ as keyof typeof toasty] ?? toasty.wyslij));
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
        {pakiet.nierozwiazaneUwagiKlienta > 0 ? <div className="font-medium text-bursztyn">{liczebnik(pakiet.nierozwiazaneUwagiKlienta, t.nierozwiazane.jeden, t.nierozwiazane.kilka, t.nierozwiazane.wiele)}</div> : null}
      </dl>
      {wstrzymana ? (
        <p role="status" data-wstrzymana className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-bursztyn">
          <span className="font-semibold">{t.wstrzymana}.</span> {t.wstrzymanaOpis}
        </p>
      ) : null}
      {mozeZmieniac ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {pakiet.status === "szkic" ? <Button type="button" size="lg" disabled={trwa} onClick={() => setDialog("wyslij")} data-akcja="wyslij">{a.wyslij}</Button> : null}
          {pakiet.status === "do_akceptacji" && mozePokazacLink ? <PokazLinkPulpit slug={slug} nazwaKlienta={nazwaKlienta} etykieta={a.linkDlaKlienta} /> : null}
          {pakiet.status === "do_akceptacji" ? <Button type="button" variant="outline" size="lg" disabled={trwa} onClick={() => void uruchom({ typ: "wycofaj" }, a.wycofajPotwierdz)} data-akcja="wycofaj">{a.wycofaj}</Button> : null}
          {pakiet.status === "poprawki" ? <Button type="button" size="lg" disabled={trwa} onClick={() => setDialog("wyslij_v2")} data-akcja="wyslij_v2">{a.wyslijV2.replace("{n}", String(pakiet.runda + 1))}</Button> : null}
          {pakiet.status === "zaakceptowany" ? <Button type="button" size="lg" disabled={trwa} onClick={() => void uruchom({ typ: "zaplanuj" }, a.zaplanowanoPotwierdz)} data-akcja="zaplanuj">{a.zaplanowano}</Button> : null}
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
          {kontrola ? <ListaKontrolna kontrola={kontrola} adresHarmonogramu={adresHarmonogramu} /> : null}
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
            <Button type="button" size="lg" disabled={trwa || (kontrola?.braki.length ?? 0) > 0} onClick={() => void uruchom(dialog === "wyslij_v2" ? { typ: "wyslij_v2", autoAkceptacja: auto } : { typ: "wyslij", autoAkceptacja: auto })} data-potwierdz-wysylke>
              {trwa ? a.trwa : dialog === "wyslij_v2" ? a.wyslijV2.replace("{n}", String(pakiet.runda + 1)) : a.wyslij}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "wyslano"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md" data-okno-po-wysylce>
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{a.wyslanoTytul}</DialogTitle>
            <DialogDescription>{a.wyslanoOpis}</DialogDescription>
          </DialogHeader>
          {dialog === "wyslano" ? <LinkiDoWyslania slug={slug} /> : null}
          <div className="flex justify-end">
            <Button type="button" size="lg" onClick={() => setDialog(null)} data-gotowe-po-wysylce>{a.gotowe}</Button>
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
            <Button type="button" size="lg" disabled={trwa || powod.trim().length === 0} onClick={() => void uruchom({ typ: "cofnij_do_poprawek", powod })} data-potwierdz-cofniecie>
              {trwa ? a.trwa : a.potwierdzCofniecie}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {okno}
    </section>
  );
}
