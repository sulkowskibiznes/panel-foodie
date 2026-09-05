"use client";

import { POLE, POLE_TEKSTOWE } from "@/components/zespol/materialy/typy";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { MaterialPropozycji, PodgladDokumentu, Propozycja, PropozycjaContentu, PropozycjaReklam } from "@/lib/dto/import";

function wstaw(tekst: string, pola: Record<string, string | number>): string {
  return Object.entries(pola).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), tekst);
}

const t = () => copy.zespol.import.mapowanie;

function Miniatura({ url, nazwa, wideo }: { url: string | null; nazwa: string; wideo: boolean }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={nazwa} loading="lazy" className="size-16 flex-none rounded-md object-cover" data-miniatura-mapowania />;
  }
  return <div className="flex size-16 flex-none items-center justify-center rounded-md bg-szary-100 text-[10px] font-medium uppercase text-szary-600">{wideo ? "wideo" : "plik"}</div>;
}

function PodgladDokumentow({ dokumenty }: { dokumenty: PodgladDokumentu[] }) {
  if (dokumenty.length === 0) return null;
  return (
    <div className="space-y-2">
      {dokumenty.map((d) => (
        <details key={d.dokumentId} className="rounded-lg border border-szary-100 px-3 py-2 text-sm" data-podglad-dokumentu={d.dokumentId}>
          <summary className="cursor-pointer font-medium text-foodie-czern">{wstaw(t().podzialDokumentu, { nazwa: d.nazwa })}</summary>
          <div className="mt-2 space-y-2">
            {d.wstep ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-szary-600">{t().wstep}</p>
                <p className="whitespace-pre-wrap text-szary-600">{d.wstep}</p>
              </div>
            ) : null}
            {d.sekcje.map((s, i) => (
              <div key={i} data-sekcja-dokumentu={s.numer ?? "-"}>
                <p className="text-xs font-medium uppercase tracking-wide text-szary-600">
                  {s.numer !== null ? wstaw(t().sekcja, { numer: s.numer }) : t().sekcjaBezNumeru}
                  {s.tytul ? ` - ${s.tytul}` : ""}
                </p>
                <p className="whitespace-pre-wrap text-foodie-czern">{s.tresc || "-"}</p>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function WierszMaterialu({ m, dokumenty, onChange }: { m: MaterialPropozycji; dokumenty: PodgladDokumentu[]; onChange: (m: MaterialPropozycji) => void }) {
  const opcje = dokumenty.flatMap((d) => d.sekcje.filter((s) => s.tresc.trim()).map((s, i) => ({ klucz: `${d.dokumentId}:${i}`, etykieta: `${dokumenty.length > 1 ? `${d.nazwa}: ` : ""}${s.numer !== null ? wstaw(t().sekcja, { numer: s.numer }) : t().sekcjaBezNumeru}${s.tytul ? ` - ${s.tytul}` : ""}`, tresc: s.tresc })));
  const pierwszy = m.pliki[0];
  return (
    <div className={`rounded-lg border border-szary-100 p-3 ${m.pominiety ? "opacity-60" : ""}`} data-material-mapowania={m.klucz} data-rodzaj={m.rodzaj} data-dopasowanie={m.dopasowanie}>
      <div className="flex gap-3">
        <div className="flex flex-none flex-col gap-1">
          {m.pliki.slice(0, 3).map((p) => (
            <Miniatura key={p.id} url={p.miniaturaUrl} nazwa={p.nazwa} wideo={p.rodzajMediow === "wideo"} />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate text-xs text-szary-600" title={m.pliki.map((p) => p.nazwa).join(", ")}>
            {m.pliki.length > 1 ? wstaw(t().slajdy, { n: m.pliki.length }) + ": " : ""}
            {m.pliki.map((p) => p.nazwa).join(", ")}
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
            <input value={m.tytul} onChange={(e) => onChange({ ...m, tytul: e.target.value.slice(0, 160) })} aria-label={t().tytulPola} className={POLE} disabled={m.pominiety} data-mapowanie-tytul />
            <select value={m.rodzaj} onChange={(e) => onChange({ ...m, rodzaj: e.target.value as MaterialPropozycji["rodzaj"] })} aria-label={t().rodzaj} className={POLE} disabled={m.pominiety || (pierwszy?.rodzajMediow === "obraz" && m.rodzaj !== "reels" ? false : false)} data-mapowanie-rodzaj>
              {(["post", "reels", "relacja"] as const).filter((r) => r !== "reels" || pierwszy?.rodzajMediow === "wideo" || m.rodzaj === "reels").map((r) => (
                <option key={r} value={r}>{t().rodzaje[r]}</option>
              ))}
            </select>
          </div>
          {m.rodzaj !== "relacja" ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-medium text-szary-600" htmlFor={`opis-${m.klucz}`}>
                  {t().opisPola} · <span data-mapowanie-dopasowanie>{t().dopasowanie[m.dopasowanie]}</span>
                </label>
                {opcje.length > 0 ? (
                  <select aria-label={t().wybierzOpis} className="h-8 rounded-lg border border-szary-300 bg-white px-2 text-xs" value="" onChange={(e) => { const o = opcje.find((x) => x.klucz === e.target.value); if (o) onChange({ ...m, opis: o.tresc, dopasowanie: "numer" }); }} disabled={m.pominiety} data-mapowanie-wybierz-opis>
                    <option value="">{t().wybierzOpis}</option>
                    {opcje.map((o) => (
                      <option key={o.klucz} value={o.klucz}>{o.etykieta}</option>
                    ))}
                  </select>
                ) : null}
              </div>
              <textarea id={`opis-${m.klucz}`} value={m.opis ?? ""} onChange={(e) => onChange({ ...m, opis: e.target.value.slice(0, 6000) || null })} rows={3} placeholder={t().bezOpisu} className={POLE_TEKSTOWE} disabled={m.pominiety} data-mapowanie-opis />
            </div>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...m, pominiety: !m.pominiety })} data-mapowanie-pomin>
            {m.pominiety ? t().przywroc : t().pomin}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MapowanieContentu({ p, onChange }: { p: PropozycjaContentu; onChange: (p: PropozycjaContentu) => void }) {
  const zmien = (m: MaterialPropozycji) => onChange({ ...p, materialy: p.materialy.map((x) => (x.klucz === m.klucz ? m : x)) });
  const posty = p.materialy.filter((m) => m.rodzaj !== "relacja");
  const relacje = p.materialy.filter((m) => m.rodzaj === "relacja");
  return (
    <section className="space-y-4 rounded-xl bg-white p-5 shadow-miekki sm:p-6" data-mapowanie-contentu>
      <PodgladDokumentow dokumenty={p.dokumenty} />
      <div>
        <h3 className="font-naglowek text-lg text-foodie-czern">{t().posty}</h3>
        <div className="mt-2 space-y-3">
          {posty.length === 0 ? <p className="text-sm text-szary-600">{t().brakMaterialow}</p> : posty.map((m) => <WierszMaterialu key={m.klucz} m={m} dokumenty={p.dokumenty} onChange={zmien} />)}
        </div>
      </div>
      <div>
        <h3 className="font-naglowek text-lg text-foodie-czern">{t().relacje}</h3>
        <div className="mt-2 space-y-3">
          {relacje.length === 0 ? <p className="text-sm text-szary-600">{t().brakMaterialow}</p> : relacje.map((m) => <WierszMaterialu key={m.klucz} m={m} dokumenty={p.dokumenty} onChange={zmien} />)}
        </div>
      </div>
      {p.nieuzyteSekcje.length > 0 ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-bursztyn" data-nieuzyte-sekcje>
          <p className="font-medium">{t().nieuzyte}</p>
          <ul className="mt-1 list-disc pl-5">
            {p.nieuzyteSekcje.map((n, i) => (
              <li key={i}>
                {n.sekcja.numer !== null ? wstaw(t().sekcja, { numer: n.sekcja.numer }) : t().sekcjaBezNumeru}
                {n.sekcja.tytul ? ` - ${n.sekcja.tytul}` : ""}: {n.sekcja.tresc.slice(0, 80)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ListaTekstow({ etykieta, wartosci, onChange, dodaj, wiersze, atrybut }: { etykieta: string; wartosci: string[]; onChange: (w: string[]) => void; dodaj: string; wiersze: number; atrybut: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-foodie-czern">{etykieta}</p>
      <div className="mt-1 space-y-2">
        {wartosci.map((w, i) => (
          <div key={i} className="flex gap-2">
            <textarea value={w} onChange={(e) => onChange(wartosci.map((x, j) => (j === i ? e.target.value : x)))} rows={wiersze} className={POLE_TEKSTOWE} {...{ [atrybut]: i }} />
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(wartosci.filter((_, j) => j !== i))}>{t().usun}</Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" disabled={wartosci.length >= 10} onClick={() => onChange([...wartosci, ""])}>{dodaj}</Button>
      </div>
    </div>
  );
}

function MapowanieReklam({ p, onChange }: { p: PropozycjaReklam; onChange: (p: PropozycjaReklam) => void }) {
  return (
    <section className="space-y-4 rounded-xl bg-white p-5 shadow-miekki sm:p-6" data-mapowanie-reklam={p.kampaniaId}>
      <h3 className="font-naglowek text-lg text-foodie-czern">{wstaw(t().reklama, { kampania: p.kampaniaNazwa })}</h3>
      <div>
        <p className="text-sm font-medium text-foodie-czern">{t().grafiki}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {p.grafiki.length === 0 ? <p className="text-sm text-szary-600">{t().brakMaterialow}</p> : null}
          {p.grafiki.map((g) => (
            <div key={g.id} className={`w-28 ${g.pominiety ? "opacity-50" : ""}`} data-grafika-mapowania={g.id}>
              <Miniatura url={g.miniaturaUrl} nazwa={g.nazwa} wideo={g.rodzajMediow === "wideo"} />
              <p className="mt-1 truncate text-xs text-szary-600" title={g.nazwa}>{g.nazwa}</p>
              <button type="button" className="text-xs font-medium text-foodie-fiolet hover:underline" onClick={() => onChange({ ...p, grafiki: p.grafiki.map((x) => (x.id === g.id ? { ...x, pominiety: !x.pominiety } : x)) })} data-grafika-pomin>
                {g.pominiety ? t().przywroc : t().pomin}
              </button>
            </div>
          ))}
        </div>
      </div>
      {p.dokumenty.length > 0 ? <p className="text-xs text-szary-600">{wstaw(t().zDokumentu, { nazwy: p.dokumenty.join(", ") })}</p> : <p className="text-xs text-szary-600">{t().bezDokumentu}</p>}
      {p.dokumenty.length > 0 && !p.rozpoznanoSekcje ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-bursztyn">{t().bezSekcji}</p> : null}
      <ListaTekstow etykieta={t().teksty} wartosci={p.teksty} onChange={(teksty) => onChange({ ...p, teksty })} dodaj={t().dodajTekst} wiersze={2} atrybut="data-reklama-tekst" />
      <ListaTekstow etykieta={t().naglowki} wartosci={p.naglowki} onChange={(naglowki) => onChange({ ...p, naglowki })} dodaj={t().dodajNaglowek} wiersze={1} atrybut="data-reklama-naglowek" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-foodie-czern" htmlFor={`opis-${p.kampaniaId}`}>{t().opisReklamy}</label>
          <input id={`opis-${p.kampaniaId}`} value={p.opis ?? ""} onChange={(e) => onChange({ ...p, opis: e.target.value.slice(0, 1000) || null })} className={POLE} data-reklama-opis />
        </div>
        <div>
          <label className="block text-sm font-medium text-foodie-czern" htmlFor={`cta-${p.kampaniaId}`}>{t().cta}</label>
          <input id={`cta-${p.kampaniaId}`} value={p.cta ?? ""} onChange={(e) => onChange({ ...p, cta: e.target.value.slice(0, 60) || null })} className={POLE} data-reklama-cta />
        </div>
        <div>
          <label className="block text-sm font-medium text-foodie-czern" htmlFor={`link-${p.kampaniaId}`}>{t().link}</label>
          <input id={`link-${p.kampaniaId}`} value={p.link ?? ""} onChange={(e) => onChange({ ...p, link: e.target.value.slice(0, 500) || null })} className={POLE} data-reklama-link />
        </div>
      </div>
    </section>
  );
}

export function policzDoImportu(propozycje: Propozycja[]): { materialy: number; pliki: number } {
  let materialy = 0;
  let pliki = 0;
  for (const p of propozycje) {
    if (p.rodzaj === "content") {
      for (const m of p.materialy) {
        if (m.pominiety) continue;
        materialy += 1;
        pliki += m.pliki.length;
      }
    } else {
      const g = p.grafiki.filter((x) => !x.pominiety).length;
      pliki += g;
      if (g > 0 || p.teksty.some((x) => x.trim()) || p.naglowki.some((x) => x.trim())) materialy += 1;
    }
  }
  return { materialy, pliki };
}

/** Ekran mapowania (SPEC rozdz. 13.3), obowiązkowy: człowiek widzi „grafika ↔ opis" i poprawia, zanim cokolwiek trafi do bazy. */
export function Mapowanie({ propozycje, onChange, onImportuj, onWstecz, trwa, blad }: { propozycje: Propozycja[]; onChange: (p: Propozycja[]) => void; onImportuj: () => void; onWstecz: () => void; trwa: boolean; blad: string | null }) {
  const suma = policzDoImportu(propozycje);
  const zmien = (i: number, p: Propozycja) => onChange(propozycje.map((x, j) => (j === i ? p : x)));
  return (
    <div className="space-y-4" data-krok-mapowania>
      <div>
        <h3 className="font-naglowek text-lg text-foodie-czern">{t().tytul}</h3>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{t().opis}</p>
      </div>
      {propozycje.map((p, i) => (p.rodzaj === "content" ? <MapowanieContentu key={p.folderId} p={p} onChange={(x) => zmien(i, x)} /> : <MapowanieReklam key={p.folderId} p={p} onChange={(x) => zmien(i, x)} />))}
      <p className="text-sm font-medium text-foodie-czern" data-podsumowanie-mapowania>{wstaw(t().podsumowanie, suma)}</p>
      {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony" data-blad-importu>{blad}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="lg" disabled={trwa || suma.materialy === 0} onClick={onImportuj} data-importuj>{trwa ? t().importujemy : t().importuj}</Button>
        <Button type="button" size="lg" variant="outline" disabled={trwa} onClick={onWstecz}>{t().wstecz}</Button>
      </div>
      {suma.materialy === 0 ? <p className="text-xs text-bursztyn">{t().nicDoImportu}</p> : null}
    </div>
  );
}
