"use client";

import { Archive, BarChart3, FileText, Menu, Package, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { copy } from "@/lib/copy";

/** Ikony po kluczu: komponent serwerowy nie może przekazać funkcji do komponentu klienckiego. */
export type IkonaMenu = "archiwum" | "raporty" | "faktury" | "pakiet" | "uslugi";
const IKONY: Record<IkonaMenu, LucideIcon> = { archiwum: Archive, raporty: BarChart3, faktury: FileText, pakiet: Package, uslugi: Sparkles };

export type PozycjaMenu = { href: string; etykieta: string; ikona: IkonaMenu; aktywna: boolean; biezaca: boolean };

/** Dolna nawigacja na telefonie mieści trzy pozycje; reszta sekcji (raporty, faktury, pakiet, usługi) w arkuszu „Więcej". */
export function WiecejMobile({ pozycje, token, podglad }: { pozycje: PozycjaMenu[]; token: string; podglad: boolean }) {
  const [otwarty, setOtwarty] = useState(false);
  const n = copy.nawigacja;
  const cokolwiekBiezace = pozycje.some((p) => p.biezaca);
  return (
    <>
      <button type="button" onClick={() => setOtwarty(true)} className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium ${cokolwiekBiezace ? "text-fiolet-700" : "text-szary-600"}`} aria-haspopup="dialog" data-wiecej>
        <Menu className="size-5" aria-hidden />
        <span className="truncate">{n.wiecej}</span>
      </button>
      <Sheet open={otwarty} onOpenChange={setOtwarty}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle className="font-naglowek text-lg">{n.wiecejTytul}</SheetTitle>
          </SheetHeader>
          <nav className="mt-2 space-y-1 px-4" data-wiecej-lista>
            {pozycje.map(({ href, etykieta, ikona, aktywna, biezaca }) => {
              const Ikona = IKONY[ikona];
              return aktywna ? (
                <Link key={href} href={href} onClick={() => setOtwarty(false)} aria-current={biezaca ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${biezaca ? "bg-fiolet-050 text-fiolet-700" : "text-foodie-czern hover:bg-szary-050"}`}>
                  <Ikona className="size-5" aria-hidden />
                  {etykieta}
                </Link>
              ) : (
                <span key={href} aria-disabled className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-szary-600">
                  <Ikona className="size-5 opacity-60" aria-hidden />
                  <span className="flex-1">{etykieta}</span>
                  <span className="text-xs text-szary-300">{n.wkrotce}</span>
                </span>
              );
            })}
            {podglad ? (
              <span className="block px-3 py-3 text-sm text-szary-600">{copy.podgladKlienta.zalogowanyJako}</span>
            ) : (
              <form action={`/p/${token}/wyloguj`} method="post">
                <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-foodie-fiolet hover:bg-szary-050">
                  <span className="size-5 rounded-full border border-szary-300" aria-hidden />
                  {n.wyloguj}
                </button>
              </form>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
