import Link from "next/link";
import { notFound } from "next/navigation";
import { ListaZainteresowan } from "@/components/zespol/uslugi/lista-zainteresowan";
import { assertTeamClientAccess, wymagajCzlonka } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzPierwszeKroki } from "@/lib/dane/dane-klienta";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { pobierzZainteresowaniaKlienta } from "@/lib/dane/uslugi";
import { maUprawnienie } from "@/lib/uprawnienia";

export default async function PodsumowanieKlienta({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const mozeZarzadzac = maUprawnienie(czlonek.role, "klienci", "pelne");
  const [zainteresowania, kroki] = await Promise.all([pobierzZainteresowaniaKlienta(klient.id), mozeZarzadzac && klient.status === "aktywny" && !klient.demo ? pobierzPierwszeKroki(klient.id) : null]);
  const k = copy.zespol.karta;
  const p = copy.zespol.pierwszeKroki;
  const baza = `/zespol/klienci/${slug}`;
  const listaKrokow = kroki
    ? [
        { klucz: "linki", gotowe: kroki.linki, tekst: p.linki, href: `${baza}/dostep` },
        { klucz: "zdjecia", gotowe: kroki.zdjecia, tekst: p.zdjecia, href: `${baza}/ustawienia` },
        { klucz: "zespol", gotowe: kroki.zespol, tekst: p.zespol, href: `${baza}/ustawienia` },
        { klucz: "dokumenty", gotowe: kroki.dokumenty, tekst: p.dokumenty, href: `${baza}/dokumenty` },
        { klucz: "pakiet", gotowe: kroki.pakiet, tekst: p.pakiet, href: `${baza}/pakiety/nowy` },
      ]
    : [];

  return (
    <div className="space-y-4">
      {listaKrokow.some((x) => !x.gotowe) ? (
        <section className="rounded-xl border border-fiolet-100 bg-fiolet-050 p-5 sm:p-6" data-pierwsze-kroki>
          <h2 className="font-naglowek text-xl text-foodie-czern">{p.tytul}</h2>
          <p className="mt-1 text-sm text-szary-600">{p.opis}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {listaKrokow.map((x) => (
              <li key={x.klucz} className="flex items-center gap-2" data-krok={x.klucz} data-gotowe={x.gotowe ? "tak" : "nie"}>
                <span aria-hidden className={`inline-flex size-5 items-center justify-center rounded-full text-xs ${x.gotowe ? "bg-zielony text-white" : "border border-szary-300 bg-white"}`}>{x.gotowe ? "✓" : ""}</span>
                {x.gotowe ? (
                  <span className="text-szary-600 line-through">{x.tekst}</span>
                ) : (
                  <Link href={x.href} className="font-medium text-foodie-fiolet hover:underline">{x.tekst}</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
                  <span className="text-szary-600"> · {copy.zespol.nowyKlient.lokale.fb}: {l.fb_page_name}</span>
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
                  {c.phone || c.email ? <span className="block text-xs text-szary-600">{[c.phone, c.email].filter(Boolean).join(" · ")}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6" data-zainteresowania>
        <h2 className="font-naglowek text-xl text-foodie-czern">{k.zainteresowania.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{k.zainteresowania.opis}</p>
        <div className="mt-4">
          <ListaZainteresowan slug={slug} zainteresowania={zainteresowania} mozeZalatwiac={maUprawnienie(czlonek.role, "klienci", "pelne")} />
        </div>
      </section>
    </div>
  );
}
