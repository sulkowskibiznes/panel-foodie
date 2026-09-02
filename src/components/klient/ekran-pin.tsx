"use client";

import { useActionState } from "react";
import { zalogujPinem, type StanPin } from "@/app/p/[token]/akcje";
import { Sygnet } from "@/components/marka/sygnet";
import { copy } from "@/lib/copy";

const STAN_POCZATKOWY: StanPin = {};

/**
 * Ekran PIN (SPEC rozdz. 4.2). Mobile first: klawiatura numeryczna, duże pole, jeden przycisk.
 * Wygląda identycznie dla istniejącego i nieistniejącego linku.
 */
export function EkranPin({ token }: { token: string }) {
  const [stan, akcja, trwa] = useActionState(zalogujPinem, STAN_POCZATKOWY);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-szary-050">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <div className="rounded-xl bg-white p-6 shadow-miekki sm:p-8">
          <Sygnet rozmiar={40} />
          <p className="mt-5 text-sm font-medium text-szary-600">{copy.marka.panel}</p>
          <h1 className="mt-1 font-naglowek text-2xl text-foodie-czern">{copy.pin.tytul}</h1>
          <p className="mt-2 text-base leading-7 text-szary-600">{copy.pin.opis}</p>
          <form action={akcja} className="mt-6 space-y-5">
            <input type="hidden" name="token" value={token} />
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-foodie-czern">
                {copy.pin.etykieta}
              </label>
              <input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                minLength={4}
                maxLength={12}
                aria-invalid={stan.blad ? true : undefined}
                aria-describedby={stan.blad ? "pin-blad" : undefined}
                className="mt-2 h-14 w-full rounded-xl border border-szary-300 bg-white px-4 text-center text-2xl tracking-[0.4em] text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30 aria-invalid:border-czerwony"
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-foodie-czern">
              <input type="checkbox" name="zapamietaj" defaultChecked className="size-5 accent-foodie-fiolet" />
              {copy.pin.zapamietaj}
            </label>
            {stan.blad ? (
              <p id="pin-blad" role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm leading-6 text-czerwony">
                {stan.blad}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={trwa}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-foodie-fiolet px-6 text-base font-medium text-white hover:bg-fiolet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foodie-fiolet disabled:opacity-60"
            >
              {trwa ? copy.pin.trwa : copy.pin.przycisk}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-szary-600">{copy.start.pomoc}</p>
      </main>
    </div>
  );
}
