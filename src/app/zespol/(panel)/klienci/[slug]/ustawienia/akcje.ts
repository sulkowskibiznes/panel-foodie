"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { zapiszAudyt } from "@/lib/audyt";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia, type CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu, type KartaKlienta } from "@/lib/dane/klienci-zespolu";
import { usunDaneKlienta as usunWBazie, wstrzymajWspolprace as wstrzymajWBazie, wycofajPakietyWToku, wznowWspolprace as wznowWBazie, zakonczWspolprace as zakonczWBazie } from "@/lib/dane/offboarding";
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
  revalidatePath("/zespol/uwagi");
}

/** „Zakończ współpracę" (SPEC rozdz. 17): admin i csm. Linki wygaszone, urządzenia wylogowane, status zakonczony. */
export async function zakonczWspolprace(slug: string): Promise<WynikAkcji> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (klient.status === "zakonczony") return { ok: true };
  const { ipHash } = await infoZadania();
  const wycofane = await wycofajPakietyWToku(klient.id, { rodzaj: "zespol", memberId: czlonek.id, name: czlonek.name });
  await Promise.all(wycofane.map((id) => zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.pakiet_wycofany", entity: "package", entity_id: id, client_id: klient.id, ip_hash: ipHash, meta: { powod: "zakonczenie_wspolpracy" } })));
  const wynik = await zakonczWBazie(klient.id, new Date());
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.klient_zakonczony", entity: "client", entity_id: klient.id, client_id: klient.id, ip_hash: ipHash, meta: { linki: wynik.linki, sesje: wynik.sesje, wycofane_pakiety: wycofane.length } });
  odswiez(slug);
  return { ok: true };
}

/**
 * „Przerwa we współpracy" (plan 1.7): pakiety czekające na akceptację wracają do szkicu (inaczej po wznowieniu
 * przeterminowany termin odpaliłby od razu), klient znika z pulpitu, linki działają dalej.
 */
export async function wstrzymajWspolprace(slug: string): Promise<WynikAkcji> {
  const { czlonek, klient } = await autoryzuj(slug);
  if (klient.status !== "aktywny") return { ok: true };
  const { ipHash } = await infoZadania();
  const wycofane = await wycofajPakietyWToku(klient.id, { rodzaj: "zespol", memberId: czlonek.id, name: czlonek.name });
  await Promise.all(wycofane.map((id) => zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.pakiet_wycofany", entity: "package", entity_id: id, client_id: klient.id, ip_hash: ipHash, meta: { powod: "przerwa_we_wspolpracy" } })));
  await wstrzymajWBazie(klient.id);
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.klient_wstrzymany", entity: "client", entity_id: klient.id, client_id: klient.id, ip_hash: ipHash, meta: { wycofane_pakiety: wycofane.length } });
  odswiez(slug);
  return { ok: true };
}

/** „Wznów współpracę": klient wraca na pulpit; po zakończeniu linki trzeba utworzyć od nowa, po przerwie działają. */
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
    wynik = await usunWBazie(klient.id, klient.slug);
  } catch (e) {
    console.error("[offboarding] usunDaneKlienta", e instanceof Error ? e.message : e);
    return { ok: false, blad: u.bledy.ogolny };
  }
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.klient_usuniety", entity: "client", entity_id: klient.id, client_id: klient.id, ip_hash: ipHash, meta: { name: klient.name, slug: klient.slug, obiekty: wynik.obiekty } });
  revalidatePath("/zespol");
  redirect(`/zespol?usunieto=${encodeURIComponent(klient.name)}`);
}
