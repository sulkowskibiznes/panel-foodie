import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularzLogowania } from "@/components/zespol/formularz-logowania";
import { pobierzCzlonkaZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.zespol.logowanie.tytul };

export default async function LogowanieZespolu() {
  const czlonek = await pobierzCzlonkaZespolu();
  if (czlonek) redirect("/zespol");
  return <FormularzLogowania />;
}
