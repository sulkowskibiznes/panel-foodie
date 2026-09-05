import Link from "next/link";
import { notFound } from "next/navigation";
import { EkranImportu } from "@/components/zespol/import/ekran-importu";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { ostatniaSeria, pobierzPakietDoImportu, stanImportuPakietu } from "@/lib/dane/import";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { konfiguracjaDysku } from "@/lib/drive/klient";
import type { KartaWeryfikacyjna } from "@/lib/dto/import";
import { zbudujKartyPakietu } from "@/lib/import/weryfikacja";
import { czyUuid } from "@/lib/walidacja";
import { przygotujMapowanieAkcja, rozpocznijImportAkcja, stanImportuAkcja, wznowImportAkcja, zapiszLinkAkcja } from "./akcje";

/** Kopiowanie w tle biegnie w `after()` akcji z tej strony; limit czasu obejmuje worker (SPEC rozdz. 13.4). */
export const maxDuration = 300;

/**
 * Import z Dysku dla pakietu (SPEC rozdz. 12.3 pkt 2 i 4, rozdz. 13): karta weryfikacyjna każdego folderu,
 * obowiązkowy ekran mapowania, postęp zadań w tle. Działa w szkicu; po wysyłce zostaje „Dodaj materiał".
 */
export default async function ImportPakietu({ params, searchParams }: PageProps<"/zespol/klienci/[slug]/pakiety/[pakietId]/import">) {
  const { slug, pakietId } = await params;
  const { nowy } = await searchParams;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "materialy", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient || !czyUuid(pakietId)) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const pakiet = await pobierzPakietDoImportu(pakietId);
  if (!pakiet || pakiet.clientId !== klient.id) notFound();
  const konf = konfiguracjaDysku();
  const stan = ostatniaSeria(await stanImportuPakietu(pakietId));
  const pokazPostep = stan.zadania.length > 0 && nowy !== "1";
  const mozeImportowac = !!konf && pakiet.status === "szkic";
  const karty: KartaWeryfikacyjna[] = konf && mozeImportowac && !pokazPostep ? await zbudujKartyPakietu(konf, klient, pakiet) : [];
  const t = copy.zespol.import;

  return (
    <div className="space-y-4">
      <Link href={`/zespol/klienci/${slug}/pakiety/${pakietId}`} className="text-sm font-medium text-foodie-fiolet hover:underline">
        {copy.zespol.pakietyMaterialow.wroc}
      </Link>
      <div>
        <h2 className="font-naglowek text-xl text-foodie-czern">{t.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{t.opis}</p>
      </div>
      {!konf ? (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-bursztyn" data-import-nieskonfigurowany>{t.nieSkonfigurowany}</p>
      ) : pakiet.status !== "szkic" && !pokazPostep ? (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-bursztyn" data-import-tylko-szkic>{t.tylkoSzkic}</p>
      ) : (
        <EkranImportu
          key={pokazPostep ? "postep" : "weryfikacja"}
          slug={slug}
          pakietId={pakietId}
          trybStartowy={pokazPostep ? "postep" : "weryfikacja"}
          karty={karty}
          stan={stan}
          kampanie={pakiet.kampanie.map((k) => ({ id: k.id, nazwa: k.nazwa }))}
          akcje={{
            zapiszLink: zapiszLinkAkcja.bind(null, slug, pakietId),
            przygotujMapowanie: przygotujMapowanieAkcja.bind(null, slug, pakietId),
            rozpocznij: rozpocznijImportAkcja.bind(null, slug, pakietId),
            stan: stanImportuAkcja.bind(null, slug, pakietId),
            wznow: wznowImportAkcja.bind(null, slug, pakietId),
          }}
        />
      )}
    </div>
  );
}
