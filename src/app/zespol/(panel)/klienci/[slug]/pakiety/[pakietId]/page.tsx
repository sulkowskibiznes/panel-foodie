import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { EkranPakietu } from "@/components/pakiet/ekran-pakietu";
import { PasekZespolu } from "@/components/zespol/pakiety/pasek-zespolu";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { oznaczPrzeczytanePrzezZespol } from "@/lib/dane/komentarze";
import { pobierzPakietSzczegoly } from "@/lib/dane/materialy";
import { maUprawnienie } from "@/lib/uprawnienia";
import { czyUuid } from "@/lib/walidacja";
import { odpowiedzNaKomentarz, oznaczZalatwione, wykonajPrzejscieZespolu } from "./akcje";

/** Pakiet w panelu zespołu: TE SAME komponenty podglądu co u klienta (SPEC rozdz. 12.3 pkt 6) plus akcje zespołu i odpowiedzi w wątkach. */
export default async function PakietZespolu({ params }: PageProps<"/zespol/klienci/[slug]/pakiety/[pakietId]">) {
  const { slug, pakietId } = await params;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "materialy", "podglad");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient || !czyUuid(pakietId)) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const wynik = await pobierzPakietSzczegoly(pakietId, {
    adresy: { plik: (id, wariant) => `/zespol/plik/${id}/${wariant}`, awatar: (id) => `/zespol/awatar/${id}` },
    strona: { rodzaj: "zespol" },
  });
  if (!wynik || wynik.clientId !== klient.id) notFound();
  after(() => oznaczPrzeczytanePrzezZespol(pakietId));
  const mozeZmieniac = maUprawnienie(czlonek.role, "materialy", "pelne");

  return (
    <div className="space-y-4">
      <Link href={`/zespol/klienci/${slug}/materialy`} className="text-sm font-medium text-foodie-fiolet hover:underline">
        {copy.zespol.pakietyMaterialow.wroc}
      </Link>
      <PasekZespolu pakiet={wynik.pakiet} teraz={new Date().toISOString()} mozeZmieniac={mozeZmieniac} wykonaj={wykonajPrzejscieZespolu.bind(null, slug, pakietId)} />
      <p className="text-sm text-szary-600">{copy.pakiet.zespolWidziKlienta}</p>
      <EkranPakietu
        tryb="zespol"
        pakiet={wynik.pakiet}
        teraz={new Date().toISOString()}
        mozeAkceptowac={false}
        akcje={{
          decyzje: null,
          komentarz: odpowiedzNaKomentarz.bind(null, slug, pakietId),
          zalatwione: oznaczZalatwione.bind(null, slug, pakietId),
          obejrzenie: null,
        }}
      />
    </div>
  );
}
