"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { WynikZmiany } from "@/app/zespol/(panel)/klienci/[slug]/pakiety/[pakietId]/materialy-akcje";
import { KomunikatWyniku } from "@/components/zespol/materialy/komunikat-wyniku";
import { PolePliku } from "@/components/zespol/materialy/pole-pliku";
import { czyPoAkceptacji, PotwierdzeniePoAkceptacji } from "@/components/zespol/materialy/potwierdzenie-po-akceptacji";
import type { AkcjeMaterialow } from "@/components/zespol/materialy/typy";
import { useUploadPliku } from "@/components/zespol/materialy/use-upload-pliku";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import type { MaterialDto, PlikDto, StatusPakietu } from "@/lib/dto/materialy";

type Tryb = { rodzaj: "podmiana"; assetId: string } | { rodzaj: "dodanie" } | null;

/**
 * „Podmień materiał" i dodatkowe pliki (SPEC rozdz. 12.6, kryteria 19 i 20): lista bieżących plików z „Podmień"
 * i „Usuń", „Dodaj slajd" (post) albo „Dodaj grafikę" (reklama). Stary plik zostaje w historii (superseded_at).
 */
export function DialogPlikow({ open, onClose, material, status, akcje }: { open: boolean; onClose: () => void; material: MaterialDto; status: StatusPakietu; akcje: AkcjeMaterialow }) {
  const router = useRouter();
  const t = copy.zespol.materialy.podmiana;
  const [tryb, setTryb] = useState<Tryb>(null);
  const [potwierdzono, setPotwierdzono] = useState(false);
  const [wynik, setWynik] = useState<WynikZmiany | null>(null);
  const [trwa, startTransition] = useTransition();
  const upload = useUploadPliku(useMemo(() => ({ przygotuj: akcje.przygotuj, zakoncz: akcje.zakoncz }), [akcje]));
  const reklama = material.typ === "reklama";
  const pliki: PlikDto[] = reklama ? material.warianty.filter((w) => w.rodzaj === "grafika" && w.plik).map((w) => w.plik as PlikDto) : material.pliki;
  const wymagaPotwierdzenia = czyPoAkceptacji(status) && !potwierdzono;

  function zamknij() {
    onClose();
    setTryb(null);
    setWynik(null);
    setPotwierdzono(false);
    upload.wyczysc();
  }

  async function poUploadzie(plik: File) {
    const opis = await upload.wyslij(plik);
    if (!opis || !tryb) return;
    startTransition(async () => {
      const w = tryb.rodzaj === "podmiana" ? await akcje.podmienPlik({ materialId: material.id, assetId: tryb.assetId, opis, potwierdzono }) : await akcje.dodajPlik({ materialId: material.id, opis, potwierdzono });
      setWynik(w);
      if (w.ok) {
        setTryb(null);
        upload.wyczysc();
        router.refresh();
      }
    });
  }

  function usun(assetId: string) {
    if (!window.confirm(t.usunPlikPotwierdz)) return;
    startTransition(async () => {
      const w = await akcje.usunPlik({ materialId: material.id, assetId, potwierdzono });
      setWynik(w);
      if (w.ok) router.refresh();
    });
  }

  const etykietaPliku = (p: PlikDto, i: number) => (p.rodzaj === "wideo" ? t.wideo : reklama ? t.grafika.replace("{n}", String(i + 1)) : t.slajd.replace("{n}", String(i + 1)));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && zamknij()}>
      <DialogContent className="sm:max-w-lg" data-dialog-plikow>
        <DialogHeader>
          <DialogTitle className="font-naglowek text-lg">{t.tytul}: {material.tytul}</DialogTitle>
          <DialogDescription>{t.opis}</DialogDescription>
        </DialogHeader>
        <PotwierdzeniePoAkceptacji status={status} wartosc={potwierdzono} onChange={setPotwierdzono} />
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {pliki.map((p, i) => (
            <li key={p.id} data-plik={p.id} className="flex items-center gap-3 rounded-lg border border-szary-100 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura przez signed URL (decyzja D3) */}
              <img src={p.thumbUrl} alt="" width={48} height={48} className="size-12 shrink-0 rounded-md bg-szary-100 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foodie-czern">{etykietaPliku(p, i)}</p>
                <p className="truncate text-xs text-szary-600">{p.nazwa ?? ""}</p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={trwa || wymagaPotwierdzenia} onClick={() => { setWynik(null); setTryb({ rodzaj: "podmiana", assetId: p.id }); }} data-podmien-plik={p.id}>
                {t.podmienPlik}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={trwa || wymagaPotwierdzenia || (status !== "szkic" && pliki.length <= 1)} title={status !== "szkic" && pliki.length <= 1 ? t.ostatniPlik : undefined} onClick={() => usun(p.id)} data-usun-plik={p.id}>
                {t.usunPlik}
              </Button>
            </li>
          ))}
        </ul>
        {material.typ === "post" || reklama ? (
          <Button type="button" variant="outline" size="lg" disabled={trwa || wymagaPotwierdzenia} onClick={() => { setWynik(null); setTryb({ rodzaj: "dodanie" }); }} data-dodaj-plik>
            {reklama ? t.dodajGrafike : t.dodajSlajd}
          </Button>
        ) : null}
        {tryb ? (
          <div className="rounded-lg bg-szary-050 p-3" data-wybor-pliku={tryb.rodzaj}>
            <PolePliku id={`plik-${material.id}`} stan={upload.stan} onPlik={(plik) => void poUploadzie(plik)} etykieta={tryb.rodzaj === "podmiana" ? t.wybierzNowy : t.wybierz} wideo={!reklama} />
          </div>
        ) : null}
        <KomunikatWyniku wynik={wynik} />
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="lg" onClick={zamknij}>{copy.zespol.dostep.gotowy.zamknij}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
