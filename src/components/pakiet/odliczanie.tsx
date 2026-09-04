"use client";

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { tekstOdliczania } from "@/lib/format";

/** „Automatyczna akceptacja za 2 dni 4 godz." albo, po terminie, pełne zdanie o czekaniu na zespół. */
export function tekstAutoAkceptacji(do_: string, teraz: Date): string {
  const ms = new Date(do_).getTime() - teraz.getTime();
  return ms <= 0 ? copy.pakiet.autoMinela : `${copy.pakiet.autoAkceptacja} ${tekstOdliczania(do_, teraz)}`;
}

/** Licznik auto-akceptacji odświeżany w przeglądarce co pół minuty; pierwszy render z czasem serwera (bez rozjazdu hydracji). */
export function Odliczanie({ do_, teraz }: { do_: string; teraz: string }) {
  const [tekst, setTekst] = useState(() => tekstAutoAkceptacji(do_, new Date(teraz)));
  useEffect(() => {
    const odswiez = () => setTekst(tekstAutoAkceptacji(do_, new Date()));
    odswiez();
    const id = window.setInterval(odswiez, 30_000);
    return () => window.clearInterval(id);
  }, [do_]);
  return <span data-odliczanie>{tekst}</span>;
}
