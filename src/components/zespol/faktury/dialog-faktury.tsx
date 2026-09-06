"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { dodajFakture, type WynikFaktury } from "@/app/zespol/(panel)/klienci/[slug]/faktury/akcje";
import { przygotujPdf, zakonczPdf } from "@/app/zespol/(panel)/klienci/[slug]/pliki-akcje";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PolePdf } from "@/components/zespol/pliki/pole-pdf";
import { useUploadPdf } from "@/components/zespol/pliki/use-upload-pdf";
import { copy } from "@/lib/copy";
import { bruttoZNetto } from "@/lib/faktury/status";

const POLE = "mt-1 h-11 w-full rounded-lg border border-szary-300 bg-white px-3 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30";

function plusDni(data: string, dni: number): string {
  const [r, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(r ?? 0, (m ?? 1) - 1, (d ?? 1) + dni)).toISOString().slice(0, 10);
}

/** „Dodaj fakturę" (SPEC rozdz. 10): numer, daty, kwoty (brutto podpowiadane z 23%), notatka, opcjonalny PDF. */
export function DialogFaktury({ slug, dzis, kwotaNetto }: { slug: string; dzis: string; kwotaNetto: number | null }) {
  const router = useRouter();
  const [otwarty, setOtwarty] = useState(false);
  const [netto, setNetto] = useState(kwotaNetto ? String(kwotaNetto) : "");
  const [brutto, setBrutto] = useState(kwotaNetto ? String(bruttoZNetto(kwotaNetto)) : "");
  const [bruttoReczne, setBruttoReczne] = useState(false);
  const [wynik, setWynik] = useState<WynikFaktury | null>(null);
  const [trwa, startTransition] = useTransition();
  const akcjeUploadu = useMemo(() => ({ przygotuj: (p: { nazwa: string; mime: string; bytes: number }) => przygotujPdf(slug, "faktury", p), zakoncz: (poz: string) => zakonczPdf(slug, "faktury", poz) }), [slug]);
  const upload = useUploadPdf(akcjeUploadu);
  const t = copy.zespol.faktury;
  const d = t.dialog;

  function zmienNetto(wartosc: string) {
    setNetto(wartosc);
    if (!bruttoReczne) {
      const n = Number(wartosc.replace(",", "."));
      setBrutto(Number.isFinite(n) && n > 0 ? String(bruttoZNetto(n)) : "");
    }
  }

  function zmienOtwarcie(open: boolean) {
    setOtwarty(open);
    if (!open) {
      setWynik(null);
      upload.wyczysc();
    }
  }

  function wyslij(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dane = new FormData(e.currentTarget);
    const opisPdf = upload.stan.faza === "gotowy" ? upload.stan.opis : null;
    startTransition(async () => {
      const r = await dodajFakture(slug, {
        numer: String(dane.get("numer") ?? ""),
        wystawiono: String(dane.get("wystawiono") ?? ""),
        termin: String(dane.get("termin") ?? ""),
        netto: String(dane.get("netto") ?? ""),
        brutto: String(dane.get("brutto") ?? ""),
        notatka: String(dane.get("notatka") ?? ""),
        opisPdf,
      });
      setWynik(r);
      if (r.ok) router.refresh();
    });
  }

  const zajete = upload.stan.faza === "wysylanie" || upload.stan.faza === "sprawdzanie";

  return (
    <Dialog open={otwarty} onOpenChange={zmienOtwarcie}>
      <DialogTrigger render={<Button size="lg" data-dodaj-fakture />}>{t.dodaj}</DialogTrigger>
      <DialogContent className="sm:max-w-lg" data-dialog-faktury>
        {wynik?.ok ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-naglowek text-lg">{d.tytul}</DialogTitle>
              <DialogDescription data-wynik-akcji>{d.dodano}</DialogDescription>
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
              <label htmlFor="faktura-numer" className="block text-sm font-medium text-foodie-czern">{d.numer}</label>
              <input id="faktura-numer" name="numer" required maxLength={100} placeholder={d.numerPodpowiedz} className={POLE} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="faktura-wystawiono" className="block text-sm font-medium text-foodie-czern">{d.wystawiono}</label>
                <input id="faktura-wystawiono" name="wystawiono" type="date" required defaultValue={dzis} className={POLE} />
              </div>
              <div>
                <label htmlFor="faktura-termin" className="block text-sm font-medium text-foodie-czern">{d.termin}</label>
                <input id="faktura-termin" name="termin" type="date" required defaultValue={plusDni(dzis, 14)} className={POLE} />
              </div>
              <div>
                <label htmlFor="faktura-netto" className="block text-sm font-medium text-foodie-czern">{d.netto}</label>
                <input id="faktura-netto" name="netto" inputMode="decimal" required value={netto} onChange={(e) => zmienNetto(e.target.value)} className={POLE} />
              </div>
              <div>
                <label htmlFor="faktura-brutto" className="block text-sm font-medium text-foodie-czern">{d.brutto}</label>
                <input
                  id="faktura-brutto"
                  name="brutto"
                  inputMode="decimal"
                  required
                  value={brutto}
                  onChange={(e) => {
                    setBruttoReczne(true);
                    setBrutto(e.target.value);
                  }}
                  className={POLE}
                />
              </div>
            </div>
            <div>
              <label htmlFor="faktura-notatka" className="block text-sm font-medium text-foodie-czern">{d.notatka}</label>
              <input id="faktura-notatka" name="notatka" maxLength={1000} className={POLE} />
              <p className="mt-1 text-xs text-szary-600">{d.notatkaOpis}</p>
            </div>
            <PolePdf id="faktura-pdf" stan={upload.stan} onPlik={(plik) => void upload.wyslij(plik)} etykieta={d.pdf} />
            {wynik && !wynik.ok ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony" data-blad-akcji>{wynik.blad}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => zmienOtwarcie(false)}>{d.anuluj}</Button>
              <Button type="submit" size="lg" disabled={trwa || zajete} data-zapisz-fakture>{trwa ? d.zapisywanie : d.zapisz}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
