import Link from "next/link";
import { Odliczanie } from "@/components/pakiet/odliczanie";
import { copy } from "@/lib/copy";
import { pobierzFakturePoTerminie } from "@/lib/dane/faktury";
import { pobierzNajblizszaPublikacje, pobierzPakietyDoAkceptacji } from "@/lib/dane/pakiety-klienta";
import { pobierzNajnowszyRaport } from "@/lib/dane/raporty";
import { dniPoTerminie, dzisLokalnie } from "@/lib/faktury/status";
import { etykietaMiesiaca, formatujDate, formatujDateCzas, liczebnik } from "@/lib/format";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";

const MS_24H = 24 * 60 * 60 * 1000;

/** SPEC rozdz. 5.1: jeden duży kafel akcji, gdy coś czeka; pod spodem najnowszy raport, najbliższa publikacja, faktura po terminie. */
export default async function Start({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const { pin } = await searchParams;
  const kontekst = await wymagajKontekstuKlienta(token);
  const teraz = new Date();
  const [pakiety, raport, publikacja, fakturaPoTerminie] = await Promise.all([
    pobierzPakietyDoAkceptacji(kontekst.clientId),
    pobierzNajnowszyRaport(kontekst.clientId),
    pobierzNajblizszaPublikacje(kontekst.clientId, teraz),
    pobierzFakturePoTerminie(kontekst.clientId),
  ]);
  const k = copy.klientStart.kafle;
  const f = copy.faktury;

  // Baner po ustawieniu albo zmianie własnego PIN-u (Etap 2 planu domknięcia); tylko znana wartość z adresu.
  const banerPinu = pin === "ustawiony" ? copy.klientStart.pinUstawiony : pin === "zmieniony" ? copy.klientStart.pinZmieniony : null;

  return (
    <div className="space-y-4">
      {banerPinu ? (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium leading-6 text-zielony" data-baner-pinu>
          {banerPinu}
        </p>
      ) : null}
      {pakiety.length === 0 ? (
        <section className="rounded-xl bg-white p-6 shadow-miekki sm:p-8">
          <h1 className="font-naglowek text-2xl text-foodie-czern">{copy.klientStart.naBiezaco}</h1>
          <p className="mt-2 text-base leading-7 text-szary-600">{copy.klientStart.naBiezacoOpis}</p>
        </section>
      ) : (
        pakiety.map((p) => {
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
        })
      )}

      {fakturaPoTerminie ? (
        <section className="rounded-xl border border-czerwony/30 bg-red-50 p-5 shadow-miekki" data-kafel-faktura>
          <p className="text-xs font-semibold uppercase tracking-wide text-czerwony">{k.fakturaTytul}</p>
          <p className="mt-1 text-sm leading-6 text-foodie-czern">
            {k.fakturaOpis
              .replace("{numer}", fakturaPoTerminie.numer)
              .replace("{termin}", formatujDate(fakturaPoTerminie.termin))
              .replace("{dni}", liczebnik(dniPoTerminie(fakturaPoTerminie.termin, dzisLokalnie(teraz)), f.poTerminieDni.jeden, f.poTerminieDni.kilka, f.poTerminieDni.wiele))}
          </p>
          <Link href={`/p/${token}/faktury`} className="mt-2 inline-block text-sm font-medium text-czerwony hover:underline">
            {k.fakturaLink}
          </Link>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl bg-white p-5 shadow-miekki" data-kafel-raport>
          <p className="text-xs font-medium uppercase tracking-wide text-szary-600">{k.raport}</p>
          {raport ? (
            <>
              <p className="mt-1 font-naglowek text-lg text-foodie-czern">
                {etykietaMiesiaca(raport.rok, raport.miesiac)}
                {raport.nazwaLokalu ? <span className="ml-2 text-sm font-normal text-szary-600">{raport.nazwaLokalu}</span> : null}
              </p>
              <p className="text-sm text-szary-600">{raport.tytul}</p>
              <a href={raport.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-foodie-fiolet hover:underline">
                {k.raportOtworz}
              </a>
            </>
          ) : (
            <p className="mt-1 text-sm text-szary-600">{k.raportBrak}</p>
          )}
        </section>
        <section className="rounded-xl bg-white p-5 shadow-miekki" data-kafel-publikacja>
          <p className="text-xs font-medium uppercase tracking-wide text-szary-600">{k.publikacja}</p>
          {publikacja ? (
            <>
              <p className="mt-1 font-naglowek text-lg text-foodie-czern">{formatujDateCzas(publikacja.publikacjaO)}</p>
              <p className="text-sm text-szary-600">
                {copy.wysylka.typ[publikacja.typ]}: {publikacja.tytul}
              </p>
              <Link href={`/p/${token}/harmonogram?p=${publikacja.pakietId}`} className="mt-3 inline-block text-sm font-medium text-foodie-fiolet hover:underline">
                {k.publikacjaLink}
              </Link>
            </>
          ) : (
            <p className="mt-1 text-sm text-szary-600">{k.publikacjaBrak}</p>
          )}
        </section>
      </div>
    </div>
  );
}
