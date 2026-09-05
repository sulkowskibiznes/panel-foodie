"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { POLE } from "@/components/zespol/materialy/typy";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { rozpoznajLinkDysku } from "@/lib/drive/linki";
import type { KartaWeryfikacyjna } from "@/lib/dto/import";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { etykietaOkresu, formatujDateCzas } from "@/lib/format";
import type { OstrzezenieFolderu } from "@/lib/import/ocena";

function wstaw(tekst: string, pola: Record<string, string | number>): string {
  return Object.entries(pola).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), tekst);
}

function TrescOstrzezenia({ o }: { o: OstrzezenieFolderu }) {
  const t = copy.zespol.import.karta.ostrzezenie;
  switch (o.kod) {
    case "klient":
      return <>{wstaw(t.klient, { folder: o.folder, klient: o.klient })}</>;
    case "miesiac":
      return <>{wstaw(t.miesiac, { wNazwie: o.wNazwie, oczekiwany: o.oczekiwany })}</>;
    case "miesiac_kalendarzowy":
      return <>{wstaw(t.miesiacKalendarzowy, { wNazwie: o.wNazwie, oczekiwany: o.oczekiwany })}</>;
    case "okres":
      return <>{wstaw(t.okres, { wNazwie: o.wNazwie, oczekiwany: o.oczekiwany })}</>;
    case "powtorny":
      return (
        <>
          {wstaw(t.powtorny, { tytul: o.uzycie.tytul, okres: etykietaOkresu(o.uzycie.okres.rok, o.uzycie.okres.miesiac), data: o.uzycie.zaimportowanoO ? wstaw(t.powtornyData, { data: formatujDateCzas(o.uzycie.zaimportowanoO) }) : "" })}{" "}
          <Link href={`/zespol/klienci/${o.uzycie.slug}/pakiety/${o.uzycie.pakietId}`} className="font-medium underline" data-link-poprzedniego-pakietu>
            {t.powtornyLink}
          </Link>
        </>
      );
    case "brak_podfolderow":
      return <>{t.brakPodfolderow}</>;
    case "pusty":
      return <>{t.pusty}</>;
    case "nieobslugiwane":
      return <>{wstaw(t.nieobslugiwane, { nazwy: o.nazwy.join(", ") })}</>;
    case "duze_wideo":
      return <>{wstaw(t.duzeWideo, { nazwy: o.nazwy.join(", ") })}</>;
  }
}

/**
 * Karta weryfikacyjna folderu (SPEC rozdz. 13.2): ścieżka, pliki, data, pierwsze nazwy, ostrzeżenia z checkboxem
 * „rozumiem" i blokada bez obejścia dla folderu spoza „Materiałów klientów". Link da się poprawić w miejscu.
 */
