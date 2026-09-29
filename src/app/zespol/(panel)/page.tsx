import Link from "next/link";
import { BanerCronow } from "@/components/zespol/pulpit/baner-cronow";
import { PokazLinkPulpit } from "@/components/zespol/pulpit/pokaz-link";
import { wymagajCzlonka } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { ocenCrony } from "@/lib/crony/monitoring";
import { liczNieudaneOutbox, pobierzPrzebiegiCronow } from "@/lib/dane/crony";
import { pobierzIdsMoichKlientow, pobierzKlientowDla } from "@/lib/dane/klienci-zespolu";
import { pobierzOkresyPakietow, pobierzPakietyNaPulpit, type PakietNaPulpicie } from "@/lib/dane/materialy";
import { etykietaMiesiaca, etykietaOkresu, formatujDate, liczebnik, tekstOdliczania } from "@/lib/format";
import { dataLokalna, kluczMiesiaca, miesiacZDaty, parsujMiesiac } from "@/lib/harmonogram/kalendarz";
import { czyWKafelku, KAFELKI, klienciBezNastepnegoPakietu, policzKafelki, sortujWgPilnosci, type Kafelek } from "@/lib/pakiety/pilnosc";
import { KLASA_TERMINU, kolorTerminu } from "@/lib/pakiety/terminy";
import { maUprawnienie, MOZE_ODSZYFROWAC_TOKEN, WIDZI_WSZYSTKICH_KLIENTOW } from "@/lib/uprawnienia";

const MS_DNIA = 86_400_000;
const POLE = "h-9 rounded-lg border border-szary-300 bg-white px-2 text-sm text-foodie-czern";
/** Content creator widzi „Moją pracę": najpierw to, co sam poprawia i przygotowuje. */
const KAFELKI_MOJA_PRACA: Kafelek[] = ["poprawki", "szkice", "noweUwagi", "auto24h", "wstrzymana", "doZaplanowania"];

function ileTemu(iso: string, teraz: Date): string {
  const t = copy.zespol.pulpitPakiety;
  const ms = teraz.getTime() - new Date(iso).getTime();
  const dni = Math.floor(ms / MS_DNIA);
  if (dni >= 1) return liczebnik(dni, t.dni.jeden, t.dni.kilka, t.dni.wiele);
  return liczebnik(Math.max(1, Math.floor(ms / 3_600_000)), t.godziny.jeden, t.godziny.kilka, t.godziny.wiele);
}

/** Kolory terminów jak w Bazie Klientów (lib/pakiety/terminy.ts): niebieski 6-7 dni, żółty 4-5, pomarańczowy 1-3, czerwony dziś, szary po terminie. */
function KomorkaAuto({ p, teraz }: { p: PakietNaPulpicie; teraz: Date }) {
  const t = copy.zespol.pulpitPakiety.auto;
  if (p.status === "poprawki") return <span className="text-bursztyn">{t.zatrzymane}</span>;
  if (p.status !== "do_akceptacji") return <span className="text-szary-300">{t.brak}</span>;
  if (!p.autoAkceptacjaO) return <span className="text-szary-600">{t.wylaczona}</span>;
  const kolor = kolorTerminu(p.autoAkceptacjaO, teraz);
  return (
    <span className={`font-medium ${KLASA_TERMINU[kolor]}`} data-kolor-terminu={kolor}>
      {kolor === "szary" ? t.minal : tekstOdliczania(p.autoAkceptacjaO, teraz)}
    </span>
  );
}

type Filtry = { zakres: "moi" | "wszyscy"; kafelek: Kafelek | null; miesiac: string | null };

function odczytajFiltry(sp: Record<string, string | string[] | undefined>, widziWszystkich: boolean): Filtry {
  const jeden = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const kafelek = jeden("kafelek");
  return {
    zakres: widziWszystkich && jeden("zakres") === "moi" ? "moi" : "wszyscy",
    kafelek: kafelek && (KAFELKI as readonly string[]).includes(kafelek) ? (kafelek as Kafelek) : null,
    miesiac: parsujMiesiac(jeden("m")) ? jeden("m") : null,
  };
}

