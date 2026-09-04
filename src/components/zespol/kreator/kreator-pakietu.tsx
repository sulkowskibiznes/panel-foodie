"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { WynikKreatora } from "@/app/zespol/(panel)/klienci/[slug]/pakiety/nowy/akcje";
import { PolaKampanii, pusteDaneKampanii } from "@/components/zespol/materialy/dialog-kampanii";
import { POLE, type DaneKampaniiFormularz } from "@/components/zespol/materialy/typy";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { rozpoznajLinkDysku } from "@/lib/drive/linki";
import type { KategoriaKlienta } from "@/lib/dto/materialy";
import { etykietaOkresu, NAZWY_MIESIECY } from "@/lib/format";
import { miesiacWspolpracy } from "@/lib/harmonogram/kalendarz";

export type DaneKreatora = { rok: number; miesiac: number; lokalId: string | null; tytul: string; folder: string | null; kampanie: Array<Omit<DaneKampaniiFormularz, "potwierdzono">> };

/**
 * Kreator pakietu na wklejanych linkach (SPEC rozdz. 12.3): klient i miesiąc, link do folderu z contentem,
 * kampanie z osobnymi folderami reklam (bywa ich kilka). Pakiet powstaje w szkicu; materiały dochodzą
 * z „Dodaj materiał" (faza 3) albo z importu po linku (faza 4).
 */
