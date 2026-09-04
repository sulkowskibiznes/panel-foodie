import Link from "next/link";
import { notFound } from "next/navigation";
import { KreatorPakietu } from "@/components/zespol/kreator/kreator-pakietu";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { przesunMiesiac } from "@/lib/harmonogram/kalendarz";
import { supabaseSerwer } from "@/lib/supabase/server";
import { utworzPakietAkcja } from "./akcje";

/** Kreator pakietu (SPEC rozdz. 12.3). Domyślnie następny miesiąc; zajęte okresy z bazy, żeby nie wpaść na unique. */
export default async function NowyPakiet({ params }: PageProps<"/zespol/klienci/[slug]/pakiety/nowy">) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "materialy", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const { data: pakiety } = await supabaseSerwer().from("packages").select("period_year, period_month, location_id").eq("client_id", klient.id);
  const zajete = (pakiety ?? []).map((p) => `${p.period_year}-${String(p.period_month).padStart(2, "0")}${klient.category === "kat1" ? `:${p.location_id ?? ""}` : ""}`);
  const dzis = new Date();
  const domyslny = przesunMiesiac(dzis.getFullYear(), dzis.getMonth() + 1, 1);
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
      <KreatorPakietu slug={slug} kategoria={klient.category} lokale={klient.locations.map((l) => ({ id: l.id, name: l.name }))} startWspolpracy={klient.cooperation_started_on} domyslnyOkres={domyslny} zajeteOkresy={zajete} utworz={utworzPakietAkcja.bind(null, slug)} />
    </div>
  );
}
