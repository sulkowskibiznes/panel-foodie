"use server";

import { redirect } from "next/navigation";
import { hashAtrapa, weryfikujPin } from "@/lib/auth-klient";
import { zapiszAudyt } from "@/lib/audyt";
import { copy } from "@/lib/copy";
import { czyPrzekroczonyLimitIp, NIEISTNIEJACY_LINK } from "@/lib/limity";
import { weryfikujLogowanie, type LinkDoLogowania } from "@/lib/logowanie-klienta";
import { odnotujNieudanaProbe, ustawPozwolenieNaPin } from "@/lib/pin-klienta";
import { utworzSesje } from "@/lib/sesja-klienta";
import { supabaseSerwer } from "@/lib/supabase/server";
import { infoZadania } from "@/lib/zadanie";

export type StanPin = { blad?: string };

async function znajdzLink(lookup: string): Promise<LinkDoLogowania | null> {
  const { data } = await supabaseSerwer()
    .from("access_links")
    .select("id, client_id, contact_id, label, can_approve, token_hash, pin_hash, pin_pepper, pin_temporary, pin_temporary_expires_at, pin_version, revoked_at, locked_until, frozen_at")
    .eq("token_lookup", lookup)
    .maybeSingle();
  return data ?? null;
}

/**
 * Logowanie linkiem i PIN-em (SPEC rozdz. 4.3). Zły token i zły PIN: ten sam komunikat,
 * jedno wywołanie argon2 i jeden zapis w bazie w obu ścieżkach, żeby czas był ten sam.
 * Poprawny kod startowy (Etap 2 planu domknięcia) nie daje sesji, tylko pozwolenie na ustawienie własnego PIN-u.
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
    weryfikuj: (hashPinu, pinDoSprawdzenia, zPieprzem) => (zPieprzem ? weryfikujPin(hashPinu, pinDoSprawdzenia) : weryfikujPin(hashPinu, pinDoSprawdzenia, null)),
    hashAtrapa: await hashAtrapa(),
    teraz: () => new Date(),
  });

  if (!wynik.ok) {
    // Wygasły kod startowy liczy się jak zły PIN (ten sam zapis), ale klient dostaje podpowiedź, co zrobić.
    const liczyDoBlokady = wynik.powod === "zly_pin" || wynik.powod === "blokada" || wynik.powod === "kod_wygasl";
    const proba = await odnotujNieudanaProbe(liczyDoBlokady ? wynik.link : null, liczyDoBlokady && wynik.link ? wynik.link.id : NIEISTNIEJACY_LINK, ipHash);
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
    return { blad: wynik.powod === "kod_wygasl" ? copy.pin.kodWygasl : copy.pin.blad };
  }

  const link = wynik.link;
  await supabaseSerwer()
    .from("access_links")
    .update({ failed_attempts: 0, failed_window_started_at: null, locked_until: null, last_used_at: new Date().toISOString() })
    .eq("id", link.id);
  if (wynik.ustawPin) {
    await ustawPozwolenieNaPin(token, link, zapamietaj);
    await zapiszAudyt({ actor_kind: "klient", actor_id: link.contact_id, actor_label: link.label, action: "klient.kod_startowy_ok", entity: "access_link", entity_id: link.id, client_id: link.client_id, ip_hash: ipHash, ua });
    redirect(`/p/${token}/ustaw-pin`);
  }
  await utworzSesje(link.id, { zapamietaj, ipHash, uaHash, pinVersion: link.pin_version });
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
