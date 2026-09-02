import { StronaStatyczna } from "@/components/uklad/strona-statyczna";

type Sekcja = { readonly naglowek: string; readonly tresc: readonly string[] };

type Props = {
  tytul: string;
  wstep: string;
  doUzupelnienia: string;
  sekcje: readonly Sekcja[];
};

/** Regulamin i polityka prywatności: nagłówki sekcji z miejscem na treść (SPEC rozdz. 17). */
export function DokumentPrawny({ tytul, wstep, doUzupelnienia, sekcje }: Props) {
  return (
    <StronaStatyczna>
      <article className="rounded-xl bg-white p-6 shadow-miekki sm:p-10">
        <h1 className="font-naglowek text-3xl text-foodie-czern sm:text-4xl">{tytul}</h1>
        <p className="mt-4 text-base leading-7 text-szary-600">{wstep}</p>
        <div className="mt-8 space-y-8">
          {sekcje.map((sekcja) => (
            <section key={sekcja.naglowek}>
              <h2 className="font-naglowek text-xl text-foodie-czern">{sekcja.naglowek}</h2>
              {sekcja.tresc.length === 0 ? (
                <p className="mt-2 text-base leading-7 text-szary-600 italic">{doUzupelnienia}</p>
              ) : (
                sekcja.tresc.map((akapit) => (
                  <p key={akapit} className="mt-2 text-base leading-7 text-foodie-czern">
                    {akapit}
                  </p>
                ))
              )}
            </section>
          ))}
        </div>
      </article>
    </StronaStatyczna>
  );
}
