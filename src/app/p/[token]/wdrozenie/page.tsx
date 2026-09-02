import { notFound } from "next/navigation";
import { copy } from "@/lib/copy";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";
import { supabaseSerwer } from "@/lib/supabase/server";

/** SPEC rozdz. 11: trasa istnieje, ale przy wyłączonej fladze onboarding_enabled zwraca 404. */
export default async function Wdrozenie({ params }: PageProps<"/p/[token]/wdrozenie">) {
  const { token } = await params;
  const { data } = await supabaseSerwer().from("settings").select("value").eq("key", "onboarding_enabled").maybeSingle();
  if (data?.value !== true) notFound();
  await wymagajKontekstuKlienta(token);
  return <h1 className="font-naglowek text-2xl">{copy.nawigacja.wdrozenie}</h1>;
}
