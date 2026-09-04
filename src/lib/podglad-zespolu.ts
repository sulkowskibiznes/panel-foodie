/**
 * Token podglądu „Zobacz jak klient" (SPEC rozdz. 2, kryterium 25). Zamiast tokenu linku w adresie
 * /p/<token>/... stoi podpisany, wygasający ładunek z id klienta i członka zespołu. Sam token nie wystarcza:
 * kontekst klienta wymaga jeszcze żywej sesji Auth tego samego członka (lib/kontekst-klienta.ts).
 * Czysty Node; klucz wyprowadza wywołujący (wyprowadzKlucz(SESSION_SECRET, "podglad")).
 */
import { odczytajLadunek, podpiszLadunek } from "@/lib/podpis";

export const PREFIKS_PODGLADU = "podglad.";
export const MS_WAZNOSCI_PODGLADU = 4 * 60 * 60 * 1000;

export type LadunekPodgladu = { clientId: string; memberId: string; wydanoO: number; wygasaO: number };

export function czyTokenPodgladu(token: string): boolean {
  return token.startsWith(PREFIKS_PODGLADU);
}

export function utworzTokenPodgladu(klucz: Buffer, dane: { clientId: string; memberId: string }, teraz = new Date()): string {
  const ladunek: LadunekPodgladu = { clientId: dane.clientId, memberId: dane.memberId, wydanoO: teraz.getTime(), wygasaO: teraz.getTime() + MS_WAZNOSCI_PODGLADU };
  return PREFIKS_PODGLADU + podpiszLadunek(klucz, ladunek);
}

export function odczytajTokenPodgladu(klucz: Buffer, token: string, teraz = new Date()): LadunekPodgladu | null {
  if (!czyTokenPodgladu(token)) return null;
  const l = odczytajLadunek<LadunekPodgladu>(klucz, token.slice(PREFIKS_PODGLADU.length), teraz);
  if (!l || typeof l.clientId !== "string" || typeof l.memberId !== "string") return null;
  return l;
}
