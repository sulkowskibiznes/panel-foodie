import Link from "next/link";
import type { ReactNode } from "react";
import { Sygnet } from "@/components/marka/sygnet";
import { Toaster } from "@/components/ui/sonner";
import type { CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { maUprawnienie } from "@/lib/uprawnienia";

const KLASA_LINKU = "font-medium hover:text-foodie-fiolet aria-[current=page]:text-foodie-fiolet aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8";

/**
 * Nagłówek panelu zespołu: Pulpit, Skrzynka uwag, Ustawienia (admin, z zakładkami) i aktywna pozycja (`aria-current`).
 * Toaster pokazuje skutki akcji (plan domknięcia, Etap 3a); panel jest wyłącznie jasny (bez trybu ciemnego w MVP).
 */
export function UkladZespolu({ czlonek, nieprzeczytaneUwagi = 0, sciezka, children }: { czlonek: CzlonekZespolu; nieprzeczytaneUwagi?: number; sciezka: string; children: ReactNode }) {
  const n = copy.zespol.nawigacja;
  const biezaca = (href: string, dokladnie = false) => (dokladnie ? sciezka === href : sciezka === href || sciezka.startsWith(`${href}/`));
  const aktualna = (tu: boolean) => (tu ? ("page" as const) : undefined);
  return (
    <div className="flex min-h-full flex-1 flex-col bg-szary-050">
      <header className="border-b border-szary-100 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/zespol" className="flex items-center gap-3" aria-label={copy.marka.panelZespolu}>
            <Sygnet rozmiar={28} />
            <span className="font-naglowek text-base text-foodie-czern">{copy.marka.panelZespolu}</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-foodie-czern" aria-label={copy.marka.panelZespolu}>
            <Link href="/zespol" className={KLASA_LINKU} aria-current={aktualna(biezaca("/zespol", true))} data-link-pulpitu>
              {n.pulpit}
            </Link>
            {maUprawnienie(czlonek.role, "materialy", "podglad") ? (
              <Link href="/zespol/uwagi" className={`flex items-center gap-1.5 ${KLASA_LINKU}`} aria-current={aktualna(biezaca("/zespol/uwagi"))} data-link-skrzynki>
                {n.skrzynka}
                {nieprzeczytaneUwagi > 0 ? <span className="rounded-full bg-foodie-fiolet px-1.5 text-[11px] font-semibold text-white" data-nieprzeczytane-uwagi={nieprzeczytaneUwagi}>{nieprzeczytaneUwagi}</span> : null}
              </Link>
            ) : null}
            {maUprawnienie(czlonek.role, "ustawienia", "pelne") ? (
              <Link href="/zespol/ustawienia" className={KLASA_LINKU} aria-current={aktualna(biezaca("/zespol/ustawienia"))} data-link-ustawien>
                {n.ustawienia}
              </Link>
            ) : null}
          </nav>
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
