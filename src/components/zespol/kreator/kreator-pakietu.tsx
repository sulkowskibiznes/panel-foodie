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
import { etykietaOkresu } from "@/lib/format";
import { czyOkresyZachodza, dlugoscOkresuDni, kolejnyMiesiacWspolpracy } from "@/lib/harmonogram/kalendarz";

export type DaneKreatora = { od: string; do: string; miesiacWspolpracy: number | null; lokalId: string | null; tytul: string; folder: string | null; kampanie: Array<Omit<DaneKampaniiFormularz, "potwierdzono">> };

/** Istniejący pakiet klienta: do podpowiedzi numeru miesiąca współpracy i ostrzeżenia o zachodzących okresach. */
export type IstniejacyPakiet = { id: string; tytul: string; lokalId: string | null; od: string; do: string; miesiacWspolpracy: number | null };

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Kreator pakietu na wklejanych linkach (SPEC rozdz. 12.3): klient i okres od-do (obie daty wpisywane ręcznie,
 * bo każdy klient zaczyna miesiąc innego dnia), numer miesiąca współpracy podpowiadany z ostatniego pakietu
 * i edytowalny, link do folderu z contentem, kampanie z osobnymi folderami reklam (bywa ich kilka).
 * Zachodzące okresy tylko ostrzegają. Pakiet powstaje w szkicu; z linkami kreator prowadzi do karty weryfikacyjnej.
 */
