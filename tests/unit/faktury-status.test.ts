import { describe, expect, it } from "vitest";
import { bruttoZNetto, czyPoTerminie, dniPoTerminie, doPrzeterminowania, dzisLokalnie, statusNieoplaconej, uruchomCronFaktur } from "@/lib/faktury/status";

describe("faktury: status po terminie (SPEC rozdz. 10)", () => {
  it("dzień w Warszawie, nie w UTC: 23:30 UTC 14 września to już 15 września", () => {
    expect(dzisLokalnie(new Date("2026-09-14T23:30:00Z"))).toBe("2026-09-15");
    expect(dzisLokalnie(new Date("2026-09-15T04:00:00Z"))).toBe("2026-09-15");
  });
  it("po terminie dopiero następnego dnia po due_date", () => {
    expect(czyPoTerminie("2026-09-15", "2026-09-15")).toBe(false);
    expect(czyPoTerminie("2026-09-15", "2026-09-16")).toBe(true);
    expect(dniPoTerminie("2026-09-15", "2026-09-16")).toBe(1);
    expect(dniPoTerminie("2026-09-15", "2026-10-15")).toBe(30);
    expect(dniPoTerminie("2026-09-15", "2026-09-10")).toBe(0);
  });
  it("do przeterminowania trafiają tylko do_zaplaty z minionym terminem", () => {
    const faktury = [
      { id: "a", status: "do_zaplaty" as const, dueDate: "2026-09-14" },
      { id: "b", status: "do_zaplaty" as const, dueDate: "2026-09-15" },
      { id: "c", status: "oplacona" as const, dueDate: "2026-09-01" },
      { id: "d", status: "po_terminie" as const, dueDate: "2026-09-01" },
    ];
    expect(doPrzeterminowania(faktury, "2026-09-15")).toEqual(["a"]);
  });
  it("cofnięcie opłacenia: status z terminu, jak zrobiłby cron", () => {
    expect(statusNieoplaconej("2026-09-15", "2026-09-15")).toBe("do_zaplaty");
    expect(statusNieoplaconej("2026-09-15", "2026-09-16")).toBe("po_terminie");
  });
  it("brutto z netto przy 23% zaokrąglone do groszy", () => {
    expect(bruttoZNetto(3800)).toBe(4674);
    expect(bruttoZNetto(1234.56)).toBe(1518.51);
  });
  it("cron: oznacza przeterminowane i nic więcej", async () => {
    const oznaczone: string[][] = [];
    const wynik = await uruchomCronFaktur({
      pobierzDoZaplaty: async () => [
        { id: "a", status: "do_zaplaty", dueDate: "2026-09-01" },
        { id: "b", status: "do_zaplaty", dueDate: "2026-12-01" },
      ],
      oznaczPoTerminie: async (ids) => {
        oznaczone.push(ids);
      },
      teraz: () => new Date("2026-09-15T04:00:00Z"),
    });
    expect(wynik).toEqual({ dzis: "2026-09-15", sprawdzone: 2, przeterminowane: ["a"] });
    expect(oznaczone).toEqual([["a"]]);
  });
  it("cron bez przeterminowanych nie woła zapisu", async () => {
    let wywolania = 0;
    await uruchomCronFaktur({ pobierzDoZaplaty: async () => [], oznaczPoTerminie: async () => { wywolania++; }, teraz: () => new Date() });
    expect(wywolania).toBe(0);
  });
});
