import type { ReactNode } from "react";
import { UkladKlienta } from "@/components/klient/uklad-klienta";
import { pobierzKlienta } from "@/lib/dane/pakiety-klienta";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";

/** WSZYSTKO pod /p/[token]/... wymaga sesji klienta (CLAUDE.md, struktura). */
export default async function UkladPaneluKlienta({ children, params }: { children: ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const kontekst = await wymagajKontekstuKlienta(token);
  const klient = await pobierzKlienta(kontekst.clientId);
  return (
    <UkladKlienta token={token} nazwaKlienta={klient?.nazwa ?? ""} etykietaOsoby={kontekst.label}>
      {children}
    </UkladKlienta>
  );
}
