"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/copy";
import { maUprawnienie, type Rola } from "@/lib/uprawnienia";

type Zakladka = { klucz: string; etykieta: string; href: string | null; podpowiedz?: string };

/** Zakładki karty klienta (SPEC rozdz. 12.2). Niedostępne w tej fazie: wyszarzone z podpisem „wkrótce"; Wdrożenie nieaktywne za flagą (rozdz. 11). */
export function ZakladkiKarty({ slug, rola }: { slug: string; rola: Rola }) {
  const pathname = usePathname();
  const baza = `/zespol/klienci/${slug}`;
  const z = copy.zespol.karta.zakladki;
  const zakladki: Zakladka[] = [
    { klucz: "podsumowanie", etykieta: copy.zespol.karta.podsumowanie, href: baza },
    ...(maUprawnienie(rola, "materialy", "podglad") ? [{ klucz: "materialy", etykieta: z.materialy, href: `${baza}/materialy` }] : []),
    ...(maUprawnienie(rola, "harmonogram", "podglad") ? [{ klucz: "harmonogram", etykieta: z.harmonogram, href: `${baza}/harmonogram` }] : []),
    ...(maUprawnienie(rola, "raporty", "podglad") ? [{ klucz: "raporty", etykieta: z.raporty, href: `${baza}/raporty` }] : []),
    ...(maUprawnienie(rola, "faktury", "podglad") ? [{ klucz: "faktury", etykieta: z.faktury, href: `${baza}/faktury` }] : []),
    ...(maUprawnienie(rola, "dokumenty", "podglad") ? [{ klucz: "dokumenty", etykieta: z.dokumenty, href: `${baza}/dokumenty` }] : []),
    ...(maUprawnienie(rola, "dostep", "pelne") ? [{ klucz: "dostep", etykieta: z.dostep, href: `${baza}/dostep` }] : []),
    { klucz: "ustawienia", etykieta: z.ustawienia, href: null, podpowiedz: copy.zespol.karta.wkrotce },
    { klucz: "wdrozenie", etykieta: z.wdrozenie, href: null, podpowiedz: copy.zespol.karta.wdrozenieWkrotce },
  ];

  return (
    <nav aria-label={copy.zespol.karta.podsumowanie} className="mt-4 flex gap-1 overflow-x-auto border-b border-szary-100">
      {zakladki.map((t) => {
        const aktywna = t.href !== null && (t.href === baza ? pathname === baza : pathname.startsWith(t.href));
        if (t.href === null) {
          return (
            <span key={t.klucz} aria-disabled title={t.podpowiedz} className="whitespace-nowrap px-3 py-2.5 text-sm text-szary-300" data-zakladka-nieaktywna={t.klucz}>
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