/** Miesiąc startu pakietu jako „YYYY-MM": filtr pulpitu po miesiącu, w którym pakiet się zaczyna (okres bywa na styku dwóch miesięcy). */
function miesiacStartu(p: PakietNaPulpicie): string {
  const m = miesiacZDaty(p.okres.od);
  return kluczMiesiaca(m.rok, m.miesiac);
}

/**
 * Pulpit (SPEC rozdz. 12.1; plan domknięcia, Etap 3b): kafelki pilności z licznikami (zarazem filtry), pakiety w toku
 * od najpilniejszego, „Otwarty przez klienta" zamiast drugiej kolumny czasu, klienci bez pakietu na następny okres.
 * Content creator widzi to samo jako „Moja praca". Lista klientów ma własną zakładkę (Klienci).
 */
export default async function Pulpit({ searchParams }: PageProps<"/zespol">) {
  const czlonek = await wymagajCzlonka();
  const widziWszystkich = WIDZI_WSZYSTKICH_KLIENTOW.includes(czlonek.role);
  const mojaPraca = czlonek.role === "content_creator";
  const sp = await searchParams;
  const filtry = odczytajFiltry(sp, widziWszystkich);
  const usunieto = typeof sp.usunieto === "string" ? sp.usunieto.slice(0, 120) : null;
  const teraz = new Date();
  // Monitoring cronów tylko dla admina; lokalnie crony nie chodzą same, więc brak zapisu nie jest tam problemem.
  const problemyCronow = maUprawnienie(czlonek.role, "ustawienia", "pelne")
    ? ocenCrony(await pobierzPrzebiegiCronow(), teraz, { nieudaneOutbox: await liczNieudaneOutbox(), wymagajPrzebiegu: process.env.NODE_ENV === "production" })
    : [];
  const klienci = await pobierzKlientowDla(czlonek);
  const zakres = !widziWszystkich ? klienci.map((k) => k.id) : filtry.zakres === "moi" ? await pobierzIdsMoichKlientow(czlonek.id) : null;
  const [wszystkiePakiety, okresy] = await Promise.all([pobierzPakietyNaPulpit(zakres, teraz), pobierzOkresyPakietow(zakres)]);
  const wMiesiacu = wszystkiePakiety.filter((p) => (filtry.miesiac ? miesiacStartu(p) === filtry.miesiac : true));
  const kafelki = policzKafelki(wMiesiacu, teraz);
  const pakiety = sortujWgPilnosci(
    wMiesiacu.filter((p) => (filtry.kafelek ? czyWKafelku(p, filtry.kafelek, teraz) : true)),
    teraz,
  );
  const miesiace = [...new Set(wszystkiePakiety.map(miesiacStartu))].sort().reverse();
  const klienciWZakresie = klienci.filter((k) => !k.demo && (zakres === null || zakres.includes(k.id)));
  const bezNastepnego = klienciBezNastepnegoPakietu(klienciWZakresie, okresy, dataLokalna(teraz));
  const mozeTworzycPakiety = maUprawnienie(czlonek.role, "materialy", "pelne");
  const t = copy.zespol.pulpitPakiety;
  const pu = copy.zespol.pulpit;
  const f = t.filtry;
  const mozePokazacLink = MOZE_ODSZYFROWAC_TOKEN.includes(czlonek.role);
  const kolejnoscKafelkow = mojaPraca ? KAFELKI_MOJA_PRACA : [...KAFELKI];
  // Link kafelka zachowuje zakres i miesiąc; ponowne kliknięcie aktywnego kafelka zdejmuje filtr.
  const adresKafelka = (k: Kafelek | null) => {
    const q = new URLSearchParams();
    if (filtry.zakres === "moi") q.set("zakres", "moi");
    if (filtry.miesiac) q.set("m", filtry.miesiac);
    if (k) q.set("kafelek", k);
    const s = q.toString();
    return s ? `/zespol?${s}` : "/zespol";
  };

  return (
    <div>
      <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{mojaPraca ? pu.tytulMojaPraca : pu.tytul}</h1>
      <p className="mt-1 text-sm text-szary-600">{mojaPraca ? pu.opisMojaPraca : pu.opis}</p>
      <BanerCronow problemy={problemyCronow} />
      {usunieto ? (
        <p role="status" className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-zielony" data-usunieto-klienta>
          {pu.usunietoKlienta.replace("{klient}", usunieto)}
        </p>
      ) : null}
      {klienci.length === 0 ? <p className="mt-4 rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki">{pu.brakKlientow}</p> : null}

      <section className="mt-6" aria-label={pu.kafelkiNaglowek}>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-kafelki>
          {kolejnoscKafelkow.map((k) => {
            const aktywny = filtry.kafelek === k;
            const pilny = (k === "wstrzymana" || k === "auto24h" || k === "noweUwagi") && kafelki[k] > 0;
            return (
              <li key={k}>
                <Link
                  href={adresKafelka(aktywny ? null : k)}
                  aria-current={aktywny ? "true" : undefined}
                  className={`block rounded-xl border p-3 shadow-miekki transition-colors ${aktywny ? "border-foodie-fiolet bg-fiolet-050" : pilny ? "border-amber-200 bg-amber-50 hover:border-bursztyn" : "border-transparent bg-white hover:border-szary-300"}`}
                  data-kafelek={k}
                  data-liczba={kafelki[k]}
                >
                  <span className={`block font-naglowek text-2xl ${pilny ? "text-bursztyn" : "text-foodie-czern"}`}>{kafelki[k]}</span>
                  <span className="mt-0.5 block text-xs font-medium text-szary-600">{pu.kafelki[k]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-naglowek text-lg text-foodie-czern">{filtry.kafelek ? pu.kafelki[filtry.kafelek] : t.tytul}</h2>
            <p className="mt-1 text-sm text-szary-600">{t.opis}</p>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-2" data-filtry-pulpitu>
            {filtry.kafelek ? <input type="hidden" name="kafelek" value={filtry.kafelek} /> : null}
            {widziWszystkich ? (
              <label className="text-xs text-szary-600">
                {f.zakres}
                <select name="zakres" defaultValue={filtry.zakres} className={`${POLE} mt-1 block`}>
                  <option value="wszyscy">{f.wszyscy}</option>
                  <option value="moi">{f.moi}</option>
                </select>
              </label>
            ) : null}
            <label className="text-xs text-szary-600">
              {f.miesiac}
              <select name="m" defaultValue={filtry.miesiac ?? ""} className={`${POLE} mt-1 block`}>
                <option value="">{f.wszystkieMiesiace}</option>
                {miesiace.map((m) => {
                  const o = parsujMiesiac(m);
                  return (
                    <option key={m} value={m}>{o ? etykietaMiesiaca(o.rok, o.miesiac) : m}</option>
                  );
                })}
              </select>
            </label>
            <button type="submit" className="h-9 rounded-lg bg-foodie-fiolet px-3 text-sm font-medium text-white hover:bg-fiolet-600">{f.pokaz}</button>
            {filtry.kafelek || filtry.miesiac || filtry.zakres === "moi" ? (
              <Link href="/zespol" className="h-9 rounded-lg border border-szary-300 px-3 text-sm leading-9 text-foodie-czern hover:bg-szary-050" data-wyczysc-filtry>{pu.wszystkiePakiety}</Link>
            ) : null}
          </form>
        </div>
        {pakiety.length === 0 ? (
          <p className="mt-4 rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki">{t.brak}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-miekki">
            <table aria-label={t.tytul} className="w-full min-w-[960px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
                <tr>
                  <th className="px-4 py-3">{t.kolumny.klient}</th>
                  <th className="px-4 py-3">{t.kolumny.okres}</th>
                  <th className="px-4 py-3">{t.kolumny.status}</th>
                  <th className="px-4 py-3">{t.kolumny.wyslano}</th>
                  <th className="px-4 py-3">{t.kolumny.otwarty}</th>
                  <th className="px-4 py-3">{t.kolumny.auto}</th>
                  <th className="px-4 py-3">{t.kolumny.uwagi}</th>
                  <th className="px-4 py-3">{t.kolumny.akcja}</th>
                </tr>
              </thead>
              <tbody>
                {pakiety.map((p) => {
                  const odpowiedz = p.wstrzymana || p.nieprzeczytaneUwagi > 0;
                  const adresPakietu = `/zespol/klienci/${p.klient.slug}/pakiety/${p.id}`;
                  return (
                    <tr key={p.id} data-pakiet-wiersz={p.id} data-wstrzymana={p.wstrzymana ? "true" : undefined} className={`border-t border-szary-100 ${p.wstrzymana ? "bg-amber-50" : ""}`}>
                      <td className="px-4 py-3 font-medium text-foodie-czern">{p.klient.name}</td>
                      <td className="px-4 py-3 text-szary-600">
                        {etykietaOkresu(p.okres.od, p.okres.do)}
                        {p.nazwaLokalu ? <span className="block text-xs">{p.nazwaLokalu}</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        {p.wstrzymana ? (
                          <span className="font-semibold text-bursztyn">{t.wstrzymana}</span>
                        ) : (
                          <span className="text-foodie-czern">
                            {copy.materialy.status[p.status]}
                            {p.runda > 1 ? ` v${p.runda}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-szary-600">{p.wyslanoO ? t.temu.replace("{czas}", ileTemu(p.wyslanoO, teraz)) : t.auto.brak}</td>
                      <td className="px-4 py-3 text-szary-600" data-otwarty={p.otwartoO ? "tak" : "nie"}>
                        {p.status !== "do_akceptacji" ? t.auto.brak : p.otwartoO ? t.temu.replace("{czas}", ileTemu(p.otwartoO, teraz)) : <span className="font-medium text-bursztyn">{t.nieotwarty}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <KomorkaAuto p={p} teraz={teraz} />
                      </td>
                      <td className="px-4 py-3">
                        {p.nieprzeczytaneUwagi > 0 ? (
                          <span className="font-semibold text-bursztyn" data-nieprzeczytane={p.nieprzeczytaneUwagi}>
                            {t.nieprzeczytane.replace("{n}", String(p.nieprzeczytaneUwagi))}
                          </span>
                        ) : p.nierozwiazaneUwagi > 0 ? (
                          <span className="text-szary-600">{liczebnik(p.nierozwiazaneUwagi, t.nierozwiazane.jeden, t.nierozwiazane.kilka, t.nierozwiazane.wiele)}</span>
                        ) : (
                          <span className="text-szary-300">{t.bezUwag}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {odpowiedz ? (
                            <Link href={`${adresPakietu}#uwagi`} className="font-medium text-bursztyn hover:underline">{t.odpowiedz}</Link>
                          ) : p.status === "poprawki" ? (
                            <Link href={adresPakietu} className="font-medium text-bursztyn hover:underline">{t.zobaczUwagi}</Link>
                          ) : (
                            <Link href={adresPakietu} className="font-medium text-foodie-fiolet hover:underline">{t.otworz}</Link>
                          )}
                          {p.status === "do_akceptacji" && mozePokazacLink ? <PokazLinkPulpit slug={p.klient.slug} nazwaKlienta={p.klient.name} /> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {bezNastepnego.length > 0 ? (
        <section className="mt-8" data-bez-nastepnego>
          <h2 className="font-naglowek text-lg text-foodie-czern">{pu.bezNastepnego.tytul}</h2>
          <p className="mt-1 text-sm text-szary-600">{pu.bezNastepnego.opis}</p>
          <ul className="mt-3 divide-y divide-szary-100 rounded-xl bg-white shadow-miekki">
            {bezNastepnego.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm" data-klient-bez-pakietu={k.slug}>
                <div>
                  <span className="font-medium text-foodie-czern">{k.name}</span>
                  <span className="ml-2 text-szary-600">{k.ostatniDo ? pu.bezNastepnego.konczySie.replace("{data}", formatujDate(k.ostatniDo, { day: "numeric", month: "long" })) : pu.bezNastepnego.brakPakietu}</span>
                </div>
                <Link href={mozeTworzycPakiety ? `/zespol/klienci/${k.slug}/pakiety/nowy` : `/zespol/klienci/${k.slug}`} className="font-medium text-foodie-fiolet hover:underline">
                  {mozeTworzycPakiety ? pu.bezNastepnego.nowyPakiet : pu.bezNastepnego.otworz}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
