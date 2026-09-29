import Link from "next/link";
import { redirect } from "next/navigation";
import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzListeKlientow } from "@/lib/dane/klienci-zespolu";
import { pobierzOpiekunow } from "@/lib/dane/klienci-nowi";
import { formatujDate } from "@/lib/format";
import { filtrujKlientow, FILTRY_STATUSU, odczytajFiltry, SORTOWANIA } from "@/lib/klienci/lista";
import { KATEGORIE } from "@/lib/klienci/nowy";
import { maUprawnienie } from "@/lib/uprawnienia";

const POLE = "h-9 rounded-lg border border-szary-300 bg-white px-2 text-sm text-foodie-czern";

/**
 * Lista klientów (plan domknięcia, Etap 3b; SPEC rozdz. 12.1): wyszukiwarka i filtry w formularzu GET, dane wyłącznie
 * z zakresu członka zespołu (csm i content creator widzą tylko swoich). „Przejdź do klienta" z nagłówka (idz=1)
 * otwiera od razu kartę, gdy pasuje dokładnie jeden klient. Tu też lądują przerwy i zakończone współprace.
 */
export default async function ListaKlientow({ searchParams }: PageProps<"/zespol/klienci">) {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "klienci", "podglad");
  const sp = await searchParams;
  const filtry = odczytajFiltry(sp);
  const [wszyscy, opiekunowie] = await Promise.all([pobierzListeKlientow(czlonek), pobierzOpiekunow()]);
  const idz = sp.idz === "1" && filtry.q !== "";
  // „Przejdź do klienta" szuka we wszystkich statusach: zakończony klient też ma kartę.
  const lista = filtrujKlientow(wszyscy, idz ? { ...filtry, status: "wszystkie" } : filtry);
  const jedyny = lista[0];
  if (idz && lista.length === 1 && jedyny) redirect(`/zespol/klienci/${jedyny.slug}`);
  const nieaktywnych = wszyscy.filter((k) => k.status !== "aktywny").length;
  const t = copy.zespol.listaKlientow;
  const k = t.kolumny;

  return (
    <div data-lista-klientow>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{t.tytul}</h1>
          <p className="mt-1 max-w-prose text-sm text-szary-600">{t.opis}</p>
        </div>
        {maUprawnienie(czlonek.role, "klienci", "pelne") ? (
          <Link href="/zespol/klienci/nowy" className="inline-flex h-10 items-center rounded-lg bg-foodie-fiolet px-4 text-sm font-medium text-white hover:bg-fiolet-600" data-nowy-klient-link>
            {copy.zespol.nowyKlient.przycisk}
          </Link>
        ) : null}
      </div>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2" data-filtry-klientow>
        <label className="text-xs text-szary-600">
          {t.szukaj}
          <input type="search" name="q" defaultValue={filtry.q} placeholder={t.szukajPodpowiedz} className={`${POLE} mt-1 block w-56`} data-szukaj-klienta />
        </label>
        <label className="text-xs text-szary-600">
          {t.opiekun}
          <select name="opiekun" defaultValue={filtry.opiekun ?? ""} className={`${POLE} mt-1 block`}>
            <option value="">{t.wszyscyOpiekunowie}</option>
            <option value="brak">{t.bezOpiekuna}</option>
            {opiekunowie.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-szary-600">
          {t.kategoria}
          <select name="kategoria" defaultValue={filtry.kategoria ?? ""} className={`${POLE} mt-1 block`}>
            <option value="">{t.wszystkieKategorie}</option>
            {KATEGORIE.map((kat) => (
              <option key={kat} value={kat}>{copy.zespol.kategorieKrotko[kat]}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-szary-600">
          {t.status}
          <select name="status" defaultValue={filtry.status} className={`${POLE} mt-1 block`} data-filtr-statusu>
            {FILTRY_STATUSU.map((st) => (
              <option key={st} value={st}>{t.statusy[st]}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-szary-600">
          {t.sort}
          <select name="sort" defaultValue={filtry.sort} className={`${POLE} mt-1 block`}>
            {SORTOWANIA.map((so) => (
              <option key={so} value={so}>{t.sortowania[so]}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-lg bg-foodie-fiolet px-3 text-sm font-medium text-white hover:bg-fiolet-600">{t.pokaz}</button>
        <Link href="/zespol/klienci" className="h-9 rounded-lg border border-szary-300 px-3 text-sm leading-9 text-foodie-czern hover:bg-szary-050">{t.wyczysc}</Link>
        <span className="text-sm text-szary-600" data-liczba-klientow={lista.length}>{t.liczba.replace("{n}", String(lista.length)).replace("{razem}", String(wszyscy.length))}</span>
      </form>

      {lista.length === 0 ? (
        <p className="mt-4 rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki">{t.brak}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-miekki">
          <table aria-label={t.tytul} className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
              <tr>
                <th className="px-4 py-3">{k.klient}</th>
                <th className="px-4 py-3">{k.kategoria}</th>
                <th className="px-4 py-3">{k.opiekun}</th>
                <th className="px-4 py-3 text-right">{k.doAkceptacji}</th>
                <th className="px-4 py-3 text-right">{k.linki}</th>
                <th className="px-4 py-3">{k.okres}</th>
                <th className="px-4 py-3">{k.status}</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((kl) => (
                <tr key={kl.id} className="border-t border-szary-100" data-klient-wiersz={kl.slug} data-klient-nieaktywny={kl.status !== "aktywny" ? kl.slug : undefined}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/zespol/klienci/${kl.slug}`} className="text-foodie-czern hover:text-foodie-fiolet hover:underline">{kl.name}</Link>
                    {kl.demo ? <span className="ml-2 rounded-full bg-fiolet-050 px-2 py-0.5 text-xs font-medium text-fiolet-700">{copy.zespol.karta.demo}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-szary-600">{copy.zespol.kategorieKrotko[kl.category]}</td>
                  <td className="px-4 py-3 text-szary-600">{kl.opiekun ?? copy.zespol.karta.brakOpiekuna}</td>
                  <td className="px-4 py-3 text-right">
                    {kl.doAkceptacji > 0 ? <span className="rounded-full bg-fiolet-050 px-2 py-0.5 font-medium text-fiolet-700">{kl.doAkceptacji}</span> : <span className="text-szary-300">0</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-szary-600">{kl.aktywneLinki}</td>
                  <td className="px-4 py-3 text-szary-600">{kl.ostatniOkresDo ? formatujDate(kl.ostatniOkresDo, { day: "numeric", month: "short", year: "numeric" }) : t.bezPakietu}</td>
                  <td className="px-4 py-3">
                    {kl.status === "aktywny" ? (
                      <span className="text-szary-600">{copy.zespol.karta.statusKlienta.aktywny}</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-bursztyn">{copy.zespol.karta.statusKlienta[kl.status]}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtry.status === "trwajace" && nieaktywnych > 0 ? (
        <p className="mt-3 text-sm">
          <Link href="/zespol/klienci?status=nieaktywne" className="font-medium text-foodie-fiolet hover:underline" data-link-nieaktywnych>
            {t.nieaktywni.replace("{n}", String(nieaktywnych))}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
