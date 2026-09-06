import { FormularzKlienta } from "@/components/zespol/klienci/formularz-klienta";
import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzOpiekunow } from "@/lib/dane/klienci-nowi";

/** „Nowy klient" (panel zespołu): dane z umowy, lokale, osoby kontaktowe. Admin i csm. */
export default async function NowyKlient() {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "klienci", "pelne");
  const opiekunowie = await pobierzOpiekunow();
  const t = copy.zespol.nowyKlient;
  return (
    <div className="space-y-6" data-nowy-klient>
      <div>
        <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{t.tytul}</h1>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{t.opis}</p>
      </div>
      <FormularzKlienta opiekunowie={opiekunowie} domyslnyOpiekunId={czlonek.role === "csm" ? czlonek.id : null} />
    </div>
  );
}
