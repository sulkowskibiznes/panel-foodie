import type { ReactNode } from "react";
import { UkladZespolu } from "@/components/zespol/uklad-zespolu";
import { wymagajCzlonka } from "@/lib/auth-zespol";
import { zakresKlientow } from "@/lib/dane/klienci-zespolu";
import { liczNieprzeczytaneUwagi } from "@/lib/dane/skrzynka";
import { infoZadania } from "@/lib/zadanie";

/** WSZYSTKO pod /zespol (poza logowaniem) wymaga aktywnego członka zespołu. Plakietka skrzynki liczy nieprzeczytane uwagi. */
export default async function UkladPaneluZespolu({ children }: { children: ReactNode }) {
  const czlonek = await wymagajCzlonka();
  const [nieprzeczytane, { pathname }] = await Promise.all([liczNieprzeczytaneUwagi(await zakresKlientow(czlonek)), infoZadania()]);
  return (
    <UkladZespolu czlonek={czlonek} nieprzeczytaneUwagi={nieprzeczytane} sciezka={pathname}>
      {children}
    </UkladZespolu>
  );
}
