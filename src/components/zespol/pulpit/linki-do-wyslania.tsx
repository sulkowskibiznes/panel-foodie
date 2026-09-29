"use client";

import { useEffect, useState, useTransition } from "react";
import { listaLinkowDoPokazania, odnotujSkopiowanie, pokazLink, type LinkDoPokazania } from "@/app/zespol/(panel)/klienci/[slug]/dostep/akcje";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

/**
 * Linki klienta do ponownego wysłania (SPEC rozdz. 12.1, 12.4): etykiety bez adresów, adres dopiero po „Pokaż link"
 * (akcja serwerowa, tylko admin i csm, każde pokazanie w audycie). Wspólne dla pulpitu i okna po wysyłce pakietu.
 */
export function LinkiDoWyslania({ slug }: { slug: string }) {
  const t = copy.zespol.pulpitPakiety;
  const d = copy.zespol.dostep;
  const [linki, setLinki] = useState<LinkDoPokazania[] | null>(null);
  const [adresy, setAdresy] = useState<Record<string, string>>({});
  const [skopiowany, setSkopiowany] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();

  useEffect(() => {
    let aktualne = true;
    listaLinkowDoPokazania(slug)
      .then((l) => aktualne && setLinki(l))
      .catch(() => aktualne && setBlad(d.bledy.ogolny));
    return () => {
      aktualne = false;
    };
  }, [slug, d.bledy.ogolny]);

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
      // schowek niedostępny: pole jest zaznaczalne, mówimy o tym zamiast „Skopiowano" i nie piszemy audytu
      setBlad(d.gotowy.bladKopiowania);
      return;
    }
    setBlad(null);
    setSkopiowany(id);
    setTimeout(() => setSkopiowany(null), 2000);
    void odnotujSkopiowanie(slug, id, "link");
  }

  return (
    <div className="space-y-2" data-linki-do-wyslania>
      {linki === null && !blad ? <p className="text-sm text-szary-600">{copy.zespol.pakietyMaterialow.akcje.trwa}</p> : null}
      {linki !== null && linki.length === 0 ? <p className="text-sm text-szary-600">{t.pokazLinkBrak}</p> : null}
      {linki && linki.length > 0 ? (
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
      ) : null}
      {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
    </div>
  );
}
