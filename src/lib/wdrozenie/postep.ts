/** Wdrożenie klienta (SPEC rozdz. 11): pasek postępu z kroków; czysta funkcja. Trasa istnieje za flagą `onboarding_enabled`. */
export type KrokPostepu = { doneAt: string | null };

export function postepWdrozenia(kroki: KrokPostepu[]): { zrobione: number; wszystkie: number; procent: number } {
  const wszystkie = kroki.length;
  const zrobione = kroki.filter((k) => k.doneAt !== null).length;
  return { zrobione, wszystkie, procent: wszystkie === 0 ? 0 : Math.round((zrobione / wszystkie) * 100) };
}
