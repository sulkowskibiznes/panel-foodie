/**
 * Kalendarz harmonogramu (SPEC rozdz. 8) w strefie Europe/Warsaw, bez bibliotek dat. Czysta logika
 * wspólna dla widoku zespołu (przeciąganie) i klienta (tylko odczyt) oraz testów.
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

export type DzienSiatki = { data: string; dzien: number; wMiesiacu: boolean };

/** Tygodnie od poniedziałku, z dniami sąsiednich miesięcy na brzegach (zawsze pełne wiersze). */
export function siatkaMiesiaca(rok: number, miesiac: number): DzienSiatki[][] {
  const pierwszy = Date.UTC(rok, miesiac - 1, 1);
  const dzienTygodnia = (new Date(pierwszy).getUTCDay() + 6) % 7; // 0 = poniedziałek
  const start = pierwszy - dzienTygodnia * MS_DNIA;
  const dni = dniWMiesiacu(rok, miesiac);
  const wierszy = Math.ceil((dzienTygodnia + dni) / 7);
  const tygodnie: DzienSiatki[][] = [];
  for (let t = 0; t < wierszy; t++) {
    const tydzien: DzienSiatki[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start + (t * 7 + i) * MS_DNIA);
      tydzien.push({ data: `${d.getUTCFullYear()}-${dwie(d.getUTCMonth() + 1)}-${dwie(d.getUTCDate())}`, dzien: d.getUTCDate(), wMiesiacu: d.getUTCMonth() + 1 === miesiac && d.getUTCFullYear() === rok });
    }
    tygodnie.push(tydzien);
  }
  return tygodnie;
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

export function przesunMiesiac(rok: number, miesiac: number, delta: number): { rok: number; miesiac: number } {
  const indeks = rok * 12 + (miesiac - 1) + delta;
  return { rok: Math.floor(indeks / 12), miesiac: (indeks % 12) + 1 };
}

/** Miesiąc współpracy (n-ty od startu), jak w seedzie: start w kwietniu i pakiet na wrzesień = 6. */
export function miesiacWspolpracy(start: string | null, rok: number, miesiac: number): number | null {
  if (!start) return null;
  const [sr, sm] = start.split("-").map(Number);
  if (!sr || !sm) return null;
  return (rok - sr) * 12 + (miesiac - sm) + 1;
}
