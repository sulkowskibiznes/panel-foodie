"use client";

import { copy } from "@/lib/copy";
import type { StronaDto } from "@/lib/dto/materialy";

export const POLE_WYBORU = "h-10 w-full rounded-lg border border-szary-300 bg-white px-2.5 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30";

/**
 * Czwarta lista „Lokal" (SPEC 7.4, 1.4 poz. 15) i przełącznik profilu w poście kat3 (7.1).
 * Natywny <select>: na telefonie otwiera systemową listę, w testach działa selectOption.
 */
export function PrzelacznikLokalu({ id, lokale, wartosc, onChange, zWersjaWspolna }: { id: string; lokale: StronaDto[]; wartosc: string | null; onChange: (lokalId: string | null) => void; zWersjaWspolna: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-szary-600">
        {copy.podglad.warianty.lokal}
      </label>
      <select id={id} value={wartosc ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)} className={`mt-1 ${POLE_WYBORU}`}>
        {zWersjaWspolna ? <option value="">{copy.podglad.warianty.wszystkieLokale}</option> : null}
        {lokale.map((l) => (
          <option key={l.lokalId} value={l.lokalId}>
            {l.nazwaLokalu}
          </option>
        ))}
      </select>
    </div>
  );
}
