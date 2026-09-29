import { notFound } from "next/navigation";
import { SekcjaAkceptacja } from "@/components/zespol/dane-klienta/sekcja-akceptacja";
import { SekcjaDane } from "@/components/zespol/dane-klienta/sekcja-dane";
import { SekcjaKontakty } from "@/components/zespol/dane-klienta/sekcja-kontakty";
import { SekcjaLokale } from "@/components/zespol/dane-klienta/sekcja-lokale";
import { SekcjaZespol } from "@/components/zespol/dane-klienta/sekcja-zespol";
import { UsunDaneKlienta } from "@/components/zespol/ustawienia-klienta/usun-dane";
import { Wspolpraca } from "@/components/zespol/ustawienia-klienta/wspolpraca";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzDaneKlienta } from "@/lib/dane/dane-klienta";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { pobierzStanWspolpracy } from "@/lib/dane/offboarding";
import { maUprawnienie } from "@/lib/uprawnienia";

/**
 * Zakładka „Dane i współpraca" karty klienta (SPEC rozdz. 12.2, 17; plan domknięcia Etap 1): admin i csm poprawiają
 * dane, lokale ze zdjęciem profilowym, osoby kontaktowe, zespół klienta i akceptację; niżej przerwa, zakończenie
 * i usunięcie danych.
 */
export default async function UstawieniaKlienta({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "klienci", "pelne");
  const karta = await pobierzKlientaPoSlugu(slug);
  if (!karta) notFound();
  await assertTeamClientAccess(czlonek, karta.id);
  const [klient, stan] = await Promise.all([pobierzDaneKlienta(karta.id), pobierzStanWspolpracy(karta.id)]);
  if (!klient || !stan) notFound();
  const u = copy.zespol.ustawieniaKlienta;

  return (
    <div className="space-y-6" data-ustawienia-klienta>
      <SekcjaDane slug={slug} klient={klient} />
      <SekcjaLokale slug={slug} klient={klient} />
      <SekcjaKontakty slug={slug} klient={klient} />
      <SekcjaZespol slug={slug} klient={klient} />
      <SekcjaAkceptacja slug={slug} klient={klient} />
      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
        <h2 className="font-naglowek text-xl text-foodie-czern">{u.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{u.opis}</p>
        <div className="mt-4">
          <Wspolpraca slug={slug} nazwa={karta.name} stan={stan} />
        </div>
      </section>
      <section className="rounded-xl border border-red-100 bg-white p-5 shadow-miekki sm:p-6" data-usuwanie-danych>
        <h2 className="font-naglowek text-xl text-czerwony">{u.usuwanie.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{u.usuwanie.opis}</p>
        <div className="mt-4">
          {karta.demo ? (
            <p className="text-sm text-szary-600">{u.usuwanie.klientDemo}</p>
          ) : !maUprawnienie(czlonek.role, "ustawienia", "pelne") ? (
            <p className="text-sm text-szary-600" data-usuwanie-tylko-admin>{u.usuwanie.tylkoAdmin}</p>
          ) : stan.status !== "zakonczony" ? (
            <p className="text-sm text-szary-600" data-usuwanie-najpierw-zakoncz>{u.usuwanie.najpierwZakoncz}</p>
          ) : (
            <UsunDaneKlienta slug={slug} nazwa={karta.name} />
          )}
        </div>
      </section>
    </div>
  );
}
