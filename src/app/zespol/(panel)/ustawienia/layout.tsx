import type { ReactNode } from "react";
import { ZakladkiUstawien } from "@/components/zespol/ustawienia/zakladki-ustawien";
import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";

/** Ustawienia (wyłącznie admin, SPEC rozdz. 2): jeden nagłówek i zakładki; każda strona sprawdza uprawnienie jeszcze raz. */
export default async function UkladUstawien({ children }: { children: ReactNode }) {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "ustawienia", "pelne");
  return (
    <div>
      <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{copy.zespol.ustawienia.tytul}</h1>
      <ZakladkiUstawien />
      <div className="mt-6">{children}</div>
    </div>
  );
}
