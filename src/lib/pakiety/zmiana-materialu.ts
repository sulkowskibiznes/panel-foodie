/**
 * Skutki dodania, podmiany albo edycji materiału wg statusu pakietu (SPEC rozdz. 12.6, tabela; rozdz. 6.4 poz. 25;
 * przegląd T6: edycja treści po akceptacji idzie tą samą ścieżką co podmiana pliku). Czysta logika, testowana
 * jednostkowo; zapis do bazy robi lib/dane/materialy-zespol.ts.
 *
 * | status                      | skutek                                                                        |
 * | szkic                       | bez plakietek, tylko zdarzenie w historii                                     |
 * | do_akceptacji, poprawki     | plakietka „Nowe" (dodany) albo „Poprawione" (podmieniony, edytowany), zdarzenie; |
 * |                             | w do_akceptacji termin auto-akceptacji na co najmniej 24 h od zmiany            |
 * | zaakceptowany, zaplanowany  | wymaga potwierdzenia; potem plakietka, changed_after_approval, baner, outbox    |
 */
import type { Database } from "@/lib/db-types";
import { przesunAutoAkceptacje } from "@/lib/pakiety/auto-akceptacja";

type StatusPakietu = Database["public"]["Enums"]["package_status"];

export type RodzajZmiany = "dodany" | "podmieniony" | "edytowany";

export type SkutkiZmiany = {
  wymagaPotwierdzenia: boolean;
  plakietka: "nowe" | "poprawione" | null;
  /** `package_items.updated_in_round` (plakietka „Poprawione"). */
  updatedInRound: number | null;
  /** `package_items.added_after_submit` (plakietka „Nowe"). */
  addedAfterSubmit: boolean;
  /** Nowy `auto_approve_at` (tylko do_akceptacji z włączoną auto-akceptacją i terminem), gdy zmiana go przesuwa. */
  nowyTerminAuto: string | null;
  /** `packages.changed_after_approval = true` (baner dla klienta). */
  zmienionePoAkceptacji: boolean;
  zdarzenie: Extract<Database["public"]["Enums"]["package_event_kind"], "material_dodany" | "material_podmieniony">;
  outbox: "material.podmieniony_po_akceptacji" | null;
};

export type StanPakietuDoZmiany = {
  status: StatusPakietu;
  round: number;
  autoApproveEnabled: boolean;
  autoApproveAt: string | null;
};

export function skutkiZmianyMaterialu(pakiet: StanPakietuDoZmiany, rodzaj: RodzajZmiany, o: { teraz: Date; potwierdzono: boolean }): SkutkiZmiany {
  const zdarzenie = rodzaj === "dodany" ? "material_dodany" : "material_podmieniony";
  const bazowe: SkutkiZmiany = { wymagaPotwierdzenia: false, plakietka: null, updatedInRound: null, addedAfterSubmit: false, nowyTerminAuto: null, zmienionePoAkceptacji: false, zdarzenie, outbox: null };
  if (pakiet.status === "szkic") return bazowe;

  const plakietka = rodzaj === "dodany" ? "nowe" : "poprawione";
  const zPlakietka: SkutkiZmiany = {
    ...bazowe,
    plakietka,
    updatedInRound: plakietka === "poprawione" ? pakiet.round : null,
    addedAfterSubmit: plakietka === "nowe",
  };

  if (pakiet.status === "do_akceptacji" || pakiet.status === "poprawki") {
    if (pakiet.status === "do_akceptacji" && pakiet.autoApproveEnabled && pakiet.autoApproveAt) {
      const nowy = przesunAutoAkceptacje(pakiet.autoApproveAt, o.teraz).toISOString();
      return { ...zPlakietka, nowyTerminAuto: nowy !== new Date(pakiet.autoApproveAt).toISOString() ? nowy : null };
    }
    return zPlakietka;
  }

  // zaakceptowany, zaplanowany
  if (!o.potwierdzono) return { ...bazowe, wymagaPotwierdzenia: true };
  return { ...zPlakietka, zmienionePoAkceptacji: true, outbox: "material.podmieniony_po_akceptacji" };
}
