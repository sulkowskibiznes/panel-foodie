import Link from "next/link";
import { wymagajCzlonka } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientowDla } from "@/lib/dane/klienci-zespolu";
import { pobierzPakietyNaPulpit, type PakietNaPulpicie } from "@/lib/dane/materialy";
import { etykietaOkresu, formatujKwote, liczebnik, tekstOdliczania } from "@/lib/format";
import { WIDZI_WSZYSTKICH_KLIENTOW } from "@/lib/uprawnienia";

const MS_DNIA = 86_400_000;

/** Kolory terminów jak w Bazie Klientów (CLAUDE.md, Marka): niebieski 6-7 dni, żółty 4-5, pomarańczowy 1-3, czerwony dziś, szary po terminie. */
function klasaTerminu(termin: string, teraz: Date): string {
  const dni = Math.ceil((new Date(termin).getTime() - teraz.getTime()) / MS_DNIA);
  if (dni < 0) return "text-termin-szary";
  if (dni === 0) return "text-termin-czerwony";
  if (dni <= 3) return "text-termin-pomaranczowy";
  if (dni <= 5) return "text-termin-zolty";
  return "text-termin-niebieski";
}

function ileTemu(iso: string, teraz: Date): string {
  const t = copy.zespol.pulpitPakiety;
  const ms = teraz.getTime() - new Date(iso).getTime();
  const dni = Math.floor(ms / MS_DNIA);
  if (dni >= 1) return liczebnik(dni, t.dni.jeden, t.dni.kilka, t.dni.wiele);
  return liczebnik(Math.max(1, Math.floor(ms / 3_600_000)), t.godziny.jeden, t.godziny.kilka, t.godziny.wiele);
}

function KomorkaAuto({ p, teraz }: { p: PakietNaPulpicie; teraz: Date }) {
  const t = copy.zespol.pulpitPakiety.auto;
  if (p.status === "poprawki") return <span className="text-bursztyn">{t.zatrzymane}</span>;
  if (p.status !== "do_akceptacji") return <span className="text-szary-300">{t.brak}</span>;
  if (!p.autoAkceptacjaO) return <span className="text-szary-600">{t.wylaczona}</span>;
  const minal = new Date(p.autoAkceptacjaO).getTime() <= teraz.getTime();
  return <span className={`font-medium ${klasaTerminu(p.autoAkceptacjaO, teraz)}`}>{minal ? t.minal : tekstOdliczania(p.autoAkceptacjaO, teraz)}</span>;
}

