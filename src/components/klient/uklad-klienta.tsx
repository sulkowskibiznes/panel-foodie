import { BarChart3, CalendarDays, FileText, Home, Inbox, Package, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { WiecejMobile, type IkonaMenu } from "@/components/klient/wiecej-mobile";
import { Sygnet } from "@/components/marka/sygnet";
import { copy } from "@/lib/copy";

/**
 * Układ panelu klienta (SPEC rozdz. 5): dolna nawigacja na telefonie (trzy pozycje plus „Więcej"), boczna na desktopie.
 * Branding wyłącznie Foodie Media; nazwa klienta tylko tekstem. Wdrożenie nie ma pozycji w nawigacji (rozdz. 11).
 */
export function UkladKlienta({ token, nazwaKlienta, etykietaOsoby, sciezka, podglad = false, children }: { token: string; nazwaKlienta: string; etykietaOsoby: string; sciezka: string; podglad?: boolean; children: ReactNode }) {
  const baza = `/p/${token}`;
  const biezaca = (href: string) => sciezka === href || sciezka.startsWith(`${href}/`);
  const glowne = [
    { href: `${baza}/start`, etykieta: copy.nawigacja.start, Ikona: Home },
    { href: `${baza}/materialy`, etykieta: copy.nawigacja.materialy, Ikona: Inbox },
    { href: `${baza}/harmonogram`, etykieta: copy.nawigacja.harmonogram, Ikona: CalendarDays },
  ].map((p) => ({ ...p, biezaca: biezaca(p.href) }));
  // Pozostałe sekcje idą też do arkusza „Więcej" (komponent kliencki), więc ikona jest kluczem, nie funkcją.
  // Bez pozycji „wkrótce": Archiwum wraca do menu, gdy powstanie (plan domknięcia, Etap 4).
  const pozostaleZrodlo: Array<{ href: string; etykieta: string; ikona: IkonaMenu }> = [
    { href: `${baza}/raporty`, etykieta: copy.nawigacja.raporty, ikona: "raporty" },
    { href: `${baza}/faktury`, etykieta: copy.nawigacja.faktury, ikona: "faktury" },
    { href: `${baza}/pakiet`, etykieta: copy.nawigacja.pakiet, ikona: "pakiet" },
    { href: `${baza}/uslugi`, etykieta: copy.nawigacja.uslugi, ikona: "uslugi" },
  ];
  const pozostale = pozostaleZrodlo.map((p) => ({ ...p, biezaca: biezaca(p.href) }));
  const IKONY: Record<IkonaMenu, typeof Home> = { raporty: BarChart3, faktury: FileText, pakiet: Package, uslugi: Sparkles };
  const pozycje = [...glowne, ...pozostale.map((p) => ({ ...p, Ikona: IKONY[p.ikona] }))];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-szary-050 lg:flex-row">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-szary-100 bg-white lg:flex">
        <div className="flex items-center gap-3 px-6 py-5">
          <Sygnet rozmiar={32} />
          <span className="font-naglowek text-lg text-foodie-czern">{copy.marka.nazwa}</span>
        </div>
        <nav aria-label={copy.marka.panel} className="flex-1 space-y-1 px-3">
          {pozycje.map(({ href, etykieta, Ikona, biezaca: tu }) => (
            <Link key={href} href={href} aria-current={tu ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${tu ? "bg-fiolet-050 text-fiolet-700" : "text-foodie-czern hover:bg-szary-050"}`}>
              <Ikona className="size-5" aria-hidden />
              {etykieta}
            </Link>
          ))}
        </nav>
        <StopkaSesji token={token} nazwaKlienta={nazwaKlienta} etykietaOsoby={etykietaOsoby} podglad={podglad} />
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
        <nav aria-label={copy.marka.panel} className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-szary-100 bg-white lg:hidden" data-nawigacja-dolna>
          {glowne.map(({ href, etykieta, Ikona, biezaca: tu }) => (
            <Link key={href} href={href} aria-current={tu ? "page" : undefined} className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium ${tu ? "text-fiolet-700" : "text-szary-600"}`}>
              <Ikona className="size-5" aria-hidden />
              <span className="truncate">{etykieta}</span>
            </Link>
          ))}
          <WiecejMobile pozycje={pozostale} token={token} podglad={podglad} />
        </nav>
      </div>
    </div>
  );
}

function StopkaSesji({ token, nazwaKlienta, etykietaOsoby, podglad }: { token: string; nazwaKlienta: string; etykietaOsoby: string; podglad: boolean }) {
  return (
    <div className="border-t border-szary-100 px-6 py-4 text-sm">
      <p className="font-medium text-foodie-czern">{nazwaKlienta}</p>
      <p className="text-szary-600">
        {podglad ? copy.podgladKlienta.zalogowanyJako : copy.nawigacja.zalogowanyJako} {etykietaOsoby}
      </p>
      {podglad ? null : (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={`/p/${token}/pin`} className="text-sm font-medium text-foodie-fiolet hover:underline" data-zmien-pin>
            {copy.nawigacja.zmienPin}
          </Link>
          <form action={`/p/${token}/wyloguj`} method="post">
            <button type="submit" className="text-sm font-medium text-foodie-fiolet hover:underline">
              {copy.nawigacja.wyloguj}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
