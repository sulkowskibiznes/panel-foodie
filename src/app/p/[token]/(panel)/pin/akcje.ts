"use server";

import { notFound, redirect } from "next/navigation";
import { walidujPinKlienta, weryfikujPin } from "@/lib/auth-klient";
import { zapiszAudyt } from "@/lib/audyt";
import { copy } from "@/lib/copy";
import { pobierzKontekstKlienta } from "@/lib/kontekst-klienta";
import { czyPrzekroczonyLimitIp, zwiekszLicznik } from "@/lib/limity";
import { odnotujNieudanaProbe, zapiszPinKlienta, zdarzenieDostepu } from "@/lib/pin-klienta";
import { pobierzSesjeKlienta, uniewaznijSesjeLinku, utworzSesje, zakonczSesje } from "@/lib/sesja-klienta";
import { supabaseSerwer } from "@/lib/supabase/server";
import { infoZadania } from "@/lib/zadanie";

export type StanZmianyPinu = { blad?: string };

/** Po tylu błędnych „obecnych PIN-ach" w jednej sesji kończymy ją: ktoś przy cudzym telefonie nie zgaduje dalej. */
const BLEDY_DO_WYLOGOWANIA = 3;

/**
 * „Zmień PIN" (Etap 2 planu domknięcia). Link i sesja wyłącznie z cookie sesji, nigdy z formularza; podgląd zespołu
 * nie ma tej akcji (404). Błędny obecny PIN liczy się do blokad linku jak przy logowaniu, a trzeci błąd w tej sesji ją
 * kończy. Po zmianie wszystkie sesje linku są unieważnione, bieżące urządzenie dostaje nową z tym samym „Zapamiętaj mnie".
 */
export async function zmienPin(_poprzedni: StanZmianyPinu, formData: FormData): Promise<StanZmianyPinu> {
  const token = String(formData.get("token") ?? "").trim().toLowerCase();
  const kontekst = await pobierzKontekstKlienta(token);
  if (!kontekst || kontekst.tryb !== "klient") notFound();
  const sesja = await pobierzSesjeKlienta(token);
  if (!sesja) redirect(`/p/${token}`);

  const obecny = String(formData.get("obecny") ?? "").replace(/\s/g, "");
  const pin = String(formData.get("pin") ?? "").replace(/\s/g, "");
  const powtorz = String(formData.get("powtorz") ?? "").replace(/\s/g, "");
  const b = { ...copy.ustawPin.bledy, ...copy.zmianaPinu.bledy };
  const { ipHash, uaHash, ua } = await infoZadania();
  if (await czyPrzekroczonyLimitIp(ipHash)) return { blad: b.limit };

  const { data: link } = await supabaseSerwer()
    .from("access_links")
    .select("id, client_id, contact_id, label, pin_hash, pin_pepper, pin_version, revoked_at, locked_until, frozen_at")
    .eq("id", sesja.linkId)
    .maybeSingle();
  if (!link || link.revoked_at || link.client_id !== sesja.clientId) redirect(`/p/${token}`);
  if (link.frozen_at || (link.locked_until && new Date(link.locked_until) > new Date())) return { blad: b.zablokowany };

  if (!(await weryfikujPin(link.pin_hash, obecny, link.pin_pepper ? undefined : null))) {
    const proba = await odnotujNieudanaProbe(link, link.id, ipHash);
    const bledySesji = await zwiekszLicznik(`pin:zmiana:${sesja.sesjaId}`, 24 * 60 * 60);
    await zapiszAudyt({ actor_kind: "klient", actor_id: link.contact_id, actor_label: link.label, action: "klient.zmiana_pinu_blad", entity: "access_link", entity_id: link.id, client_id: link.client_id, ip_hash: ipHash, ua, meta: { proby: proba.proby, bledy_sesji: bledySesji } });
    if (bledySesji >= BLEDY_DO_WYLOGOWANIA) {
      await zakonczSesje();
      redirect(`/p/${token}`);
    }
    return { blad: b.obecny };
  }

  const polityka = walidujPinKlienta(pin);
  if (!polityka.ok && polityka.powod === "format") return { blad: b.format };
  if (pin !== powtorz) return { blad: b.rozne };
  if (pin === obecny) return { blad: b.takiSam };
  if (!polityka.ok) return { blad: b[polityka.powod] };

  const wersja = await zapiszPinKlienta(link.id, link.pin_version, pin);
  if (wersja === null) {
    // Zespół wydał w międzyczasie nowy kod albo PIN zmienił się na innym urządzeniu: ta sesja i tak już nie żyje.
    await zakonczSesje();
    redirect(`/p/${token}`);
  }
  await uniewaznijSesjeLinku(link.id);
  await utworzSesje(link.id, { zapamietaj: sesja.zapamietaj, ipHash, uaHash, pinVersion: wersja });
  await zapiszAudyt({ actor_kind: "klient", actor_id: link.contact_id, actor_label: link.label, action: "klient.pin_zmieniony", entity: "access_link", entity_id: link.id, client_id: link.client_id, ip_hash: ipHash, ua });
  await zdarzenieDostepu("klient.pin_zmieniony", link);
  redirect(`/p/${token}/start?pin=zmieniony`);
}
