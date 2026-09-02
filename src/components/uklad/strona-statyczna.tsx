import Link from "next/link";
import type { ReactNode } from "react";
import { Sygnet } from "@/components/marka/sygnet";
import { copy } from "@/lib/copy";

/** Wspólny układ stron publicznych: start, regulamin, polityka prywatności, 404. Mobile first. */
export function StronaStatyczna({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-szary-050">
      <header className="border-b border-szary-100 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 py-4">
          <Link href="/" className="flex items-center gap-3" aria-label={copy.marka.nazwa}>
            <Sygnet rozmiar={32} />
            <span className="font-naglowek text-lg text-foodie-czern">{copy.marka.nazwa}</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-12">{children}</main>
      <footer className="border-t border-szary-100 bg-white">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-5 text-sm text-szary-600">
          <span>{copy.stopka.prawa}</span>
          <Link href="/regulamin" className="hover:text-foodie-fiolet">
            {copy.stopka.regulamin}
          </Link>
          <Link href="/prywatnosc" className="hover:text-foodie-fiolet">
            {copy.stopka.prywatnosc}
          </Link>
        </div>
      </footer>
    </div>
  );
}
