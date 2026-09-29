"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { WynikZmiany } from "@/app/zespol/(panel)/klienci/[slug]/pakiety/[pakietId]/materialy-akcje";
import { KomunikatWyniku } from "@/components/zespol/materialy/komunikat-wyniku";
import type { AkcjeMaterialow } from "@/components/zespol/materialy/typy";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import type { PakietSzczegoly } from "@/lib/dto/materialy";

const POLE = "mt-1 h-11 w-full rounded-lg border border-szary-300 bg-white px-3 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30";

/**
 * „Ustawienia pakietu" (plan domknięcia, Etap 3a): tytuł i link do folderu z contentem na istniejącej akcji
 * edytujPakietAkcja (walidacja linku Dysku na serwerze). `dlaImportu`: otwarte z „Importuj z Dysku" bez linku.
 */
export function DialogUstawienPakietu({ open, onClose, pakiet, akcje, dlaImportu = false }: { open: boolean; onClose: () => void; pakiet: PakietSzczegoly; akcje: AkcjeMaterialow; dlaImportu?: boolean }) {
  const router = useRouter();
  const t = copy.zespol.materialy.ustawieniaPakietu;
  const [tytul, setTytul] = useState(pakiet.tytul);
  const [folder, setFolder] = useState(pakiet.folderContentuUrl ?? "");
  const [wynik, setWynik] = useState<WynikZmiany | null>(null);
  const [trwa, startTransition] = useTransition();

  function zapisz(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWynik(null);
    startTransition(async () => {
      const w = await akcje.edytujPakiet({ tytul: tytul.trim(), folder: folder.trim() || null });
      setWynik(w);
      if (!w.ok) return;
      toast.success(w.komunikat ?? copy.zespol.materialy.zapisano);
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" data-dialog-ustawien-pakietu>
        <form onSubmit={zapisz} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{t.tytul}</DialogTitle>
            <DialogDescription>{dlaImportu ? t.importInfo : t.opis}</DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="pakiet-tytul" className="block text-sm font-medium text-foodie-czern">{t.tytulPole}</label>
            <input id="pakiet-tytul" required maxLength={200} value={tytul} onChange={(e) => setTytul(e.target.value)} className={POLE} />
          </div>
          <div>
            <label htmlFor="pakiet-folder" className="block text-sm font-medium text-foodie-czern">{t.folderPole}</label>
            <input id="pakiet-folder" type="url" inputMode="url" autoFocus={dlaImportu} value={folder} onChange={(e) => setFolder(e.target.value)} className={POLE} data-pole-folderu />
            <p className="mt-1 text-xs text-szary-600">{t.folderPodpowiedz}</p>
          </div>
          <KomunikatWyniku wynik={wynik} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>{copy.zespol.pakietyMaterialow.akcje.anuluj}</Button>
            <Button type="submit" size="lg" disabled={trwa} data-zapisz-ustawienia-pakietu>{trwa ? t.zapisywanie : t.zapisz}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