export function KreatorPakietu({ slug, kategoria, lokale, startWspolpracy, istniejace, utworz }: { slug: string; kategoria: KategoriaKlienta; lokale: { id: string; name: string }[]; startWspolpracy: string | null; istniejace: IstniejacyPakiet[]; utworz: (dane: DaneKreatora) => Promise<WynikKreatora> }) {
  const router = useRouter();
  const k = copy.zespol.kreator;
  const [od, setOd] = useState("");
  const [do_, setDo] = useState("");
  const [lokalId, setLokalId] = useState<string>(lokale[0]?.id ?? "");
  const [tytulWlasny, setTytulWlasny] = useState<string | null>(null);
  const [numerWlasny, setNumerWlasny] = useState<string | null>(null);
  const [folder, setFolder] = useState("");
  const [kampanie, setKampanie] = useState<DaneKampaniiFormularz[]>([{ ...pusteDaneKampanii(), nazwa: "Kampania standardowa" }]);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();

  const datyPoprawne = DATA.test(od) && DATA.test(do_);
  const kolejnoscZla = datyPoprawne && od > do_;
  const zaDlugi = datyPoprawne && !kolejnoscZla && dlugoscOkresuDni(od, do_) > 366;
  const okresGotowy = datyPoprawne && !kolejnoscZla && !zaDlugi;
  const tytul = tytulWlasny ?? (okresGotowy ? `Materiały ${etykietaOkresu(od, do_)}` : "Materiały");
  const linkContentu = folder ? rozpoznajLinkDysku(folder) : null;
  const dlaLokalu = kategoria === "kat1" ? istniejace.filter((p) => p.lokalId === lokalId) : istniejace;
  const ostatni = dlaLokalu[0] ?? null;
  const podpowiedz = DATA.test(od) ? kolejnyMiesiacWspolpracy(ostatni?.miesiacWspolpracy ?? null, startWspolpracy, od) : null;
  const numerTekst = numerWlasny ?? (podpowiedz !== null ? String(podpowiedz) : "");
  const numer = numerTekst.trim() === "" ? null : Number(numerTekst);
  const nachodzace = okresGotowy ? dlaLokalu.filter((p) => czyOkresyZachodza({ od, do: do_ }, p)) : [];

  function wyslij(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBlad(null);
    if (!datyPoprawne) {
      setBlad(k.bledy.brakOkresu);
      return;
    }
    if (kolejnoscZla) {
      setBlad(k.bledy.zlyOkres);
      return;
    }
    if (zaDlugi) {
      setBlad(k.bledy.zaDlugiOkres);
      return;
    }
    if (kampanie.some((x) => !x.nazwa.trim())) {
      setBlad(k.bledy.brakNazwyKampanii);
      return;
    }
    startTransition(async () => {
      const w = await utworz({ od, do: do_, miesiacWspolpracy: numer !== null && Number.isInteger(numer) && numer >= 1 ? numer : null, lokalId: kategoria === "kat1" ? lokalId : null, tytul: tytul.trim(), folder: folder.trim() || null, kampanie: kampanie.map(({ nazwa, cel, notatka, folder: f }) => ({ nazwa: nazwa.trim(), cel, notatka: notatka?.trim() || null, folder: f?.trim() || null })) });
      if (!w.ok) {
        setBlad(w.blad);
        return;
      }
      const maFoldery = !!folder.trim() || kampanie.some((x) => !!x.folder?.trim());
      router.push(maFoldery ? `/zespol/klienci/${slug}/pakiety/${w.pakietId}/import` : `/zespol/klienci/${slug}/pakiety/${w.pakietId}`);
    });
  }

  return (
    <form onSubmit={wyslij} className="space-y-6" data-kreator-pakietu>
      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
        <h2 className="font-naglowek text-lg text-foodie-czern">{k.krokKlient}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="kreator-od" className="block text-sm font-medium text-foodie-czern">{k.od}</label>
            <input id="kreator-od" type="date" required value={od} min="2024-01-01" max="2100-12-31" onChange={(e) => { setOd(e.target.value); setNumerWlasny(null); }} className={POLE} data-kreator-od />
          </div>
          <div>
            <label htmlFor="kreator-do" className="block text-sm font-medium text-foodie-czern">{k.do}</label>
            <input id="kreator-do" type="date" required value={do_} min={od || "2024-01-01"} max="2100-12-31" onChange={(e) => setDo(e.target.value)} className={POLE} data-kreator-do />
          </div>
          {kategoria === "kat1" ? (
            <div>
              <label htmlFor="kreator-lokal" className="block text-sm font-medium text-foodie-czern">{k.lokal}</label>
              <select id="kreator-lokal" value={lokalId} onChange={(e) => { setLokalId(e.target.value); setNumerWlasny(null); }} className={POLE} data-kreator-lokal>
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
        <p className="mt-1 text-xs text-szary-600">{k.okresOpis}</p>
        {kolejnoscZla ? <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony" data-zly-okres>{k.bledy.zlyOkres}</p> : null}
        {zaDlugi ? <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony" data-zly-okres>{k.bledy.zaDlugiOkres}</p> : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem]">
          <div>
            <label htmlFor="kreator-tytul" className="block text-sm font-medium text-foodie-czern">{k.tytulPakietu}</label>
            <input id="kreator-tytul" value={tytul} onChange={(e) => setTytulWlasny(e.target.value)} maxLength={160} className={POLE} />
          </div>
          <div>
            <label htmlFor="kreator-miesiac-wspolpracy" className="block text-sm font-medium text-foodie-czern">{k.miesiacWspolpracyPole}</label>
            <input id="kreator-miesiac-wspolpracy" type="number" min={1} max={999} value={numerTekst} onChange={(e) => setNumerWlasny(e.target.value)} className={POLE} data-miesiac-wspolpracy />
          </div>
        </div>
        <p className="mt-1 text-xs text-szary-600">{k.miesiacWspolpracyOpis}</p>
        {nachodzace.length > 0 ? (
          <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-bursztyn" data-okres-nachodzi>
            {k.okresNachodzi.replace("{pakiety}", nachodzace.map((p) => `${p.tytul || etykietaOkresu(p.od, p.do)} (${etykietaOkresu(p.od, p.do)})`).join(", "))}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
        <h2 className="font-naglowek text-lg text-foodie-czern">{k.krokContent}</h2>
        <label htmlFor="kreator-folder" className="mt-3 block text-sm font-medium text-foodie-czern">{k.folderContentu}</label>
        <input id="kreator-folder" type="url" value={folder} onChange={(e) => setFolder(e.target.value.slice(0, 500))} placeholder="https://drive.google.com/drive/folders/..." className={POLE} data-folder-contentu />
        <p className={`mt-1 text-xs ${folder && !linkContentu ? "text-czerwony" : "text-szary-600"}`} data-folder-status>
          {folder ? (linkContentu ? k.linkRozpoznany.replace("{id}", linkContentu.id) : k.linkNierozpoznany) : k.folderContentuOpis}
        </p>
        <p className="mt-2 rounded-lg bg-szary-050 px-3 py-2 text-xs text-szary-600">{k.importPoUtworzeniu}</p>
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
        <Button type="submit" size="lg" disabled={trwa || !okresGotowy || (!!folder && !linkContentu)} data-utworz-pakiet>{trwa ? k.tworzenie : k.utworz}</Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.push(`/zespol/klienci/${slug}/materialy`)}>{k.anuluj}</Button>
      </div>
    </form>
  );
}
