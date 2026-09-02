"use server";

import { redirect } from "next/navigation";
import { hashAtrapa, weryfikujPin } from "@/lib/auth-klient";
import { zapiszAudyt } from "@/lib/audyt";
import { copy } from "@/lib/copy";
import { czyPrzekroczonyLimitIp, NIEISTNIEJACY_LINK, odnotujNieudaneLogowanie } from "@/lib/limity";
import { weryfikujLogowanie, type LinkDoLogowania } from "@/lib/logowanie-klienta";
import { dodajDoOutbox } from "@/lib/outbox";
import { utworzSesje } from "@/lib/sesja-klienta";
import { supabaseSerwer } from "@/lib/supabase/server";
import { infoZadania } from "@/lib/zadanie";

export type StanPin = { blad?: string };

async function znajdzLink(lookup: string): Promise<LinkDoLogowania | null> {
  const { data } = await supabaseSerwer()
    .from("access_links")
    .select("id, client_id, contact_id, label, can_approve, token_hash, pin_hash, revoked_at, locked_until")
    .eq("token_lookup", lookup)
    .maybeSingle();
  return data ?? null;
}

/**
 * Logowanie linkiem i PIN-em (SPEC rozdz. 4.3). Zły token i zły PIN: ten sam komunikat,
 * jedno wywołanie argon2 i jeden zapis w bazie w obu ścieżkach, żeby czas był ten sam.
 */
export async function zalogujPinem(_poprzedni: StanPin, formData: FormData): Promise<StanPin> {
  const token = String(formData.get("token") ?? "").trim().toLowerCase();
  const pin = String(formData.get("pin") ?? "").replace(/\s/g, "");
  const zapamietaj = formData.get("zapamietaj") === "on";
  const { ipHash, uaHash, ua } = await infoZadania();

  if (await czyPrzekroczonyLimitIp(ipHash)) {
    return { blad: copy.pin.limit };
  }

  const wynik = await weryfikujLogowanie(token, pin, {
    znajdzLink,
    weryfikuj: weryfikujPin,
    hashAtrapa: await hashAtrapa(),
    teraz: () => new Date(),
  });

  if (!wynik.ok) {
    const liczyDoBlokady = wynik.powod === "zly_pin" || wynik.powod === "blokada";
    const proba = await odnotujNieudaneLogowanie(liczyDoBlokady && wynik.link ? wynik.link.id : NIEISTNIEJACY_LINK);
    await zapiszAudyt({
      actor_kind: "klient",
      actor_id: wynik.link?.contact_id ?? null,
      actor_label: wynik.link?.label ?? null,
      action: "klient.logowanie_blad",
      entity: "access_link",
      entity_id: wynik.link?.id ?? null,
      client_id: wynik.link?.client_id ?? null,
      ip_hash: ipHash,
      ua,
      meta: { powod: wynik.powod, proby: proba.proby },
    });
    if (proba.blokada24h && wynik.link) {
      await Promise.all([
        zapiszAudyt({ actor_kind: "system", action: "klient.blokada_24h", entity: "access_link", entity_id: wynik.link.id, client_id: wynik.link.client_id, ip_hash: ipHash }),
        dodajDoOutbox("bezpieczenstwo.blokada", { client_id: wynik.link.client_id, access_link_id: wynik.link.id, label: wynik.link.label, proby: proba.proby, do: proba.zablokowanyDo }),
      ]);
    }
    return { blad: copy.pin.blad };
  }

  const link = wynik.link;
  await supabaseSerwer()
    .from("access_links")
    .update({ failed_attempts: 0, failed_window_started_at: null, locked_until: null, last_used_at: new Date().toISOString() })
    .eq("id", link.id);
  await utworzSesje(link.id, { zapamietaj, ipHash, uaHash });
  await zapiszAudyt({
    actor_kind: "klient",
    actor_id: link.contact_id,
    actor_label: link.label,
    action: "klient.logowanie_ok",
    entity: "access_link",
    entity_id: link.id,
    client_id: link.client_id,
    ip_hash: ipHash,
    ua,
    meta: { zapamietaj },
  });
  redirect(`/p/${token}/start`);
}
