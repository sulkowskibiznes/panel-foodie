import { Archive, BarChart3, CalendarDays, FileText, Home, Inbox, Package, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Sygnet } from "@/components/marka/sygnet";
import { copy } from "@/lib/copy";

/**
 * Układ panelu klienta (SPEC rozdz. 5): dolna nawigacja na telefonie, boczna na desktopie.
 * Branding wyłącznie Foodie Media; nazwa klienta tylko tekstem.
 */
export function UkladKlienta({ token, nazwaKlienta, etykietaOsoby, sciezka, children }: { token: string; nazwaKlienta: string; etykietaOsoby: string; sciezka: string; children: ReactNode }) {
  const baza = `/p/${token}`;
  const biezaca = (href: string) => sciezka === href || sciezka.startsWith(`${href}/`);
  const pozycje = [
    { href: `${baza}/start`, etykieta: copy.nawigacja.start, Ikona: Home, aktywna: true },
    { href: `${baza}/materialy`, etykieta: copy.nawigacja.materialy, Ikona: Inbox, aktywna: true },
    { href: `${baza}/harmonogram`, etykieta: copy.nawigacja.harmonogram, Ikona: CalendarDays, aktywna: false },
    { href: `${baza}/archiwum`, etykieta: copy.nawigacja.archiwum, Ikona: Archive, aktywna: false },
    { href: `${baza}/raporty`, etykieta: copy.nawigacja.raporty, Ikona: BarChart3, aktywna: false },
    { href: `${baza}/faktury`, etykieta: copy.nawigacja.faktury, Ikona: FileText, aktywna: false },
    { href: `${baza}/pakiet`, etykieta: copy.nawigacja.pakiet, Ikona: Package, aktywna: false },
    { href: `${baza}/uslugi`, etykieta: copy.nawigacja.uslugi, Ikona: Sparkles, aktywna: false },
  ].map((p) => ({ ...p, biezaca: p.aktywna && biezaca(p.href) }));

  return (
    <div className="flex min-h-full flex-1 flex-col bg-szary-050 lg:flex-row">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-szary-100 bg-white lg:flex">
        <div className="flex items-center gap-3 px-6 py-5">
          <Sygnet rozmiar={32} />
          <span className="font-naglowek text-lg text-foodie-czern">{copy.marka.nazwa}</span>
        </div>
        <nav aria-label={copy.marka.panel} className="flex-1 space-y-1 px-3">
          {pozycje.map(({ href, etykieta, Ikona, aktywna, biezaca: tu }) =>
            aktywna ? (
              <Link key={href} href={href} aria-current={tu ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${tu ? "bg-fiolet-050 text-fiolet-700" : "text-foodie-czern hover:bg-szary-050"}`}>
                <Ikona className="size-5" aria-hidden />
                {etykieta}
              </Link>
            ) : (
              <span key={href} aria-disabled className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-szary-600">
                <Ikona className="size-5 opacity-60" aria-hidden />
                <span className="flex-1">{etykieta}</span>
                <span className="text-xs text-szary-300">{copy.nawigacja.wkrotce}</span>
              </span>
            ),
          )}
        </nav>
        <StopkaSesji token={token} nazwaKlienta={nazwaKlienta} etykietaOsoby={etykietaOsoby} />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-szary-100 bg-white px-5 py-4 lg:hidden">
          <div className="flex items-center gap-3">
            <Sygnet rozmiar={28} />
            <span className="font-naglowek text-base text-foodie-czern">{copy.marka.nazwa}</span>
          </div>
          <span className="truncate text-sm text-szary-600">{nazwaKlienta}</span>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 pb-24 sm:py-8 lg:pb-8">{children}</main>
        <nav aria-label={copy.marka.panel} className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-szary-100 bg-white lg:hidden">
          {pozycje.slice(0, 3).map(({ href, etykieta, Ikona, aktywna, biezaca: tu }) =>
            aktywna ? (
              <Link key={href} href={href} aria-current={tu ? "page" : undefined} className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium ${tu ? "text-fiolet-700" : "text-szary-600"}`}>
                <Ikona className="size-5" aria-hidden />
                <span className="truncate">{etykieta}</span>
              </Link>
            ) : (
              <span key={href} aria-disabled className="flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] text-szary-600">
                <Ikona className="size-5 opacity-60" aria-hidden />
                <span className="truncate">{etykieta}</span>
              </span>
            ),
          )}
          <form action={`${baza}/wyloguj`} method="post" className="contents">
            <button type="submit" className="flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] text-szary-600">
              <span className="size-5 rounded-full border border-szary-300" aria-hidden />
              {copy.nawigacja.wyloguj}
            </button>
          </form>
        </nav>
      </div>
    </div>
  );
}

function StopkaSesji({ token, nazwaKlienta, etykietaOsoby }: { token: string; nazwaKlienta: string; etykietaOsoby: string }) {
  return (
    <div className="border-t border-szary-100 px-6 py-4 text-sm">
      <p className="font-medium text-foodie-czern">{nazwaKlienta}</p>
      <p className="text-szary-600">
        {copy.nawigacja.zalogowanyJako} {etykietaOsoby}
      </p>
      <form action={`/p/${token}/wyloguj`} method="post" className="mt-3">
        <button type="submit" className="text-sm font-medium text-foodie-fiolet hover:underline">
          {copy.nawigacja.wyloguj}
        </button>
      </form>
    </div>
  );
}
