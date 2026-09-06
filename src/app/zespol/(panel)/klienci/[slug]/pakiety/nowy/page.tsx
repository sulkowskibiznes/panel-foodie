import Link from "next/link";
import { notFound } from "next/navigation";
import { KreatorPakietu, type IstniejacyPakiet } from "@/components/zespol/kreator/kreator-pakietu";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { supabaseSerwer } from "@/lib/supabase/server";
import { utworzPakietAkcja } from "./akcje";

/**
 * Kreator pakietu (SPEC rozdz. 12.3): okres od-do wpisywany ręcznie, numer miesiąca współpracy podpowiadany
 * z ostatniego pakietu klienta. Istniejące pakiety służą do ostrzeżenia o zachodzących okresach (bez blokady).
 */
export default async function NowyPakiet({ params }: PageProps<"/zespol/klienci/[slug]/pakiety/nowy">) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "materialy", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const { data: pakiety } = await supabaseSerwer().from("packages").select("id, title, location_id, period_from, period_to, cooperation_month").eq("client_id", klient.id).order("period_from", { ascending: false }).order("created_at", { ascending: false });
  const istniejace: IstniejacyPakiet[] = (pakiety ?? []).map((p) => ({ id: p.id, tytul: p.title ?? "", lokalId: p.location_id, od: p.period_from, do: p.period_to, miesiacWspolpracy: p.cooperation_month }));
  const k = copy.zespol.kreator;

  return (
    <div className="space-y-4">
      <Link href={`/zespol/klienci/${slug}/materialy`} className="text-sm font-medium text-foodie-fiolet hover:underline">
        {copy.zespol.pakietyMaterialow.wroc}
      </Link>
      <div>
        <h2 className="font-naglowek text-xl text-foodie-czern">{k.tytul}</h2>
        <p className="mt-1 max-w-prose text-sm text-szary-600">{k.opis}</p>
      </div>
      <KreatorPakietu slug={slug} kategoria={klient.category} lokale={klient.locations.map((l) => ({ id: l.id, name: l.name }))} startWspolpracy={klient.cooperation_started_on} istniejace={istniejace} utworz={utworzPakietAkcja.bind(null, slug)} />
    </div>
  );
}
