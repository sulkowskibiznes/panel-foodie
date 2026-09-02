import Link from "next/link";
import { StronaStatyczna } from "@/components/uklad/strona-statyczna";
import { copy } from "@/lib/copy";

/** Jeden ekran 404 dla wszystkiego, czego nie ma albo do czego nie ma dostępu (nigdy 403). */
export default function NieZnaleziono() {
  return (
    <StronaStatyczna>
      <section className="rounded-xl bg-white p-6 shadow-miekki sm:p-10">
        <h1 className="font-naglowek text-3xl text-foodie-czern">{copy.nieZnaleziono.tytul}</h1>
        <p className="mt-4 text-base leading-7 text-szary-600">{copy.nieZnaleziono.opis}</p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-xl bg-foodie-fiolet px-5 text-base font-medium text-white hover:bg-fiolet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foodie-fiolet"
        >
          {copy.nieZnaleziono.wroc}
        </Link>
      </section>
    </StronaStatyczna>
  );
}
