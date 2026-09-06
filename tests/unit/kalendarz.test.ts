import { describe, expect, it } from "vitest";
import { czasLokalny, czesciLokalne, czyOkresyZachodza, czyPoprawnaDataLokalna, dataLokalna, dlugoscOkresuDni, dniWMiesiacu, kluczMiesiaca, kolejnyMiesiacWspolpracy, miesiacZDaty, parsujMiesiac, siatkaOkresu, zlozDateLokalna } from "@/lib/harmonogram/kalendarz";

describe("kalendarz harmonogramu (SPEC rozdz. 8) w Europe/Warsaw", () => {
  it("siatka okresu: cały wrzesień daje dawną siatkę miesiąca (od poniedziałku, pełne tygodnie)", () => {
    const wrzesien = siatkaOkresu("2026-09-01", "2026-09-30"); // 1 września 2026 to wtorek
    expect(wrzesien).toHaveLength(5);
    expect(wrzesien[0]?.[0]).toEqual({ data: "2026-08-31", dzien: 31, wOkresie: false, nowyMiesiac: true });
    expect(wrzesien[0]?.[1]).toEqual({ data: "2026-09-01", dzien: 1, wOkresie: true, nowyMiesiac: true });
    expect(wrzesien[4]?.[2]).toEqual({ data: "2026-09-30", dzien: 30, wOkresie: true, nowyMiesiac: false });
    expect(wrzesien[4]?.[6]).toEqual({ data: "2026-10-04", dzien: 4, wOkresie: false, nowyMiesiac: false });
    const luty = siatkaOkresu("2027-02-01", "2027-02-28"); // 1 lutego 2027 to poniedziałek, 28 dni = dokładnie 4 tygodnie
    expect(luty).toHaveLength(4);
    expect(luty[0]?.[0]?.data).toBe("2027-02-01");
    expect(luty[3]?.[6]?.data).toBe("2027-02-28");
  });

  it("siatka okresu na styku miesięcy: 20.09 do 19.10 to 6 tygodni od 14.09 do 25.10", () => {
    const siatka = siatkaOkresu("2026-09-20", "2026-10-19");
    expect(siatka).toHaveLength(6);
    expect(siatka[0]?.[0]?.data).toBe("2026-09-14");
    expect(siatka[5]?.[6]?.data).toBe("2026-10-25");
    const dni = siatka.flat();
    expect(dni.find((d) => d.data === "2026-09-19")?.wOkresie).toBe(false);
    expect(dni.find((d) => d.data === "2026-09-20")?.wOkresie).toBe(true);
    expect(dni.find((d) => d.data === "2026-10-19")?.wOkresie).toBe(true);
    expect(dni.find((d) => d.data === "2026-10-20")?.wOkresie).toBe(false);
    expect(dni.find((d) => d.data === "2026-10-01")?.nowyMiesiac).toBe(true);
    expect(dni.find((d) => d.data === "2026-10-02")?.nowyMiesiac).toBe(false);
    expect(siatkaOkresu("2026-09-16", "2026-09-16")).toHaveLength(1);
    expect(() => siatkaOkresu("2026-10-19", "2026-09-20")).toThrow();
    expect(() => siatkaOkresu("2026-01-01", "2028-01-01")).toThrow();
  });

  it("data i czas lokalny z chwili UTC", () => {
    expect(dataLokalna("2026-09-04T23:30:00Z")).toBe("2026-09-05");
    expect(czasLokalny("2026-09-04T23:30:00Z")).toBe("01:30");
    expect(dataLokalna("2026-01-10T12:00:00Z")).toBe("2026-01-10");
    expect(czasLokalny("2026-01-10T12:00:00Z")).toBe("13:00");
    expect(czesciLokalne("2026-09-06T10:00:00Z").dzienTygodnia).toBe(7); // niedziela
    expect(czesciLokalne("2026-09-07T10:00:00Z").dzienTygodnia).toBe(1);
  });

  it("składa lokalną datę i godzinę w chwilę UTC, z poprawką na czas letni i zimowy", () => {
    expect(zlozDateLokalna("2026-09-04", 12, 0).toISOString()).toBe("2026-09-04T10:00:00.000Z");
    expect(zlozDateLokalna("2026-12-04", 12, 0).toISOString()).toBe("2026-12-04T11:00:00.000Z");
    // dzień zmiany czasu (25 października 2026): 18:00 to już czas zimowy
    expect(zlozDateLokalna("2026-10-25", 18, 0).toISOString()).toBe("2026-10-25T17:00:00.000Z");
    expect(czasLokalny(zlozDateLokalna("2026-10-25", 18, 30))).toBe("18:30");
  });

  it("okresy: zachodzenie, długość, miesiąc z daty", () => {
    expect(czyOkresyZachodza({ od: "2026-09-20", do: "2026-10-19" }, { od: "2026-10-19", do: "2026-11-18" })).toBe(true);
    expect(czyOkresyZachodza({ od: "2026-09-20", do: "2026-10-19" }, { od: "2026-10-20", do: "2026-11-19" })).toBe(false);
    expect(czyOkresyZachodza({ od: "2026-09-01", do: "2026-09-30" }, { od: "2026-09-10", do: "2026-09-12" })).toBe(true);
    expect(dlugoscOkresuDni("2026-09-20", "2026-10-19")).toBe(30);
    expect(dlugoscOkresuDni("2026-09-16", "2026-09-16")).toBe(1);
    expect(miesiacZDaty("2026-09-20")).toEqual({ rok: 2026, miesiac: 9 });
  });

  it("numer miesiąca współpracy: ostatni plus jeden, inaczej z daty startu, inaczej null", () => {
    expect(kolejnyMiesiacWspolpracy(5, "2026-04-01", "2026-09-20")).toBe(6);
    expect(kolejnyMiesiacWspolpracy(null, "2026-04-01", "2026-09-20")).toBe(6);
    expect(kolejnyMiesiacWspolpracy(null, "2026-04-15", "2026-04-20")).toBe(1);
    expect(kolejnyMiesiacWspolpracy(null, null, "2026-09-20")).toBeNull();
    expect(kolejnyMiesiacWspolpracy(null, "2027-01-01", "2026-09-20")).toBeNull();
  });

  it("pomocnicze: dni w miesiącu, klucz i parsowanie miesiąca, poprawność daty", () => {
    expect(dniWMiesiacu(2026, 2)).toBe(28);
    expect(dniWMiesiacu(2028, 2)).toBe(29);
    expect(kluczMiesiaca(2026, 9)).toBe("2026-09");
    expect(parsujMiesiac("2026-09")).toEqual({ rok: 2026, miesiac: 9 });
    expect(parsujMiesiac("2026-13")).toBeNull();
    expect(parsujMiesiac("wrzesien")).toBeNull();
    expect(czyPoprawnaDataLokalna("2026-02-29")).toBe(false);
    expect(czyPoprawnaDataLokalna("2028-02-29")).toBe(true);
    expect(czyPoprawnaDataLokalna("2026-9-1")).toBe(false);
  });
});
