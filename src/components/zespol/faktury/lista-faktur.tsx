"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { cofnijOplacenie, oznaczOplacona, ustawPdf, usunFakture, type WynikFaktury } from "@/app/zespol/(panel)/klienci/[slug]/faktury/akcje";
import { przygotujPdf, zakonczPdf } from "@/app/zespol/(panel)/klienci/[slug]/pliki-akcje";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PolePdf } from "@/components/zespol/pliki/pole-pdf";
import { useUploadPdf } from "@/components/zespol/pliki/use-upload-pdf";
import { usePotwierdzenie } from "@/components/zespol/potwierdzenie";
import { copy } from "@/lib/copy";
import type { FakturaZespolu } from "@/lib/dane/faktury";
import { dniPoTerminie } from "@/lib/faktury/status";
import { formatujDate } from "@/lib/format";

const POLE = "mt-1 h-11 w-full rounded-lg border border-szary-300 bg-white px-3 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30";
const kwota = (k: number) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2 }).format(k);
const data = (d: string) => formatujDate(d, { day: "numeric", month: "numeric", year: "numeric" });

type Dialog = { rodzaj: "oplacenie"; faktura: FakturaZespolu } | { rodzaj: "pdf"; faktura: FakturaZespolu } | null;

/** Lista faktur zespołu z akcjami (SPEC rozdz. 10): oznacz opłaconą / cofnij, PDF, usuń. Bez prawa pełnego: tylko podgląd. */
export function ListaFaktur({ slug, faktury, mozeZmieniac, dzis }: { slug: string; faktury: FakturaZespolu[]; mozeZmieniac: boolean; dzis: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const akcjeUploadu = useMemo(() => ({ przygotuj: (p: { nazwa: string; mime: string; bytes: number }) => przygotujPdf(slug, "faktury", p), zakoncz: (poz: string) => zakonczPdf(slug, "faktury", poz) }), [slug]);
  const upload = useUploadPdf(akcjeUploadu);
  const t = copy.zespol.faktury;
  const { potwierdz, okno } = usePotwierdzenie();

  if (faktury.length === 0) return <p className="text-sm text-szary-600" data-brak-faktur>{t.brak}</p>;

  function wykonaj(akcja: () => Promise<WynikFaktury>) {
    setBlad(null);
    startTransition(async () => {
      const w = await akcja();
      if (!w.ok) {
        setBlad(w.blad);
        return;
      }
      setDialog(null);
      upload.wyczysc();
      router.refresh();
    });
  }

  function zamknij() {
    setDialog(null);
    setBlad(null);
    upload.wyczysc();
  }

  return (
    <div className="overflow-x-auto">
      <table aria-label={t.tytul} className="w-full min-w-[820px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
          <tr>
            <th className="py-2 pr-4">{t.kolumny.numer}</th>
            <th className="py-2 pr-4">{t.kolumny.wystawiono}</th>
            <th className="py-2 pr-4">{t.kolumny.termin}</th>
            <th className="py-2 pr-4 text-right">{t.kolumny.netto}</th>
            <th className="py-2 pr-4 text-right">{t.kolumny.brutto}</th>
            <th className="py-2 pr-4">{t.kolumny.status}</th>
            <th className="py-2 pr-4">{t.kolumny.pdf}</th>
            {mozeZmieniac ? <th className="py-2">{t.kolumny.akcje}</th> : null}
          </tr>
        </thead>
        <tbody>
          {faktury.map((f) => (
            <tr key={f.id} className="border-t border-szary-100 align-top" data-faktura={f.id} data-status={f.status}>
              <td className="py-3 pr-4 font-medium text-foodie-czern">
                {f.numer}
                {f.notatka ? <span className="block max-w-56 truncate text-xs font-normal text-szary-600" title={f.notatka}>{f.notatka}</span> : null}
              </td>
              <td className="py-3 pr-4 text-szary-600">{data(f.wystawiono)}</td>
              <td className="py-3 pr-4 text-szary-600">{data(f.termin)}</td>
              <td className="py-3 pr-4 text-right text-szary-600">{kwota(f.netto)}</td>
              <td className="py-3 pr-4 text-right font-medium text-foodie-czern">{kwota(f.brutto)}</td>
              <td className="py-3 pr-4">
                {f.status === "po_terminie" ? (
                  <span className="font-semibold text-czerwony">
                    {t.status.po_terminie}
                    <span className="block text-xs font-normal">{t.poTerminie.replace("{n}", String(dniPoTerminie(f.termin, dzis)))}</span>
                  </span>
                ) : f.status === "oplacona" ? (
                  <span className="font-medium text-zielony">
                    {t.status.oplacona}
                    {f.zaplaconoDnia ? <span className="block text-xs font-normal text-szary-600">{data(f.zaplaconoDnia)}</span> : null}
                  </span>
                ) : (
                  <span className="text-foodie-czern">{t.status.do_zaplaty}</span>
                )}
              </td>
              <td className="py-3 pr-4">
                {f.maPdf ? (
                  <a href={`/zespol/faktura/${f.id}`} className="font-medium text-foodie-fiolet hover:underline" data-pobierz-fakture>{t.pdfPobierz}</a>
                ) : (
                  <span className="text-szary-300">{t.pdfBrak}</span>
                )}
              </td>
              {mozeZmieniac ? (
                <td className="py-3">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 whitespace-nowrap">
                    {f.status === "oplacona" ? (
                      <button type="button" disabled={trwa} onClick={() => void potwierdz({ tresc: t.cofnijPotwierdz, przycisk: t.cofnijOplacenie }).then((tak) => tak && wykonaj(() => cofnijOplacenie(slug, f.id)))} className="font-medium text-szary-600 hover:text-foodie-czern disabled:opacity-50" data-cofnij-oplacenie>
                        {t.cofnijOplacenie}
                      </button>
                    ) : (
                      <button type="button" disabled={trwa} onClick={() => setDialog({ rodzaj: "oplacenie", faktura: f })} className="font-medium text-zielony hover:underline disabled:opacity-50" data-oznacz-oplacona>
                        {t.oznaczOplacona}
                      </button>
                    )}
                    <button type="button" disabled={trwa} onClick={() => setDialog({ rodzaj: "pdf", faktura: f })} className="font-medium text-foodie-fiolet hover:underline disabled:opacity-50" data-pdf-faktury>
                      {f.maPdf ? t.pdfPodmien : t.pdfDodaj}
                    </button>
                    <button type="button" disabled={trwa} onClick={() => void potwierdz({ tresc: t.usunPotwierdz.replace("{numer}", f.numer), przycisk: t.usun, niebezpieczne: true }).then((tak) => tak && wykonaj(() => usunFakture(slug, f.id)))} className="font-medium text-szary-600 hover:text-czerwony disabled:opacity-50" data-usun-fakture>
                      {t.usun}
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {blad && !dialog ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}

      <Dialog open={dialog?.rodzaj === "oplacenie"} onOpenChange={(o) => !o && zamknij()}>
        <DialogContent className="sm:max-w-sm" data-dialog-oplacenia>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = dialog?.faktura;
              if (!f) return;
              const dataWplaty = String(new FormData(e.currentTarget).get("dataWplaty") ?? "");
              wykonaj(() => oznaczOplacona(slug, f.id, dataWplaty));
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle className="font-naglowek text-lg">{t.dialogOplacenia.tytul}</DialogTitle>
              <DialogDescription>{dialog?.faktura.numer}</DialogDescription>
            </DialogHeader>
            <div>
              <label htmlFor="faktura-data-wplaty" className="block text-sm font-medium text-foodie-czern">{t.dialogOplacenia.data}</label>
              <input id="faktura-data-wplaty" name="dataWplaty" type="date" required defaultValue={dzis} max={dzis} className={POLE} />
            </div>
            {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="lg" onClick={zamknij}>{t.dialogOplacenia.anuluj}</Button>
              <Button type="submit" size="lg" disabled={trwa} data-potwierdz-oplacenie>{t.dialogOplacenia.zapisz}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.rodzaj === "pdf"} onOpenChange={(o) => !o && zamknij()}>
        <DialogContent className="sm:max-w-md" data-dialog-pdf-faktury>
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{t.dialogPdf.tytul.replace("{numer}", dialog?.faktura.numer ?? "")}</DialogTitle>
            <DialogDescription>{t.dialogPdf.opis}</DialogDescription>
          </DialogHeader>
          <PolePdf id="faktura-pdf-podmiana" stan={upload.stan} onPlik={(plik) => void upload.wyslij(plik)} />
          {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={zamknij}>{t.dialogPdf.anuluj}</Button>
            <Button
              type="button"
              size="lg"
              disabled={trwa || upload.stan.faza !== "gotowy"}
              onClick={() => {
                const f = dialog?.faktura;
                if (!f || upload.stan.faza !== "gotowy") return;
                const opis = upload.stan.opis;
                wykonaj(() => ustawPdf(slug, f.id, opis));
              }}
              data-zapisz-pdf-faktury
            >
              {t.dialogPdf.zapisz}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {okno}
    </div>
  );
}
