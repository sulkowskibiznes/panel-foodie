import { KartaUslugi } from "@/components/klient/uslugi/karta-uslugi";
import { copy } from "@/lib/copy";
import { pobierzTierKlienta } from "@/lib/dane/pakiety-klienta";
import { pobierzUslugiDlaKlienta } from "@/lib/dane/uslugi";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";
import { zglosZainteresowanie } from "./akcje";

/** „Co jeszcze możemy zrobić" (SPEC rozdz. 5.8): karty z `services`, modal z jednym polem. */
export default async function UslugiKlienta({ params }: PageProps<"/p/[token]/uslugi">) {
  const { token } = await params;
  const kontekst = await wymagajKontekstuKlienta(token);
  const tier = await pobierzTierKlienta(kontekst.clientId);
  const uslugi = tier ? await pobierzUslugiDlaKlienta(kontekst.clientId, tier) : [];
  const u = copy.uslugi;
  return (
    <div className="space-y-4" data-uslugi-klienta>
      <div>
        <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{u.tytul}</h1>
        <p className="mt-1 text-sm text-szary-600">{u.opis}</p>
      </div>
      {uslugi.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki">{u.brak}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {uslugi.map((s) => (
            <li key={s.id}>
              <KartaUslugi usluga={s} podglad={kontekst.tryb === "podglad"} onZglos={zglosZainteresowanie.bind(null, token, s.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
