"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { usunDokument } from "@/app/zespol/(panel)/klienci/[slug]/dokumenty/akcje";
import { usePotwierdzenie } from "@/components/zespol/potwierdzenie";
import { copy } from "@/lib/copy";
import type { DokumentDlaKlienta } from "@/lib/dto/klient";
import { formatujDate } from "@/lib/format";

export function ListaDokumentow({ slug, dokumenty, mozeUsuwac }: { slug: string; dokumenty: DokumentDlaKlienta[]; mozeUsuwac: boolean }) {
  const router = useRouter();
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const t = copy.zespol.dokumenty;
  const { potwierdz, okno } = usePotwierdzenie();
  if (dokumenty.length === 0) return <p className="text-sm text-szary-600" data-brak-dokumentow>{t.brak}</p>;

  async function usun(d: DokumentDlaKlienta) {
    if (!(await potwierdz({ tresc: t.usunPotwierdz.replace("{tytul}", d.tytul), przycisk: t.usun, niebezpieczne: true }))) return;
    setBlad(null);
    startTransition(async () => {
      const w = await usunDokument(slug, d.id);
      if (!w.ok) setBlad(w.blad);
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto">
      <table aria-label={t.tytul} className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
          <tr>
            <th className="py-2 pr-4">{t.kolumny.rodzaj}</th>
            <th className="py-2 pr-4">{t.kolumny.tytul}</th>
            <th className="py-2 pr-4">{t.kolumny.obowiazujeOd}</th>
            <th className="py-2 pr-4">{t.kolumny.dodano}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {dokumenty.map((d) => (
            <tr key={d.id} className="border-t border-szary-100" data-dokument={d.id}>
              <td className="py-3 pr-4 text-szary-600">{t.rodzaje[d.rodzaj]}</td>
              <td className="py-3 pr-4 font-medium text-foodie-czern">{d.tytul}</td>
              <td className="py-3 pr-4 text-szary-600">{d.obowiazujeOd ? formatujDate(d.obowiazujeOd) : copy.zespol.pulpitPakiety.auto.brak}</td>
              <td className="py-3 pr-4 text-szary-600">{formatujDate(d.dodanoO)}</td>
              <td className="py-3 text-right whitespace-nowrap">
                <a href={`/zespol/dokument/${d.id}`} className="font-medium text-foodie-fiolet hover:underline" data-pobierz-dokument>{t.pobierz}</a>
                {mozeUsuwac ? (
                  <button type="button" disabled={trwa} onClick={() => void usun(d)} className="ml-3 font-medium text-szary-600 hover:text-czerwony disabled:opacity-50" data-usun-dokument>
                    {t.usun}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {blad ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
      {okno}
    </div>
  );
}
