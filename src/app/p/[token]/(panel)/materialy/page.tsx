import Link from "next/link";
import { redirect } from "next/navigation";
import { Odliczanie } from "@/components/pakiet/odliczanie";
import { copy } from "@/lib/copy";
import { pobierzPakietyKlienta } from "@/lib/dane/materialy";
import { liczebnik } from "@/lib/format";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";

/** Lista pakietów klienta (SPEC rozdz. 5.2): jeden pakiet otwiera się od razu, kilka (kat1 per lokal, poprzednie miesiące) jako lista. */
export default async function MaterialyKlienta({ params }: PageProps<"/p/[token]/materialy">) {
  const { token } = await params;
  const kontekst = await wymagajKontekstuKlienta(token);
  const pakiety = await pobierzPakietyKlienta(kontekst.clientId, { zeSzkicami: false });
  if (pakiety.length === 1 && pakiety[0]) redirect(`/p/${token}/materialy/${pakiety[0].id}`);
  const k = copy.klientStart;
  const teraz = new Date().toISOString();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{copy.pakiet.lista.tytul}</h1>
        <p className="mt-1 text-sm text-szary-600">{copy.pakiet.lista.opis}</p>
      </div>
      {pakiety.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki">{copy.pakiet.lista.brak}</p>
      ) : (
        <ul className="space-y-3">
          {pakiety.map((p) => (
            <li key={p.id} className={`rounded-xl bg-white p-5 shadow-miekki ${p.status === "do_akceptacji" ? "border-2 border-foodie-fiolet" : ""}`}>
              <p className="text-xs font-medium uppercase tracking-wide text-szary-600">
                {copy.materialy.status[p.status]}
                {p.runda > 1 ? ` · ${k.wersja} ${p.runda}` : ""}
              </p>
              <h2 className="mt-1 font-naglowek text-xl text-foodie-czern">
                {p.tytul}
                {p.nazwaLokalu ? <span className="ml-2 text-base text-szary-600">{p.nazwaLokalu}</span> : null}
              </h2>
              <p className="mt-1 text-sm text-szary-600">
                {liczebnik(p.liczbaPostow, k.posty.jeden, k.posty.kilka, k.posty.wiele)} · {liczebnik(p.liczbaRelacji, k.relacje.jeden, k.relacje.kilka, k.relacje.wiele)} · {liczebnik(p.liczbaKampanii, k.kampanie.jeden, k.kampanie.kilka, k.kampanie.wiele)}
              </p>
              {p.status === "do_akceptacji" && p.autoAkceptacjaO ? (
                <p className="mt-2 text-sm font-medium text-fiolet-700">
                  <Odliczanie do_={p.autoAkceptacjaO} teraz={teraz} />
                </p>
              ) : null}
              <Link href={`/p/${token}/materialy/${p.id}`} className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-foodie-fiolet px-5 text-sm font-medium text-white hover:bg-fiolet-600">
                {copy.pakiet.lista.otworz}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
