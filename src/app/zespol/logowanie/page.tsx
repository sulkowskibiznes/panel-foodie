import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularzLogowania } from "@/components/zespol/formularz-logowania";
import { pobierzCzlonkaZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.zespol.logowanie.tytul };

/** `?odmowa=1` ustawia trasa /zespol/odmowa po wylogowaniu konta bez aktywnego członka zespołu. */
export default async function LogowanieZespolu({ searchParams }: { searchParams: Promise<{ odmowa?: string }> }) {
  const czlonek = await pobierzCzlonkaZespolu();
  if (czlonek) redirect("/zespol");
  const { odmowa } = await searchParams;
  return <FormularzLogowania odmowa={odmowa === "1"} />;
}
