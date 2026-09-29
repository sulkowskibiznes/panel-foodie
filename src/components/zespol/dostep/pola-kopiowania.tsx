"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

type Co = "link" | "pin";

/**
 * SPEC rozdz. 12.4: pola z przyciskiem kopiowania. Panel nie układa wiadomości i nie otwiera WhatsAppa.
 * Link i kod startowy kopiuje się osobno, żeby poszły osobnymi wiadomościami (Etap 2 planu domknięcia);
 * nieudane kopiowanie mówi, co zrobić, zamiast udawać „Skopiowano".
 */
export function PolaKopiowania({ adres, pin, onSkopiowano }: { adres: string; pin?: string; onSkopiowano?: (co: Co) => void }) {
  const [skopiowano, setSkopiowano] = useState<Co | null>(null);
  const [blad, setBlad] = useState(false);
  const g = copy.zespol.dostep.gotowy;

  useEffect(() => {
    if (!skopiowano) return;
    const t = setTimeout(() => setSkopiowano(null), 2000);
    return () => clearTimeout(t);
  }, [skopiowano]);

  async function kopiuj(co: Co) {
    setBlad(false);
    try {
      await navigator.clipboard.writeText(co === "link" ? adres : (pin ?? ""));
    } catch {
      // brak uprawnień do schowka: pole jest zaznaczalne, użytkownik skopiuje ręcznie
      setBlad(true);
      return;
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
          <Button type="button" variant="outline" size="lg" onClick={() => kopiuj("link")} data-kopiuj-link>{skopiowano === "link" ? g.skopiowano : g.kopiuj}</Button>
        </div>
      </div>
      {pin !== undefined ? (
        <div>
          <label htmlFor="pole-pin" className="block text-xs font-medium uppercase tracking-wide text-szary-600">{g.pin}</label>
          <div className="mt-1 flex gap-2">
            <input id="pole-pin" readOnly value={pin} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-szary-300 bg-szary-050 px-3 font-mono text-lg tracking-[0.3em] text-foodie-czern" />
            <Button type="button" variant="outline" size="lg" onClick={() => kopiuj("pin")} data-kopiuj-kod>{skopiowano === "pin" ? g.skopiowano : g.kopiuj}</Button>
          </div>
        </div>
      ) : null}
      {blad ? <p role="alert" className="text-sm text-czerwony">{g.bladKopiowania}</p> : null}
    </div>
  );
}
