"use client";

import { useActionState } from "react";
import { dodajCzlonka, type StanCzlonka } from "@/app/zespol/(panel)/ustawienia/zespol/akcje";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

const POLE = "mt-1 h-11 w-full rounded-lg border border-szary-300 bg-white px-3 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30";

export function FormularzCzlonka() {
  const [stan, akcja, trwa] = useActionState<StanCzlonka, FormData>(dodajCzlonka, {});
  const u = copy.zespol.ustawienia.zespol;
  return (
    <form action={akcja} key={stan.ok ? "ok" : "form"} className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
      <h3 className="font-naglowek text-lg text-foodie-czern">{u.dodaj}</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foodie-czern">{u.imie}</label>
          <input id="name" name="name" required maxLength={80} className={POLE} />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foodie-czern">{u.email}</label>
          <input id="email" name="email" type="email" required className={POLE} />
        </div>
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-foodie-czern">{u.rola}</label>
          <select id="role" name="role" defaultValue="csm" className={POLE}>
            {(Object.keys(copy.zespol.role) as Array<keyof typeof copy.zespol.role>).map((r) => (
              <option key={r} value={r}>{copy.zespol.role[r]}</option>
            ))}
          </select>
        </div>
      </div>
      {stan.blad ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{stan.blad}</p> : null}
      <Button type="submit" size="lg" disabled={trwa} className="mt-4">{trwa ? u.dodawanie : u.dodaj}</Button>
    </form>
  );
}
