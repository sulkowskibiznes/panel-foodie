"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ponowPowiadomienie } from "@/app/zespol/(panel)/ustawienia/powiadomienia/akcje";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { ZdarzenieWKolejce } from "@/lib/dane/powiadomienia";
import { formatujDateCzas } from "@/lib/format";

const KLASA_STATUSU = { pending: "text-bursztyn", sent: "text-zielony", failed: "text-czerwony" } as const;

export function ListaPowiadomien({ kolejka }: { kolejka: ZdarzenieWKolejce[] }) {
  const router = useRouter();
  const [trwa, startTransition] = useTransition();
  const t = copy.zespol.powiadomienia;
  if (kolejka.length === 0) return <p className="rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki">{t.brak}</p>;
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-miekki">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
          <tr>
            <th className="px-4 py-3">{t.kolumny.zdarzenie}</th>
            <th className="px-4 py-3">{t.kolumny.klient}</th>
            <th className="px-4 py-3">{t.kolumny.status}</th>
            <th className="px-4 py-3 text-right">{t.kolumny.proby}</th>
            <th className="px-4 py-3">{t.kolumny.blad}</th>
            <th className="px-4 py-3">{t.kolumny.nastepna}</th>
            <th className="px-4 py-3">{t.kolumny.utworzono}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {kolejka.map((z) => (
            <tr key={z.id} className="border-t border-szary-100 align-top" data-powiadomienie={z.id} data-status={z.status}>
              <td className="px-4 py-3">
                <span className="font-medium text-foodie-czern">{z.event}</span>
                {z.podsumowanie ? <span className="block max-w-80 text-xs text-szary-600">{z.podsumowanie}</span> : null}
              </td>
              <td className="px-4 py-3 text-szary-600">{z.klient ?? copy.zespol.pulpitPakiety.auto.brak}</td>
              <td className={`px-4 py-3 font-medium ${KLASA_STATUSU[z.status]}`}>{t.status[z.status]}</td>
              <td className="px-4 py-3 text-right text-szary-600">{z.proby}</td>
              <td className="max-w-64 truncate px-4 py-3 text-xs text-szary-600" title={z.ostatniBlad ?? undefined}>{z.ostatniBlad ?? ""}</td>
              <td className="px-4 py-3 text-szary-600">{z.nastepnaProbaO ? formatujDateCzas(z.nastepnaProbaO) : copy.zespol.pulpitPakiety.auto.brak}</td>
              <td className="px-4 py-3 text-szary-600">{formatujDateCzas(z.utworzonoO)}</td>
              <td className="px-4 py-3 text-right">
                {z.status === "failed" ? (
                  <Button type="button" variant="outline" size="sm" disabled={trwa} onClick={() => startTransition(async () => { await ponowPowiadomienie(z.id); router.refresh(); })} data-ponow>
                    {t.ponow}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 pb-4 text-xs text-szary-600">{t.podsumowanie.replace("{n}", String(kolejka.length))}</p>
    </div>
  );
}
