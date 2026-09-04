"use client";

import type { WynikZmiany } from "@/app/zespol/(panel)/klienci/[slug]/pakiety/[pakietId]/materialy-akcje";

/** Wynik akcji w dialogu: błąd na czerwono, komunikat o skutkach (plakietka, termin) na zielono. */
export function KomunikatWyniku({ wynik }: { wynik: WynikZmiany | null }) {
  if (!wynik) return null;
  if (!wynik.ok) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony" data-blad-akcji>
        {wynik.blad}
      </p>
    );
  }
  if (!wynik.komunikat) return null;
  return (
    <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-zielony" data-wynik-akcji>
      {wynik.komunikat}
    </p>
  );
}
