"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/copy";
import { maUprawnienie, type Rola } from "@/lib/uprawnienia";

type Zakladka = { klucz: string; etykieta: string; href: string; takze?: string[] };

/**
 * Zakładki karty klienta (SPEC rozdz. 12.2). „Dane i współpraca" dla admina i csm. Pakiet (`/pakiety/...`) należy do
 * zakładki Materiały. Wdrożenie nie ma zakładki, dopóki jest wyłączone (plan domknięcia, Etap 3: bez pozycji „wkrótce").
 */
export function ZakladkiKarty({ slug, rola }: { slug: string; rola: Rola }) {
  const pathname = usePathname();
  const baza = `/zespol/klienci/${slug}`;
  const z = copy.zespol.karta.zakladki;
  const zakladki: Zakladka[] = [
    { klucz: "podsumowanie", etykieta: copy.zespol.karta.podsumowanie, href: baza },
    ...(maUprawnienie(rola, "materialy", "podglad") ? [{ klucz: "materialy", etykieta: z.materialy, href: `${baza}/materialy`, takze: [`${baza}/pakiety`] }] : []),
    ...(maUprawnienie(rola, "harmonogram", "podglad") ? [{ klucz: "harmonogram", etykieta: z.harmonogram, href: `${baza}/harmonogram` }] : []),
    ...(maUprawnienie(rola, "raporty", "podglad") ? [{ klucz: "raporty", etykieta: z.raporty, href: `${baza}/raporty` }] : []),
    ...(maUprawnienie(rola, "faktury", "podglad") ? [{ klucz: "faktury", etykieta: z.faktury, href: `${baza}/faktury` }] : []),
    ...(maUprawnienie(rola, "dokumenty", "podglad") ? [{ klucz: "dokumenty", etykieta: z.dokumenty, href: `${baza}/dokumenty` }] : []),
    ...(maUprawnienie(rola, "dostep", "pelne") ? [{ klucz: "dostep", etykieta: z.dostep, href: `${baza}/dostep` }] : []),
    ...(maUprawnienie(rola, "klienci", "pelne") ? [{ klucz: "ustawienia", etykieta: z.ustawienia, href: `${baza}/ustawienia` }] : []),
  ];

  return (
    <nav aria-label={copy.zespol.karta.nawigacjaKarty} className="mt-4 flex gap-1 overflow-x-auto border-b border-szary-100">
      {zakladki.map((t) => {
        const aktywna = t.href === baza ? pathname === baza : [t.href, ...(t.takze ?? [])].some((h) => pathname.startsWith(h));
        return (
          <Link
            key={t.klucz}
            href={t.href}
            aria-current={aktywna ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${aktywna ? "border-foodie-fiolet text-foodie-fiolet" : "border-transparent text-szary-600 hover:text-foodie-czern"}`}
            data-zakladka-karty={t.klucz}
          >
            {t.etykieta}
          </Link>
        );
      })}
    </nav>
  );
}
