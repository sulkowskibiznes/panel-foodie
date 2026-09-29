"use client";

import { useActionState } from "react";
import { Sygnet } from "@/components/marka/sygnet";
import { copy } from "@/lib/copy";

type Stan = { blad?: string };
type Akcja = (poprzedni: Stan, formData: FormData) => Promise<Stan>;

const POLE =
  "mt-2 h-14 w-full rounded-xl border border-szary-300 bg-white px-4 text-center text-2xl tracking-[0.4em] text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30 aria-invalid:border-czerwony";

function PolePinu({ id, etykieta, blad, autoFocus, autoComplete }: { id: string; etykieta: string; blad: boolean; autoFocus?: boolean; autoComplete: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foodie-czern">
        {etykieta}
      </label>
      <input
        id={id}
        name={id}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        minLength={4}
        maxLength={6}
        aria-invalid={blad ? true : undefined}
        aria-describedby={blad ? "pin-blad" : "pin-wskazowka"}
        className={POLE}
      />
    </div>
  );
}

/**
 * Formularz własnego PIN-u (Etap 2 planu domknięcia): „ustaw" po kodzie startowym (osobny ekran bez nawigacji)
 * i „zmien" w panelu (obecny PIN, nowy, powtórzenie). Pola czyści React po każdej próbie, i dobrze: PIN-u nie trzymamy.
 */
export function FormularzPinu({ token, tryb, akcja }: { token: string; tryb: "ustaw" | "zmien"; akcja: Akcja }) {
  const [stan, wykonaj, trwa] = useActionState(akcja, {});
  const t = tryb === "ustaw" ? copy.ustawPin : copy.zmianaPinu;
  const formularz = (
    <form action={wykonaj} className="mt-6 space-y-5" data-formularz-pinu={tryb}>
      <input type="hidden" name="token" value={token} />
      {tryb === "zmien" ? <PolePinu id="obecny" etykieta={copy.zmianaPinu.obecny} blad={!!stan.blad} autoFocus autoComplete="current-password" /> : null}
      <PolePinu id="pin" etykieta={copy.ustawPin.nowy} blad={!!stan.blad} autoFocus={tryb === "ustaw"} autoComplete="new-password" />
      <PolePinu id="powtorz" etykieta={copy.ustawPin.powtorz} blad={!!stan.blad} autoComplete="new-password" />
      <p id="pin-wskazowka" className="text-sm leading-6 text-szary-600">
        {copy.ustawPin.wskazowka}
      </p>
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
        {trwa ? t.trwa : t.przycisk}
      </button>
    </form>
  );

  if (tryb === "zmien") {
    return (
      <section className="rounded-xl bg-white p-6 shadow-miekki sm:p-8">
        <h1 className="font-naglowek text-2xl text-foodie-czern">{t.tytul}</h1>
        <p className="mt-2 text-base leading-7 text-szary-600">{t.opis}</p>
        {formularz}
      </section>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-szary-050">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <div className="rounded-xl bg-white p-6 shadow-miekki sm:p-8">
          <Sygnet rozmiar={40} />
          <p className="mt-5 text-sm font-medium text-szary-600">{copy.marka.panel}</p>
          <h1 className="mt-1 font-naglowek text-2xl text-foodie-czern">{t.tytul}</h1>
          <p className="mt-2 text-base leading-7 text-szary-600">{t.opis}</p>
          {formularz}
        </div>
        <p className="mt-6 text-center text-sm text-szary-600">{copy.start.pomoc}</p>
      </main>
    </div>
  );
}
