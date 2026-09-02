import { StronaStatyczna } from "@/components/uklad/strona-statyczna";
import { Sygnet } from "@/components/marka/sygnet";
import { copy } from "@/lib/copy";

/** Strona startowa: neutralna, w brandzie Foodie Media, bez żadnych danych klientów. */
export default function StronaStartowa() {
  return (
    <StronaStatyczna>
      <section className="rounded-xl bg-white p-6 shadow-miekki sm:p-10">
        <Sygnet rozmiar={56} />
        <h1 className="mt-6 font-naglowek text-3xl leading-tight text-foodie-czern sm:text-4xl">
          {copy.start.tytul}
        </h1>
        <p className="mt-4 max-w-prose text-base leading-7 text-szary-600">{copy.start.opis}</p>
        <div className="mt-8 rounded-xl border border-fiolet-100 bg-fiolet-050 p-5">
          <p className="text-base leading-7 text-foodie-czern">{copy.start.jakWejsc}</p>
          <p className="mt-2 text-sm leading-6 text-szary-600">{copy.start.pomoc}</p>
        </div>
      </section>
    </StronaStatyczna>
  );
}
