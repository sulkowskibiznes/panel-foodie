import { notFound, redirect } from "next/navigation";
import { EkranPin } from "@/components/klient/ekran-pin";
import { pobierzKontekstKlienta } from "@/lib/kontekst-klienta";
import { czyTokenPodgladu } from "@/lib/podglad-zespolu";
import { pobierzSesjeKlienta } from "@/lib/sesja-klienta";

/**
 * Wejście z linku. Z żywą sesją dla tego linku: od razu Start. Bez sesji: ekran PIN,
 * IDENTYCZNY dla istniejącego i nieistniejącego tokenu (SPEC rozdz. 4.3, kryterium 1).
 * Token podglądu zespołu: Start przy ważnej sesji zespołu, inaczej 404.
 */
export default async function StronaWejscia({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  if (czyTokenPodgladu(token)) {
    if (!(await pobierzKontekstKlienta(token))) notFound();
    redirect(`/p/${token}/start`);
  }
  const sesja = await pobierzSesjeKlienta(token);
  if (sesja) redirect(`/p/${token}/start`);
  return <EkranPin token={token} />;
}
