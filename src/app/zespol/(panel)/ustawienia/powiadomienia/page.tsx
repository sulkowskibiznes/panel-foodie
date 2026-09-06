import { ListaPowiadomien } from "@/components/zespol/powiadomienia/lista-powiadomien";
import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKolejkePowiadomien } from "@/lib/dane/powiadomienia";
import { adresZapiera } from "@/lib/outbox/baza";

/** Ustawienia -> Powiadomienia (SPEC rozdz. 15): kolejka outbox do Zapiera, wyłącznie admin. Adres webhooka nigdy nie trafia na ekran. */
export default async function UstawieniaPowiadomien() {
  const admin = await wymagajCzlonka();
  wymagajUprawnienia(admin, "ustawienia", "pelne");
  const kolejka = await pobierzKolejkePowiadomien(100);
  const t = copy.zespol.powiadomienia;
  const skonfigurowany = adresZapiera() !== null;
  return (
    <div className="space-y-6" data-powiadomienia>
      <div>
        <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{copy.zespol.ustawienia.tytul}</h1>
        <h2 className="mt-4 font-naglowek text-xl text-foodie-czern">{t.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{t.opis}</p>
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${skonfigurowany ? "bg-green-50 text-zielony" : "bg-amber-50 text-bursztyn"}`} data-adres-zapiera={skonfigurowany ? "tak" : "nie"}>
          {skonfigurowany ? t.adresSkonfigurowany : t.adresBrak}
        </p>
      </div>
      <ListaPowiadomien kolejka={kolejka} />
    </div>
  );
}
