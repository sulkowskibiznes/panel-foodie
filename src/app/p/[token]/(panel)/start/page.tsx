import Link from "next/link";
import { Odliczanie } from "@/components/pakiet/odliczanie";
import { copy } from "@/lib/copy";
import { pobierzPakietyDoAkceptacji } from "@/lib/dane/pakiety-klienta";
import { liczebnik } from "@/lib/format";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";

const MS_24H = 24 * 60 * 60 * 1000;

/** SPEC rozdz. 5.1: jeden duży kafel akcji, gdy coś czeka; inaczej „Wszystko na bieżąco". */
export default async function Start({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const kontekst = await wymagajKontekstuKlienta(token);
  const pakiety = await pobierzPakietyDoAkceptacji(kontekst.clientId);
  const teraz = new Date();

  if (pakiety.length === 0) {
    return (
      <section className="rounded-xl bg-white p-6 shadow-miekki sm:p-8">
        <h1 className="font-naglowek text-2xl text-foodie-czern">{copy.klientStart.naBiezaco}</h1>
        <p className="mt-2 text-base leading-7 text-szary-600">{copy.klientStart.naBiezacoOpis}</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {pakiety.map((p) => {
        const pilne = p.autoAkceptacjaO !== null && new Date(p.autoAkceptacjaO).getTime() - teraz.getTime() < MS_24H;
        return (
          <section key={p.id} className="rounded-xl border-2 border-foodie-fiolet bg-white p-6 shadow-miekki sm:p-8">
            <p className="text-sm font-medium uppercase tracking-wide text-foodie-fiolet">{copy.klientStart.doAkceptacji}</p>
            <h1 className="mt-2 font-naglowek text-2xl text-foodie-czern sm:text-3xl">
              {p.tytul}
              {p.runda > 1 ? <span className="ml-2 text-base text-szary-600">{copy.klientStart.wersja} {p.runda}</span> : null}
            </h1>
            <p className="mt-2 text-base text-szary-600">
              {liczebnik(p.liczbaPostow, copy.klientStart.posty.jeden, copy.klientStart.posty.kilka, copy.klientStart.posty.wiele)},{" "}
              {liczebnik(p.liczbaRelacji, copy.klientStart.relacje.jeden, copy.klientStart.relacje.kilka, copy.klientStart.relacje.wiele)} i{" "}
              {liczebnik(p.liczbaKampanii, copy.klientStart.kampanie.jeden, copy.klientStart.kampanie.kilka, copy.klientStart.kampanie.wiele)}
            </p>
            <p className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${pilne ? "bg-amber-50 text-bursztyn" : "bg-fiolet-050 text-fiolet-700"}`}>
              {p.autoAkceptacjaO ? <Odliczanie do_={p.autoAkceptacjaO} teraz={teraz.toISOString()} /> : copy.klientStart.autoWylaczona}
            </p>
            <Link
              href={`/p/${token}/materialy/${p.id}`}
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-foodie-fiolet px-6 text-base font-medium text-white hover:bg-fiolet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foodie-fiolet sm:w-auto"
            >
              {copy.klientStart.przejrzyj}
            </Link>
          </section>
        );
      })}
    </div>
  );
}
