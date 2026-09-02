import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { pobierzSesjeKlienta } from "@/lib/sesja-klienta";
import { infoZadania } from "@/lib/zadanie";

/**
 * Kontekst strony klienta. W fazie 3 dojdzie tryb 'podglad' (impersonacja z sesji zespołu),
 * dlatego wszystkie strony klienta biorą kontekst stąd, a nie bezpośrednio z sesji.
 */
export type KontekstKlienta = {
  tryb: "klient";
  token: string;
  clientId: string;
  contactId: string | null;
  linkId: string;
  label: string;
  canApprove: boolean;
};

export const pobierzKontekstKlienta = cache(async (token: string): Promise<KontekstKlienta | null> => {
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

/** Wymaga sesji: bez niej ekran PIN; gdy pora na rotację, jednorazowe przejście przez trasę rotacji. */
export async function wymagajKontekstuKlienta(token: string): Promise<KontekstKlienta> {
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
