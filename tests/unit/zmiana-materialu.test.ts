import { describe, expect, it } from "vitest";
import { skutkiZmianyMaterialu, type StanPakietuDoZmiany } from "@/lib/pakiety/zmiana-materialu";

const TERAZ = new Date("2026-09-04T10:30:00+02:00");
const ZA_48H = new Date(TERAZ.getTime() + 48 * 3_600_000).toISOString();
const ZA_6H = new Date(TERAZ.getTime() + 6 * 3_600_000).toISOString();

function pakiet(n: Partial<StanPakietuDoZmiany>): StanPakietuDoZmiany {
  return { status: "szkic", round: 1, autoApproveEnabled: true, autoApproveAt: null, ...n };
}

describe("skutki zmiany materiału wg statusu (SPEC rozdz. 12.6)", () => {
  it("szkic: bez ograniczeń i bez plakietek", () => {
    for (const rodzaj of ["dodany", "podmieniony", "edytowany"] as const) {
      const s = skutkiZmianyMaterialu(pakiet({}), rodzaj, { teraz: TERAZ, potwierdzono: false });
      expect(s.wymagaPotwierdzenia).toBe(false);
      expect(s.plakietka).toBeNull();
      expect(s.updatedInRound).toBeNull();
      expect(s.addedAfterSubmit).toBe(false);
      expect(s.zmienionePoAkceptacji).toBe(false);
      expect(s.outbox).toBeNull();
    }
    expect(skutkiZmianyMaterialu(pakiet({}), "dodany", { teraz: TERAZ, potwierdzono: false }).zdarzenie).toBe("material_dodany");
    expect(skutkiZmianyMaterialu(pakiet({}), "podmieniony", { teraz: TERAZ, potwierdzono: false }).zdarzenie).toBe("material_podmieniony");
  });

  it(`do_akceptacji: „Nowe" albo „Poprawione" i termin auto-akceptacji na co najmniej 24 h od zmiany (poz. 25)`, () => {
    const dodany = skutkiZmianyMaterialu(pakiet({ status: "do_akceptacji", round: 2, autoApproveAt: ZA_6H }), "dodany", { teraz: TERAZ, potwierdzono: false });
    expect(dodany.plakietka).toBe("nowe");
    expect(dodany.addedAfterSubmit).toBe(true);
    expect(dodany.updatedInRound).toBeNull();
    expect(new Date(dodany.nowyTerminAuto ?? 0).getTime() - TERAZ.getTime()).toBeGreaterThanOrEqual(24 * 3_600_000);

    const podmieniony = skutkiZmianyMaterialu(pakiet({ status: "do_akceptacji", round: 2, autoApproveAt: ZA_48H }), "podmieniony", { teraz: TERAZ, potwierdzono: false });
    expect(podmieniony.plakietka).toBe("poprawione");
    expect(podmieniony.updatedInRound).toBe(2);
    // termin dalszy niż 24 h zostaje: nic do przesunięcia
    expect(podmieniony.nowyTerminAuto).toBeNull();
    expect(podmieniony.zmienionePoAkceptacji).toBe(false);
  });

  it("do_akceptacji z wyłączoną auto-akceptacją: plakietka bez terminu", () => {
    const s = skutkiZmianyMaterialu(pakiet({ status: "do_akceptacji", autoApproveEnabled: false, autoApproveAt: null }), "edytowany", { teraz: TERAZ, potwierdzono: false });
    expect(s.plakietka).toBe("poprawione");
    expect(s.nowyTerminAuto).toBeNull();
  });

  it("poprawki: plakietka, bez terminu (licznik stoi)", () => {
    const s = skutkiZmianyMaterialu(pakiet({ status: "poprawki", round: 1, autoApproveAt: null }), "podmieniony", { teraz: TERAZ, potwierdzono: false });
    expect(s.plakietka).toBe("poprawione");
    expect(s.updatedInRound).toBe(1);
    expect(s.nowyTerminAuto).toBeNull();
    expect(s.wymagaPotwierdzenia).toBe(false);
  });

  it("zaakceptowany i zaplanowany: najpierw potwierdzenie, potem plakietka, flaga, baner i outbox", () => {
    for (const status of ["zaakceptowany", "zaplanowany"] as const) {
      const bez = skutkiZmianyMaterialu(pakiet({ status, round: 1 }), "podmieniony", { teraz: TERAZ, potwierdzono: false });
      expect(bez.wymagaPotwierdzenia).toBe(true);
      expect(bez.plakietka).toBeNull();
      expect(bez.zmienionePoAkceptacji).toBe(false);
      expect(bez.outbox).toBeNull();

      const z = skutkiZmianyMaterialu(pakiet({ status, round: 1 }), "podmieniony", { teraz: TERAZ, potwierdzono: true });
      expect(z.wymagaPotwierdzenia).toBe(false);
      expect(z.plakietka).toBe("poprawione");
      expect(z.updatedInRound).toBe(1);
      expect(z.zmienionePoAkceptacji).toBe(true);
      expect(z.outbox).toBe("material.podmieniony_po_akceptacji");
      expect(z.zdarzenie).toBe("material_podmieniony");

      const dodany = skutkiZmianyMaterialu(pakiet({ status, round: 1 }), "dodany", { teraz: TERAZ, potwierdzono: true });
      expect(dodany.plakietka).toBe("nowe");
      expect(dodany.zdarzenie).toBe("material_dodany");
      expect(dodany.outbox).toBe("material.podmieniony_po_akceptacji");
    }
  });
});
