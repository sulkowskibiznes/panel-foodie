import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { NAZWY_CRONOW } from "@/lib/crony/monitoring";
import { pobierzPrzebiegiCronow } from "@/lib/dane/crony";
import { pobierzMiesiaceRetencji } from "@/lib/dane/retencja";
import { pobierzUstawienia, pobierzUstawieniaAutoAkceptacji } from "@/lib/dane/ustawienia";
import { konfiguracjaDysku } from "@/lib/drive/klient";
import { formatujDateCzas } from "@/lib/format";
import { adresZapiera } from "@/lib/outbox/baza";

function Wiersz({ etykieta, wartosc, dane, notka }: { etykieta: string; wartosc: string; dane?: string; notka?: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[16rem_1fr]" data-ustawienie={dane}>
      <dt className="text-sm text-szary-600">{etykieta}</dt>
      <dd className="text-sm font-medium text-foodie-czern">
        {wartosc}
        {/* Notka w <dd>, nie luzem w <dl>: lista definicji może zawierać tylko pary dt/dd. */}
        {notka ? <span className="mt-1 block text-xs font-normal text-szary-600">{notka}</span> : null}
      </dd>
    </div>
  );
}

/**
 * Ustawienia → Ogólne (plan domknięcia, Etap 3a): ustawienia globalne, integracje i ostatnie przebiegi cronów, tylko do
 * odczytu. Wartości sekretów nigdy nie trafiają na ekran, pokazujemy wyłącznie, czy są skonfigurowane.
 */
export default async function UstawieniaOgolne() {
  const admin = await wymagajCzlonka();
  wymagajUprawnienia(admin, "ustawienia", "pelne");
  const [auto, miesiace, flagi, przebiegi] = await Promise.all([pobierzUstawieniaAutoAkceptacji(), pobierzMiesiaceRetencji(), pobierzUstawienia(["onboarding_enabled"]), pobierzPrzebiegiCronow()]);
  const o = copy.zespol.ustawienia.ogolne;
  const wdrozenie = flagi.get("onboarding_enabled") === true || flagi.get("onboarding_enabled") === "true";
  const tak = (warunek: boolean) => (warunek ? o.skonfigurowane : o.brak);
  const pieprz = (process.env.PIN_PEPPER ?? "").length >= 32;

  return (
    <div className="space-y-6" data-ustawienia-ogolne>
      <div>
        <h2 className="font-naglowek text-xl text-foodie-czern">{o.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{o.opis}</p>
      </div>
      <dl className="divide-y divide-szary-100 rounded-xl bg-white px-5 shadow-miekki">
        <Wiersz dane="auto" etykieta={o.autoAkceptacja} wartosc={o.autoAkceptacjaWartosc.replace("{godziny}", String(auto.godziny)).replace("{dni}", auto.dniRobocze ? o.dniRobocze : o.dniKalendarzowe)} notka={o.autoPerKlient} />
        <Wiersz dane="retencja" etykieta={o.retencja} wartosc={o.retencjaWartosc.replace("{n}", String(miesiace))} />
        <Wiersz dane="wdrozenie" etykieta={o.wdrozenie} wartosc={wdrozenie ? o.wlaczone : o.wylaczone} />
      </dl>
      <section>
        <h3 className="font-naglowek text-lg text-foodie-czern">{o.integracje}</h3>
        <dl className="mt-2 divide-y divide-szary-100 rounded-xl bg-white px-5 shadow-miekki">
          <Wiersz dane="zapier" etykieta={o.zapier} wartosc={tak(adresZapiera() !== null)} />
          <Wiersz dane="dysk" etykieta={o.dysk} wartosc={tak(konfiguracjaDysku() !== null)} />
          <Wiersz dane="raporty" etykieta={o.raporty} wartosc={tak(!!process.env.INGEST_TOKEN)} />
          <Wiersz dane="pieprz" etykieta={o.pieprz} wartosc={tak(pieprz)} />
        </dl>
      </section>
      <section>
        <h3 className="font-naglowek text-lg text-foodie-czern">{o.crony}</h3>
        <dl className="mt-2 divide-y divide-szary-100 rounded-xl bg-white px-5 shadow-miekki">
          {NAZWY_CRONOW.map((c) => {
            const p = przebiegi[c];
            return <Wiersz key={c} dane={`cron-${c}`} etykieta={copy.zespol.crony.nazwy[c]} wartosc={p ? o.cronOstatni.replace("{data}", formatujDateCzas(p.at)) : o.cronNigdy} />;
          })}
        </dl>
      </section>
    </div>
  );
}