/** Pulpit (SPEC rozdz. 12.1): pakiety w toku z osobnym stanem „Auto-akceptacja wstrzymana" (1.4, poz. 26), pod spodem lista klientów. */
export default async function Pulpit() {
  const czlonek = await wymagajCzlonka();
  const klienci = await pobierzKlientowDla(czlonek);
  const pakiety = await pobierzPakietyNaPulpit(WIDZI_WSZYSTKICH_KLIENTOW.includes(czlonek.role) ? null : klienci.map((k) => k.id));
  const k = copy.zespol.pulpit.kolumny;
  const t = copy.zespol.pulpitPakiety;
  const teraz = new Date();

  return (
    <div>
      <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{copy.zespol.pulpit.tytul}</h1>
      <p className="mt-1 text-sm text-szary-600">{copy.zespol.pulpit.opis}</p>

      <section className="mt-6">
        <h2 className="font-naglowek text-lg text-foodie-czern">{t.tytul}</h2>
        <p className="mt-1 text-sm text-szary-600">{t.opis}</p>
        {pakiety.length === 0 ? (
          <p className="mt-4 rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki">{t.brak}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-miekki">
            <table aria-label={t.tytul} className="w-full min-w-[860px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
                <tr>
                  <th className="px-4 py-3">{t.kolumny.klient}</th>
                  <th className="px-4 py-3">{t.kolumny.miesiac}</th>
                  <th className="px-4 py-3">{t.kolumny.status}</th>
                  <th className="px-4 py-3">{t.kolumny.wyslano}</th>
                  <th className="px-4 py-3">{t.kolumny.czeka}</th>
                  <th className="px-4 py-3">{t.kolumny.auto}</th>
                  <th className="px-4 py-3">{t.kolumny.uwagi}</th>
                  <th className="px-4 py-3">{t.kolumny.akcja}</th>
                </tr>
              </thead>
              <tbody>
                {pakiety.map((p) => {
                  const odpowiedz = p.wstrzymana || p.nieprzeczytaneUwagi > 0;
                  return (
                    <tr key={p.id} data-pakiet-wiersz={p.id} data-wstrzymana={p.wstrzymana ? "true" : undefined} className={`border-t border-szary-100 ${p.wstrzymana ? "bg-amber-50" : ""}`}>
                      <td className="px-4 py-3 font-medium text-foodie-czern">{p.klient.name}</td>
                      <td className="px-4 py-3 text-szary-600">
                        {etykietaOkresu(p.okres.rok, p.okres.miesiac)}
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
                      <td className="px-4 py-3 text-szary-600">{p.wyslanoO && p.status === "do_akceptacji" ? ileTemu(p.wyslanoO, teraz) : t.auto.brak}</td>
                      <td className="px-4 py-3">
                        <KomorkaAuto p={p} teraz={teraz} />
                      </td>
                      <td className="px-4 py-3">
                        {p.nieprzeczytaneUwagi > 0 ? (
                          <span className="font-semibold text-bursztyn" data-nieprzeczytane={p.nieprzeczytaneUwagi}>
                            {t.nieprzeczytane.replace("{n}", String(p.nieprzeczytaneUwagi))}
                          </span>
                        ) : p.nierozwiazaneUwagi > 0 ? (
                          <span className="text-szary-600">{t.nierozwiazane.replace("{n}", String(p.nierozwiazaneUwagi))}</span>
                        ) : (
                          <span className="text-szary-300">{t.bezUwag}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/zespol/klienci/${p.klient.slug}/pakiety/${p.id}`} className={`font-medium hover:underline ${odpowiedz ? "text-bursztyn" : "text-foodie-fiolet"}`}>
                          {odpowiedz ? t.odpowiedz : t.otworz}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-naglowek text-lg text-foodie-czern">{copy.zespol.nawigacja.klienci}</h2>
        {klienci.length === 0 ? (
          <p className="mt-4 rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki">{copy.zespol.pulpit.brakKlientow}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-miekki">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-szary-600">
                <tr>
                  <th className="px-4 py-3">{k.klient}</th>
                  <th className="px-4 py-3">{k.kategoria}</th>
                  <th className="px-4 py-3">{k.pakiet}</th>
                  <th className="px-4 py-3 text-right">{k.doAkceptacji}</th>
                  <th className="px-4 py-3 text-right">{k.linki}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {klienci.map((kl) => (
                  <tr key={kl.id} className="border-t border-szary-100">
                    <td className="px-4 py-3 font-medium text-foodie-czern">{kl.name}</td>
                    <td className="px-4 py-3 text-szary-600">{copy.zespol.kategorieKrotko[kl.category]}</td>
                    <td className="px-4 py-3 text-szary-600">
                      {copy.zespol.pakiety[kl.tier]}
                      {kl.monthly_amount_net ? ` · ${formatujKwote(kl.monthly_amount_net)} ${copy.zespol.pulpit.miesiecznie}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {kl.doAkceptacji > 0 ? <span className="rounded-full bg-fiolet-050 px-2 py-0.5 font-medium text-fiolet-700">{kl.doAkceptacji}</span> : <span className="text-szary-300">0</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-szary-600">{kl.aktywneLinki}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/zespol/klienci/${kl.slug}`} className="font-medium text-foodie-fiolet hover:underline">
                        {copy.zespol.pulpit.otworz}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
