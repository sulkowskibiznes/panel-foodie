/**
 * Faktury (SPEC rozdz. 10): czysta logika statusu. `po_terminie` NIE jest wpisywane ręcznie: cron o 6:00
 * przestawia `do_zaplaty` na `po_terminie`, gdy termin płatności minął w Europe/Warsaw. Ręcznie ustawia się
 * wyłącznie `oplacona`. Trasa /api/cron/faktury tylko woła `uruchomCronFaktur`.
 */
import type { Database } from "@/lib/db-types";
import { dataLokalna } from "@/lib/harmonogram/kalendarz";

export type StatusFaktury = Database["public"]["Enums"]["invoice_status"];
export type FakturaDoTerminu = { id: string; status: StatusFaktury; dueDate: string };

const MS_DNIA = 86_400_000;

function msDaty(data: string): number {
  const [r, m, d] = data.split("-").map(Number);
  return Date.UTC(r ?? 0, (m ?? 1) - 1, d ?? 1);
}

/** Dzisiejsza data w Warszawie jako „YYYY-MM-DD" (daty faktur są datami bez godziny). */
export function dzisLokalnie(teraz: Date): string {
  return dataLokalna(teraz);
}

export function czyPoTerminie(dueDate: string, dzis: string): boolean {
  return dueDate < dzis;
}

/** Ile dni po terminie (0, gdy termin jeszcze nie minął). */
export function dniPoTerminie(dueDate: string, dzis: string): number {
  return Math.max(0, Math.round((msDaty(dzis) - msDaty(dueDate)) / MS_DNIA));
}

/** Kwota brutto z netto przy stawce 23% (podpowiedź w formularzu, do poprawienia ręcznie). */
export function bruttoZNetto(netto: number, stawkaProcent = 23): number {
  return Math.round(netto * (1 + stawkaProcent / 100) * 100) / 100;
}

/** Status po cofnięciu „opłacona": zależy wyłącznie od terminu, tak jak zrobiłby to cron. */
export function statusNieoplaconej(dueDate: string, dzis: string): Exclude<StatusFaktury, "oplacona"> {
  return czyPoTerminie(dueDate, dzis) ? "po_terminie" : "do_zaplaty";
}

export function doPrzeterminowania(faktury: FakturaDoTerminu[], dzis: string): string[] {
  return faktury.filter((f) => f.status === "do_zaplaty" && czyPoTerminie(f.dueDate, dzis)).map((f) => f.id);
}

export type ZaleznosciCronaFaktur = {
  pobierzDoZaplaty(): Promise<FakturaDoTerminu[]>;
  oznaczPoTerminie(ids: string[]): Promise<void>;
  teraz(): Date;
};

export type WynikCronaFaktur = { dzis: string; sprawdzone: number; przeterminowane: string[] };

export async function uruchomCronFaktur(d: ZaleznosciCronaFaktur): Promise<WynikCronaFaktur> {
  const dzis = dzisLokalnie(d.teraz());
  const faktury = await d.pobierzDoZaplaty();
  const przeterminowane = doPrzeterminowania(faktury, dzis);
  if (przeterminowane.length > 0) await d.oznaczPoTerminie(przeterminowane);
  return { dzis, sprawdzone: faktury.length, przeterminowane };
}
