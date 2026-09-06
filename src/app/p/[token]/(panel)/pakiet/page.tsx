import Link from "next/link";
import { copy } from "@/lib/copy";
import { pobierzTwojPakiet } from "@/lib/dane/twoj-pakiet";
import { formatujDate, formatujKwote, liczebnik } from "@/lib/format";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";

/**
 * „Twój pakiet" (SPEC rozdz. 5.7): nazwa pakietu, kwota netto miesięcznie, zakres (stała w copy.ts per tier),
 * lokale objęte współpracą, opiekun (imię plus kanał kontaktu, bez numerów prywatnych), data startu. Bez logo klienta.
 */
export default async function TwojPakietStrona({ params }: PageProps<"/p/[token]/pakiet">) {
  const { token } = await params;
  const kontekst = await wymagajKontekstuKlienta(token);
  const pakiet = await pobierzTwojPakiet(kontekst.clientId);
  const t = copy.twojPakiet;
  if (!pakiet) return <p className="rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki">{copy.bledy.ogolny}</p>;
  const zakres = t.zakresPakietow[pakiet.tier];

  return (
    <div className="space-y-4" data-twoj-pakiet>
      <div>
        <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{t.tytul}</h1>
        <p className="mt-1 text-sm text-szary-600">{t.opis}</p>
      </div>

      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-foodie-fiolet">{copy.zespol.pakiety[pakiet.tier]}</p>
        <p className="mt-1 font-naglowek text-3xl text-foodie-czern" data-kwota-pakietu>
          {pakiet.kwotaNetto !== null ? (
            <>
              {formatujKwote(pakiet.kwotaNetto)} <span className="text-base font-normal text-szary-600">{t.miesiecznie}</span>
            </>
          ) : (
            <span className="text-base font-normal text-szary-600">{t.kwotaWUmowie}</span>
          )}
        </p>
        <h2 className="mt-5 text-sm font-medium text-szary-600">{t.zakres}</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-foodie-czern">
          {zakres.map((p) => (
            <li key={p} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-foodie-fiolet" />
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-szary-600">{t.zakresUwaga}</p>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
        <h2 className="text-sm font-medium text-szary-600">
          {t.lokale} · {liczebnik(pakiet.lokale.length, t.lokaleOpis.jeden, t.lokaleOpis.kilka, t.lokaleOpis.wiele)}
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-foodie-czern" data-lokale-pakietu>
          {pakiet.lokale.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-miekki sm:p-6" data-opiekun>
        <h2 className="text-sm font-medium text-szary-600">{t.opiekun}</h2>
        {pakiet.opiekun ? (
          <>
            <p className="mt-1 font-naglowek text-xl text-foodie-czern">{pakiet.opiekun.imie}</p>
            <p className="mt-1 text-sm text-foodie-czern">{pakiet.opiekun.kontakt ?? t.kontaktAgencji}</p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-szary-600">{t.opiekunBrak}</p>
            <p className="mt-1 text-sm text-foodie-czern">{t.kontaktAgencji}</p>
          </>
        )}
        <p className="mt-2 text-xs text-szary-600">{t.kontaktOpis}</p>
        {pakiet.wspolpracaOd ? (
          <p className="mt-4 text-sm text-szary-600">
            {t.wspolpracaOd} <span className="font-medium text-foodie-czern">{formatujDate(pakiet.wspolpracaOd)}</span>
          </p>
        ) : null}
        <Link href={`/p/${token}/raporty`} className="mt-4 inline-block text-sm font-medium text-foodie-fiolet hover:underline">
          {t.raportyLink}
        </Link>
      </section>
    </div>
  );
}
