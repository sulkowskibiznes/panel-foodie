"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

type Co = "link" | "pin" | "oba";

/** SPEC rozdz. 12.4: dwa pola z przyciskiem kopiowania. Panel nie układa wiadomości i nie otwiera WhatsAppa. */
export function PolaKopiowania({ adres, pin, onSkopiowano }: { adres: string; pin?: string; onSkopiowano?: (co: Co) => void }) {
  const [skopiowano, setSkopiowano] = useState<Co | null>(null);
  const g = copy.zespol.dostep.gotowy;

  useEffect(() => {
    if (!skopiowano) return;
    const t = setTimeout(() => setSkopiowano(null), 2000);
    return () => clearTimeout(t);
  }, [skopiowano]);

  async function kopiuj(co: Co) {
    const tekst = co === "link" ? adres : co === "pin" ? (pin ?? "") : `${g.link}: ${adres}\n${g.pin}: ${pin ?? ""}`;
    try {
      await navigator.clipboard.writeText(tekst);
    } catch {
      // brak uprawnień do schowka: pole jest zaznaczalne, użytkownik skopiuje ręcznie
    }
    setSkopiowano(co);
    onSkopiowano?.(co);
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="pole-link" className="block text-xs font-medium uppercase tracking-wide text-szary-600">{g.link}</label>
        <div className="mt-1 flex gap-2">
          <input id="pole-link" readOnly value={adres} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-szary-300 bg-szary-050 px-3 font-mono text-sm text-foodie-czern" />
          <Button type="button" variant="outline" size="lg" onClick={() => kopiuj("link")}>{skopiowano === "link" ? g.skopiowano : g.kopiuj}</Button>
        </div>
      </div>
      {pin !== undefined ? (
        <>
          <div>
            <label htmlFor="pole-pin" className="block text-xs font-medium uppercase tracking-wide text-szary-600">{g.pin}</label>
            <div className="mt-1 flex gap-2">
              <input id="pole-pin" readOnly value={pin} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-szary-300 bg-szary-050 px-3 font-mono text-lg tracking-[0.3em] text-foodie-czern" />
              <Button type="button" variant="outline" size="lg" onClick={() => kopiuj("pin")}>{skopiowano === "pin" ? g.skopiowano : g.kopiuj}</Button>
            </div>
          </div>
          <Button type="button" size="lg" className="w-full" onClick={() => kopiuj("oba")}>{skopiowano === "oba" ? g.skopiowano : g.kopiujOba}</Button>
        </>
      ) : null}
    </div>
  );
}
