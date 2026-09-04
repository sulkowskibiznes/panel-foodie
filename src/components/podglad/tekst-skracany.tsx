"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { podzielTekst } from "@/lib/podglad/tekst";

/**
 * Tekst posta skracany po ~3 linijkach z „Zobacz więcej", dokładnie jak na Facebooku (SPEC rozdz. 7.1),
 * żeby klient zobaczył, co się urywa. Hashtagi i linki w kolorze odnośnika, bez klikania.
 */
export function TekstSkracany({ tekst, linie = 3, className = "", kolorOdnosnika = "text-[#0064d1]" }: { tekst: string | null; linie?: number; className?: string; kolorOdnosnika?: string }) {
  const [rozwiniety, setRozwiniety] = useState(false);
  const [ucina, setUcina] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || rozwiniety) return;
    const sprawdz = () => setUcina(el.scrollHeight > el.clientHeight + 1);
    sprawdz();
    const obserwator = new ResizeObserver(sprawdz);
    obserwator.observe(el);
    return () => obserwator.disconnect();
  }, [rozwiniety, tekst]);

  if (!tekst) return null;
  const fragmenty = podzielTekst(tekst);

  return (
    <div className={className}>
      <p ref={ref} className="whitespace-pre-line text-[15px] leading-5" style={rozwiniety ? undefined : { display: "-webkit-box", WebkitLineClamp: linie, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {fragmenty.map((f, i) =>
          f.rodzaj === "odnosnik" ? (
            <span key={i} className={kolorOdnosnika}>
              {f.tresc}
            </span>
          ) : (
            <span key={i}>{f.tresc}</span>
          ),
        )}
      </p>
      {ucina && !rozwiniety ? (
        <button type="button" onClick={() => setRozwiniety(true)} className="text-[15px] font-semibold text-szary-600 hover:underline">
          {copy.podglad.zobaczWiecej}
        </button>
      ) : null}
    </div>
  );
}
