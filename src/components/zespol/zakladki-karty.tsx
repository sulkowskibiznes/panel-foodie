"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/copy";
import { maUprawnienie, type Rola } from "@/lib/uprawnienia";

type Zakladka = { klucz: string; etykieta: string; href: string | null };

/** Zakładki karty klienta (SPEC rozdz. 12.2). Niedostępne w tej fazie: wyszarzone z podpisem „wkrótce". */
export function ZakladkiKarty({ slug, rola }: { slug: string; rola: Rola }) {
  const pathname = usePathname();
  const baza = `/zespol/klienci/${slug}`;
  const z = copy.zespol.karta.zakladki;
  const zakladki: Zakladka[] = [
    { klucz: "podsumowanie", etykieta: copy.zespol.karta.podsumowanie, href: baza },
    { klucz: "materialy", etykieta: z.materialy, href: null },
    { klucz: "harmonogram", etykieta: z.harmonogram, href: null },
    { klucz: "raporty", etykieta: z.raporty, href: null },
    ...(maUprawnienie(rola, "faktury", "podglad") ? [{ klucz: "faktury", etykieta: z.faktury, href: `${baza}/faktury` }] : []),
    { klucz: "dokumenty", etykieta: z.dokumenty, href: null },
    ...(maUprawnienie(rola, "dostep", "pelne") ? [{ klucz: "dostep", etykieta: z.dostep, href: `${baza}/dostep` }] : []),
    { klucz: "ustawienia", etykieta: z.ustawienia, href: null },
  ];

  return (
    <nav aria-label={copy.zespol.karta.zakladki.dostep} className="mt-4 flex gap-1 overflow-x-auto border-b border-szary-100">
      {zakladki.map((t) => {
        const aktywna = t.href !== null && (t.href === baza ? pathname === baza : pathname.startsWith(t.href));
        if (t.href === null) {
          return (
            <span key={t.klucz} aria-disabled title={copy.zespol.karta.wkrotce} className="whitespace-nowrap px-3 py-2.5 text-sm text-szary-300">
              {t.etykieta}
            </span>
          );
        }
        return (
          <Link
            key={t.klucz}
            href={t.href}
            aria-current={aktywna ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${aktywna ? "border-foodie-fiolet text-foodie-fiolet" : "border-transparent text-szary-600 hover:text-foodie-czern"}`}
          >
            {t.etykieta}
          </Link>
        );
      })}
    </nav>
  );
}
