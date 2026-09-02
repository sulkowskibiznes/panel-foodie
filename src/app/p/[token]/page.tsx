import { redirect } from "next/navigation";
import { EkranPin } from "@/components/klient/ekran-pin";
import { pobierzSesjeKlienta } from "@/lib/sesja-klienta";

/**
 * Wejście z linku. Z żywą sesją dla tego linku: od razu Start. Bez sesji: ekran PIN,
 * IDENTYCZNY dla istniejącego i nieistniejącego tokenu (SPEC rozdz. 4.3, kryterium 1).
 */
export default async function StronaWejscia({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const sesja = await pobierzSesjeKlienta(token);
  if (sesja) redirect(`/p/${token}/start`);
  return <EkranPin token={token} />;
}
