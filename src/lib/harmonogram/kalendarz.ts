/**
 * Kalendarz harmonogramu (SPEC rozdz. 8) w strefie Europe/Warsaw, bez bibliotek dat. Czysta logika
 * wspólna dla widoku zespołu (przeciąganie) i klienta (tylko odczyt) oraz testów.
 * Pakiet obejmuje dowolny okres od-do (np. 20.09 do 19.10), więc siatka jest siatką okresu, nie miesiąca.
 * Daty to napisy „YYYY-MM-DD" porównywane jako napisy; arytmetyka dni w UTC, żeby zmiana czasu nic nie psuła.
 */
export const STREFA = "Europe/Warsaw";
const MS_DNIA = 86_400_000;

const format = new Intl.DateTimeFormat("en-GB", { timeZone: STREFA, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" });
const DNI = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type CzesciLokalne = { rok: number; miesiac: number; dzien: number; godzina: number; minuta: number; sekunda: number; dzienTygodnia: number };

function naDate(d: Date | string): Date {
  return typeof d === "string" ? new Date(d) : d;
}

/** Części daty w Europe/Warsaw; dzień tygodnia 1 = poniedziałek, 7 = niedziela. */
export function czesciLokalne(d: Date | string): CzesciLokalne {
  const czesci: Record<string, string> = {};
  for (const c of format.formatToParts(naDate(d))) czesci[c.type] = c.value;
  return {
    rok: Number(czesci.year),
    miesiac: Number(czesci.month),
    dzien: Number(czesci.day),
    godzina: Number(czesci.hour),
    minuta: Number(czesci.minute),
    sekunda: Number(czesci.second),
    dzienTygodnia: DNI.indexOf(czesci.weekday ?? "Mon") + 1,
  };
}

const dwie = (n: number) => String(n).padStart(2, "0");

/** „YYYY-MM-DD" w Europe/Warsaw. */
export function dataLokalna(d: Date | string): string {
  const c = czesciLokalne(d);
  return `${c.rok}-${dwie(c.miesiac)}-${dwie(c.dzien)}`;
}

/** „HH:MM" w Europe/Warsaw. */
export function czasLokalny(d: Date | string): string {
  const c = czesciLokalne(d);
  return `${dwie(c.godzina)}:${dwie(c.minuta)}`;
}

function przesuniecieMinut(d: Date): number {
  const c = czesciLokalne(d);
  return (Date.UTC(c.rok, c.miesiac - 1, c.dzien, c.godzina, c.minuta, c.sekunda) - d.getTime()) / 60_000;
}

/** Chwila UTC dla lokalnej daty i godziny w Europe/Warsaw (z poprawką na zmianę czasu). */
export function zlozDateLokalna(data: string, godzina: number, minuta = 0): Date {
  const [r, m, d] = data.split("-").map(Number);
  if (!r || !m || !d) throw new Error(`zlozDateLokalna: zła data ${data}`);
  const jakUtc = Date.UTC(r, m - 1, d, godzina, minuta, 0);
  const pierwsze = przesuniecieMinut(new Date(jakUtc));
  let wynik = jakUtc - pierwsze * 60_000;
  const drugie = przesuniecieMinut(new Date(wynik));
  if (drugie !== pierwsze) wynik = jakUtc - drugie * 60_000;
  return new Date(wynik);
}

export function czyPoprawnaDataLokalna(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [r, m, d] = data.split("-").map(Number);
  if (!r || !m || !d || m < 1 || m > 12) return false;
  return d >= 1 && d <= dniWMiesiacu(r, m);
}

export function dniWMiesiacu(rok: number, miesiac: number): number {
  return new Date(Date.UTC(rok, miesiac, 0)).getUTCDate();
}

/** Okres pakietu: pierwszy i ostatni dzień publikacji (YYYY-MM-DD, włącznie). */
export type Okres = { od: string; do: string };

export type DzienSiatki = { data: string; dzien: number; /** Dzień w okresie pakietu (poza nim szare brzegi tygodni). */ wOkresie: boolean; /** Pierwszy dzień miesiąca albo pierwsza komórka siatki: tu pokazujemy nazwę miesiąca. */ nowyMiesiac: boolean };

function msDaty(data: string): number {
  const [r, m, d] = data.split("-").map(Number);
  if (!r || !m || !d) throw new Error(`zła data ${data}`);
  return Date.UTC(r, m - 1, d);
}

function dataZMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${dwie(d.getUTCMonth() + 1)}-${dwie(d.getUTCDate())}`;
}

/** Tygodnie od poniedziałku przed `od` do niedzieli po `do`, zawsze pełne wiersze. Cały wrzesień daje tę samą siatkę co dawna siatka miesiąca. */
export function siatkaOkresu(od: string, do_: string): DzienSiatki[][] {
  const poczatek = msDaty(od);
  const koniecOkresu = msDaty(do_);
  if (koniecOkresu < poczatek) throw new Error("siatkaOkresu: koniec przed początkiem");
  const start = poczatek - ((new Date(poczatek).getUTCDay() + 6) % 7) * MS_DNIA;
  const koniec = koniecOkresu + (6 - ((new Date(koniecOkresu).getUTCDay() + 6) % 7)) * MS_DNIA;
  const wierszy = Math.round(((koniec - start) / MS_DNIA + 1) / 7);
  if (wierszy > 60) throw new Error("siatkaOkresu: okres dłuższy niż rok");
  const tygodnie: DzienSiatki[][] = [];
  for (let t = 0; t < wierszy; t++) {
    const tydzien: DzienSiatki[] = [];
    for (let i = 0; i < 7; i++) {
      const ms = start + (t * 7 + i) * MS_DNIA;
      const data = dataZMs(ms);
      const dzien = new Date(ms).getUTCDate();
      tydzien.push({ data, dzien, wOkresie: od <= data && data <= do_, nowyMiesiac: dzien === 1 || (t === 0 && i === 0) });
    }
    tygodnie.push(tydzien);
  }
  return tygodnie;
}

/** Okresy zachodzą na siebie, gdy mają choć jeden wspólny dzień (włącznie z brzegami). */
export function czyOkresyZachodza(a: Okres, b: Okres): boolean {
  return a.od <= b.do && b.od <= a.do;
}

/** Liczba dni okresu włącznie z oboma brzegami. */
export function dlugoscOkresuDni(od: string, do_: string): number {
  return Math.round((msDaty(do_) - msDaty(od)) / MS_DNIA) + 1;
}

/** Rok i miesiąc z daty „YYYY-MM-DD" (miesiąc startu pakietu: filtr pulpitu, webhook, ostrzeżenia importu). */
export function miesiacZDaty(data: string): { rok: number; miesiac: number } {
  const [r, m] = data.split("-").map(Number);
  if (!r || !m) throw new Error(`zła data ${data}`);
  return { rok: r, miesiac: m };
}

export function kluczMiesiaca(rok: number, miesiac: number): string {
  return `${rok}-${dwie(miesiac)}`;
}

export function parsujMiesiac(wartosc: string | null | undefined): { rok: number; miesiac: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(wartosc ?? "");
  if (!m) return null;
  const rok = Number(m[1]);
  const miesiac = Number(m[2]);
  if (miesiac < 1 || miesiac > 12 || rok < 2024 || rok > 2100) return null;
  return { rok, miesiac };
}

/**
 * Podpowiedź numeru miesiąca współpracy dla nowego pakietu: ostatni pakiet klienta plus jeden; bez poprzedniego
 * pakietu liczymy z daty startu współpracy i daty początku okresu (start w kwietniu, pakiet od września = 6).
 * Po przerwach numer bywa inny, dlatego pole w kreatorze jest edytowalne. `null` = brak podstaw do podpowiedzi.
 */
export function kolejnyMiesiacWspolpracy(ostatniNumer: number | null, startWspolpracy: string | null, od: string): number | null {
  if (ostatniNumer !== null && ostatniNumer >= 1) return ostatniNumer + 1;
  if (!startWspolpracy) return null;
  const [sr, sm] = startWspolpracy.split("-").map(Number);
  const [r, m] = od.split("-").map(Number);
  if (!sr || !sm || !r || !m) return null;
  const numer = (r - sr) * 12 + (m - sm) + 1;
  return numer >= 1 ? numer : null;
}
