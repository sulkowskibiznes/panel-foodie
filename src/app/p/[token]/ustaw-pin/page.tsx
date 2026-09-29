import { notFound, redirect } from "next/navigation";
import { FormularzPinu } from "@/components/klient/formularz-pinu";
import { odczytajPozwolenieNaPin } from "@/lib/pin-klienta";
import { czyTokenPodgladu } from "@/lib/podglad-zespolu";
import { ustawWlasnyPin } from "./akcje";

/**
 * Ustawienie własnego PIN-u po kodzie startowym (Etap 2 planu domknięcia). Bez sesji: wejście tylko z ważnym
 * pozwoleniem z cookie (15 min, ten sam link i wersja PIN-u); w każdym innym przypadku powrót do ekranu PIN.
 */
export default async function UstawPin({ params }: PageProps<"/p/[token]/ustaw-pin">) {
  const { token } = await params;
  if (czyTokenPodgladu(token)) notFound();
  if (!(await odczytajPozwolenieNaPin(token))) redirect(`/p/${token}`);
  return <FormularzPinu token={token} tryb="ustaw" akcja={ustawWlasnyPin} />;
}
