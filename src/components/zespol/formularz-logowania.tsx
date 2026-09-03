"use client";

import { useActionState, useState } from "react";
import { wyslijKod, zweryfikujKod, type StanLogowania } from "@/app/zespol/logowanie/akcje";
import { Sygnet } from "@/components/marka/sygnet";
import { copy } from "@/lib/copy";

const POLE = "mt-2 h-12 w-full rounded-xl border border-szary-300 bg-white px-4 text-base text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30";
const PRZYCISK = "inline-flex h-12 w-full items-center justify-center rounded-xl bg-foodie-fiolet px-6 text-base font-medium text-white hover:bg-fiolet-600 disabled:opacity-60";

/** Dwa kroki: adres e-mail, potem sześciocyfrowy kod. Odpowiedź na krok 1 nie zdradza, czy adres jest na liście. */
export function FormularzLogowania({ odmowa = false }: { odmowa?: boolean }) {
  const [stanEmail, wyslij, trwaWysylka] = useActionState<StanLogowania, FormData>(wyslijKod, { etap: "email" });
  const [stanKod, zweryfikuj, trwaWeryfikacja] = useActionState<StanLogowania, FormData>(zweryfikujKod, { etap: "kod" });
  const [innyAdres, setInnyAdres] = useState(false);
  const l = copy.zespol.logowanie;
  const etapKodu = stanEmail.etap === "kod" && !innyAdres && stanKod.etap !== "email";
  const email = stanKod.email ?? stanEmail.email ?? "";

  return (
    <div className="flex min-h-full flex-1 flex-col bg-szary-050">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <div className="rounded-xl bg-white p-6 shadow-miekki sm:p-8">
          <Sygnet rozmiar={40} />
          <h1 className="mt-5 font-naglowek text-2xl text-foodie-czern">{l.tytul}</h1>
          <p className="mt-2 text-base leading-7 text-szary-600">{l.opis}</p>

          {!etapKodu ? (
            <form action={wyslij} className="mt-6 space-y-5" onSubmit={() => setInnyAdres(false)}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foodie-czern">{l.email}</label>
                <input id="email" name="email" type="email" autoComplete="email" required autoFocus defaultValue={email} className={POLE} />
              </div>
              {stanEmail.blad || stanKod.etap === "email" ? (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm leading-6 text-czerwony">{stanEmail.blad ?? stanKod.blad}</p>
              ) : odmowa ? (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm leading-6 text-czerwony">{l.brakDostepu}</p>
              ) : null}
              <button type="submit" disabled={trwaWysylka} className={PRZYCISK}>{trwaWysylka ? l.wysylanie : l.wyslijKod}</button>
            </form>
          ) : (
            <form action={zweryfikuj} className="mt-6 space-y-5">
              <input type="hidden" name="email" value={email} />
              <p className="rounded-lg bg-fiolet-050 px-3 py-2 text-sm leading-6 text-fiolet-700">{stanEmail.info}</p>
              <div>
                <label htmlFor="kod" className="block text-sm font-medium text-foodie-czern">{l.kod}</label>
                <input id="kod" name="kod" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus className={`${POLE} text-center text-2xl tracking-[0.3em]`} />
              </div>
              {stanKod.blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm leading-6 text-czerwony">{stanKod.blad}</p> : null}
              <button type="submit" disabled={trwaWeryfikacja} className={PRZYCISK}>{trwaWeryfikacja ? l.sprawdzanie : l.zaloguj}</button>
              <button type="button" onClick={() => setInnyAdres(true)} className="w-full text-sm font-medium text-foodie-fiolet hover:underline">{l.innyAdres}</button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
