"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/copy";

const ZAKLADKI = [
  { klucz: "zespol", href: "/zespol/ustawienia/zespol", dane: { "data-link-zespolu": "" } },
  { klucz: "ogolne", href: "/zespol/ustawienia/ogolne", dane: { "data-link-ogolne": "" } },
  { klucz: "powiadomienia", href: "/zespol/ustawienia/powiadomienia", dane: { "data-link-powiadomien": "" } },
  { klucz: "retencja", href: "/zespol/ustawienia/retencja", dane: { "data-link-retencji": "" } },
] as const;

/** Zakładki Ustawień (plan domknięcia, Etap 3a): jedno „Ustawienia" w nawigacji zamiast trzech osobnych pozycji. */
export function ZakladkiUstawien() {
  const pathname = usePathname();
  const z = copy.zespol.ustawienia.zakladki;
  return (
    <nav aria-label={z.nawigacja} className="mt-4 flex gap-1 overflow-x-auto border-b border-szary-100">
      {ZAKLADKI.map((t) => {
        const aktywna = pathname.startsWith(t.href);
        return (
          <Link
            key={t.klucz}
            href={t.href}
            aria-current={aktywna ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${aktywna ? "border-foodie-fiolet text-foodie-fiolet" : "border-transparent text-szary-600 hover:text-foodie-czern"}`}
            {...t.dane}
          >
            {z[t.klucz]}
          </Link>
        );
      })}
    </nav>
  );
}
