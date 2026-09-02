import { FormularzCzlonka } from "@/components/zespol/ustawienia/formularz-czlonka";
import { ListaCzlonkow } from "@/components/zespol/ustawienia/lista-czlonkow";
import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { supabaseSerwer } from "@/lib/supabase/server";

/** Ustawienia → Zespół: wyłącznie admin (SPEC rozdz. 2). Lista = allowlista logowania. */
export default async function UstawieniaZespolu() {
  const admin = await wymagajCzlonka();
  wymagajUprawnienia(admin, "ustawienia", "pelne");
  const { data } = await supabaseSerwer().from("team_members").select("id, name, email, role, active").order("name");
  const u = copy.zespol.ustawienia.zespol;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{copy.zespol.ustawienia.tytul}</h1>
        <h2 className="mt-4 font-naglowek text-xl text-foodie-czern">{u.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{u.opis}</p>
      </div>
      <ListaCzlonkow czlonkowie={data ?? []} adminId={admin.id} />
      <FormularzCzlonka />
    </div>
  );
}
