import Link from "next/link";
import { notFound } from "next/navigation";
import { KalendarzZespolu } from "@/components/harmonogram/kalendarz-zespolu";
import { UstawieniaHarmonogramu } from "@/components/harmonogram/ustawienia-harmonogramu";
import { KLASA_STATUSU, NawigacjaMiesiaca } from "@/components/harmonogram/wspolne";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { domyslnyMiesiac, pobierzHarmonogram } from "@/lib/dane/harmonogram";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { parsujMiesiac } from "@/lib/harmonogram/kalendarz";
import { maUprawnienie } from "@/lib/uprawnienia";
import { przesunMaterialAkcja, zapiszUstawieniaHarmonogramu } from "./akcje";

/** Zakładka Harmonogram (SPEC rozdz. 8, 12.2): kalendarz z przeciąganiem dla ról z prawem edycji, podgląd dla reszty. */
export default async function HarmonogramZespolu({ params, searchParams }: PageProps<"/zespol/klienci/[slug]/harmonogram">) {
  const { slug } = await params;
  const { m } = await searchParams;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "harmonogram", "podglad");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const okres = parsujMiesiac(typeof m === "string" ? m : null) ?? (await domyslnyMiesiac(klient.id, { zeSzkicami: true }));
  const harmonogram = await pobierzHarmonogram(klient.id, okres.rok, okres.miesiac, {
    zeSzkicami: true,
    adresy: { plik: (id, wariant) => `/zespol/plik/${id}/${wariant}`, awatar: (id) => `/zespol/awatar/${id}` },
  });
  const h = copy.zespol.harmonogram;
  const mozeEdytowac = maUprawnienie(czlonek.role, "harmonogram", "pelne");
  const baza = `/zespol/klienci/${slug}/harmonogram`;

  return (
    <div className="space-y-4" data-harmonogram-zespolu>
      <section className="rounded-xl bg-white p-4 shadow-miekki sm:p-5">
        <h2 className="font-naglowek text-xl text-foodie-czern">{h.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{h.opis}</p>
        <div className="mt-4">
          <NawigacjaMiesiaca rok={okres.rok} miesiac={okres.miesiac} baza={baza} poprzedni={h.poprzedni} nastepny={h.nastepny} />
        </div>
        {harmonogram.pakiety.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {harmonogram.pakiety.map((p) => (
              <li key={p.id} className={`rounded-full border px-2 py-0.5 ${KLASA_STATUSU[p.status]}`}>
                <Link href={`/zespol/klienci/${slug}/pakiety/${p.id}`} className="hover:underline">
                  {h.pakiet}: {p.tytul}
                  {p.nazwaLokalu ? ` (${p.nazwaLokalu})` : ""} · {copy.materialy.status[p.status]}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-szary-600">{h.brakPakietow}</p>
        )}
      </section>
      {harmonogram.pakiety.length > 0 ? (
        <>
          <KalendarzZespolu key={`${okres.rok}-${okres.miesiac}`} harmonogram={harmonogram} przesun={mozeEdytowac ? przesunMaterialAkcja.bind(null, slug) : async () => ({ ok: false as const, blad: copy.przejscia.odmowa.niewlasciwy_aktor })} />
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
          {mozeEdytowac ? <UstawieniaHarmonogramu pakiety={harmonogram.pakiety} godziny={harmonogram.domyslneGodziny} zapisz={zapiszUstawieniaHarmonogramu.bind(null, slug)} /> : null}
        </>
      ) : null}
    </div>
  );
}
