"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dodajRaport, type WynikRaportu } from "@/app/zespol/(panel)/klienci/[slug]/raporty/akcje";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";

const POLE = "mt-1 h-11 w-full rounded-lg border border-szary-300 bg-white px-3 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30";

/** „Dodaj raport" (SPEC rozdz. 9): link, miesiąc, lokal dla kat1, tytuł i numer miesiąca współpracy opcjonalne. */
export function DialogRaportu({ slug, kategoria, lokale, podpowiedzMiesiaca }: { slug: string; kategoria: "kat1" | "kat2" | "kat3"; lokale: { id: string; name: string }[]; podpowiedzMiesiaca: number | null }) {
  const router = useRouter();
  const [otwarty, setOtwarty] = useState(false);
  const [wynik, setWynik] = useState<WynikRaportu | null>(null);
  const [trwa, startTransition] = useTransition();
  const t = copy.zespol.raporty;
  const d = t.dialog;
  const zLokalem = kategoria === "kat1";

  function zmienOtwarcie(open: boolean) {
    setOtwarty(open);
    if (!open) setWynik(null);
  }

  function wyslij(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dane = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await dodajRaport(slug, {
        url: String(dane.get("url") ?? ""),
        okres: String(dane.get("okres") ?? ""),
        lokalId: zLokalem ? String(dane.get("lokal") ?? "") || null : null,
        tytul: String(dane.get("tytul") ?? ""),
        miesiacWspolpracy: String(dane.get("miesiacWspolpracy") ?? ""),
      });
      setWynik(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <Dialog open={otwarty} onOpenChange={zmienOtwarcie}>
      <DialogTrigger render={<Button size="lg" data-dodaj-raport />}>{t.dodaj}</DialogTrigger>
      <DialogContent className="sm:max-w-md" data-dialog-raportu>
        {wynik?.ok ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-naglowek text-lg">{d.tytul}</DialogTitle>
              <DialogDescription data-wynik-akcji>{wynik.utworzony ? d.dodano : d.nadpisano}</DialogDescription>
            </DialogHeader>
            <Button type="button" variant="outline" size="lg" onClick={() => zmienOtwarcie(false)}>{d.anuluj}</Button>
          </>
        ) : (
          <form onSubmit={wyslij} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-naglowek text-lg">{d.tytul}</DialogTitle>
              <DialogDescription>{d.opis}</DialogDescription>
            </DialogHeader>
            <div>
              <label htmlFor="raport-url" className="block text-sm font-medium text-foodie-czern">{d.link}</label>
              <input id="raport-url" name="url" type="url" required placeholder={d.linkPodpowiedz} maxLength={500} className={POLE} />
            </div>
            <div>
              <label htmlFor="raport-okres" className="block text-sm font-medium text-foodie-czern">{d.miesiac}</label>
              <input id="raport-okres" name="okres" type="month" required className={POLE} />
            </div>
            {zLokalem ? (
              <div>
                <label htmlFor="raport-lokal" className="block text-sm font-medium text-foodie-czern">{d.lokal}</label>
                <select id="raport-lokal" name="lokal" defaultValue={lokale[0]?.id ?? ""} className={POLE}>
                  {lokale.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label htmlFor="raport-tytul" className="block text-sm font-medium text-foodie-czern">{d.tytulPola}</label>
              <input id="raport-tytul" name="tytul" maxLength={200} className={POLE} />
            </div>
            <div>
              <label htmlFor="raport-miesiac" className="block text-sm font-medium text-foodie-czern">{d.miesiacWspolpracy}</label>
              <input id="raport-miesiac" name="miesiacWspolpracy" type="number" min={1} max={600} defaultValue={podpowiedzMiesiaca ?? ""} className={POLE} />
            </div>
            {wynik && !wynik.ok ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony" data-blad-akcji>{wynik.blad}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => zmienOtwarcie(false)}>{d.anuluj}</Button>
              <Button type="submit" size="lg" disabled={trwa} data-zapisz-raport>{trwa ? d.zapisywanie : d.zapisz}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
