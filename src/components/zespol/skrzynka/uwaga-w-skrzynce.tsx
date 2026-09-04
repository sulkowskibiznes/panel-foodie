"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { odpowiedzNaKomentarz, oznaczZalatwione } from "@/app/zespol/(panel)/klienci/[slug]/pakiety/[pakietId]/akcje";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { UwagaWSkrzynce } from "@/lib/dane/skrzynka";
import { etykietaOkresu, formatujDateCzas } from "@/lib/format";

/** Jedna uwaga w skrzynce (SPEC rozdz. 12.5): odpowiedź w tym samym wątku co u klienta i „Załatwione". */
export function UwagaWSkrzynceKarta({ u }: { u: UwagaWSkrzynce }) {
  const router = useRouter();
  const s = copy.zespol.skrzynka;
  const p = copy.zespol.pakietyMaterialow;
  const [tresc, setTresc] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const adres = `/zespol/klienci/${u.klient.slug}/pakiety/${u.pakietId}${u.materialId ? `#material-${u.materialId}` : "#uwagi"}`;

  function odpowiedz(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBlad(null);
    startTransition(async () => {
      const w = await odpowiedzNaKomentarz(u.klient.slug, u.pakietId, { materialId: u.materialId, wariantId: u.wariantId, tresc });
      if (!w.ok) {
        setBlad(w.blad);
        return;
      }
      setTresc("");
      router.refresh();
    });
  }

  function zalatwione() {
    setBlad(null);
    startTransition(async () => {
      const w = await oznaczZalatwione(u.klient.slug, u.pakietId, u.id);
      if (!w.ok) {
        setBlad(w.blad);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li data-uwaga-skrzynki={u.id} className="rounded-xl bg-white p-4 shadow-miekki">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-szary-600">
        <span className="font-semibold text-foodie-czern">{u.klient.name}</span>
        <span>· {etykietaOkresu(u.okres.rok, u.okres.miesiac)}</span>
        <span>· {s.typ[u.typ]}{u.materialTytul ? `: ${u.materialTytul}` : ""}</span>
        {u.runda > 1 ? <span>· {copy.pakiet.wersja} {u.runda}</span> : null}
        {u.nieprzeczytana ? <span className="rounded-full bg-fiolet-050 px-2 py-0.5 font-medium text-fiolet-700">{s.nieprzeczytana}</span> : null}
        {u.poAkceptacji ? <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-bursztyn">{s.poAkceptacji}</span> : null}
        {u.odpowiedzi > 0 ? <span>· {s.odpowiedzi.replace("{n}", String(u.odpowiedzi))}</span> : null}
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-foodie-czern">{u.tresc}</p>
      <p className="mt-1 text-xs text-szary-600">
        {u.autorNazwa} · {formatujDateCzas(u.utworzonoO)}
      </p>
      <form onSubmit={odpowiedz} className="mt-3 space-y-2">
        <textarea aria-label={p.odpowiedz} value={tresc} onChange={(e) => setTresc(e.target.value.slice(0, 4000))} placeholder={p.odpowiedzPodpowiedz} rows={2} className="w-full rounded-lg border border-szary-300 px-3 py-2 text-sm outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30" />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={trwa || tresc.trim().length === 0}>{p.wyslijOdpowiedz}</Button>
          <Button type="button" variant="outline" size="sm" disabled={trwa} onClick={zalatwione} data-zalatwione>{p.zalatwione}</Button>
          <Link href={adres} className="text-sm font-medium text-foodie-fiolet hover:underline">{s.otworzPakiet}</Link>
          {blad ? <span role="alert" className="text-xs text-czerwony">{blad}</span> : null}
        </div>
      </form>
    </li>
  );
}
