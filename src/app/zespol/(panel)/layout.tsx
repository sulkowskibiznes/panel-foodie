import type { ReactNode } from "react";
import { UkladZespolu } from "@/components/zespol/uklad-zespolu";
import { wymagajCzlonka } from "@/lib/auth-zespol";

/** WSZYSTKO pod /zespol (poza logowaniem) wymaga aktywnego członka zespołu. */
export default async function UkladPaneluZespolu({ children }: { children: ReactNode }) {
  const czlonek = await wymagajCzlonka();
  return <UkladZespolu czlonek={czlonek}>{children}</UkladZespolu>;
}
