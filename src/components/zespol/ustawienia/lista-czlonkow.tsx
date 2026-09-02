"use client";

import { useTransition } from "react";
import { przelaczAktywnosc } from "@/app/zespol/(panel)/ustawienia/zespol/akcje";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { Rola } from "@/lib/uprawnienia";

type Czlonek = { id: string; name: string; email: string; role: Rola; active: boolean };

export function ListaCzlonkow({ czlonkowie, adminId }: { czlonkowie: Czlonek[]; adminId: string }) {
  const [trwa, startTransition] = useTransition();
  const u = copy.zespol.ustawienia.zespol;
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-miekki">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
          <tr>
            <th className="px-4 py-3">{u.kolumny.osoba}</th>
            <th className="px-4 py-3">{u.kolumny.email}</th>
            <th className="px-4 py-3">{u.kolumny.rola}</th>
            <th className="px-4 py-3">{u.kolumny.status}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {czlonkowie.map((c) => (
            <tr key={c.id} className="border-t border-szary-100">
              <td className="px-4 py-3 font-medium text-foodie-czern">{c.name}</td>
              <td className="px-4 py-3 text-szary-600">{c.email}</td>
              <td className="px-4 py-3 text-szary-600">{copy.zespol.role[c.role]}</td>
              <td className="px-4 py-3">{c.active ? <span className="text-zielony">{u.aktywny}</span> : <span className="text-szary-600">{u.nieaktywny}</span>}</td>
              <td className="px-4 py-3 text-right">
                {c.id !== adminId ? (
                  <Button type="button" variant="ghost" size="sm" disabled={trwa} onClick={() => startTransition(() => przelaczAktywnosc(c.id, !c.active))}>
                    {c.active ? u.dezaktywuj : u.aktywuj}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
