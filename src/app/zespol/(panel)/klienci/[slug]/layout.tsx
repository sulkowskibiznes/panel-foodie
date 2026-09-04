import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ZakladkiKarty } from "@/components/zespol/zakladki-karty";
import { assertTeamClientAccess, wymagajCzlonka } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { formatujDate, formatujKwote } from "@/lib/format";
import { mozeImpersonowac } from "@/lib/uprawnienia";
import { rozpocznijPodglad } from "./akcje";

/** Karta klienta (SPEC rozdz. 12.2): nagłówek + zakładki. Klient poza przypisaniami = 404. */
export default async function UkladKartyKlienta({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const czlonek = await wymagajCzlonka();
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const k = copy.zespol.karta;

  return (
    <div>
      <header className="rounded-xl bg-white p-5 shadow-miekki sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">
            {klient.name}
            {klient.demo ? <span className="ml-3 align-middle rounded-full bg-fiolet-050 px-2 py-0.5 text-xs font-medium text-fiolet-700">{k.demo}</span> : null}
          </h1>
          {mozeImpersonowac(czlonek.role, klient.demo) ? (
            <form action={rozpocznijPodglad.bind(null, slug)}>
              <button type="submit" className="inline-flex h-9 items-center rounded-lg border border-szary-300 bg-white px-3 text-sm font-medium text-foodie-czern hover:bg-szary-050" data-zobacz-jak-klient>
                {copy.podgladKlienta.przycisk}
              </button>
            </form>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-szary-600">
          {copy.zespol.kategorie[klient.category]} · {copy.zespol.pakiety[klient.tier]}
          {klient.monthly_amount_net ? ` · ${formatujKwote(klient.monthly_amount_net)} ${copy.zespol.pulpit.miesiecznie}` : ""}
        </p>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-szary-600">{k.lokale}</dt>
            <dd className="text-foodie-czern">{klient.locations.map((l) => l.name).join(", ")}</dd>
          </div>
          <div>
            <dt className="text-szary-600">{k.opiekun}</dt>
            <dd className="text-foodie-czern">{klient.opiekun?.name ?? k.brakOpiekuna}</dd>
          </div>
          {klient.slack_channel ? (
            <div>
              <dt className="text-szary-600">{k.slack}</dt>
              <dd className="text-foodie-czern">{klient.slack_channel}</dd>
            </div>
          ) : null}
          {klient.cooperation_started_on ? (
            <div>
              <dt className="text-szary-600">{k.wspolpracaOd}</dt>
              <dd className="text-foodie-czern">{formatujDate(klient.cooperation_started_on)}</dd>
            </div>
          ) : null}
        </dl>
      </header>
      <ZakladkiKarty slug={slug} rola={czlonek.role} />
      <div className="mt-4">{children}</div>
    </div>
  );
}
