import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { czyWidziKlienta, pobierzCzlonkaZespolu } from "@/lib/auth-zespol";
import { env } from "@/lib/env";
import { wyprowadzKlucz } from "@/lib/krypto";
import { czyTokenPodgladu, odczytajTokenPodgladu } from "@/lib/podglad-zespolu";
import { pobierzSesjeKlienta } from "@/lib/sesja-klienta";
import { supabaseSerwer } from "@/lib/supabase/server";
import { mozeImpersonowac } from "@/lib/uprawnienia";
import { infoZadania } from "@/lib/zadanie";

/**
 * Kontekst strony klienta. Dwa tryby:
 * - `klient`: sesja z linku i PIN-u (rozdz. 4),
 * - `podglad`: „Zobacz jak klient" (rozdz. 2, kryterium 25): token podpisany w adresie plus żywa sesja Auth
 *   TEGO SAMEGO członka zespołu; wyłącznie odczyt, bez akceptacji, komentarzy i śladów w `item_views`.
 * Wszystkie strony klienta biorą kontekst stąd, więc impersonacja nie rozwidla kodu.
 */
export type KontekstKlienta =
  | { tryb: "klient"; token: string; clientId: string; contactId: string | null; linkId: string; label: string; canApprove: boolean }
  | { tryb: "podglad"; token: string; clientId: string; contactId: null; linkId: null; label: string; canApprove: false; memberId: string; memberName: string; slug: string; nazwaKlienta: string };

export function kluczPodgladu(): Buffer {
  return wyprowadzKlucz(env().SESSION_SECRET, "podglad");
}

const kontekstPodgladu = cache(async (token: string): Promise<KontekstKlienta | null> => {
  const ladunek = odczytajTokenPodgladu(kluczPodgladu(), token);
  if (!ladunek) return null;
  const czlonek = await pobierzCzlonkaZespolu();
  if (!czlonek || czlonek.id !== ladunek.memberId) return null;
  const { data: klient } = await supabaseSerwer().from("clients").select("id, slug, name, demo").eq("id", ladunek.clientId).maybeSingle();
  if (!klient || !mozeImpersonowac(czlonek.role, klient.demo) || !(await czyWidziKlienta(czlonek, klient.id))) return null;
  return { tryb: "podglad", token, clientId: klient.id, contactId: null, linkId: null, label: czlonek.name, canApprove: false, memberId: czlonek.id, memberName: czlonek.name, slug: klient.slug, nazwaKlienta: klient.name };
});

export const pobierzKontekstKlienta = cache(async (token: string): Promise<KontekstKlienta | null> => {
  if (czyTokenPodgladu(token)) return kontekstPodgladu(token);
  const sesja = await pobierzSesjeKlienta(token);
  if (!sesja) return null;
  return {
    tryb: "klient",
    token,
    clientId: sesja.clientId,
    contactId: sesja.contactId,
    linkId: sesja.linkId,
    label: sesja.label,
    canApprove: sesja.canApprove,
  };
});

/**
 * Wymaga kontekstu: bez sesji klienta ekran PIN; gdy pora na rotację, jednorazowe przejście przez trasę rotacji.
 * Token podglądu bez ważnej sesji zespołu = 404 (nie ma czego pokazać ani podpowiadać).
 */
export async function wymagajKontekstuKlienta(token: string): Promise<KontekstKlienta> {
  if (czyTokenPodgladu(token)) {
    const kontekst = await kontekstPodgladu(token);
    if (!kontekst) notFound();
    return kontekst;
  }
  const sesja = await pobierzSesjeKlienta(token);
  if (!sesja) redirect(`/p/${token}`);
  if (sesja.wymagaRotacji) {
    const { pathname } = await infoZadania();
    const wroc = pathname.startsWith(`/p/${token}/`) ? pathname : `/p/${token}/start`;
    redirect(`/p/${token}/rotacja?wroc=${encodeURIComponent(wroc)}`);
  }
  const kontekst = await pobierzKontekstKlienta(token);
  if (!kontekst) redirect(`/p/${token}`);
  return kontekst;
}
