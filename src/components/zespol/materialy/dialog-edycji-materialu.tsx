"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { WynikZmiany } from "@/app/zespol/(panel)/klienci/[slug]/pakiety/[pakietId]/materialy-akcje";
import { KomunikatWyniku } from "@/components/zespol/materialy/komunikat-wyniku";
import { czyPoAkceptacji, PotwierdzeniePoAkceptacji } from "@/components/zespol/materialy/potwierdzenie-po-akceptacji";
import { POLE, POLE_TEKSTOWE, type AkcjeMaterialow } from "@/components/zespol/materialy/typy";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import type { KategoriaKlienta, MaterialDto, StatusPakietu, StronaDto } from "@/lib/dto/materialy";
import { czasLokalny, dataLokalna } from "@/lib/harmonogram/kalendarz";

function wartoscPola(iso: string | null): string {
  return iso ? `${dataLokalna(iso)}T${czasLokalny(iso)}` : "";
}

/** Edycja tytułu, opisu, daty publikacji i lokali (SPEC rozdz. 12.3 pkt 5). Po akceptacji tak samo jak podmiana (T6). */
export function DialogEdycjiMaterialu({ open, onClose, material, status, kategoria, lokale, akcje }: { open: boolean; onClose: () => void; material: MaterialDto; status: StatusPakietu; kategoria: KategoriaKlienta; lokale: StronaDto[]; akcje: AkcjeMaterialow }) {
  const router = useRouter();
  const t = copy.zespol.materialy.edycja;
  const [tytul, setTytul] = useState(material.tytul);
  const [opis, setOpis] = useState(material.opis ?? "");
  const [publikacja, setPublikacja] = useState(wartoscPola(material.publikacjaO));
  const [lokaleIds, setLokaleIds] = useState<string[]>(material.lokaleIds);
  const [potwierdzono, setPotwierdzono] = useState(false);
  const [wynik, setWynik] = useState<WynikZmiany | null>(null);
  const [trwa, startTransition] = useTransition();
  const reklama = material.typ === "reklama";
  const zLokalami = kategoria !== "kat1" && lokale.length > 1;

  function zamknij() {
    onClose();
    setWynik(null);
    setPotwierdzono(false);
  }

  function zapisz(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const w = await akcje.edytujMaterial({
        materialId: material.id,
        tytul: tytul.trim() || null,
        ...(reklama ? {} : { opis: opis, publikacja: publikacja || null }),
        ...(zLokalami ? { lokaleIds } : {}),
        potwierdzono,
      });
      setWynik(w);
      if (w.ok) {
        router.refresh();
        zamknij();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && zamknij()}>
      <DialogContent className="sm:max-w-lg" data-dialog-edycji>
        <form onSubmit={zapisz} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{t.tytul}</DialogTitle>
          </DialogHeader>
          <div>
            <label htmlFor={`tytul-${material.id}`} className="block text-sm font-medium text-foodie-czern">{t.tytulPola}</label>
            <input id={`tytul-${material.id}`} value={tytul} onChange={(e) => setTytul(e.target.value)} maxLength={160} className={POLE} />
          </div>
          {reklama ? null : (
            <>
              <div>
                <label htmlFor={`opis-${material.id}`} className="block text-sm font-medium text-foodie-czern">{t.opis}</label>
                <textarea id={`opis-${material.id}`} value={opis} onChange={(e) => setOpis(e.target.value.slice(0, 10_000))} rows={6} placeholder={t.opisPodpowiedz} className={POLE_TEKSTOWE} />
              </div>
              <div>
                <label htmlFor={`publikacja-${material.id}`} className="block text-sm font-medium text-foodie-czern">{t.publikacja}</label>
                <input id={`publikacja-${material.id}`} type="datetime-local" value={publikacja} onChange={(e) => setPublikacja(e.target.value)} className={POLE} data-pole-publikacji />
                {publikacja ? (
                  <button type="button" onClick={() => setPublikacja("")} className="mt-1 text-xs font-medium text-foodie-fiolet hover:underline">{t.bezDaty}</button>
                ) : (
                  <p className="mt-1 text-xs text-szary-600">{t.bezDaty}</p>
                )}
              </div>
            </>
          )}
          {zLokalami ? (
            <fieldset>
              <legend className="text-sm font-medium text-foodie-czern">{t.lokale}</legend>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                {lokale.map((l) => (
                  <label key={l.lokalId} className="flex items-center gap-2 text-sm text-foodie-czern">
                    <input type="checkbox" checked={lokaleIds.includes(l.lokalId)} onChange={(e) => setLokaleIds((s) => (e.target.checked ? [...s, l.lokalId] : s.filter((x) => x !== l.lokalId)))} className="size-4 accent-foodie-fiolet" />
                    {l.nazwaLokalu}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <PotwierdzeniePoAkceptacji status={status} wartosc={potwierdzono} onChange={setPotwierdzono} />
          <KomunikatWyniku wynik={wynik} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={zamknij}>{t.anuluj}</Button>
            <Button type="submit" size="lg" disabled={trwa || (czyPoAkceptacji(status) && !potwierdzono)} data-zapisz-material>
              {trwa ? copy.zespol.pakietyMaterialow.akcje.trwa : t.zapisz}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
