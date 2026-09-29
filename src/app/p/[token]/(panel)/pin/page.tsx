import { notFound } from "next/navigation";
import { FormularzPinu } from "@/components/klient/formularz-pinu";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";
import { zmienPin } from "./akcje";

/** „Zmień PIN" (Etap 2 planu domknięcia): tylko klient z własną sesją; podgląd zespołu dostaje 404 (tryb tylko do odczytu). */
export default async function ZmianaPinu({ params }: PageProps<"/p/[token]/pin">) {
  const { token } = await params;
  const kontekst = await wymagajKontekstuKlienta(token);
  if (kontekst.tryb !== "klient") notFound();
  return <FormularzPinu token={token} tryb="zmien" akcja={zmienPin} />;
}
