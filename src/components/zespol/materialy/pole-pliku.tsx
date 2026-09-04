"use client";

import { copy } from "@/lib/copy";
import type { StanUploadu } from "@/components/zespol/materialy/use-upload-pliku";

/** Pole wyboru pliku z paskiem postępu i komunikatami z trzech kroków uploadu. */
export function PolePliku({ id, stan, onPlik, etykieta, wideo = true }: { id: string; stan: StanUploadu; onPlik: (plik: File) => void; etykieta?: string; wideo?: boolean }) {
  const u = copy.zespol.materialy.upload;
  const zajete = stan.faza === "wysylanie" || stan.faza === "sprawdzanie";
  const accept = wideo ? "image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime" : "image/jpeg,image/png,image/webp,image/heic";
  return (
    <div className="space-y-2" data-pole-pliku>
      <label htmlFor={id} className="block text-sm font-medium text-foodie-czern">
        {etykieta ?? u.wybierz}
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={zajete}
        onChange={(e) => {
          const plik = e.target.files?.[0];
          if (plik) onPlik(plik);
        }}
        className="block w-full text-sm text-foodie-czern file:mr-3 file:rounded-lg file:border file:border-szary-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foodie-czern hover:file:bg-szary-050"
      />
      <p className="text-xs text-szary-600">{u.formaty}</p>
      {stan.faza === "wysylanie" ? (
        <div data-postep-uploadu>
          <p className="text-xs text-szary-600">{u.wysylanie.replace("{procent}", String(stan.procent))}</p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-szary-100">
            <div className="h-full bg-foodie-fiolet transition-[width]" style={{ width: `${stan.procent}%` }} />
          </div>
        </div>
      ) : null}
      {stan.faza === "sprawdzanie" ? <p className="text-xs text-szary-600">{u.sprawdzanie}</p> : null}
      {stan.faza === "gotowy" ? (
        <div data-plik-gotowy>
          <p className="text-xs font-medium text-zielony">{u.gotowy.replace("{nazwa}", stan.nazwa)}</p>
          {stan.ostrzezenia.map((o) => (
            <p key={o} className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-bursztyn">
              {o}
            </p>
          ))}
        </div>
      ) : null}
      {stan.faza === "blad" ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-czerwony">
          {stan.komunikat}
        </p>
      ) : null}
    </div>
  );
}
