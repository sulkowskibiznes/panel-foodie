import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { EkranPakietuZespolu } from "@/components/zespol/materialy/ekran-pakietu-zespolu";
import type { AkcjeMaterialow } from "@/components/zespol/materialy/typy";
import { PasekZespolu } from "@/components/zespol/pakiety/pasek-zespolu";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { oznaczPrzeczytanePrzezZespol } from "@/lib/dane/komentarze";
import { pobierzPakietSzczegoly } from "@/lib/dane/materialy";
import { maUprawnienie } from "@/lib/uprawnienia";
import { czyUuid } from "@/lib/walidacja";
import { odpowiedzNaKomentarz, oznaczZalatwione, wykonajPrzejscieZespolu } from "./akcje";
import { dodajKampanieAkcja, dodajMaterialAkcja, dodajPlikAkcja, edytujKampanieAkcja, edytujMaterialAkcja, edytujPakietAkcja, podmienPlikAkcja, przygotujUpload, usunKampanieAkcja, usunMaterialAkcja, usunPlikAkcja, zakonczUpload, zapiszReklameAkcja } from "./materialy-akcje";

/** Pakiet w panelu zespołu: TE SAME komponenty podglądu co u klienta (SPEC rozdz. 12.3 pkt 6) plus akcje zespołu, narzędzia materiałów (12.6) i odpowiedzi w wątkach. */
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
  const uprawnienia = { content: mozeZmieniac, kampanie: maUprawnienie(czlonek.role, "kampanie", "pelne") };
  const akcjeMaterialow: AkcjeMaterialow = {
    przygotuj: przygotujUpload.bind(null, slug, pakietId),
    zakoncz: zakonczUpload.bind(null, slug, pakietId),
    dodajMaterial: dodajMaterialAkcja.bind(null, slug, pakietId),
    podmienPlik: podmienPlikAkcja.bind(null, slug, pakietId),
    dodajPlik: dodajPlikAkcja.bind(null, slug, pakietId),
    usunPlik: usunPlikAkcja.bind(null, slug, pakietId),
    edytujMaterial: edytujMaterialAkcja.bind(null, slug, pakietId),
    usunMaterial: usunMaterialAkcja.bind(null, slug, pakietId),
    zapiszReklame: zapiszReklameAkcja.bind(null, slug, pakietId),
    dodajKampanie: dodajKampanieAkcja.bind(null, slug, pakietId),
    edytujKampanie: edytujKampanieAkcja.bind(null, slug, pakietId),
    usunKampanie: usunKampanieAkcja.bind(null, slug, pakietId),
    edytujPakiet: edytujPakietAkcja.bind(null, slug, pakietId),
  };
  const teraz = new Date().toISOString();

  return (
    <div className="space-y-4">
      <Link href={`/zespol/klienci/${slug}/materialy`} className="text-sm font-medium text-foodie-fiolet hover:underline">
        {copy.zespol.pakietyMaterialow.wroc}
      </Link>
      <PasekZespolu pakiet={wynik.pakiet} teraz={teraz} mozeZmieniac={mozeZmieniac} wykonaj={wykonajPrzejscieZespolu.bind(null, slug, pakietId)} />
      <p className="text-sm text-szary-600">{copy.pakiet.zespolWidziKlienta}</p>
      <EkranPakietuZespolu
        pakiet={wynik.pakiet}
        teraz={teraz}
        akcje={{
          decyzje: null,
          komentarz: odpowiedzNaKomentarz.bind(null, slug, pakietId),
          zalatwione: oznaczZalatwione.bind(null, slug, pakietId),
          obejrzenie: null,
        }}
        akcjeMaterialow={akcjeMaterialow}
        uprawnienia={uprawnienia}
        adresHarmonogramu={`/zespol/klienci/${slug}/harmonogram?m=${wynik.pakiet.okres.rok}-${String(wynik.pakiet.okres.miesiac).padStart(2, "0")}`}
      />
    </div>
  );
}
