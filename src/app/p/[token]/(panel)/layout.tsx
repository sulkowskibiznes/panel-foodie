import type { ReactNode } from "react";
import { PasekPodgladu } from "@/components/klient/pasek-podgladu";
import { UkladKlienta } from "@/components/klient/uklad-klienta";
import { pobierzKlienta } from "@/lib/dane/pakiety-klienta";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";
import { infoZadania } from "@/lib/zadanie";

/** WSZYSTKO pod /p/[token]/... wymaga sesji klienta (CLAUDE.md, struktura) albo ważnego podglądu zespołu. */
export default async function UkladPaneluKlienta({ children, params }: { children: ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const kontekst = await wymagajKontekstuKlienta(token);
  const [klient, { pathname }] = await Promise.all([pobierzKlienta(kontekst.clientId), infoZadania()]);
  const nazwa = klient?.nazwa ?? "";
  return (
    <>
      {kontekst.tryb === "podglad" ? <PasekPodgladu token={token} nazwaKlienta={nazwa} /> : null}
      <UkladKlienta token={token} nazwaKlienta={nazwa} etykietaOsoby={kontekst.label} sciezka={pathname} podglad={kontekst.tryb === "podglad"}>
        {children}
      </UkladKlienta>
    </>
  );
}
