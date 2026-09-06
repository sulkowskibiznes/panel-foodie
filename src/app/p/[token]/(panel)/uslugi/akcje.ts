"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { zapiszAudyt } from "@/lib/audyt";
import { copy } from "@/lib/copy";
import { pobierzKlienta } from "@/lib/dane/pakiety-klienta";
import { MAKS_DLUGOSC_ZAINTERESOWANIA, pobierzUsluge, zapiszZainteresowanie } from "@/lib/dane/uslugi";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { env } from "@/lib/env";
import { pobierzKontekstKlienta } from "@/lib/kontekst-klienta";
import { dodajDoOutbox } from "@/lib/outbox";
import { supabaseSerwer } from "@/lib/supabase/server";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

/**
 * „Chcę wiedzieć więcej" (SPEC rozdz. 5.8, 15): zapis `service_interests` i zdarzenie `usluga.zainteresowanie`
 * w outbox (Zapier kieruje je na kanał klienta). Podgląd zespołu niczego nie zapisuje (zasada 15).
 */
export async function zglosZainteresowanie(token: string, serviceId: string, tresc: string): Promise<WynikAkcji> {
  const kontekst = await pobierzKontekstKlienta(token);
  if (!kontekst) notFound();
  if (kontekst.tryb === "podglad") return { ok: false, blad: copy.uslugi.dialog.podglad };
  const b = copy.uslugi.bledy;
  if (!czyUuid(serviceId)) return { ok: false, blad: b.brakUslugi };
  const notatka = String(tresc ?? "").replace(/\r\n/g, "\n").trim();
  if (notatka.length === 0) return { ok: false, blad: b.pusty };
  if (notatka.length > MAKS_DLUGOSC_ZAINTERESOWANIA) return { ok: false, blad: b.zaDlugi };
  const [usluga, klient] = await Promise.all([pobierzUsluge(serviceId), pobierzKlienta(kontekst.clientId)]);
  if (!usluga || !klient) return { ok: false, blad: b.brakUslugi };

  let id: string;
  try {
    id = await zapiszZainteresowanie({ clientId: kontekst.clientId, contactId: kontekst.contactId, serviceId, notatka });
  } catch (blad) {
    console.error("[uslugi] zapis zainteresowania", blad instanceof Error ? blad.message : blad);
    return { ok: false, blad: b.ogolny };
  }
  const { data: dane } = await supabaseSerwer().from("clients").select("slug, slack_channel").eq("id", kontekst.clientId).maybeSingle();
  const baza = env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  await dodajDoOutbox("usluga.zainteresowanie", {
    event: "usluga.zainteresowanie",
    client_slug: dane?.slug ?? "",
    client_name: klient.nazwa,
    slack_channel: dane?.slack_channel ?? null,
    actor: kontekst.label,
    url: `${baza}/zespol/klienci/${dane?.slug ?? ""}`,
    summary: copy.zdarzenia.zainteresowanie.replace("{osoba}", kontekst.label).replace("{klient}", klient.nazwa).replace("{usluga}", usluga.nazwa),
    service: usluga.slug,
    service_name: usluga.nazwa,
    note: notatka,
    interest_id: id,
  });
  const { ipHash, ua } = await infoZadania();
  await zapiszAudyt({ actor_kind: "klient", actor_id: kontekst.contactId, actor_label: kontekst.label, action: "klient.zainteresowanie_usluga", entity: "service_interest", entity_id: id, client_id: kontekst.clientId, ip_hash: ipHash, ua, meta: { service: usluga.slug } });
  revalidatePath(`/p/${token}/uslugi`);
  revalidatePath(`/zespol/klienci/${dane?.slug ?? ""}`);
  return { ok: true };
}
