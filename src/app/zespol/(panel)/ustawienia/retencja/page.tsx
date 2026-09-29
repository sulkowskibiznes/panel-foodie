import { ListaRetencji } from "@/components/zespol/retencja/lista-retencji";
import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzMiesiaceRetencji, pobierzOczekujacePrzeglady, pobierzOstatnieDecyzje } from "@/lib/dane/retencja";

/** Ustawienia -> Retencja (SPEC rozdz. 17): zgłoszenia crona czekające na decyzję admina; nic nie kasuje się samo. */
export default async function UstawieniaRetencji() {
  const admin = await wymagajCzlonka();
  wymagajUprawnienia(admin, "ustawienia", "pelne");
  const [miesiace, oczekujace, decyzje] = await Promise.all([pobierzMiesiaceRetencji(), pobierzOczekujacePrzeglady(), pobierzOstatnieDecyzje(20)]);
  const t = copy.zespol.retencja;
  return (
    <div className="space-y-6" data-retencja>
      <div>
        <h2 className="font-naglowek text-xl text-foodie-czern">{t.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{t.opis.replace("{n}", String(miesiace))}</p>
        <p className="mt-1 max-w-prose text-xs text-szary-600">{t.sprzatanie}</p>
      </div>
      <ListaRetencji oczekujace={oczekujace} decyzje={decyzje} />
    </div>
  );
}
