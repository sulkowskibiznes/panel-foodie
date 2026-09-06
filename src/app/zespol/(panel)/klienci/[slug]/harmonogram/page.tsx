import Link from "next/link";
import { notFound } from "next/navigation";
import { KalendarzZespolu } from "@/components/harmonogram/kalendarz-zespolu";
import { UstawieniaHarmonogramu } from "@/components/harmonogram/ustawienia-harmonogramu";
import { KLASA_STATUSU, NawigacjaOkresu } from "@/components/harmonogram/wspolne";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { domyslnyPakiet, pobierzHarmonogramOkresu } from "@/lib/dane/harmonogram";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { etykietaOkresu } from "@/lib/format";
import { maUprawnienie } from "@/lib/uprawnienia";
import { czyUuid } from "@/lib/walidacja";
import { przesunMaterialAkcja, zapiszUstawieniaHarmonogramu } from "./akcje";

/** Zakładka Harmonogram (SPEC rozdz. 8, 12.2): widok okresu pakietu (`?p=`) z przeciąganiem dla ról z prawem edycji, podgląd dla reszty. */
export default async function HarmonogramZespolu({ params, searchParams }: PageProps<"/zespol/klienci/[slug]/harmonogram">) {
  const { slug } = await params;
  const { p } = await searchParams;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "harmonogram", "podglad");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const zadany = typeof p === "string" && czyUuid(p) ? p : null;
  const pakietId = zadany ?? (await domyslnyPakiet(klient.id, { zeSzkicami: true }));
  const harmonogram = pakietId
    ? await pobierzHarmonogramOkresu(klient.id, pakietId, { zeSzkicami: true, adresy: { plik: (id, wariant) => `/zespol/plik/${id}/${wariant}`, awatar: (id) => `/zespol/awatar/${id}` } })
    : null;
  if (zadany && !harmonogram) notFound();
  const h = copy.zespol.harmonogram;
  const mozeEdytowac = maUprawnienie(czlonek.role, "harmonogram", "pelne");
  const baza = `/zespol/klienci/${slug}/harmonogram`;

  return (
    <div className="space-y-4" data-harmonogram-zespolu>
      <section className="rounded-xl bg-white p-4 shadow-miekki sm:p-5">
        <h2 className="font-naglowek text-xl text-foodie-czern">{h.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{h.opis}</p>
        {harmonogram ? (
          <>
            <div className="mt-4">
              <NawigacjaOkresu okres={harmonogram.pakiet.okres} baza={baza} poprzedniId={harmonogram.nawigacja.poprzedniId} nastepnyId={harmonogram.nawigacja.nastepnyId} poprzedni={h.poprzedni} nastepny={h.nastepny} />
            </div>
            <ul className="mt-3 flex flex-wrap gap-2 text-xs">
              {harmonogram.pakiety.map((pk) => (
                <li key={pk.id} className={`rounded-full border px-2 py-0.5 ${KLASA_STATUSU[pk.status]}`} data-pakiet-w-widoku={pk.id}>
                  <Link href={`/zespol/klienci/${slug}/pakiety/${pk.id}`} className="hover:underline">
                    {h.pakiet}: {pk.tytul}
                    {pk.nazwaLokalu ? ` (${pk.nazwaLokalu})` : ""} · {etykietaOkresu(pk.okres.od, pk.okres.do)} · {copy.materialy.status[pk.status]}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-szary-600" data-brak-pakietow>{h.brakPakietow}</p>
        )}
      </section>
      {harmonogram ? (
        <>
          <KalendarzZespolu key={harmonogram.pakiet.id} harmonogram={harmonogram} przesun={mozeEdytowac ? przesunMaterialAkcja.bind(null, slug) : async () => ({ ok: false as const, blad: copy.przejscia.odmowa.niewlasciwy_aktor })} />
          <section className="rounded-xl bg-white p-4 shadow-miekki sm:p-5" data-kampanie-harmonogramu>
            <h3 className="font-naglowek text-base text-foodie-czern">{h.kampanie}</h3>
            {harmonogram.kampanie.length === 0 ? (
              <p className="mt-2 text-sm text-szary-600">{h.bezKampanii}</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {harmonogram.kampanie.map((k) => (
                  <li key={k.id} className={`rounded-lg border px-3 py-1.5 ${KLASA_STATUSU[k.statusPakietu]}`}>
                    <Link href={`/zespol/klienci/${slug}/pakiety/${k.pakietId}#kampania-${k.id}`} className="hover:underline">
                      {k.nazwa}
                      {k.cel ? ` · ${copy.podglad.cele[k.cel]}` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {mozeEdytowac ? <UstawieniaHarmonogramu key={`ustawienia-${harmonogram.pakiet.id}`} pakiety={harmonogram.pakiety} godziny={harmonogram.domyslneGodziny} zapisz={zapiszUstawieniaHarmonogramu.bind(null, slug)} /> : null}
        </>
      ) : null}
    </div>
  );
}
