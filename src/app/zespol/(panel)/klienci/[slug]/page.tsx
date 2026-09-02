import { notFound } from "next/navigation";
import { assertTeamClientAccess, wymagajCzlonka } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";

export default async function PodsumowanieKlienta({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const k = copy.zespol.karta;

  return (
    <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
      <h2 className="font-naglowek text-xl text-foodie-czern">{k.podsumowanie}</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-szary-600">{k.lokale}</h3>
          <ul className="mt-2 space-y-1 text-sm text-foodie-czern">
            {klient.locations.map((l) => (
              <li key={l.id}>
                {l.name}
                {l.city ? <span className="text-szary-600"> · {l.city}</span> : null}
                <span className="text-szary-600"> · FB: {l.fb_page_name}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium text-szary-600">{k.kontakty}</h3>
          <ul className="mt-2 space-y-1 text-sm text-foodie-czern">
            {klient.client_contacts.map((c) => (
              <li key={c.id}>
                {c.name}
                {c.role_label ? <span className="text-szary-600"> · {c.role_label}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
