"use client";

import { POLE_WYBORU, PrzelacznikLokalu } from "@/components/podglad/przelacznik-lokalu";
import { copy } from "@/lib/copy";
import type { StronaDto, WariantDto } from "@/lib/dto/materialy";
import { skrotTekstu } from "@/lib/podglad/tekst";
import { dopasujWybor, opcjeWariantow, type RodzajListy, type WyborWariantu } from "@/lib/reklamy/warianty";

export function etykietaWariantu(w: WariantDto, indeks: number): string {
  if (w.etykieta) return w.etykieta;
  const rodzaj = w.rodzaj === "grafika" || w.rodzaj === "tekst" || w.rodzaj === "naglowek" ? copy.podglad.warianty[w.rodzaj] : copy.podglad.elementy[w.rodzaj];
  return `${rodzaj} ${indeks + 1}`;
}

export function nazwaLokalu(lokale: StronaDto[], lokalId: string | null): string {
  if (lokalId === null) return copy.podglad.wszystkieLokalePodpis;
  return lokale.find((l) => l.lokalId === lokalId)?.nazwaLokalu ?? copy.podglad.warianty.lokal;
}

function Lista({ id, rodzaj, opcje, wartosc, onChange, lokale }: { id: string; rodzaj: RodzajListy; opcje: WariantDto[]; wartosc: string | null; onChange: (id: string) => void; lokale: StronaDto[] }) {
  const w = copy.podglad.warianty;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-szary-600">
        {w[rodzaj]} <span className="text-szary-300">{w.z} {opcje.length}</span>
      </label>
      <select id={id} value={wartosc ?? ""} onChange={(e) => onChange(e.target.value)} disabled={opcje.length === 0} className={`mt-1 ${POLE_WYBORU}`} data-lista={rodzaj}>
        {opcje.map((o, i) => (
          <option key={o.id} value={o.id}>
            {etykietaWariantu(o, i)}
            {o.rodzaj !== "grafika" && o.tekst ? `: ${skrotTekstu(o.tekst, 40)}` : ""}
            {o.lokalId ? ` (${nazwaLokalu(lokale, o.lokalId)})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Serce ekranu reklam (SPEC rozdz. 7.4): trzy listy (grafika, tekst, nagłówek) i czwarta „Lokal" w kat2/kat3.
 * Zmiana dowolnej listy zmienia wybór w rodzicu, który przerysowuje ramkę bez przeładowania.
 */
export function WyborWariantow({ idPrefix, warianty, wybor, onChange, lokale, pokazLokal }: { idPrefix: string; warianty: WariantDto[]; wybor: WyborWariantu; onChange: (wybor: WyborWariantu) => void; lokale: StronaDto[]; pokazLokal: boolean }) {
  const opcje = opcjeWariantow(warianty, wybor.lokalId);
  return (
    <div className={`grid grid-cols-2 gap-3 ${pokazLokal ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
      <Lista id={`${idPrefix}-grafika`} rodzaj="grafika" opcje={opcje.grafiki} wartosc={wybor.grafikaId} onChange={(id) => onChange({ ...wybor, grafikaId: id })} lokale={lokale} />
      <Lista id={`${idPrefix}-tekst`} rodzaj="tekst" opcje={opcje.teksty} wartosc={wybor.tekstId} onChange={(id) => onChange({ ...wybor, tekstId: id })} lokale={lokale} />
      <Lista id={`${idPrefix}-naglowek`} rodzaj="naglowek" opcje={opcje.naglowki} wartosc={wybor.naglowekId} onChange={(id) => onChange({ ...wybor, naglowekId: id })} lokale={lokale} />
      {pokazLokal ? <PrzelacznikLokalu id={`${idPrefix}-lokal`} lokale={lokale} wartosc={wybor.lokalId} onChange={(lokalId) => onChange(dopasujWybor(warianty, wybor, lokalId))} zWersjaWspolna /> : null}
    </div>
  );
}
