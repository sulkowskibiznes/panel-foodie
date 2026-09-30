import Link from "next/link";
import type { ReactNode } from "react";
import { Sygnet } from "@/components/marka/sygnet";
import { NawigacjaZespolu, type PozycjaNawigacji } from "@/components/zespol/nawigacja-zespolu";
import { Toaster } from "@/components/ui/sonner";
import type { CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { maUprawnienie } from "@/lib/uprawnienia";

/**
 * Nagłówek panelu zespołu: Pulpit, Klienci, Skrzynka uwag, Ustawienia (admin, z zakładkami), „Przejdź do klienta"
 * i aktywna pozycja (`aria-current`, liczona w przeglądarce w `NawigacjaZespolu`).
 * Toaster pokazuje skutki akcji (plan domknięcia, Etap 3a); panel jest wyłącznie jasny (bez trybu ciemnego w MVP).
 */
export function UkladZespolu({ czlonek, nieprzeczytaneUwagi = 0, children }: { czlonek: CzlonekZespolu; nieprzeczytaneUwagi?: number; children: ReactNode }) {
  const n = copy.zespol.nawigacja;
  const pozycje: PozycjaNawigacji[] = [
    { href: "/zespol", etykieta: n.pulpit, dokladnie: true, dane: "data-link-pulpitu" },
    { href: "/zespol/klienci", etykieta: n.klienci, dane: "data-link-klientow" },
    ...(maUprawnienie(czlonek.role, "materialy", "podglad") ? [{ href: "/zespol/uwagi", etykieta: n.skrzynka, plakietka: nieprzeczytaneUwagi, dane: "data-link-skrzynki" }] : []),
    ...(maUprawnienie(czlonek.role, "ustawienia", "pelne") ? [{ href: "/zespol/ustawienia", etykieta: n.ustawienia, dane: "data-link-ustawien" }] : []),
  ];
  return (
    <div className="flex min-h-full flex-1 flex-col bg-szary-050">
      <header className="border-b border-szary-100 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/zespol" className="flex items-center gap-3" aria-label={copy.marka.panelZespolu}>
            <Sygnet rozmiar={28} />
            <span className="font-naglowek text-base text-foodie-czern">{copy.marka.panelZespolu}</span>
          </Link>
          <NawigacjaZespolu pozycje={pozycje} etykieta={copy.marka.panelZespolu} />
          {/* „Przejdź do klienta": GET na listę; przy jednym trafieniu lista od razu otwiera kartę (plan 3b). */}
          <form action="/zespol/klienci" method="get" role="search" className="order-last w-full sm:order-none sm:w-auto" data-przejdz-do-klienta>
            <input type="hidden" name="idz" value="1" />
            <input type="search" name="q" required maxLength={80} aria-label={copy.zespol.listaKlientow.przejdz} placeholder={copy.zespol.listaKlientow.przejdz} title={copy.zespol.listaKlientow.przejdzPodpowiedz} className="h-9 w-full rounded-lg border border-szary-300 bg-white px-3 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30 sm:w-56" />
          </form>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-szary-600">
              <span className="font-medium text-foodie-czern">{czlonek.name}</span> · {copy.zespol.role[czlonek.role]}
            </span>
            <form action="/zespol/wyloguj" method="post">
              <button type="submit" className="font-medium text-foodie-fiolet hover:underline">
                {n.wyloguj}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:py-8">{children}</main>
      <Toaster theme="light" position="top-center" />
    </div>
  );
}