export function KreatorPakietu({ slug, kategoria, lokale, startWspolpracy, domyslnyOkres, zajeteOkresy, utworz }: { slug: string; kategoria: KategoriaKlienta; lokale: { id: string; name: string }[]; startWspolpracy: string | null; domyslnyOkres: { rok: number; miesiac: number }; /** „YYYY-MM" albo „YYYY-MM:lokalId" dla kat1 */ zajeteOkresy: string[]; utworz: (dane: DaneKreatora) => Promise<WynikKreatora> }) {
  const router = useRouter();
  const k = copy.zespol.kreator;
  const [rok, setRok] = useState(domyslnyOkres.rok);
  const [miesiac, setMiesiac] = useState(domyslnyOkres.miesiac);
  const [lokalId, setLokalId] = useState<string>(lokale[0]?.id ?? "");
  const [tytulWlasny, setTytulWlasny] = useState<string | null>(null);
  const [folder, setFolder] = useState("");
  const [kampanie, setKampanie] = useState<DaneKampaniiFormularz[]>([{ ...pusteDaneKampanii(), nazwa: "Kampania standardowa" }]);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const tytul = tytulWlasny ?? `Materiały - ${etykietaOkresu(rok, miesiac)}`;
  const linkContentu = folder ? rozpoznajLinkDysku(folder) : null;
  const klucz = `${rok}-${String(miesiac).padStart(2, "0")}${kategoria === "kat1" ? `:${lokalId}` : ""}`;
  const zajety = zajeteOkresy.includes(klucz);
  const nrWspolpracy = miesiacWspolpracy(startWspolpracy, rok, miesiac);

  function wyslij(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBlad(null);
    if (kampanie.some((x) => !x.nazwa.trim())) {
      setBlad(k.bledy.brakNazwyKampanii);
      return;
    }
    startTransition(async () => {
      const w = await utworz({ rok, miesiac, lokalId: kategoria === "kat1" ? lokalId : null, tytul: tytul.trim(), folder: folder.trim() || null, kampanie: kampanie.map(({ nazwa, cel, notatka, folder: f }) => ({ nazwa: nazwa.trim(), cel, notatka: notatka?.trim() || null, folder: f?.trim() || null })) });
      if (!w.ok) {
        setBlad(w.blad);
        return;
      }
      router.push(`/zespol/klienci/${slug}/pakiety/${w.pakietId}`);
    });
  }

  return (
    <form onSubmit={wyslij} className="space-y-6" data-kreator-pakietu>
      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
        <h2 className="font-naglowek text-lg text-foodie-czern">{k.krokKlient}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="kreator-miesiac" className="block text-sm font-medium text-foodie-czern">{k.miesiac}</label>
            <select id="kreator-miesiac" value={miesiac} onChange={(e) => setMiesiac(Number(e.target.value))} className={POLE}>
              {NAZWY_MIESIECY.map((n, i) => (
                <option key={n} value={i + 1}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="kreator-rok" className="block text-sm font-medium text-foodie-czern">{k.rok}</label>
            <input id="kreator-rok" type="number" min={2024} max={2100} value={rok} onChange={(e) => setRok(Number(e.target.value))} className={POLE} />
          </div>
          {kategoria === "kat1" ? (
            <div>
              <label htmlFor="kreator-lokal" className="block text-sm font-medium text-foodie-czern">{k.lokal}</label>
              <select id="kreator-lokal" value={lokalId} onChange={(e) => setLokalId(e.target.value)} className={POLE} data-kreator-lokal>
                {lokale.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-szary-600">{k.lokalOpis}</p>
            </div>
          ) : (
            <p className="self-end pb-2 text-xs text-szary-600">{k.lokalWspolny}</p>
          )}
        </div>
        <div className="mt-3">
          <label htmlFor="kreator-tytul" className="block text-sm font-medium text-foodie-czern">{k.tytulPakietu}</label>
          <input id="kreator-tytul" value={tytul} onChange={(e) => setTytulWlasny(e.target.value)} maxLength={160} className={POLE} />
          {nrWspolpracy !== null && nrWspolpracy > 0 ? <p className="mt-1 text-xs text-szary-600">{k.miesiacWspolpracy.replace("{n}", String(nrWspolpracy))}</p> : null}
        </div>
        {zajety ? <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-bursztyn" data-okres-zajety>{copy.zespol.materialy.bledy.istnieje}</p> : null}
      </section>

      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
        <h2 className="font-naglowek text-lg text-foodie-czern">{k.krokContent}</h2>
        <label htmlFor="kreator-folder" className="mt-3 block text-sm font-medium text-foodie-czern">{k.folderContentu}</label>
        <input id="kreator-folder" type="url" value={folder} onChange={(e) => setFolder(e.target.value.slice(0, 500))} placeholder="https://drive.google.com/drive/folders/..." className={POLE} data-folder-contentu />
        <p className={`mt-1 text-xs ${folder && !linkContentu ? "text-czerwony" : "text-szary-600"}`} data-folder-status>
          {folder ? (linkContentu ? k.linkRozpoznany.replace("{id}", linkContentu.id) : k.linkNierozpoznany) : k.folderContentuOpis}
        </p>
        <p className="mt-2 rounded-lg bg-szary-050 px-3 py-2 text-xs text-szary-600">{k.importWkrotce}</p>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
        <h2 className="font-naglowek text-lg text-foodie-czern">{k.krokKampanie}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{k.kampanieOpis}</p>
        <div className="mt-4 space-y-4">
          {kampanie.map((kamp, i) => (
            <div key={i} className="rounded-lg border border-szary-100 p-4" data-kampania-kreatora={i}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foodie-czern">{copy.pakiet.kampania.ktora.replace("{n}", String(i + 1)).replace("{liczba}", String(kampanie.length))}</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setKampanie((s) => s.filter((_, j) => j !== i))}>{k.usunKampanie}</Button>
              </div>
              <div className="mt-3">
                <PolaKampanii idPrefix={`kreator-kampania-${i}`} wartosc={kamp} onChange={(d) => setKampanie((s) => s.map((x, j) => (j === i ? d : x)))} />
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="lg" className="mt-4" disabled={kampanie.length >= 10} onClick={() => setKampanie((s) => [...s, pusteDaneKampanii()])} data-dodaj-kampanie-kreator>
          {copy.zespol.materialy.dodajKampanie}
        </Button>
        {kampanie.length === 0 ? <p className="mt-2 text-xs text-bursztyn">{k.bezKampanii}</p> : null}
      </section>

      {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony" data-blad-kreatora>{blad}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={trwa || zajety || (!!folder && !linkContentu)} data-utworz-pakiet>{trwa ? k.tworzenie : k.utworz}</Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.push(`/zespol/klienci/${slug}/materialy`)}>{k.anuluj}</Button>
      </div>
    </form>
  );
}
