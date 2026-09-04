"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { WynikZmiany } from "@/app/zespol/(panel)/klienci/[slug]/pakiety/[pakietId]/materialy-akcje";
import { KomunikatWyniku } from "@/components/zespol/materialy/komunikat-wyniku";
import { czyPoAkceptacji, PotwierdzeniePoAkceptacji } from "@/components/zespol/materialy/potwierdzenie-po-akceptacji";
import { POLE, POLE_TEKSTOWE, type DaneKampaniiFormularz } from "@/components/zespol/materialy/typy";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import { rozpoznajLinkDysku } from "@/lib/drive/linki";
import type { CelKampanii, KampaniaDto, StatusPakietu } from "@/lib/dto/materialy";

export const CELE: CelKampanii[] = ["sprzedaz", "ruch", "polubienia", "leady", "zasieg", "inne"];

/** Pola kampanii wspólne dla kreatora i dialogu: nazwa, cel, zdanie dla klienta, link do folderu z reklamami. */
export function PolaKampanii({ idPrefix, wartosc, onChange }: { idPrefix: string; wartosc: DaneKampaniiFormularz; onChange: (d: DaneKampaniiFormularz) => void }) {
  const t = copy.zespol.materialy.kampania;
  const link = wartosc.folder ? rozpoznajLinkDysku(wartosc.folder) : null;
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-nazwa`} className="block text-sm font-medium text-foodie-czern">{t.nazwa}</label>
        <input id={`${idPrefix}-nazwa`} value={wartosc.nazwa} onChange={(e) => onChange({ ...wartosc, nazwa: e.target.value.slice(0, 120) })} placeholder={t.nazwaPodpowiedz} required className={POLE} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-cel`} className="block text-sm font-medium text-foodie-czern">{t.cel}</label>
        <select id={`${idPrefix}-cel`} value={wartosc.cel ?? ""} onChange={(e) => onChange({ ...wartosc, cel: (e.target.value || null) as CelKampanii | null })} className={POLE}>
          <option value="">{t.bezCelu}</option>
          {CELE.map((c) => (
            <option key={c} value={c}>{copy.podglad.cele[c]}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-notatka`} className="block text-sm font-medium text-foodie-czern">{t.notatka}</label>
        <textarea id={`${idPrefix}-notatka`} value={wartosc.notatka ?? ""} onChange={(e) => onChange({ ...wartosc, notatka: e.target.value.slice(0, 500) })} rows={2} placeholder={t.notatkaPodpowiedz} className={POLE_TEKSTOWE} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-folder`} className="block text-sm font-medium text-foodie-czern">{t.folder}</label>
        <input id={`${idPrefix}-folder`} type="url" value={wartosc.folder ?? ""} onChange={(e) => onChange({ ...wartosc, folder: e.target.value.slice(0, 500) })} placeholder="https://drive.google.com/drive/folders/..." className={POLE} data-pole-folderu />
        <p className={`mt-1 text-xs ${wartosc.folder && !link ? "text-czerwony" : "text-szary-600"}`}>
          {wartosc.folder ? (link ? copy.zespol.kreator.linkRozpoznany.replace("{id}", link.id) : copy.zespol.kreator.linkNierozpoznany) : t.folderOpis}
        </p>
      </div>
    </div>
  );
}

export function pusteDaneKampanii(): DaneKampaniiFormularz {
  return { nazwa: "", cel: "sprzedaz", notatka: "", folder: "", potwierdzono: false };
}

/** Nowa kampania albo edycja istniejącej z ekranu pakietu (SPEC rozdz. 12.3 pkt 3: kampanii bywa kilka). */
export function DialogKampanii({ open, onClose, status, kampania, onZapisz }: { open: boolean; onClose: () => void; status: StatusPakietu; kampania: KampaniaDto | null; onZapisz: (d: DaneKampaniiFormularz) => Promise<WynikZmiany> }) {
  const router = useRouter();
  const t = copy.zespol.materialy.kampania;
  const [dane, setDane] = useState<DaneKampaniiFormularz>(kampania ? { nazwa: kampania.nazwa, cel: kampania.cel, notatka: kampania.notatka ?? "", folder: kampania.folderReklamUrl ?? "", potwierdzono: false } : pusteDaneKampanii());
  const [wynik, setWynik] = useState<WynikZmiany | null>(null);
  const [trwa, startTransition] = useTransition();

  function zamknij() {
    onClose();
    setWynik(null);
    if (!kampania) setDane(pusteDaneKampanii());
  }

  function zapisz(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const w = await onZapisz({ ...dane, notatka: dane.notatka?.trim() || null, folder: dane.folder?.trim() || null });
      setWynik(w);
      if (w.ok) {
        router.refresh();
        zamknij();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && zamknij()}>
      <DialogContent className="sm:max-w-lg" data-dialog-kampanii>
        <form onSubmit={zapisz} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{kampania ? t.tytulEdycja : t.tytulNowa}</DialogTitle>
          </DialogHeader>
          <PolaKampanii idPrefix={kampania ? `kampania-${kampania.id}` : "kampania-nowa"} wartosc={dane} onChange={setDane} />
          <PotwierdzeniePoAkceptacji status={status} wartosc={dane.potwierdzono} onChange={(v) => setDane({ ...dane, potwierdzono: v })} />
          <KomunikatWyniku wynik={wynik} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={zamknij}>{copy.zespol.materialy.edycja.anuluj}</Button>
            <Button type="submit" size="lg" disabled={trwa || !dane.nazwa.trim() || (czyPoAkceptacji(status) && !dane.potwierdzono)} data-zapisz-kampanie>
              {trwa ? copy.zespol.pakietyMaterialow.akcje.trwa : kampania ? t.zapisz : t.dodaj}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
