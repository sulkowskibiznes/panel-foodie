import { notFound } from "next/navigation";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";

/** Faktury (faza 5). Już teraz: rola bez prawa do faktur dostaje 404 (kryterium 23). */
export default async function FakturyKlienta({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "faktury", "podglad");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  return (
    <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
      <h2 className="font-naglowek text-xl text-foodie-czern">{copy.zespol.faktury.tytul}</h2>
      <p className="mt-2 text-sm text-szary-600">{copy.zespol.faktury.wkrotce}</p>
    </section>
  );
}
