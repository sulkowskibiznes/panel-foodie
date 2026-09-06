/**
 * Retencja (SPEC rozdz. 17), czysta logika: które pakiety zgłosić adminowi do decyzji i co sprząta cron.
 * Cron miesięczny NICZEGO nie kasuje z materiałów: zgłasza pakiety, których okres skończył się ponad
 * `retention_months` temu, a decyzję (zachowaj 12 miesięcy / usuń) podejmuje admin w Ustawienia -> Retencja.
 * Sam kasuje wyłącznie to, co SPEC nazywa wprost: sesje klientów po 90 dniach od wygaśnięcia i audyt po 12 miesiącach.
 */
import { dataLokalna } from "@/lib/harmonogram/kalendarz";

export const DOMYSLNA_RETENCJA_MIESIECY = 24;
export const ODROCZENIE_MIESIECY = 12;
export const RETENCJA_AUDYTU_MIESIECY = 12;
export const RETENCJA_SESJI_DNI = 90;

export type PakietDoPrzegladu = {
  id: string;
  clientId: string;
  tytul: string;
  okres: { od: string; do: string };
  liczbaPlikow: number;
};

export type IstniejacyPrzeglad = {
  packageId: string;
  decision: "zachowaj" | "usun" | null;
  keepUntil: string | null;
};

const MS_DNIA = 86_400_000;

/** Data „YYYY-MM-DD" cofnięta o `miesiace`; dzień przycięty do długości miesiąca docelowego (31.03 minus miesiąc = 28.02). */
export function odejmijMiesiace(data: string, miesiace: number): string {
  const [r, m, d] = data.split("-").map(Number);
  const rok = r ?? 1970;
  const miesiac = (m ?? 1) - 1 - miesiace;
  const ostatniDzien = new Date(Date.UTC(rok, miesiac + 1, 0)).getUTCDate();
  const wynik = new Date(Date.UTC(rok, miesiac, Math.min(d ?? 1, ostatniDzien)));
  return wynik.toISOString().slice(0, 10);
}

/** Próg retencji: pakiet kwalifikuje się, gdy `period_to` jest WCZEŚNIEJSZE niż ta data (liczona w Europe/Warsaw). */
export function progRetencji(teraz: Date, miesiace: number): string {
  return odejmijMiesiace(dataLokalna(teraz), miesiace);
}

/** Do kiedy „Zachowaj" odracza kolejne zgłoszenie. */
export function dataOdroczenia(teraz: Date, miesiace = ODROCZENIE_MIESIECY): Date {
  const d = new Date(teraz);
  d.setUTCMonth(d.getUTCMonth() + miesiace);
  return d;
}

export function progSesji(teraz: Date, dni = RETENCJA_SESJI_DNI): Date {
  return new Date(teraz.getTime() - dni * MS_DNIA);
}

export function progAudytu(teraz: Date, miesiace = RETENCJA_AUDYTU_MIESIECY): Date {
  const d = new Date(teraz);
  d.setUTCMonth(d.getUTCMonth() - miesiace);
  return d;
}

export function czyPoTerminieRetencji(periodTo: string, prog: string): boolean {
  return periodTo < prog;
}

/**
 * Podział kandydatów: `nowe` nie mają jeszcze przeglądu, `ponowne` miały „zachowaj", ale odroczenie minęło.
 * Pakiety z otwartym zgłoszeniem (bez decyzji) i z ważnym odroczeniem są pomijane. Usunięte nie istnieją.
 */
export function podzielDoZgloszenia(pakiety: PakietDoPrzegladu[], przeglady: IstniejacyPrzeglad[], teraz: Date): { nowe: PakietDoPrzegladu[]; ponowne: PakietDoPrzegladu[] } {
  const mapa = new Map(przeglady.map((p) => [p.packageId, p]));
  const nowe: PakietDoPrzegladu[] = [];
  const ponowne: PakietDoPrzegladu[] = [];
  for (const pakiet of pakiety) {
    const przeglad = mapa.get(pakiet.id);
    if (!przeglad) nowe.push(pakiet);
    else if (przeglad.decision === "zachowaj" && przeglad.keepUntil && new Date(przeglad.keepUntil).getTime() <= teraz.getTime()) ponowne.push(pakiet);
  }
  return { nowe, ponowne };
}

export type ZaleznosciCronaRetencji = {
  pobierzMiesiaceRetencji(): Promise<number>;
  pobierzPakietyStarszeNiz(prog: string): Promise<PakietDoPrzegladu[]>;
  pobierzPrzeglady(packageIds: string[]): Promise<IstniejacyPrzeglad[]>;
  /** Zwraca false, gdy równoległy przebieg zdążył pierwszy (wtedy nie liczymy zgłoszenia drugi raz). */
  zglos(pakiet: PakietDoPrzegladu, teraz: Date): Promise<boolean>;
  ponow(packageId: string, teraz: Date): Promise<boolean>;
  powiadom(liczba: number): Promise<void>;
  usunStareSesje(przed: Date): Promise<number>;
  usunStaryAudyt(przed: Date): Promise<number>;
  teraz(): Date;
};

export type WynikCronaRetencji = {
  prog: string;
  miesiace: number;
  sprawdzone: number;
  zgloszone: string[];
  ponowione: string[];
  sesjeUsuniete: number;
  audytUsuniety: number;
};

export async function uruchomCronRetencji(d: ZaleznosciCronaRetencji): Promise<WynikCronaRetencji> {
  const teraz = d.teraz();
  const miesiaceZUstawien = await d.pobierzMiesiaceRetencji();
  const miesiace = Number.isFinite(miesiaceZUstawien) && miesiaceZUstawien > 0 ? miesiaceZUstawien : DOMYSLNA_RETENCJA_MIESIECY;
  const prog = progRetencji(teraz, miesiace);
  const pakiety = await d.pobierzPakietyStarszeNiz(prog);
  const przeglady = pakiety.length > 0 ? await d.pobierzPrzeglady(pakiety.map((p) => p.id)) : [];
  const kandydaci = podzielDoZgloszenia(pakiety, przeglady, teraz);
  const zgloszone: string[] = [];
  const ponowione: string[] = [];
  for (const p of kandydaci.nowe) if (await d.zglos(p, teraz)) zgloszone.push(p.id);
  for (const p of kandydaci.ponowne) if (await d.ponow(p.id, teraz)) ponowione.push(p.id);
  if (zgloszone.length + ponowione.length > 0) await d.powiadom(zgloszone.length + ponowione.length);
  const sesjeUsuniete = await d.usunStareSesje(progSesji(teraz));
  const audytUsuniety = await d.usunStaryAudyt(progAudytu(teraz));
  return { prog, miesiace, sprawdzone: pakiety.length, zgloszone, ponowione, sesjeUsuniete, audytUsuniety };
}
