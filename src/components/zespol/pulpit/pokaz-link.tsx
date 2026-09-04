"use client";

import { useState, useTransition } from "react";
import { listaLinkowDoPokazania, odnotujSkopiowanie, pokazLink, type LinkDoPokazania } from "@/app/zespol/(panel)/klienci/[slug]/dostep/akcje";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";

/** „Pokaż link" w kolumnie Akcja pulpitu (SPEC rozdz. 12.1, 12.4): ten sam mechanizm co w zakładce Dostęp, każde pokazanie w audycie. */
export function PokazLinkPulpit({ slug, nazwaKlienta }: { slug: string; nazwaKlienta: string }) {
  const t = copy.zespol.pulpitPakiety;
  const d = copy.zespol.dostep;
  const [otwarty, setOtwarty] = useState(false);
  const [linki, setLinki] = useState<LinkDoPokazania[] | null>(null);
  const [adresy, setAdresy] = useState<Record<string, string>>({});
  const [skopiowany, setSkopiowany] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();

  function otworz() {
    setOtwarty(true);
    if (linki !== null) return;
    startTransition(async () => {
      try {
        setLinki(await listaLinkowDoPokazania(slug));
      } catch {
        setBlad(d.bledy.ogolny);
      }
    });
  }

  function pokaz(id: string) {
    setBlad(null);
    startTransition(async () => {
      const r = await pokazLink(slug, id);
      if (r.ok) setAdresy((a) => ({ ...a, [id]: r.adres }));
      else setBlad(r.blad);
    });
  }

  async function kopiuj(id: string) {
    const adres = adresy[id];
    if (!adres) return;
    try {
      await navigator.clipboard.writeText(adres);
    } catch {
      // schowek niedostępny: pole jest zaznaczalne
    }
    setSkopiowany(id);
    setTimeout(() => setSkopiowany(null), 2000);
    void odnotujSkopiowanie(slug, id, "link");
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={otworz} data-pokaz-link-pulpit>{t.pokazLink}</Button>
      <Dialog open={otwarty} onOpenChange={setOtwarty}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{t.pokazLinkTytul}: {nazwaKlienta}</DialogTitle>
            <DialogDescription>{t.pokazLinkOpis}</DialogDescription>
          </DialogHeader>
          {linki === null ? <p className="text-sm text-szary-600">{copy.zespol.pakietyMaterialow.akcje.trwa}</p> : linki.length === 0 ? <p className="text-sm text-szary-600">{t.pokazLinkBrak}</p> : (
            <ul className="space-y-2">
              {linki.map((l) => (
                <li key={l.id} className="rounded-lg border border-szary-100 p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foodie-czern">{l.label}</span>
                    {!adresy[l.id] ? <Button type="button" variant="outline" size="sm" disabled={trwa} onClick={() => pokaz(l.id)}>{d.akcje.pokazLink}</Button> : null}
                  </div>
                  {adresy[l.id] ? (
                    <div className="mt-2 flex gap-2">
                      <input aria-label={d.gotowy.link} readOnly value={adresy[l.id]} onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-lg border border-szary-300 bg-szary-050 px-2 font-mono text-xs" />
                      <Button type="button" variant="outline" size="sm" onClick={() => void kopiuj(l.id)}>{skopiowany === l.id ? d.gotowy.skopiowano : d.gotowy.kopiuj}</Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
