"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { dodajDokument, type WynikDokumentu } from "@/app/zespol/(panel)/klienci/[slug]/dokumenty/akcje";
import { przygotujPdf, zakonczPdf } from "@/app/zespol/(panel)/klienci/[slug]/pliki-akcje";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PolePdf } from "@/components/zespol/pliki/pole-pdf";
import { useUploadPdf } from "@/components/zespol/pliki/use-upload-pdf";
import { copy } from "@/lib/copy";

const POLE = "mt-1 h-11 w-full rounded-lg border border-szary-300 bg-white px-3 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30";
const RODZAJE = ["umowa", "aneks", "powierzenie", "inne"] as const;

/** „Dodaj dokument" (SPEC rozdz. 10): rodzaj, tytuł, data obowiązywania, obowiązkowy PDF. */
export function DialogDokumentu({ slug }: { slug: string }) {
  const router = useRouter();
  const [otwarty, setOtwarty] = useState(false);
  const [wynik, setWynik] = useState<WynikDokumentu | null>(null);
  const [trwa, startTransition] = useTransition();
  const akcjeUploadu = useMemo(() => ({ przygotuj: (p: { nazwa: string; mime: string; bytes: number }) => przygotujPdf(slug, "dokumenty", p), zakoncz: (poz: string) => zakonczPdf(slug, "dokumenty", poz) }), [slug]);
  const upload = useUploadPdf(akcjeUploadu);
  const t = copy.zespol.dokumenty;
  const d = t.dialog;

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
      const r = await dodajDokument(slug, {
        rodzaj: String(dane.get("rodzaj") ?? "inne"),
        tytul: String(dane.get("tytul") ?? ""),
        obowiazujeOd: String(dane.get("obowiazujeOd") ?? ""),
        opisPdf,
      });
      setWynik(r);
      if (r.ok) router.refresh();
    });
  }

  const zajete = upload.stan.faza === "wysylanie" || upload.stan.faza === "sprawdzanie";

  return (
    <Dialog open={otwarty} onOpenChange={zmienOtwarcie}>
      <DialogTrigger render={<Button size="lg" data-dodaj-dokument />}>{t.dodaj}</DialogTrigger>
      <DialogContent className="sm:max-w-md" data-dialog-dokumentu>
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
            </DialogHeader>
            <div>
              <label htmlFor="dokument-rodzaj" className="block text-sm font-medium text-foodie-czern">{d.rodzaj}</label>
              <select id="dokument-rodzaj" name="rodzaj" defaultValue="umowa" className={POLE}>
                {RODZAJE.map((r) => (
                  <option key={r} value={r}>{t.rodzaje[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dokument-tytul" className="block text-sm font-medium text-foodie-czern">{d.tytulPola}</label>
              <input id="dokument-tytul" name="tytul" required maxLength={200} placeholder={d.tytulPodpowiedz} className={POLE} />
            </div>
            <div>
              <label htmlFor="dokument-od" className="block text-sm font-medium text-foodie-czern">{d.obowiazujeOd}</label>
              <input id="dokument-od" name="obowiazujeOd" type="date" className={POLE} />
            </div>
            <PolePdf id="dokument-pdf" stan={upload.stan} onPlik={(plik) => void upload.wyslij(plik)} etykieta={d.pdf} />
            {wynik && !wynik.ok ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony" data-blad-akcji>{wynik.blad}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => zmienOtwarcie(false)}>{d.anuluj}</Button>
              <Button type="submit" size="lg" disabled={trwa || zajete || upload.stan.faza !== "gotowy"} data-zapisz-dokument>{trwa ? d.zapisywanie : d.zapisz}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
