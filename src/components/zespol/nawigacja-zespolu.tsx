"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type PozycjaNawigacji = {
  href: string;
  etykieta: string;
  /** Aktywna tylko dla dokładnie tego adresu (Pulpit), nie dla podstron. */
  dokladnie?: boolean;
  /** Plakietka z liczbą (nieprzeczytane uwagi w skrzynce); 0 = bez plakietki. */
  plakietka?: number;
  /** Nazwa atrybutu data-* dla testów E2E. */
  dane: string;
};

const KLASA_LINKU = "font-medium hover:text-foodie-fiolet aria-[current=page]:text-foodie-fiolet aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8";

/**
 * Pozycje nagłówka panelu zespołu. Aktywną pozycję liczy przeglądarka z `usePathname`: wspólny układ nie renderuje się
 * ponownie przy przejściu linkiem, więc ścieżka z nagłówka żądania zostawałaby na pierwszej stronie.
 * Które pozycje pokazać (role), decyduje serwer w `uklad-zespolu.tsx`.
 */
export function NawigacjaZespolu({ pozycje, etykieta }: { pozycje: PozycjaNawigacji[]; etykieta: string }) {
  const sciezka = usePathname();
  const biezaca = (p: PozycjaNawigacji) => (p.dokladnie ? sciezka === p.href : sciezka === p.href || sciezka.startsWith(`${p.href}/`));
  return (
    <nav className="flex items-center gap-4 text-sm text-foodie-czern" aria-label={etykieta}>
      {pozycje.map((p) => (
        <Link key={p.href} href={p.href} className={`flex items-center gap-1.5 ${KLASA_LINKU}`} aria-current={biezaca(p) ? "page" : undefined} {...{ [p.dane]: "" }}>
          {p.etykieta}
          {p.plakietka && p.plakietka > 0 ? (
            <span className="rounded-full bg-foodie-fiolet px-1.5 text-[11px] font-semibold text-white" data-nieprzeczytane-uwagi={p.plakietka}>
              {p.plakietka}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
