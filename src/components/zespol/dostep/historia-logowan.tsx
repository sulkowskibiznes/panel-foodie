import { copy } from "@/lib/copy";
import type { WpisHistorii } from "@/lib/dane/linki";
import { formatujDateCzas } from "@/lib/format";

/** Historia logowań i zmian dostępu (SPEC rozdz. 4.4) z audit_log. */
export function HistoriaLogowan({ wpisy }: { wpisy: WpisHistorii[] }) {
  const h = copy.zespol.dostep.historia;
  return (
    <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
      <h2 className="font-naglowek text-xl text-foodie-czern">{h.tytul}</h2>
      {wpisy.length === 0 ? (
        <p className="mt-2 text-sm text-szary-600">{h.brak}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table aria-label={h.tytul} className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
              <tr>
                <th className="py-2 pr-4">{h.kolumny.kiedy}</th>
                <th className="py-2 pr-4">{h.kolumny.co}</th>
                <th className="py-2">{h.kolumny.kto}</th>
              </tr>
            </thead>
            <tbody>
              {wpisy.map((w) => {
                const etykieta = (h.zdarzenia as Record<string, string>)[w.akcja] ?? w.akcja;
                const nieudane = w.akcja === "klient.logowanie_blad" || w.akcja === "klient.blokada_24h";
                return (
                  <tr key={w.id} className="border-t border-szary-100">
                    <td className="py-2 pr-4 whitespace-nowrap text-szary-600">{formatujDateCzas(w.kiedy)}</td>
                    <td className={`py-2 pr-4 ${nieudane ? "text-czerwony" : "text-foodie-czern"}`}>
                      {etykieta}
                      {w.akcja === "klient.logowanie_blad" && typeof w.meta.proby === "number" && w.meta.proby > 0 ? ` (${w.meta.proby})` : ""}
                    </td>
                    <td className="py-2 text-szary-600">{w.linkLabel ?? w.actorLabel ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
