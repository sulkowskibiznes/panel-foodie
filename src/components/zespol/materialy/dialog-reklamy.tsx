"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { WynikZmiany } from "@/app/zespol/(panel)/klienci/[slug]/pakiety/[pakietId]/materialy-akcje";
import { KomunikatWyniku } from "@/components/zespol/materialy/komunikat-wyniku";
import { czyPoAkceptacji, PotwierdzeniePoAkceptacji } from "@/components/zespol/materialy/potwierdzenie-po-akceptacji";
import { POLE, POLE_TEKSTOWE, type AkcjeMaterialow } from "@/components/zespol/materialy/typy";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import type { KategoriaKlienta, MaterialDto, StatusPakietu, StronaDto } from "@/lib/dto/materialy";

type Wiersz = { id: string | null; tekst: string };
type Wersja = { lokalId: string; link: string; cta: string; opis: string };

function ListaWierszy({ idPrefix, etykieta, wiersze, onChange, dodaj, wielowierszowe }: { idPrefix: string; etykieta: string; wiersze: Wiersz[]; onChange: (w: Wiersz[]) => void; dodaj: string; wielowierszowe: boolean }) {
  const t = copy.zespol.materialy.reklama;
  return (
    <fieldset>
      <legend className="text-sm font-medium text-foodie-czern">{etykieta}</legend>
      <div className="mt-1 space-y-2">
        {wiersze.map((w, i) => (
          <div key={w.id ?? `nowy-${i}`} className="flex items-start gap-2">
            {wielowierszowe ? (
              <textarea aria-label={`${etykieta} ${i + 1}`} value={w.tekst} onChange={(e) => onChange(wiersze.map((x, j) => (j === i ? { ...x, tekst: e.target.value.slice(0, 2000) } : x)))} rows={2} className={`${POLE_TEKSTOWE} mt-0 flex-1`} />
            ) : (
              <input aria-label={`${etykieta} ${i + 1}`} value={w.tekst} onChange={(e) => onChange(wiersze.map((x, j) => (j === i ? { ...x, tekst: e.target.value.slice(0, 2000) } : x)))} className={`${POLE} mt-0 flex-1`} />
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(wiersze.filter((_, j) => j !== i))} aria-label={`${t.usunWiersz} ${i + 1}`}>
              {t.usunWiersz}
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={wiersze.length >= 10} onClick={() => onChange([...wiersze, { id: null, tekst: "" }])} data-dodaj-wiersz={idPrefix}>
          {dodaj}
        </Button>
      </div>
    </fieldset>
  );
}

/** Teksty, nagłówki, opis, przycisk i link reklamy z wersjami per lokal (SPEC rozdz. 7.4, 12.3 pkt 5). */
export function DialogReklamy({ open, onClose, material, status, kategoria, lokale, akcje }: { open: boolean; onClose: () => void; material: MaterialDto; status: StatusPakietu; kategoria: KategoriaKlienta; lokale: StronaDto[]; akcje: AkcjeMaterialow }) {
  const router = useRouter();
  const t = copy.zespol.materialy.reklama;
  const wspolne = (rodzaj: string) => material.warianty.filter((w) => w.rodzaj === rodzaj && w.lokalId === null).sort((a, b) => a.pozycja - b.pozycja);
  const [teksty, setTeksty] = useState<Wiersz[]>(wspolne("tekst").map((w) => ({ id: w.id, tekst: w.tekst ?? "" })));
  const [naglowki, setNaglowki] = useState<Wiersz[]>(wspolne("naglowek").map((w) => ({ id: w.id, tekst: w.tekst ?? "" })));
  const [opis, setOpis] = useState(wspolne("opis")[0]?.tekst ?? "");
  const [cta, setCta] = useState(wspolne("cta")[0]?.tekst ?? "");
  const [link, setLink] = useState(wspolne("link")[0]?.tekst ?? "");
  const zLokalami = kategoria !== "kat1" && lokale.length > 0;
  const [wersje, setWersje] = useState<Wersja[]>(() =>
    lokale.map((l) => {
      const dla = (rodzaj: string) => material.warianty.find((w) => w.rodzaj === rodzaj && w.lokalId === l.lokalId)?.tekst ?? "";
      return { lokalId: l.lokalId, link: dla("link"), cta: dla("cta"), opis: dla("opis") };
    }),
  );
  const [potwierdzono, setPotwierdzono] = useState(false);
  const [wynik, setWynik] = useState<WynikZmiany | null>(null);
  const [trwa, startTransition] = useTransition();

  function zamknij() {
    onClose();
    setWynik(null);
    setPotwierdzono(false);
  }

  function zapisz(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const w = await akcje.zapiszReklame({
        materialId: material.id,
        teksty: teksty.filter((x) => x.tekst.trim()),
        naglowki: naglowki.filter((x) => x.tekst.trim()),
        opis: opis.trim() || null,
        cta: cta || null,
        link: link.trim() || null,
        perLokal: zLokalami ? wersje.map((v) => ({ lokalId: v.lokalId, link: v.link.trim() || null, cta: v.cta || null, opis: v.opis.trim() || null })) : [],
        potwierdzono,
      });
      setWynik(w);
      if (w.ok) {
        router.refresh();
        zamknij();
      }
    });
  }

  const ustawWersje = (lokalId: string, pole: keyof Omit<Wersja, "lokalId">, wartosc: string) => setWersje((s) => s.map((v) => (v.lokalId === lokalId ? { ...v, [pole]: wartosc } : v)));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && zamknij()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-dialog-reklamy>
        <form onSubmit={zapisz} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{t.tytul}: {material.tytul}</DialogTitle>
            <DialogDescription>{t.opis}</DialogDescription>
          </DialogHeader>
          <ListaWierszy idPrefix="tekst" etykieta={t.teksty} wiersze={teksty} onChange={setTeksty} dodaj={t.dodajTekst} wielowierszowe />
          <ListaWierszy idPrefix="naglowek" etykieta={t.naglowki} wiersze={naglowki} onChange={setNaglowki} dodaj={t.dodajNaglowek} wielowierszowe={false} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="reklama-opis" className="block text-sm font-medium text-foodie-czern">{t.opisPola}</label>
              <input id="reklama-opis" value={opis} onChange={(e) => setOpis(e.target.value.slice(0, 500))} className={POLE} />
            </div>
            <div>
              <label htmlFor="reklama-cta" className="block text-sm font-medium text-foodie-czern">{t.cta}</label>
              <select id="reklama-cta" value={cta} onChange={(e) => setCta(e.target.value)} className={POLE}>
                <option value="">{copy.podglad.ctaDomyslne}</option>
                {copy.podglad.cta.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="reklama-link" className="block text-sm font-medium text-foodie-czern">{t.link}</label>
              <input id="reklama-link" type="url" value={link} onChange={(e) => setLink(e.target.value.slice(0, 500))} className={POLE} placeholder="https://" />
            </div>
          </div>
          {zLokalami ? (
            <fieldset>
              <legend className="text-sm font-medium text-foodie-czern">{t.perLokal}</legend>
              <p className="text-xs text-szary-600">{t.perLokalOpis}</p>
              <div className="mt-2 space-y-2">
                {lokale.map((l) => {
                  const v = wersje.find((x) => x.lokalId === l.lokalId);
                  if (!v) return null;
                  return (
                    <div key={l.lokalId} className="rounded-lg border border-szary-100 p-2" data-wersja-lokalu={l.lokalId}>
                      <p className="text-xs font-semibold text-foodie-czern">{l.nazwaLokalu}</p>
                      <div className="mt-1 grid gap-2 sm:grid-cols-3">
                        <input aria-label={`${t.linkLokalu} ${l.nazwaLokalu}`} type="url" value={v.link} onChange={(e) => ustawWersje(l.lokalId, "link", e.target.value.slice(0, 500))} placeholder={`${t.linkLokalu} (${t.wspolny})`} className={`${POLE} mt-0`} />
                        <select aria-label={`${t.ctaLokalu} ${l.nazwaLokalu}`} value={v.cta} onChange={(e) => ustawWersje(l.lokalId, "cta", e.target.value)} className={`${POLE} mt-0`}>
                          <option value="">{`${t.ctaLokalu} (${t.wspolny})`}</option>
                          {copy.podglad.cta.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <input aria-label={`${t.opisLokalu} ${l.nazwaLokalu}`} value={v.opis} onChange={(e) => ustawWersje(l.lokalId, "opis", e.target.value.slice(0, 500))} placeholder={`${t.opisLokalu} (${t.wspolny})`} className={`${POLE} mt-0`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          <PotwierdzeniePoAkceptacji status={status} wartosc={potwierdzono} onChange={setPotwierdzono} />
          <KomunikatWyniku wynik={wynik} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={zamknij}>{copy.zespol.materialy.edycja.anuluj}</Button>
            <Button type="submit" size="lg" disabled={trwa || (czyPoAkceptacji(status) && !potwierdzono)} data-zapisz-reklame>
              {trwa ? copy.zespol.pakietyMaterialow.akcje.trwa : t.zapisz}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
