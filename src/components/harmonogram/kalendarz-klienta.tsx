import Link from "next/link";
import { EtykietaMaterialu, KLASA_STATUSU, SiatkaMiesiaca } from "@/components/harmonogram/wspolne";
import { copy } from "@/lib/copy";
import type { HarmonogramMiesiaca } from "@/lib/dto/harmonogram";
import { formatujDate } from "@/lib/format";
import { kluczMiesiaca } from "@/lib/harmonogram/kalendarz";

/**
 * Kalendarz klienta (SPEC rozdz. 5.3, 8): ten sam widok miesiąca, wyłącznie do odczytu (kryterium 22: bez uchwytów,
 * bez pól daty, bez akcji), z „Skomentuj" prowadzącym do wątku materiału. Kampanie w osobnej sekcji pod kalendarzem.
 */
export function KalendarzKlienta({ harmonogram, token }: { harmonogram: HarmonogramMiesiaca; token: string }) {
  const h = copy.harmonogram;
  const klucz = kluczMiesiaca(harmonogram.rok, harmonogram.miesiac);
  const zaplanowane = harmonogram.materialy.filter((m) => m.data !== null).sort((a, b) => (a.publikacjaO ?? "").localeCompare(b.publikacjaO ?? ""));
  const adres = (pakietId: string, materialId: string) => `/p/${token}/materialy/${pakietId}#material-${materialId}`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-3 shadow-miekki">
        <SiatkaMiesiaca
          rok={harmonogram.rok}
          miesiac={harmonogram.miesiac}
          komorka={(dzien) => (
            <div key={dzien.data} role="gridcell" data-dzien={dzien.data} className={`min-h-20 rounded-lg border border-szary-100 p-1 ${dzien.wMiesiacu ? "bg-white" : "bg-szary-050 opacity-70"}`}>
              <div className={`text-right text-[11px] ${dzien.wMiesiacu ? "text-foodie-czern" : "text-szary-300"}`}>{dzien.dzien}</div>
              <ul className="mt-1 space-y-1">
                {zaplanowane
                  .filter((m) => m.data === dzien.data)
                  .map((m) => (
                    <li key={m.id} data-material-kalendarza={m.id}>
                      <Link href={adres(m.pakietId, m.id)} className={`block rounded-md border px-1.5 py-1 text-[11px] leading-4 hover:underline ${KLASA_STATUSU[m.statusPakietu]}`}>
                        <EtykietaMaterialu m={m} />
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        />
      </div>

      <section className="rounded-xl bg-white p-4 shadow-miekki sm:p-5" data-lista-publikacji>
        <h2 className="font-naglowek text-lg text-foodie-czern">{h.lista}</h2>
        {zaplanowane.filter((m) => m.data?.startsWith(klucz)).length === 0 ? (
          <p className="mt-2 text-sm text-szary-600">{h.brak}</p>
        ) : (
          <ul className="mt-3 divide-y divide-szary-100">
            {zaplanowane
              .filter((m) => m.data?.startsWith(klucz))
              .map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-foodie-czern">{m.publikacjaO ? formatujDate(m.publikacjaO, { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : h.bezDaty}</span>
                    <span className="text-szary-600"> · {h.typ[m.typ]} · {m.tytul}</span>
                    {m.nazwaLokalu ? <span className="text-szary-600"> · {m.nazwaLokalu}</span> : null}
                    <span className={`ml-2 rounded-full border px-1.5 text-[10px] ${KLASA_STATUSU[m.statusPakietu]}`}>{h.statusy[m.statusPakietu]}</span>
                  </span>
                  <Link href={adres(m.pakietId, m.id)} className="text-sm font-medium text-foodie-fiolet hover:underline">
                    {m.statusPakietu === "zaplanowany" ? h.zobacz : h.skomentuj}
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-miekki sm:p-5" data-kampanie-miesiaca>
        <h2 className="font-naglowek text-lg text-foodie-czern">{h.kampanie}</h2>
        {harmonogram.kampanie.length === 0 ? (
          <p className="mt-2 text-sm text-szary-600">{h.bezKampanii}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {harmonogram.kampanie.map((k) => (
              <li key={k.id} className="rounded-lg border border-szary-100 p-3 text-sm">
                <p className="font-medium text-foodie-czern">{k.nazwa}</p>
                {k.cel ? <p className="text-szary-600">{h.cel} {copy.podglad.cele[k.cel]}</p> : null}
                {k.notatka ? <p className="mt-1 text-foodie-czern">{k.notatka}</p> : null}
                <Link href={`/p/${token}/materialy/${k.pakietId}#kampania-${k.id}`} className="mt-1 inline-block text-sm font-medium text-foodie-fiolet hover:underline">{h.zobacz}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
