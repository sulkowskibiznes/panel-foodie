"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { zapiszAudyt } from "@/lib/audyt";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia, type CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu, type KartaKlienta } from "@/lib/dane/klienci-zespolu";
import { usunDaneKlienta as usunWBazie, wznowWspolprace as wznowWBazie, zakonczWspolprace as zakonczWBazie } from "@/lib/dane/offboarding";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { infoZadania } from "@/lib/zadanie";

async function autoryzuj(slug: string): Promise<{ czlonek: CzlonekZespolu; klient: KartaKlienta }> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "klienci", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  return { czlonek, klient };
}

function odswiez(slug: string) {
  revalidatePath(`/zespol/klienci/${slug}`, "layout");
  revalidatePath("/zespol");
}

/** „Zakończ współpracę" (SPEC rozdz. 17): admin i csm. Linki wygaszone, urządzenia wylogowane, status zakonczony. */
export async function zakonczWspolprace(slug: string): Promise<WynikAkcji> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (klient.status === "zakonczony") return { ok: true };
  const wynik = await zakonczWBazie(klient.id, new Date());
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.klient_zakonczony", entity: "client", entity_id: klient.id, client_id: klient.id, ip_hash: ipHash, meta: { linki: wynik.linki, sesje: wynik.sesje } });
  odswiez(slug);
  return { ok: true };
}

/** „Wznów współpracę": klient wraca na pulpit; linki trzeba utworzyć od nowa. */
export async function wznowWspolprace(slug: string): Promise<WynikAkcji> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (klient.status === "aktywny") return { ok: true };
  await wznowWBazie(klient.id);
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.klient_wznowiony", entity: "client", entity_id: klient.id, client_id: klient.id, ip_hash: ipHash });
  odswiez(slug);
  return { ok: true };
}

/**
 * „Usuń dane klienta" (SPEC rozdz. 17): wyłącznie admin, wyłącznie po zakończeniu współpracy, nigdy klient demo,
 * z nazwą przepisaną dokładnie. Kasuje pliki ze Storage i wiersz klienta (kaskada), zostawia audyt.
 */
export async function usunDaneKlienta(slug: string, potwierdzenie: string): Promise<WynikAkcji> {
  const { czlonek, klient } = await autoryzuj(slug);
  wymagajUprawnienia(czlonek, "ustawienia", "pelne");
  const u = copy.zespol.ustawieniaKlienta.usuwanie;
  if (klient.demo) return { ok: false, blad: u.klientDemo };
  if (klient.status !== "zakonczony") return { ok: false, blad: u.najpierwZakoncz };
  if (potwierdzenie.trim() !== klient.name.trim()) return { ok: false, blad: u.bledy.nazwa };
  const { ipHash } = await infoZadania();
  let wynik;
  try {
    wynik = await usunWBazie(klient.id);
  } catch (e) {
    console.error("[offboarding] usunDaneKlienta", e instanceof Error ? e.message : e);
    return { ok: false, blad: u.bledy.ogolny };
  }
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.klient_usuniety", entity: "client", entity_id: klient.id, client_id: klient.id, ip_hash: ipHash, meta: { name: klient.name, slug: klient.slug, obiekty: wynik.obiekty } });
  revalidatePath("/zespol");
  redirect(`/zespol?usunieto=${encodeURIComponent(klient.name)}`);
}
