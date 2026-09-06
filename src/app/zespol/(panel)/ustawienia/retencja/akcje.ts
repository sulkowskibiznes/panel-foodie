"use server";

import { revalidatePath } from "next/cache";
import { zapiszAudyt } from "@/lib/audyt";
import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { odnotujWynikRetencji, usunMaterialyPakietu, zachowajPakiet, zaleznosciCronaRetencji } from "@/lib/dane/retencja";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { uruchomCronRetencji, type WynikCronaRetencji } from "@/lib/retencja/przeglad";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

const SCIEZKA = "/zespol/ustawienia/retencja";

/** „Zachowaj 12 miesięcy" (SPEC rozdz. 17): tylko admin; cron zgłosi pakiet ponownie po odroczeniu. */
export async function zachowajMaterialy(reviewId: string): Promise<WynikAkcji> {
  const admin = await wymagajCzlonka();
  wymagajUprawnienia(admin, "ustawienia", "pelne");
  if (!czyUuid(reviewId)) return { ok: false, blad: copy.zespol.retencja.bledy.ogolny };
  const przeglad = await zachowajPakiet(reviewId, admin.id, new Date());
  if (!przeglad) return { ok: false, blad: copy.zespol.retencja.bledy.ogolny };
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: admin.id, actor_label: admin.name, action: "zespol.retencja_zachowano", entity: "package", entity_id: przeglad.packageId, client_id: null, ip_hash: ipHash, meta: { review_id: reviewId, keep_until: przeglad.keepUntil, klient: przeglad.klient.slug, okres: przeglad.okres } });
  revalidatePath(SCIEZKA);
  return { ok: true };
}

/** „Usuń materiały": pakiet z plikami znika, wiersz przeglądu zostaje jako ślad. Tylko admin, po potwierdzeniu w przeglądarce. */
export async function usunMaterialy(reviewId: string): Promise<WynikAkcji> {
  const admin = await wymagajCzlonka();
  wymagajUprawnienia(admin, "ustawienia", "pelne");
  if (!czyUuid(reviewId)) return { ok: false, blad: copy.zespol.retencja.bledy.ogolny };
  const wynik = await usunMaterialyPakietu(reviewId, admin.id, new Date());
  if (!wynik.ok) return { ok: false, blad: copy.zespol.retencja.bledy.ogolny };
  const { ipHash } = await infoZadania();
  await zapiszAudyt({
    actor_kind: "zespol",
    actor_id: admin.id,
    actor_label: admin.name,
    action: "zespol.retencja_usunieto",
    entity: "retention_review",
    entity_id: reviewId,
    ip_hash: ipHash,
    meta: { klient: wynik.przeglad.klient.slug, tytul: wynik.przeglad.tytul, okres: wynik.przeglad.okres, pliki: wynik.usunietePliki },
  });
  revalidatePath(SCIEZKA);
  revalidatePath("/zespol");
  return { ok: true };
}

export type WynikSprawdzenia = { ok: true; wynik: WynikCronaRetencji } | { ok: false; blad: string };

/** „Sprawdź teraz": ten sam przebieg co cron, uruchomiony ręcznie przez admina (np. po zmianie retention_months). */
export async function sprawdzTeraz(): Promise<WynikSprawdzenia> {
  const admin = await wymagajCzlonka();
  wymagajUprawnienia(admin, "ustawienia", "pelne");
  const wynik = await uruchomCronRetencji(zaleznosciCronaRetencji());
  await odnotujWynikRetencji(wynik, { actor_kind: "zespol", actor_id: admin.id, actor_label: admin.name });
  await zapiszAudyt({ actor_kind: "zespol", actor_id: admin.id, actor_label: admin.name, action: "zespol.retencja_sprawdzona", meta: { prog: wynik.prog, sprawdzone: wynik.sprawdzone, zgloszone: wynik.zgloszone.length, ponowione: wynik.ponowione.length } });
  revalidatePath(SCIEZKA);
  return { ok: true, wynik };
}