export function KartaWeryfikacyjnaWidok({ karta, zignorowane, onZignoruj, pominiety, onPomin, onZmienLink }: { karta: KartaWeryfikacyjna; zignorowane: boolean; onZignoruj: (v: boolean) => void; pominiety: boolean; onPomin: (v: boolean) => void; onZmienLink: (url: string | null) => Promise<WynikAkcji> }) {
  const t = copy.zespol.import.karta;
  const [edycja, setEdycja] = useState(karta.stan === "brak_linku");
  const [url, setUrl] = useState(karta.url ?? "");
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const link = url.trim() ? rozpoznajLinkDysku(url) : null;
  const tytul = karta.rodzaj === "content" ? t.content : wstaw(t.reklamy, { kampania: karta.kampaniaNazwa ?? "" });
  const klucz = karta.folderId ?? `${karta.rodzaj}-${karta.kampaniaId ?? "content"}`;

  function zapisz() {
    setBlad(null);
    startTransition(async () => {
      const w = await onZmienLink(url.trim() || null);
      if (!w.ok) setBlad(w.blad);
      else setEdycja(false);
    });
  }

  return (
    <section className={`rounded-xl bg-white p-5 shadow-miekki sm:p-6 ${pominiety ? "opacity-70" : ""}`} data-karta-weryfikacyjna={klucz} data-karta-stan={karta.stan} data-karta-rodzaj={karta.rodzaj}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-naglowek text-lg text-foodie-czern">{tytul}</h3>
        {karta.url ? (
          <a href={karta.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-foodie-fiolet hover:underline">{karta.url.replace(/^https:\/\//, "").slice(0, 60)}</a>
        ) : null}
      </div>

      {karta.stan === "brak_linku" && !edycja ? <p className="mt-2 text-sm text-szary-600">{t.brakLinku}</p> : null}
      {karta.stan === "nie_znaleziono" ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony" data-karta-blad="nie_znaleziono">{karta.blad?.rodzaj === "dysk" ? wstaw(t.bladDysku, { komunikat: karta.blad.komunikat }) : t.nieZnaleziono}</p>
      ) : null}
      {karta.stan === "zablokowany" ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-czerwony" data-karta-zablokowana>{t.zablokowany}</p>
      ) : null}

      {karta.stan === "ok" ? (
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-szary-600">{t.sciezka}</dt>
            <dd className="font-medium text-foodie-czern" data-karta-sciezka>{karta.sciezka.join(" / ")}</dd>
          </div>
          <div>
            <dt className="text-szary-600">{t.pliki}</dt>
            <dd className="text-foodie-czern" data-karta-pliki>
              {karta.liczbaPlikow} ({wstaw(t.plikiOpis, karta.typy)})
            </dd>
          </div>
          <div>
            <dt className="text-szary-600">{t.zmodyfikowano}</dt>
            <dd className="text-foodie-czern">{karta.zmodyfikowanoO ? formatujDateCzas(karta.zmodyfikowanoO) : "-"}</dd>
          </div>
          {karta.rodzaj === "content" ? (
            <div>
              <dt className="text-szary-600">{t.podfoldery}</dt>
              <dd className="text-foodie-czern">
                {t.posty}: {karta.podfoldery.posty ? "✓" : t.brakPodfolderu} · {t.relacje}: {karta.podfoldery.relacje ? "✓" : t.brakPodfolderu}
              </dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-szary-600">{t.pierwsze}</dt>
            <dd className="text-foodie-czern" data-karta-pierwsze>{karta.pierwszePliki.join(", ") || "-"}</dd>
          </div>
        </dl>
      ) : null}

      {karta.blad?.rodzaj === "limit" ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-czerwony" data-karta-blad="limit">{wstaw(t.bladLimitu, { nazwa: karta.blad.nazwa, waga: karta.blad.waga, limit: karta.blad.limit })}</p>
      ) : null}

      {karta.stan === "ok" && karta.ostrzezenia.length > 0 ? (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-bursztyn" data-karta-ostrzezenia>
          <p className="font-medium">{t.ostrzezenia}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {karta.ostrzezenia.map((o, i) => (
              <li key={i} data-karta-ostrzezenie={o.kod}>
                <TrescOstrzezenia o={o} />
              </li>
            ))}
          </ul>
          {!pominiety && !karta.blad ? (
            <label className="mt-2 flex items-center gap-2 text-sm font-medium text-foodie-czern">
              <input type="checkbox" checked={zignorowane} onChange={(e) => onZignoruj(e.target.checked)} className="size-4 accent-foodie-fiolet" data-ignoruj-ostrzezenia />
              {t.ignoruj}
            </label>
          ) : null}
        </div>
      ) : null}

      {pominiety ? <p className="mt-3 text-sm text-szary-600" data-karta-pominieta>{t.pominiety}</p> : null}

      {edycja ? (
        <div className="mt-3 space-y-2">
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value.slice(0, 500))} placeholder="https://drive.google.com/drive/folders/..." className={POLE} data-pole-linku-karty />
          <p className={`text-xs ${url && !link ? "text-czerwony" : "text-szary-600"}`}>{url ? (link ? copy.zespol.kreator.linkRozpoznany.replace("{id}", link.id) : copy.zespol.kreator.linkNierozpoznany) : copy.zespol.kreator.folderContentuOpis}</p>
          {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-czerwony">{blad}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={trwa || (!!url.trim() && !link)} onClick={zapisz} data-zapisz-link-karty>{t.zapiszLink}</Button>
            {karta.stan !== "brak_linku" ? (
              <Button type="button" size="sm" variant="ghost" disabled={trwa} onClick={() => { setEdycja(false); setUrl(karta.url ?? ""); }}>{t.anulujZmiane}</Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setEdycja(true)} data-zmien-link-karty>{t.zmienLink}</Button>
          {karta.stan === "ok" && !karta.blad ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onPomin(!pominiety)} data-pomin-folder>{pominiety ? t.przywroc : t.pomin}</Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
