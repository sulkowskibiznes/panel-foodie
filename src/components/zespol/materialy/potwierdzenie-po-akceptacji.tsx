"use client";

import { copy } from "@/lib/copy";
import type { StatusPakietu } from "@/lib/dto/materialy";

export function czyPoAkceptacji(status: StatusPakietu): boolean {
  return status === "zaakceptowany" || status === "zaplanowany";
}

/** Ostrzeżenie z checkboxem przy zmianie w zaakceptowanym pakiecie (SPEC rozdz. 12.6, kryterium 19). */
export function PotwierdzeniePoAkceptacji({ status, wartosc, onChange }: { status: StatusPakietu; wartosc: boolean; onChange: (v: boolean) => void }) {
  if (!czyPoAkceptacji(status)) return null;
  const t = copy.zespol.materialy.potwierdzenie;
  return (
    <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-bursztyn" data-potwierdzenie-po-akceptacji>
      <p className="font-semibold">{t.tytul}</p>
      <p className="mt-1 text-xs leading-5">{t.opis}</p>
      <label className="mt-2 flex items-start gap-2 text-xs font-medium text-foodie-czern">
        <input type="checkbox" checked={wartosc} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-foodie-fiolet" data-potwierdzam />
        {t.checkbox}
      </label>
    </div>
  );
}
