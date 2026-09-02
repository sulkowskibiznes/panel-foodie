import Link from "next/link";
import { notFound } from "next/navigation";
import { copy } from "@/lib/copy";
import { pobierzPakiet } from "@/lib/dane/pakiety-klienta";
import { assertClientAccess } from "@/lib/dostep";
import { liczebnik } from "@/lib/format";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";
import { czyUuid } from "@/lib/walidacja";

/** Faza 1: szkielet ekranu pakietu z izolacją klientów (kryterium 4). Pełny ekran akceptacji w fazie 2. */
export default async function EkranPakietu({ params }: { params: Promise<{ token: string; pakietId: string }> }) {
  const { token, pakietId } = await params;
  const kontekst = await wymagajKontekstuKlienta(token);
  if (!czyUuid(pakietId)) notFound();
  const wynik = await pobierzPakiet(pakietId);
  if (!wynik) notFound();
  assertClientAccess(kontekst.clientId, wynik.clientId);
  const p = wynik.pakiet;

  return (
    <section className="rounded-xl bg-white p-6 shadow-miekki sm:p-8">
      <p className="text-sm font-medium text-szary-600">{copy.materialy.status[p.status]}{p.runda > 1 ? ` · ${copy.klientStart.wersja} ${p.runda}` : ""}</p>
      <h1 className="mt-1 font-naglowek text-2xl text-foodie-czern sm:text-3xl">{p.tytul}</h1>
      <p className="mt-2 text-base text-szary-600">
        {liczebnik(p.liczbaPostow, copy.klientStart.posty.jeden, copy.klientStart.posty.kilka, copy.klientStart.posty.wiele)} ·{" "}
        {liczebnik(p.liczbaRelacji, copy.klientStart.relacje.jeden, copy.klientStart.relacje.kilka, copy.klientStart.relacje.wiele)} ·{" "}
        {liczebnik(p.liczbaKampanii, copy.klientStart.kampanie.jeden, copy.klientStart.kampanie.kilka, copy.klientStart.kampanie.wiele)}
      </p>
      <p className="mt-6 rounded-lg bg-szary-050 p-4 text-sm leading-6 text-szary-600">{copy.materialy.wBudowie}</p>
      <Link href={`/p/${token}/start`} className="mt-6 inline-block text-sm font-medium text-foodie-fiolet hover:underline">
        {copy.materialy.wroc}
      </Link>
    </section>
  );
}
