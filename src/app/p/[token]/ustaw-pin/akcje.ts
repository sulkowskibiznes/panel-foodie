"use server";

import { redirect } from "next/navigation";
import { walidujPinKlienta, weryfikujPin } from "@/lib/auth-klient";
import { zapiszAudyt } from "@/lib/audyt";
import { copy } from "@/lib/copy";
import { czyPrzekroczonyLimitIp } from "@/lib/limity";
import { odczytajPozwolenieNaPin, usunPozwolenieNaPin, zapiszPinKlienta, zdarzenieDostepu } from "@/lib/pin-klienta";
import { uniewaznijSesjeLinku, utworzSesje } from "@/lib/sesja-klienta";
import { infoZadania } from "@/lib/zadanie";

export type StanFormularzaPinu = { blad?: string };

/**
 * Własny PIN po kodzie startowym (Etap 2 planu domknięcia). Link, wersja PIN-u i „Zapamiętaj mnie" wyłącznie
 * z podpisanego pozwolenia w cookie; token z formularza służy tylko do porównania z pozwoleniem. Zapis CAS po
 * wersji: kod działa raz. Po zapisie wszystkie sesje linku są unieważnione, a to urządzenie dostaje nową.
 */
export async function ustawWlasnyPin(_poprzedni: StanFormularzaPinu, formData: FormData): Promise<StanFormularzaPinu> {
  const token = String(formData.get("token") ?? "").trim().toLowerCase();
  const pin = String(formData.get("pin") ?? "").replace(/\s/g, "");
  const powtorz = String(formData.get("powtorz") ?? "").replace(/\s/g, "");
  const b = copy.ustawPin.bledy;
  const { ipHash, uaHash, ua } = await infoZadania();

  if (await czyPrzekroczonyLimitIp(ipHash)) return { blad: b.limit };
  const pozwolenie = await odczytajPozwolenieNaPin(token);
  if (!pozwolenie) redirect(`/p/${token}`);
  const { link, zapamietaj } = pozwolenie;

  // Kolejność komunikatów: format, zgodność powtórzenia, równość z kodem, dopiero potem siła PIN-u.
  const polityka = walidujPinKlienta(pin);
  if (!polityka.ok && polityka.powod === "format") return { blad: b.format };
  if (pin !== powtorz) return { blad: b.rozne };
  // Nowy PIN nie może być kodem startowym (kod mógł przejść przez WhatsAppa albo cudze ręce).
  if (await weryfikujPin(link.pin_hash, pin, link.pin_pepper ? undefined : null)) return { blad: b.jakKod };
  if (!polityka.ok) return { blad: b[polityka.powod] };

  const wersja = await zapiszPinKlienta(link.id, link.pin_version, pin);
  await usunPozwolenieNaPin();
  // Ktoś był szybszy (drugie urządzenie z tym samym kodem albo nowy kod od zespołu): wracamy do ekranu PIN.
  if (wersja === null) redirect(`/p/${token}`);

  await uniewaznijSesjeLinku(link.id);
  await utworzSesje(link.id, { zapamietaj, ipHash, uaHash, pinVersion: wersja });
  await zapiszAudyt({ actor_kind: "klient", actor_id: link.contact_id, actor_label: link.label, action: "klient.pin_ustawiony", entity: "access_link", entity_id: link.id, client_id: link.client_id, ip_hash: ipHash, ua });
  await zdarzenieDostepu("klient.pin_ustawiony", link);
  redirect(`/p/${token}/start?pin=ustawiony`);
}
