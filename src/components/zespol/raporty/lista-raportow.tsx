"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { usunRaport } from "@/app/zespol/(panel)/klienci/[slug]/raporty/akcje";
import { usePotwierdzenie } from "@/components/zespol/potwierdzenie";
import { toast } from "sonner";
import { copy } from "@/lib/copy";
import type { RaportZespolu } from "@/lib/dane/raporty";
import { etykietaMiesiaca, formatujDate } from "@/lib/format";

export function ListaRaportow({ slug, raporty, mozeUsuwac }: { slug: string; raporty: RaportZespolu[]; mozeUsuwac: boolean }) {
  const router = useRouter();
  const [trwa, startTransition] = useTransition();
  const t = copy.zespol.raporty;
  const { potwierdz, okno } = usePotwierdzenie();
  if (raporty.length === 0) return <p className="text-sm text-szary-600" data-brak-raportow>{t.brak}</p>;

  async function usun(id: string) {
    if (!(await potwierdz({ tresc: t.usunPotwierdz, przycisk: t.usun, niebezpieczne: true }))) return;
    startTransition(async () => {
      const w = await usunRaport(slug, id);
      if (w.ok) toast.success(copy.zespol.toasty.raportUsuniety);
      else toast.error(copy.zespol.toasty.blad);
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto">
      <table aria-label={t.tytul} className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
          <tr>
            <th className="py-2 pr-4">{t.kolumny.okres}</th>
            <th className="py-2 pr-4">{t.kolumny.lokal}</th>
            <th className="py-2 pr-4">{t.kolumny.tytul}</th>
            <th className="py-2 pr-4">{t.kolumny.zrodlo}</th>
            <th className="py-2 pr-4">{t.kolumny.opublikowano}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {raporty.map((r) => (
            <tr key={r.id} className="border-t border-szary-100" data-raport={r.id}>
              <td className="py-3 pr-4 font-medium text-foodie-czern">
                {etykietaMiesiaca(r.rok, r.miesiac)}
                {r.miesiacWspolpracy ? <span className="block text-xs font-normal text-szary-600">{copy.raporty.miesiacWspolpracy.replace("{n}", String(r.miesiacWspolpracy))}</span> : null}
              </td>
              <td className="py-3 pr-4 text-szary-600">{r.nazwaLokalu ?? copy.zespol.pulpitPakiety.auto.brak}</td>
              <td className="py-3 pr-4 text-foodie-czern">{r.tytul}</td>
              <td className="py-3 pr-4 text-szary-600" data-zrodlo={r.zrodlo}>{t.zrodlo[r.zrodlo]}</td>
              <td className="py-3 pr-4 text-szary-600">{formatujDate(r.opublikowanoO)}</td>
              <td className="py-3 text-right whitespace-nowrap">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-foodie-fiolet hover:underline">{t.otworz}</a>
                {mozeUsuwac ? (
                  <button type="button" disabled={trwa} onClick={() => void usun(r.id)} className="ml-3 font-medium text-szary-600 hover:text-czerwony disabled:opacity-50" data-usun-raport>
                    {t.usun}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {okno}
    </div>
  );
}
