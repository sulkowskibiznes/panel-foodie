"use client";

import { useState, useTransition } from "react";
import { przelaczAktywnosc, zapiszKontaktDlaKlienta } from "@/app/zespol/(panel)/ustawienia/zespol/akcje";
import { Button } from "@/components/ui/button";
import { usePotwierdzenie } from "@/components/zespol/potwierdzenie";
import { toast } from "sonner";
import { copy } from "@/lib/copy";
import type { KlienciCzlonka } from "@/lib/dane/dane-klienta";
import type { Rola } from "@/lib/uprawnienia";

type Czlonek = { id: string; name: string; email: string; role: Rola; active: boolean; client_contact: string | null };

/** Pole „Kontakt dla klienta" (SPEC rozdz. 5.7) w wierszu członka zespołu; zapis osobnym przyciskiem. */
function PoleKontaktu({ czlonek }: { czlonek: Czlonek }) {
  const [wartosc, setWartosc] = useState(czlonek.client_contact ?? "");
  const [zapisano, setZapisano] = useState(false);
  const [trwa, startTransition] = useTransition();
  const u = copy.zespol.ustawienia.zespol;
  const zmienione = wartosc.trim() !== (czlonek.client_contact ?? "").trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const w = await zapiszKontaktDlaKlienta(czlonek.id, wartosc);
          setZapisano(w.ok);
          setTimeout(() => setZapisano(false), 2000);
        });
      }}
      className="flex items-center gap-2"
      data-kontakt-czlonka={czlonek.id}
    >
      <input value={wartosc} onChange={(e) => setWartosc(e.target.value.slice(0, 200))} placeholder={u.kontaktPodpowiedz} aria-label={u.kontakt} className="h-9 w-56 rounded-lg border border-szary-300 bg-white px-2 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet" />
      <Button type="submit" variant="outline" size="sm" disabled={trwa || !zmienione}>
        {u.kontaktZapisz}
      </Button>
      {zapisano ? <span className="text-xs text-zielony">{u.kontaktZapisano}</span> : null}
    </form>
  );
}

/** `klienci`: dla każdej osoby liczba klientów pod jej opieką i przypisanych (bez zakończonych współprac). */
export function ListaCzlonkow({ czlonkowie, adminId, klienci }: { czlonkowie: Czlonek[]; adminId: string; klienci: Record<string, KlienciCzlonka> }) {
  const [trwa, startTransition] = useTransition();
  const u = copy.zespol.ustawienia.zespol;
  const { potwierdz, okno } = usePotwierdzenie();
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-miekki">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
          <tr>
            <th className="px-4 py-3">{u.kolumny.osoba}</th>
            <th className="px-4 py-3">{u.kolumny.email}</th>
            <th className="px-4 py-3">{u.kolumny.rola}</th>
            <th className="px-4 py-3">{u.kolumny.status}</th>
            <th className="px-4 py-3">{u.kontakt}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {czlonkowie.map((c) => (
            <tr key={c.id} className="border-t border-szary-100">
              <td className="px-4 py-3 font-medium text-foodie-czern">
                {c.name}
                <span className="block text-xs font-normal text-szary-600" data-klienci-czlonka={c.id} title={u.klienciOpis.replace("{o}", String(klienci[c.id]?.opiekun ?? 0))}>
                  {u.klienci.replace("{n}", String(klienci[c.id]?.klienci ?? 0))}
                </span>
              </td>
              <td className="px-4 py-3 text-szary-600">{c.email}</td>
              <td className="px-4 py-3 text-szary-600">{copy.zespol.role[c.role]}</td>
              <td className="px-4 py-3">{c.active ? <span className="text-zielony">{u.aktywny}</span> : <span className="text-szary-600">{u.nieaktywny}</span>}</td>
              <td className="px-4 py-3">
                <PoleKontaktu czlonek={c} />
              </td>
              <td className="px-4 py-3 text-right">
                {c.id !== adminId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={trwa}
                    onClick={async () => {
                      // Dezaktywacja opiekuna zostawia klientów bez opiekuna w „Twój pakiet": ostrzegamy przed kliknięciem.
                      const podOpieka = klienci[c.id]?.opiekun ?? 0;
                      if (c.active && podOpieka > 0 && !(await potwierdz({ tresc: u.dezaktywujOpiekuna.replace("{osoba}", c.name).replace("{n}", String(podOpieka)), przycisk: u.dezaktywuj, niebezpieczne: true }))) return;
                      startTransition(async () => {
                        const w = await przelaczAktywnosc(c.id, !c.active);
                        if (!w.ok) {
                          toast.error(copy.zespol.toasty.blad);
                          return;
                        }
                        toast.success(c.active ? copy.zespol.toasty.czlonekNieaktywny : copy.zespol.toasty.czlonekAktywny);
                      });
                    }}
                  >
                    {c.active ? u.dezaktywuj : u.aktywuj}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 pb-4 text-xs text-szary-600">{u.kontaktOpis}</p>
      {okno}
    </div>
  );
}
