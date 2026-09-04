import type { ReactNode } from "react";
import { UkladZespolu } from "@/components/zespol/uklad-zespolu";
import { wymagajCzlonka } from "@/lib/auth-zespol";
import { zakresKlientow } from "@/lib/dane/klienci-zespolu";
import { liczNieprzeczytaneUwagi } from "@/lib/dane/skrzynka";

/** WSZYSTKO pod /zespol (poza logowaniem) wymaga aktywnego członka zespołu. Plakietka skrzynki liczy nieprzeczytane uwagi. */
export default async function UkladPaneluZespolu({ children }: { children: ReactNode }) {
  const czlonek = await wymagajCzlonka();
  const nieprzeczytane = await liczNieprzeczytaneUwagi(await zakresKlientow(czlonek));
  return (
    <UkladZespolu czlonek={czlonek} nieprzeczytaneUwagi={nieprzeczytane}>
      {children}
    </UkladZespolu>
  );
}
