/**
 * Termin auto-akceptacji (SPEC rozdz. 6.4, rozdz. 20 poz. 7, 19, 25, 30). Czysta logika, bez bazy:
 * to samo liczenie w maszynie stanów, w cronie i w testach.
 *
 * - Domyślnie 3 dni KALENDARZOWE = 72 godziny, zaokrąglone w górę do pełnej godziny
 *   (klient nigdy nie dostaje mniej niż 72 h).
 * - `settings.auto_approve_business_days = true` przełącza na dni robocze: poniedziałek-SOBOTA
 *   w Europe/Warsaw, bez świąt (1.4, poz. 30). Liczą się wyłącznie godziny, które zaczynają się
 *   poza niedzielą; niedziela nie skraca ani nie wydłuża terminu, tylko jest pomijana.
 * - Godziny per klient (`clients.auto_approve_hours`) nadpisują globalne `settings.auto_approve_hours`.
 */
export const STREFA = "Europe/Warsaw";
export const DOMYSLNE_GODZINY_AUTO_AKCEPTACJI = 72;
export const MS_GODZINY = 3_600_000;
export const MS_24H = 24 * MS_GODZINY;

export type UstawieniaAutoAkceptacji = { godziny: number; dniRobocze: boolean };

export function zaokraglijWGoreDoGodziny(d: Date): Date {
  return new Date(Math.ceil(d.getTime() / MS_GODZINY) * MS_GODZINY);
}

const dzienTygodnia = new Intl.DateTimeFormat("en-US", { timeZone: STREFA, weekday: "short" });

/** Niedziela w Europe/Warsaw, jedyny dzień pomijany w trybie dni roboczych (pon-sob). */
export function czyNiedziela(d: Date): boolean {
  return dzienTygodnia.format(d) === "Sun";
}

/** Termin auto-akceptacji liczony od chwili wysyłki do akceptacji. */
export function wyliczAutoAkceptacje(od: Date, ustawienia: UstawieniaAutoAkceptacji): Date {
  const start = zaokraglijWGoreDoGodziny(od);
  const godziny = Math.max(1, Math.floor(ustawienia.godziny));
  if (!ustawienia.dniRobocze) return new Date(start.getTime() + godziny * MS_GODZINY);
  let t = start.getTime();
  let pozostalo = godziny;
  while (pozostalo > 0) {
    if (!czyNiedziela(new Date(t))) pozostalo -= 1;
    t += MS_GODZINY;
  }
  return new Date(t);
}

/**
 * Dodanie albo podmiana materiału w `do_akceptacji` (SPEC rozdz. 6.4, poz. 25):
 * termin przesuwa się na max(obecny termin, teraz + 24 h), żeby klient zdążył zobaczyć zmianę.
 */
export function przesunAutoAkceptacje(obecny: Date | string | null, teraz: Date): Date {
  const minimum = zaokraglijWGoreDoGodziny(new Date(teraz.getTime() + MS_24H));
  if (!obecny) return minimum;
  const obecnyMs = new Date(obecny).getTime();
  return obecnyMs >= minimum.getTime() ? new Date(obecnyMs) : minimum;
}

/** Czy do terminu zostało 24 godziny albo mniej (pasek bursztynowy, zdarzenie `pakiet.auto_za_24h`). */
export function czyOstatnieDobra(termin: Date | string | null, teraz: Date): boolean {
  if (!termin) return false;
  const ms = new Date(termin).getTime() - teraz.getTime();
  return ms > 0 && ms <= MS_24H;
}
