import { notFound } from "next/navigation";
import { DialogDokumentu } from "@/components/zespol/dokumenty/dialog-dokumentu";
import { ListaDokumentow } from "@/components/zespol/dokumenty/lista-dokumentow";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzDokumentyKlienta } from "@/lib/dane/dokumenty";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { maUprawnienie } from "@/lib/uprawnienia";

/** Zakładka Dokumenty (SPEC rozdz. 10, 17): tylko admin i csm; reszta ról dostaje 404. */
export default async function DokumentyKlienta({ params }: PageProps<"/zespol/klienci/[slug]/dokumenty">) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "dokumenty", "podglad");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const dokumenty = await pobierzDokumentyKlienta(klient.id);
  const t = copy.zespol.dokumenty;
  const pelne = maUprawnienie(czlonek.role, "dokumenty", "pelne");

  return (
    <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6" data-dokumenty-zespolu>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-naglowek text-xl text-foodie-czern">{t.tytul}</h2>
          <p className="mt-1 max-w-prose text-sm text-szary-600">{t.opis}</p>
        </div>
        {pelne ? <DialogDokumentu slug={slug} /> : null}
      </div>
      <div className="mt-5">
        <ListaDokumentow slug={slug} dokumenty={dokumenty} mozeUsuwac={pelne} />
      </div>
    </section>
  );
}
