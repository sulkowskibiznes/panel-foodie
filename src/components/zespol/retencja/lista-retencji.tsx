"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sprawdzTeraz, usunMaterialy, zachowajMaterialy } from "@/app/zespol/(panel)/ustawienia/retencja/akcje";
import { Button } from "@/components/ui/button";
import { usePotwierdzenie } from "@/components/zespol/potwierdzenie";
import { copy } from "@/lib/copy";
import type { PrzegladNaLiscie } from "@/lib/dane/retencja";
import { etykietaOkresu, formatujDate, formatujDateCzas } from "@/lib/format";

/** Zgłoszenia retencyjne (SPEC rozdz. 17): „Usuń materiały" po potwierdzeniu albo „Zachowaj 12 miesięcy"; pod spodem ostatnie decyzje. */
export function ListaRetencji({ oczekujace, decyzje }: { oczekujace: PrzegladNaLiscie[]; decyzje: PrzegladNaLiscie[] }) {
  const router = useRouter();
  const [trwa, startTransition] = useTransition();
  const [komunikat, setKomunikat] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const t = copy.zespol.retencja;
  const { potwierdz, okno } = usePotwierdzenie();

  function wykonaj(fn: () => Promise<{ ok: boolean; blad?: string }>) {
    setBlad(null);
    startTransition(async () => {
      const w = await fn();
      if (!w.ok) setBlad(w.blad ?? t.bledy.ogolny);
      router.refresh();
    });
  }

  async function usun(p: PrzegladNaLiscie) {
    if (!(await potwierdz({ tresc: t.usunPotwierdz.replace("{pakiet}", p.tytul).replace("{klient}", p.klient.name), przycisk: t.usun, niebezpieczne: true }))) return;
    wykonaj(() => usunMaterialy(p.id));
  }

  function sprawdz() {
    setKomunikat(null);
    wykonaj(async () => {
      const w = await sprawdzTeraz();
      if (w.ok) setKomunikat(t.sprawdzono.replace("{sprawdzone}", String(w.wynik.sprawdzone)).replace("{nowe}", String(w.wynik.zgloszone.length + w.wynik.ponowione.length)));
      return w;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="lg" disabled={trwa} onClick={sprawdz} data-sprawdz-retencje>
          {trwa ? t.sprawdzanie : t.sprawdzTeraz}
        </Button>
        {komunikat ? <span className="text-sm text-zielony" data-wynik-sprawdzenia>{komunikat}</span> : null}
        {blad ? <span role="alert" className="text-sm text-czerwony">{blad}</span> : null}
      </div>

      {oczekujace.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki" data-brak-retencji>{t.brak}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-miekki">
          <table aria-label={t.tytul} className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
              <tr>
                <th className="px-4 py-3">{t.kolumny.klient}</th>
                <th className="px-4 py-3">{t.kolumny.pakiet}</th>
                <th className="px-4 py-3 text-right">{t.kolumny.pliki}</th>
                <th className="px-4 py-3">{t.kolumny.zgloszono}</th>
                <th className="px-4 py-3">{t.kolumny.akcja}</th>
              </tr>
            </thead>
            <tbody>
              {oczekujace.map((p) => (
                <tr key={p.id} className="border-t border-szary-100 align-top" data-przeglad={p.id} data-pakiet={p.packageId ?? undefined}>
                  <td className="px-4 py-3 font-medium text-foodie-czern">{p.klient.name}</td>
                  <td className="px-4 py-3 text-foodie-czern">
                    {p.tytul}
                    <span className="block text-xs text-szary-600">{etykietaOkresu(p.okres.od, p.okres.do)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-szary-600">{p.liczbaPlikow}</td>
                  <td className="px-4 py-3 text-szary-600">{formatujDate(p.zgloszonoO)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="destructive" size="sm" disabled={trwa} onClick={() => void usun(p)} data-usun-materialy>
                        {t.usun}
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled={trwa} onClick={() => wykonaj(() => zachowajMaterialy(p.id))} data-zachowaj-materialy>
                        {t.zachowaj}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section>
        <h3 className="font-naglowek text-lg text-foodie-czern">{t.historia}</h3>
        {decyzje.length === 0 ? (
          <p className="mt-2 text-sm text-szary-600">{t.brakHistorii}</p>
        ) : (
          <ul className="mt-2 divide-y divide-szary-100 rounded-xl bg-white shadow-miekki" data-historia-retencji>
            {decyzje.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm" data-decyzja={p.decyzja ?? undefined}>
                <div>
                  <span className="font-medium text-foodie-czern">{p.klient.name}</span>
                  <span className="text-szary-600"> · {p.tytul}</span>
                  <span className="block text-xs text-szary-600">{etykietaOkresu(p.okres.od, p.okres.do)}{p.packageId ? "" : ` · ${t.pakietUsuniety}`}</span>
                </div>
                <div className="text-right text-xs text-szary-600">
                  <span className={`block font-medium ${p.decyzja === "usun" ? "text-czerwony" : "text-zielony"}`}>
                    {p.decyzja === "usun" ? t.decyzja.usun.replace("{data}", formatujDate(p.usunietoO ?? p.zdecydowanoO ?? "")) : t.decyzja.zachowaj.replace("{data}", formatujDate(p.keepUntil ?? ""))}
                  </span>
                  {p.zdecydowanoO ? t.przez.replace("{osoba}", p.zdecydowal ?? copy.zdarzenia.system).replace("{data}", formatujDateCzas(p.zdecydowanoO)) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {okno}
    </div>
  );
}
