import Link from "next/link";
import { after } from "next/server";
import { UwagaWSkrzynceKarta } from "@/components/zespol/skrzynka/uwaga-w-skrzynce";
import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientowDla, zakresKlientow } from "@/lib/dane/klienci-zespolu";
import { oznaczPrzeczytaneWSkrzynce, pobierzNierozwiazaneUwagi, type TypUwagi } from "@/lib/dane/skrzynka";
import { czyUuid } from "@/lib/walidacja";

const TYPY: TypUwagi[] = ["post", "relacja", "reels", "reklama", "pakiet"];
const POLE = "h-9 rounded-lg border border-szary-300 bg-white px-2 text-sm text-foodie-czern";

/** Skrzynka uwag (SPEC rozdz. 12.5): nierozwiązane uwagi klientów ze wszystkich pakietów, filtr po kliencie i rodzaju. */
export default async function SkrzynkaUwag({ searchParams }: PageProps<"/zespol/uwagi">) {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "materialy", "podglad");
  const sp = await searchParams;
  const klienci = await pobierzKlientowDla(czlonek);
  const zakres = await zakresKlientow(czlonek);
  const klientId = typeof sp.klient === "string" && czyUuid(sp.klient) && klienci.some((k) => k.id === sp.klient) ? sp.klient : null;
  const typ = typeof sp.typ === "string" && (TYPY as string[]).includes(sp.typ) ? (sp.typ as TypUwagi) : null;
  const uwagi = await pobierzNierozwiazaneUwagi(zakres, { clientId: klientId, typ });
  after(() => oznaczPrzeczytaneWSkrzynce(uwagi.filter((u) => u.nieprzeczytana).map((u) => u.id)));
  const s = copy.zespol.skrzynka;

  return (
    <div data-skrzynka-uwag>
      <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{s.tytul}</h1>
      <p className="mt-1 max-w-prose text-sm text-szary-600">{s.opis}</p>
      <form method="get" className="mt-4 flex flex-wrap items-end gap-2" data-filtry-skrzynki>
        <label className="text-xs text-szary-600">
          {s.filtrKlient}
          <select name="klient" defaultValue={klientId ?? ""} className={`${POLE} mt-1 block`}>
            <option value="">{s.wszyscy}</option>
            {klienci.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-szary-600">
          {s.filtrTyp}
          <select name="typ" defaultValue={typ ?? ""} className={`${POLE} mt-1 block`}>
            <option value="">{s.wszystkieTypy}</option>
            {TYPY.map((t) => (
              <option key={t} value={t}>{s.typ[t]}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-lg bg-foodie-fiolet px-3 text-sm font-medium text-white hover:bg-fiolet-600">{s.filtruj}</button>
        <Link href="/zespol/uwagi" className="h-9 rounded-lg border border-szary-300 px-3 text-sm leading-9 text-foodie-czern hover:bg-szary-050">{copy.zespol.pulpitPakiety.filtry.wyczysc}</Link>
        <span className="text-sm text-szary-600" data-liczba-uwag={uwagi.length}>{s.liczba.replace("{n}", String(uwagi.length))}</span>
      </form>
      {uwagi.length === 0 ? (
        <p className="mt-4 rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki">{s.brak}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {uwagi.map((u) => (
            <UwagaWSkrzynceKarta key={u.id} u={u} />
          ))}
        </ul>
      )}
    </div>
  );
}
