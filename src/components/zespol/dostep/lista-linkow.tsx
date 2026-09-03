"use client";

import { useState, useTransition } from "react";
import { odnotujSkopiowanie, pokazLink, wygasLink, wylogujUrzadzenia, zresetujPin, type WynikResetu } from "@/app/zespol/(panel)/klienci/[slug]/dostep/akcje";
import { PolaKopiowania } from "@/components/zespol/dostep/pola-kopiowania";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import type { LinkDostepu } from "@/lib/dane/linki";
import { formatujDateCzas } from "@/lib/format";

export function ListaLinkow({ slug, linki }: { slug: string; linki: LinkDostepu[] }) {
  const [reset, setReset] = useState<(WynikResetu & { ok: true; linkId: string }) | null>(null);
  /** Adresy odszyfrowane na żądanie („Pokaż link"): lista z serwera nigdy ich nie niesie (SPEC rozdz. 16 pkt 12). */
  const [pokazane, setPokazane] = useState<Record<string, string>>({});
  const [skopiowany, setSkopiowany] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const d = copy.zespol.dostep;

  if (linki.length === 0) return <p className="text-sm text-szary-600">{d.brakLinkow}</p>;

  function pokaz(l: LinkDostepu) {
    setBlad(null);
    startTransition(async () => {
      const r = await pokazLink(slug, l.id);
      if (r.ok) setPokazane((p) => ({ ...p, [l.id]: r.adres }));
      else setBlad(r.blad);
    });
  }

  function ukryj(id: string) {
    setPokazane((p) => {
      const kopia = { ...p };
      delete kopia[id];
      return kopia;
    });
  }

  async function kopiujLink(l: LinkDostepu) {
    const adres = pokazane[l.id];
    if (!adres) return;
    try {
      await navigator.clipboard.writeText(adres);
    } catch {
      // schowek niedostępny
    }
    setSkopiowany(l.id);
    setTimeout(() => setSkopiowany(null), 2000);
    void odnotujSkopiowanie(slug, l.id, "link");
  }

  function wykonaj(potwierdzenie: string, akcja: () => Promise<unknown>) {
    if (!window.confirm(potwierdzenie)) return;
    setBlad(null);
    startTransition(async () => {
      try {
        await akcja();
      } catch {
        setBlad(d.bledy.ogolny);
      }
    });
  }

  function resetuj(l: LinkDostepu) {
    wykonaj(d.akcje.resetujPotwierdz, async () => {
      const r = await zresetujPin(slug, l.id);
      if (r.ok) setReset({ ...r, linkId: l.id });
      else setBlad(r.blad);
    });
  }

  return (
    <div>
      {blad ? <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
      <div className="overflow-x-auto">
        <table aria-label={d.tytul} className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
            <tr>
              <th className="py-2 pr-4">{d.kolumny.osoba}</th>
              <th className="py-2 pr-4">{d.kolumny.utworzono}</th>
              <th className="py-2 pr-4">{d.kolumny.ostatnieWejscie}</th>
              <th className="py-2 pr-4">{d.kolumny.status}</th>
              <th className="py-2 pr-4 text-right">{d.kolumny.urzadzenia}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {linki.map((l) => (
              <tr key={l.id} className="border-t border-szary-100 align-top">
                <td className="py-3 pr-4">
                  <p className="font-medium text-foodie-czern">{l.label}</p>
                  {!l.canApprove ? <p className="text-xs text-szary-600">{d.status.tylkoPodglad}</p> : null}
                  {pokazane[l.id] ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input aria-label={d.gotowy.link} readOnly value={pokazane[l.id]} onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-[260px] flex-1 rounded-lg border border-szary-300 bg-szary-050 px-2 font-mono text-xs text-foodie-czern" />
                      <Button type="button" variant="outline" size="sm" onClick={() => void kopiujLink(l)}>{skopiowany === l.id ? d.gotowy.skopiowano : d.gotowy.kopiuj}</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => ukryj(l.id)}>{d.akcje.ukryjLink}</Button>
                    </div>
                  ) : null}
                </td>
                <td className="py-3 pr-4 text-szary-600">{formatujDateCzas(l.createdAt)}</td>
                <td className="py-3 pr-4 text-szary-600">{l.lastUsedAt ? formatujDateCzas(l.lastUsedAt) : d.nigdy}</td>
                <td className="py-3 pr-4">
                  {l.revokedAt ? (
                    <span className="rounded-full bg-szary-100 px-2 py-0.5 text-xs font-medium text-szary-600">{d.status.wygaszony}</span>
                  ) : l.lockedUntil ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-czerwony">{d.status.zablokowany} {formatujDateCzas(l.lockedUntil)}</span>
                  ) : (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-zielony">{d.status.aktywny}</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-right text-szary-600">{l.aktywneUrzadzenia}</td>
                <td className="py-3">
                  {!l.revokedAt ? (
                    <div className="flex flex-wrap justify-end gap-1">
                      {!pokazane[l.id] ? <Button type="button" variant="outline" size="sm" disabled={trwa} onClick={() => pokaz(l)}>{d.akcje.pokazLink}</Button> : null}
                      <Button type="button" variant="ghost" size="sm" disabled={trwa} onClick={() => wykonaj(d.akcje.wylogujPotwierdz, () => wylogujUrzadzenia(slug, l.id))}>{d.akcje.wylogujUrzadzenia}</Button>
                      <Button type="button" variant="ghost" size="sm" disabled={trwa} onClick={() => resetuj(l)}>{d.akcje.resetujPin}</Button>
                      <Button type="button" variant="destructive" size="sm" disabled={trwa} onClick={() => wykonaj(d.akcje.wygasPotwierdz, () => wygasLink(slug, l.id))}>{d.akcje.wygas}</Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={reset !== null} onOpenChange={(open) => { if (!open) setReset(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{d.gotowy.nowyPinTytul}</DialogTitle>
            <DialogDescription>{d.gotowy.nowyPinOpis}</DialogDescription>
          </DialogHeader>
          {reset ? <PolaKopiowania adres={reset.adres} pin={reset.pin} onSkopiowano={(co) => void odnotujSkopiowanie(slug, reset.linkId, co)} /> : null}
          <Button type="button" variant="outline" size="lg" onClick={() => setReset(null)}>{d.gotowy.zamknij}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
