import { Fragment } from "react";
import { StronaStatyczna } from "@/components/uklad/strona-statyczna";

type Tabela = { readonly naglowki: readonly [string, string]; readonly wiersze: readonly (readonly [string, string])[] };

/** Blok treści z copy.ts: akapit (string), podtytuł, punkty (ust.), lista wypunktowana albo tabela. */
type Blok = string | { readonly podtytul: string } | { readonly punkty: readonly string[] } | { readonly lista: readonly string[] } | { readonly tabela: Tabela };

type Sekcja = { readonly naglowek: string; readonly tresc: readonly Blok[] };

type Props = {
  tytul: string;
  obowiazujeOd: string;
  sekcje: readonly Sekcja[];
};

const AKAPIT = "text-base leading-7 text-foodie-czern";

/** Pogrubienia zapisane w copy.ts jako **tekst**. Bez dangerouslySetInnerHTML: dzielimy string i renderujemy <strong>. */
function Tekst({ tekst }: { tekst: string }) {
  return (
    <>
      {tekst.split("**").map((czesc, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold">
            {czesc}
          </strong>
        ) : (
          <Fragment key={i}>{czesc}</Fragment>
        ),
      )}
    </>
  );
}

function BlokTresci({ blok }: { blok: Blok }) {
  if (typeof blok === "string") {
    return (
      <p className={`mt-3 ${AKAPIT}`}>
        <Tekst tekst={blok} />
      </p>
    );
  }
  if ("podtytul" in blok) {
    return <h3 className="mt-4 text-base font-semibold text-foodie-czern">{blok.podtytul}</h3>;
  }
  if ("punkty" in blok) {
    return (
      <ol className={`mt-3 list-decimal space-y-2 pl-6 ${AKAPIT}`}>
        {blok.punkty.map((punkt) => (
          <li key={punkt} className="pl-1">
            <Tekst tekst={punkt} />
          </li>
        ))}
      </ol>
    );
  }
  if ("lista" in blok) {
    return (
      <ul className={`mt-2 list-disc space-y-1 pl-6 ${AKAPIT}`}>
        {blok.lista.map((pozycja) => (
          <li key={pozycja} className="pl-1">
            <Tekst tekst={pozycja} />
          </li>
        ))}
      </ul>
    );
  }
  const { naglowki, wiersze } = blok.tabela;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[320px] border-collapse text-left text-sm leading-6 text-foodie-czern">
        <thead>
          <tr className="border-b border-szary-300">
            {naglowki.map((n) => (
              <th key={n} scope="col" className="py-2 pr-4 align-top font-semibold">
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {wiersze.map(([a, b]) => (
            <tr key={a} className="border-b border-szary-100 align-top">
              <td className="w-2/5 py-2 pr-4">
                <Tekst tekst={a} />
              </td>
              <td className="py-2">
                <Tekst tekst={b} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Regulamin i polityka prywatności (SPEC rozdz. 17): treść w całości z copy.ts, struktura nagłówków i tabel jak w docs/TRESCI-PRAWNE.md. */
export function DokumentPrawny({ tytul, obowiazujeOd, sekcje }: Props) {
  return (
    <StronaStatyczna>
      <article className="rounded-xl bg-white p-6 shadow-miekki sm:p-10">
        <h1 className="font-naglowek text-3xl text-foodie-czern sm:text-4xl">{tytul}</h1>
        <p className="mt-3 text-sm text-szary-600">{obowiazujeOd}</p>
        <div className="mt-8 space-y-8">
          {sekcje.map((sekcja) => (
            <section key={sekcja.naglowek}>
              <h2 className="font-naglowek text-xl text-foodie-czern">{sekcja.naglowek}</h2>
              {sekcja.tresc.map((blok, i) => (
                <BlokTresci key={i} blok={blok} />
              ))}
            </section>
          ))}
        </div>
      </article>
    </StronaStatyczna>
  );
}
