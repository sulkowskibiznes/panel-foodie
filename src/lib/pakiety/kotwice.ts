/**
 * Kotwice w adresie ekranu pakietu (pulpit, skrzynka uwag → ekran pakietu). O przewinięciu decyduje ekran
 * (`components/pakiet/ekran-pakietu.tsx`), nie przeglądarka: żadna z nich nie jest id elementu w DOM.
 */

/** Sekcja materiału: `#material-<id>`. */
export const kotwicaMaterialu = (materialId: string) => `material-${materialId}`;
/** Pierwsza nierozwiązana uwaga klienta z bieżącej rundy (albo wątek pakietu, gdy uwagi są tylko tam). */
export const KOTWICA_UWAG = "uwagi";
/** Wątek uwag do całego pakietu (uwaga ze skrzynki bez materiału). */
export const KOTWICA_UWAG_PAKIETU = "uwagi-do-pakietu";
