import { notFound } from "next/navigation";
import { after } from "next/server";
import { EkranPakietu } from "@/components/pakiet/ekran-pakietu";
import { copy } from "@/lib/copy";
import { oznaczPrzeczytanePrzezKlienta } from "@/lib/dane/komentarze";
import { pobierzPakietSzczegoly } from "@/lib/dane/materialy";
import { assertClientAccess } from "@/lib/dostep";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";
import { odnotujOtwarciePakietu } from "@/lib/pakiety/otwarcie";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";
import { akceptujPakiet, dodajKomentarz, odnotujObejrzenie, zglosUwagi } from "./akcje";

/** Ekran akceptacji materiałów (SPEC rozdz. 6). Izolacja: assertClientAccess przed użyciem czegokolwiek (kryterium 4). */
export default async function EkranPakietuKlienta({ params }: PageProps<"/p/[token]/materialy/[pakietId]">) {
  const { token, pakietId } = await params;
  const kontekst = await wymagajKontekstuKlienta(token);
  if (!czyUuid(pakietId)) notFound();
  const wynik = await pobierzPakietSzczegoly(pakietId, {
    adresy: { plik: (id, wariant) => `/p/${token}/plik/${id}/${wariant}`, awatar: (id) => `/p/${token}/awatar/${id}` },
    strona: { rodzaj: "klient", linkId: kontekst.linkId },
  });
  if (!wynik) notFound();
  assertClientAccess(kontekst.clientId, wynik.clientId);
  if (wynik.pakiet.status === "szkic") notFound();

  // Podgląd zespołu (kryterium 25): żadnych śladów po stronie klienta (first_opened_at, item_views, „przeczytane").
  if (kontekst.tryb === "podglad") {
    return (
      <EkranPakietu
        tryb="klient"
        pakiet={wynik.pakiet}
        teraz={new Date().toISOString()}
        mozeAkceptowac
        blokada={copy.podgladKlienta.niedostepne}
        akcje={{ decyzje: null, komentarz: null, zalatwione: null, obejrzenie: null }}
      />
    );
  }

  const { ipHash, ua } = await infoZadania();
  const aktor = { rodzaj: "klient" as const, contactId: kontekst.contactId, linkId: kontekst.linkId, label: kontekst.label, mozeAkceptowac: kontekst.canApprove };
  after(async () => {
    await odnotujOtwarciePakietu(pakietId, aktor, { ipHash, ua });
    await oznaczPrzeczytanePrzezKlienta(pakietId);
  });

  return (
    <EkranPakietu
      tryb="klient"
      pakiet={wynik.pakiet}
      teraz={new Date().toISOString()}
      mozeAkceptowac={kontekst.canApprove}
      akcje={{
        decyzje: { akceptuj: akceptujPakiet.bind(null, token, pakietId), zglosUwagi: zglosUwagi.bind(null, token, pakietId) },
        komentarz: dodajKomentarz.bind(null, token, pakietId),
        zalatwione: null,
        obejrzenie: odnotujObejrzenie.bind(null, token, pakietId),
      }}
    />
  );
}
