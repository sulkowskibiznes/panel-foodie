"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { WynikZmiany } from "@/app/zespol/(panel)/klienci/[slug]/pakiety/[pakietId]/materialy-akcje";
import { KomunikatWyniku } from "@/components/zespol/materialy/komunikat-wyniku";
import { PolePliku } from "@/components/zespol/materialy/pole-pliku";
import { czyPoAkceptacji, PotwierdzeniePoAkceptacji } from "@/components/zespol/materialy/potwierdzenie-po-akceptacji";
import { POLE, type AkcjeMaterialow, type UprawnieniaMaterialow } from "@/components/zespol/materialy/typy";
import { useUploadPliku } from "@/components/zespol/materialy/use-upload-pliku";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import type { PakietSzczegoly, TypMaterialu } from "@/lib/dto/materialy";

/** „Dodaj materiał" (SPEC rozdz. 12.6): plik z komputera albo link do pliku na Dysku, rodzaj i pozycja; reklama trafia do wybranej kampanii jako grafika. */
export function DialogNowegoMaterialu({ open, onClose, pakiet, akcje, uprawnienia }: { open: boolean; onClose: () => void; pakiet: PakietSzczegoly; akcje: AkcjeMaterialow; uprawnienia: UprawnieniaMaterialow }) {
  const router = useRouter();
  const t = copy.zespol.materialy.nowy;
  const typy = useMemo(() => (["post", "relacja", "reels", "reklama"] as TypMaterialu[]).filter((x) => (x === "reklama" ? uprawnienia.kampanie && pakiet.kampanie.length > 0 : uprawnienia.content)), [uprawnienia, pakiet.kampanie.length]);
  const [typ, setTyp] = useState<TypMaterialu>(typy[0] ?? "post");
  const [kampaniaId, setKampaniaId] = useState<string>(pakiet.kampanie[0]?.id ?? "");
  const [tytul, setTytul] = useState("");
  const [pozycja, setPozycja] = useState("");
  const [potwierdzono, setPotwierdzono] = useState(false);
  const [wynik, setWynik] = useState<WynikZmiany | null>(null);
  const [trwa, startTransition] = useTransition();
  const upload = useUploadPliku(useMemo(() => ({ przygotuj: akcje.przygotuj, zakoncz: akcje.zakoncz, pobierzZDysku: (url: string) => akcje.pobierzZDysku({ url, materialId: null, rodzaj: "dodatkowy" }) }), [akcje]));

  function zamknij() {
    onClose();
    setWynik(null);
    setTytul("");
    setPozycja("");
    setPotwierdzono(false);
    upload.wyczysc();
  }

  function zapisz(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (upload.stan.faza !== "gotowy") return;
    const opis = upload.stan.opis;
    startTransition(async () => {
      const w = await akcje.dodajMaterial({ typ, kampaniaId: typ === "reklama" ? kampaniaId || null : null, tytul: tytul.trim() || null, pozycja: pozycja ? Number(pozycja) : null, opis, potwierdzono });
      setWynik(w);
      if (w.ok) {
        router.refresh();
        zamknij();
      }
    });
  }

  const wymagaPotwierdzenia = czyPoAkceptacji(pakiet.status) && !potwierdzono;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && zamknij()}>
      <DialogContent className="sm:max-w-md" data-dialog-nowego-materialu>
        <form onSubmit={zapisz} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{t.tytul}</DialogTitle>
            <DialogDescription>{t.opis}</DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="nowy-typ" className="block text-sm font-medium text-foodie-czern">{t.typ}</label>
            <select id="nowy-typ" value={typ} onChange={(e) => setTyp(e.target.value as TypMaterialu)} className={POLE}>
              {typy.map((x) => (
                <option key={x} value={x}>{copy.wysylka.typ[x]}</option>
              ))}
            </select>
          </div>
          {typ === "reklama" ? (
            <div>
              <label htmlFor="nowy-kampania" className="block text-sm font-medium text-foodie-czern">{t.kampania}</label>
              <select id="nowy-kampania" value={kampaniaId} onChange={(e) => setKampaniaId(e.target.value)} className={POLE}>
                {pakiet.kampanie.map((k) => (
                  <option key={k.id} value={k.id}>{k.nazwa}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-szary-600">{t.kampaniaOpis}</p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="nowy-tytul" className="block text-sm font-medium text-foodie-czern">{t.tytulPola}</label>
                <input id="nowy-tytul" value={tytul} onChange={(e) => setTytul(e.target.value)} placeholder={t.tytulPodpowiedz} maxLength={160} className={POLE} />
              </div>
              <div>
                <label htmlFor="nowy-pozycja" className="block text-sm font-medium text-foodie-czern">{t.pozycja}</label>
                <input id="nowy-pozycja" type="number" min={1} max={500} value={pozycja} onChange={(e) => setPozycja(e.target.value)} className={POLE} />
                <p className="mt-1 text-xs text-szary-600">{t.pozycjaOpis}</p>
              </div>
            </>
          )}
          <PolePliku id="nowy-plik" stan={upload.stan} onPlik={(plik) => void upload.wyslij(plik)} onLink={(url) => void upload.wyslijZDysku(url)} etykieta={t.plik} wideo={typ !== "reklama"} />
          <PotwierdzeniePoAkceptacji status={pakiet.status} wartosc={potwierdzono} onChange={setPotwierdzono} />
          <KomunikatWyniku wynik={wynik} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={zamknij}>{copy.zespol.materialy.edycja.anuluj}</Button>
            <Button type="submit" size="lg" disabled={trwa || upload.stan.faza !== "gotowy" || wymagaPotwierdzenia} data-dodaj-material-zapisz>
              {trwa ? copy.zespol.pakietyMaterialow.akcje.trwa : t.dodaj}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
