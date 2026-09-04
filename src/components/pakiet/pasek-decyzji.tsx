"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Odliczanie } from "@/components/pakiet/odliczanie";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import type { PakietSzczegoly } from "@/lib/dto/materialy";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { liczebnik } from "@/lib/format";
import { czyOstatnieDobra } from "@/lib/pakiety/auto-akceptacja";

export type AkcjeDecyzji = {
  akceptuj: (dane: { sprawdzilemDaty: boolean }) => Promise<WynikAkcji>;
  zglosUwagi: () => Promise<WynikAkcji>;
};

export function podsumowanieLiczb(p: Pick<PakietSzczegoly, "posty" | "relacje" | "kampanie">) {
  const k = copy.klientStart;
  return {
    posty: liczebnik(p.posty.length, k.posty.jeden, k.posty.kilka, k.posty.wiele),
    relacje: liczebnik(p.relacje.length, k.relacje.jeden, k.relacje.kilka, k.relacje.wiele),
    kampanie: liczebnik(p.kampanie.length, k.kampanie.jeden, k.kampanie.kilka, k.kampanie.wiele),
  };
}

/**
 * Górny pasek pakietu (SPEC rozdz. 6.2, 6.3): przyklejony, z licznikiem auto-akceptacji i dwiema decyzjami.
 * „Zgłaszam uwagi" aktywne tylko z co najmniej jednym komentarzem (kryterium 9); „Akceptuję wszystko" przez
 * modal z podsumowaniem, checkboxem dat i ostrzeżeniem o nierozwiązanych uwagach, które nie blokuje.
 */
export function PasekDecyzji({ pakiet, teraz, tryb, mozeAkceptowac, obejrzane, akcje }: { pakiet: PakietSzczegoly; teraz: string; tryb: "klient" | "zespol"; mozeAkceptowac: boolean; obejrzane: number; akcje: AkcjeDecyzji | null }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"akceptacja" | "uwagi" | null>(null);
  const [sprawdzilem, setSprawdzilem] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const t = copy.pakiet;
  const liczby = podsumowanieLiczb(pakiet);
  const decyzje = tryb === "klient" && pakiet.status === "do_akceptacji" && akcje !== null;
  const pilne = czyOstatnieDobra(pakiet.autoAkceptacjaO, new Date(teraz));
  const brakUwag = pakiet.uwagiKlientaWRundzie === 0;

  function zamknij() {
    setDialog(null);
    setSprawdzilem(false);
    setBlad(null);
  }

  function wykonaj(akcja: () => Promise<WynikAkcji>) {
    setBlad(null);
    startTransition(async () => {
      const w = await akcja();
      if (!w.ok) {
        setBlad(w.blad);
        return;
      }
      zamknij();
      router.refresh();
    });
  }

  const linia = (() => {
    if (pakiet.status === "do_akceptacji") {
      if (!pakiet.autoAkceptacjaO) return { tekst: t.autoWylaczona, klasa: "text-szary-600" };
      return {
        tekst: (
          <>
            {pilne ? `${t.autoOstatniaDoba}. ` : ""}
            <Odliczanie do_={pakiet.autoAkceptacjaO} teraz={teraz} />
          </>
        ),
        klasa: pilne ? "text-bursztyn" : "text-fiolet-700",
      };
    }
    if (pakiet.status === "poprawki") return { tekst: t.licznikZatrzymany, klasa: "text-bursztyn" };
    return null;
  })();

  return (
    <header className="sticky top-0 z-30 -mx-5 border-b border-szary-100 bg-white/95 px-5 py-2.5 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:py-3 sm:shadow-miekki" data-pasek-pakietu>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-naglowek text-xl text-foodie-czern sm:text-2xl">
            {pakiet.tytul}
            {pakiet.runda > 1 ? <span className="ml-2 text-base text-szary-600">{t.wersja} {pakiet.runda}</span> : null}
          </h1>
          <p className="mt-0.5 text-xs text-szary-600 sm:text-sm">
            {liczby.posty} · {liczby.relacje} · {liczby.kampanie}
          </p>
          <p className="mt-1 text-sm font-medium">
            <span className="text-foodie-czern">{copy.materialy.status[pakiet.status]}</span>
            {linia ? (
              <>
                <span className="text-szary-300"> · </span>
                <span className={linia.klasa} data-auto-linia>
                  {linia.tekst}
                </span>
              </>
            ) : null}
          </p>
          {tryb === "klient" ? (
            <p className="mt-1 text-xs text-szary-600" data-obejrzano>
              {t.obejrzano.replace("{x}", String(obejrzane)).replace("{y}", String(pakiet.liczbaMaterialow))}
            </p>
          ) : null}
        </div>
        {decyzje ? (
          mozeAkceptowac ? (
            <div className="w-full sm:w-auto">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <Button type="button" variant="outline" size="lg" disabled={brakUwag || trwa} title={brakUwag ? copy.przejscia.odmowa.brak_uwag : undefined} onClick={() => setDialog("uwagi")} data-decyzja="uwagi">
                  {t.decyzje.uwagi}
                </Button>
                <Button type="button" size="lg" disabled={trwa} onClick={() => setDialog("akceptacja")} data-decyzja="akceptuj">
                  {t.decyzje.akceptuj}
                </Button>
              </div>
              {brakUwag ? <p className="mt-1 text-xs text-szary-600" data-podpowiedz-uwag>{copy.przejscia.odmowa.brak_uwag}</p> : null}
            </div>
          ) : (
            <p className="max-w-xs text-xs text-szary-600">{t.tylkoPodglad}</p>
          )
        ) : null}
      </div>

      <Dialog open={dialog === "akceptacja"} onOpenChange={(open) => (open ? setDialog("akceptacja") : zamknij())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{t.modalAkceptacji.tytul}</DialogTitle>
            <DialogDescription>{t.modalAkceptacji.opis.replace("{posty}", liczby.posty).replace("{relacje}", liczby.relacje).replace("{kampanie}", liczby.kampanie)}</DialogDescription>
          </DialogHeader>
          {pakiet.nierozwiazaneUwagiKlienta > 0 ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-bursztyn">{t.modalAkceptacji.ostrzezenieUwagi.replace("{n}", String(pakiet.nierozwiazaneUwagiKlienta))}</p> : null}
          <label className="flex items-start gap-2 text-sm text-foodie-czern">
            <input type="checkbox" checked={sprawdzilem} onChange={(e) => setSprawdzilem(e.target.checked)} className="mt-0.5 size-4 accent-foodie-fiolet" />
            {t.modalAkceptacji.sprawdzilem}
          </label>
          {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="lg" onClick={zamknij}>{t.modalAkceptacji.anuluj}</Button>
            <Button type="button" size="lg" disabled={!sprawdzilem || trwa} onClick={() => akcje && wykonaj(() => akcje.akceptuj({ sprawdzilemDaty: sprawdzilem }))}>
              {trwa ? t.modalAkceptacji.trwa : t.modalAkceptacji.potwierdz}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "uwagi"} onOpenChange={(open) => (open ? setDialog("uwagi") : zamknij())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{t.modalUwag.tytul}</DialogTitle>
            <DialogDescription>{t.modalUwag.opis.replace("{n}", String(pakiet.uwagiKlientaWRundzie))}</DialogDescription>
          </DialogHeader>
          {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="lg" onClick={zamknij}>{t.modalUwag.anuluj}</Button>
            <Button type="button" size="lg" disabled={trwa} onClick={() => akcje && wykonaj(() => akcje.zglosUwagi())}>
              {trwa ? t.modalUwag.trwa : t.modalUwag.potwierdz}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
