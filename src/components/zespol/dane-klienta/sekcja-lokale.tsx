"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { przygotujAwatar, zapiszAwatar, zapiszLokalKlienta } from "@/app/zespol/(panel)/klienci/[slug]/ustawienia/dane-akcje";
import { Button } from "@/components/ui/button";
import { Pole, POLE, Sekcja, StanZapisu, useZapis } from "@/components/zespol/dane-klienta/wspolne";
import { wyslijDoStorage } from "@/components/zespol/materialy/use-upload-pliku";
import { copy } from "@/lib/copy";
import type { DaneKlientaZespolu, LokalKlienta } from "@/lib/dane/dane-klienta";

const MAKS_BAJTOW = 5 * 1024 * 1024;
const RODZAJE = ["image/jpeg", "image/png", "image/webp"];

/** Zdjęcie profilowe strony do ramki podglądu (plan 1.4): pozwolenie, PUT do Storage, sprawdzenie na serwerze. */
function ZdjecieLokalu({ slug, lokal }: { slug: string; lokal: LokalKlienta }) {
  const router = useRouter();
  const plik = useRef<HTMLInputElement>(null);
  const [trwa, startTransition] = useTransition();
  const [blad, setBlad] = useState<string | null>(null);
  const t = copy.zespol.daneKlienta.lokale;

  function wybrano(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBlad(null);
    if (!RODZAJE.includes(f.type)) return setBlad(t.zdjecieBledy.nieobslugiwany);
    if (f.size > MAKS_BAJTOW) return setBlad(t.zdjecieBledy.zaDuzy.replace("{limit}", "5 MB"));
    startTransition(async () => {
      const p = await przygotujAwatar(slug, lokal.id, { mime: f.type, bytes: f.size });
      if (!p.ok) return setBlad(p.powod === "zaDuzy" ? t.zdjecieBledy.zaDuzy.replace("{limit}", p.limit ?? "5 MB") : t.zdjecieBledy.nieobslugiwany);
      if (!(await wyslijDoStorage(p.signedUrl, f, () => undefined))) return setBlad(t.zdjecieBledy.wysylka);
      const w = await zapiszAwatar(slug, lokal.id, p.pozwolenie);
      if (!w.ok) return setBlad(w.blad);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3" data-zdjecie-lokalu={lokal.id}>
      {lokal.wersjaAwatara ? (
        // Zdjęcie przez trasę zespołu (signed URL po sprawdzeniu dostępu); `v` omija pamięć przeglądarki po podmianie.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/zespol/awatar/${lokal.id}?v=${lokal.wersjaAwatara}`} alt="" width={48} height={48} className="size-12 rounded-full border border-szary-100 object-cover" data-awatar-lokalu />
      ) : (
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-szary-100 text-xs text-szary-600">{t.zdjecieBrak}</span>
      )}
      <input ref={plik} type="file" accept={RODZAJE.join(",")} className="sr-only" onChange={wybrano} data-plik-zdjecia={lokal.id} aria-label={t.zdjecie} />
      <Button type="button" variant="outline" size="sm" disabled={trwa} onClick={() => plik.current?.click()}>
        {trwa ? t.zdjecieWysylanie : lokal.wersjaAwatara ? t.zdjecieZmien : t.zdjecieWybierz}
      </Button>
      {blad ? <p role="alert" className="w-full text-sm text-czerwony">{blad}</p> : null}
    </div>
  );
}

function FormularzLokalu({ slug, lokal, kat1ZRaportami, onKoniec }: { slug: string; lokal: LokalKlienta | null; kat1ZRaportami: boolean; onKoniec: () => void }) {
  const { trwa, blad, zapisano, wyslij } = useZapis((fd) => zapiszLokalKlienta(slug, lokal?.id ?? null, fd), onKoniec);
  const t = copy.zespol.nowyKlient.lokale;
  const d = copy.zespol.daneKlienta;
  const id = lokal?.id ?? "nowy";
  return (
    <form onSubmit={wyslij} className="space-y-3 rounded-lg border border-szary-100 p-3" data-formularz-lokalu={id}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Pole id={`lokal-${id}-name`} etykieta={t.nazwa}>
          <input id={`lokal-${id}-name`} name="name" required maxLength={120} defaultValue={lokal?.name ?? ""} className={POLE} />
        </Pole>
        <Pole id={`lokal-${id}-city`} etykieta={t.miasto}>
          <input id={`lokal-${id}-city`} name="city" maxLength={80} defaultValue={lokal?.city ?? ""} className={POLE} />
        </Pole>
        <Pole id={`lokal-${id}-fb`} etykieta={t.fb}>
          <input id={`lokal-${id}-fb`} name="fb_page_name" required maxLength={120} defaultValue={lokal?.fb_page_name ?? ""} className={POLE} />
        </Pole>
        <Pole id={`lokal-${id}-ig`} etykieta={t.ig} podpowiedz={t.igPodpowiedz}>
          <input id={`lokal-${id}-ig`} name="ig_handle" maxLength={60} defaultValue={lokal?.ig_handle ?? ""} className={POLE} />
        </Pole>
        <Pole id={`lokal-${id}-adres`} etykieta={d.lokale.adres}>
          <input id={`lokal-${id}-adres`} name="address" maxLength={200} defaultValue={lokal?.address ?? ""} className={POLE} />
        </Pole>
      </div>
      {lokal && kat1ZRaportami ? <p className="text-xs text-bursztyn">{d.lokale.zmianaNazwyKat1}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" disabled={trwa} data-zapisz-lokal>
          {trwa ? d.zapisywanie : d.zapisz}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={onKoniec}>
          {d.anuluj}
        </Button>
        <StanZapisu blad={blad} zapisano={zapisano} />
      </div>
    </form>
  );
}

/** Lokale klienta (plan 1.3): zmiana nazwy strony FB i nicku IG naprawia podglądy 1:1, dodanie przelicza lokale dodatkowe. */
export function SekcjaLokale({ slug, klient }: { slug: string; klient: DaneKlientaZespolu }) {
  const [edytowany, setEdytowany] = useState<string | null>(null);
  const t = copy.zespol.daneKlienta.lokale;
  const kat1ZRaportami = klient.category === "kat1" && !klient.mozeZmienicKategorie;
  return (
    <Sekcja tytul={t.tytul} opis={t.opis} dane="lokale">
      <ul className="space-y-3">
        {klient.lokale.map((l) => (
          <li key={l.id} className="space-y-3 rounded-lg border border-szary-100 p-3" data-lokal={l.id}>
            {edytowany === l.id ? (
              <FormularzLokalu slug={slug} lokal={l} kat1ZRaportami={kat1ZRaportami} onKoniec={() => setEdytowany(null)} />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-medium text-foodie-czern">{l.name}{l.city ? <span className="text-szary-600"> · {l.city}</span> : null}</p>
                  <p className="text-szary-600">
                    {copy.zespol.nowyKlient.lokale.fb}: {l.fb_page_name} · {l.ig_handle ? `@${l.ig_handle}` : t.brakIg}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setEdytowany(l.id)} data-edytuj-lokal={l.id}>
                  {copy.zespol.daneKlienta.edytuj}
                </Button>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-szary-600">{t.zdjecie}</p>
              <p className="text-xs text-szary-600">{t.zdjecieOpis}</p>
              <div className="mt-2">
                <ZdjecieLokalu slug={slug} lokal={l} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        {edytowany === "nowy" ? (
          <FormularzLokalu slug={slug} lokal={null} kat1ZRaportami={false} onKoniec={() => setEdytowany(null)} />
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setEdytowany("nowy")} data-dodaj-lokal>
            {t.dodaj}
          </Button>
        )}
      </div>
    </Sekcja>
  );
}
