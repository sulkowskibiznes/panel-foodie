import Link from "next/link";
import type { ReactNode } from "react";
import { Sygnet } from "@/components/marka/sygnet";
import type { CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { maUprawnienie } from "@/lib/uprawnienia";

export function UkladZespolu({ czlonek, children }: { czlonek: CzlonekZespolu; children: ReactNode }) {
  const n = copy.zespol.nawigacja;
  return (
    <div className="flex min-h-full flex-1 flex-col bg-szary-050">
      <header className="border-b border-szary-100 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/zespol" className="flex items-center gap-3" aria-label={copy.marka.panelZespolu}>
            <Sygnet rozmiar={28} />
            <span className="font-naglowek text-base text-foodie-czern">{copy.marka.panelZespolu}</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm" aria-label={copy.marka.panelZespolu}>
            <Link href="/zespol" className="font-medium text-foodie-czern hover:text-foodie-fiolet">
              {n.pulpit}
            </Link>
            {maUprawnienie(czlonek.role, "ustawienia", "pelne") ? (
              <Link href="/zespol/ustawienia/zespol" className="font-medium text-foodie-czern hover:text-foodie-fiolet">
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
    </div>
  );
}
