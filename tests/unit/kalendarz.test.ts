import { describe, expect, it } from "vitest";
import { czasLokalny, czesciLokalne, czyPoprawnaDataLokalna, dataLokalna, dniWMiesiacu, kluczMiesiaca, miesiacWspolpracy, parsujMiesiac, przesunMiesiac, siatkaMiesiaca, zlozDateLokalna } from "@/lib/harmonogram/kalendarz";

describe("kalendarz harmonogramu (SPEC rozdz. 8) w Europe/Warsaw", () => {
  it("siatka miesiąca zaczyna się od poniedziałku i ma pełne tygodnie", () => {
    const wrzesien = siatkaMiesiaca(2026, 9); // 1 września 2026 to wtorek
    expect(wrzesien).toHaveLength(5);
    expect(wrzesien[0]?.[0]).toEqual({ data: "2026-08-31", dzien: 31, wMiesiacu: false });
    expect(wrzesien[0]?.[1]).toEqual({ data: "2026-09-01", dzien: 1, wMiesiacu: true });
    expect(wrzesien[4]?.[2]).toEqual({ data: "2026-09-30", dzien: 30, wMiesiacu: true });
    expect(wrzesien[4]?.[6]).toEqual({ data: "2026-10-04", dzien: 4, wMiesiacu: false });
    const luty = siatkaMiesiaca(2027, 2); // 1 lutego 2027 to poniedziałek, 28 dni = dokładnie 4 tygodnie
    expect(luty).toHaveLength(4);
    expect(luty[0]?.[0]?.data).toBe("2027-02-01");
    expect(luty[3]?.[6]?.data).toBe("2027-02-28");
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

  it("pomocnicze: dni w miesiącu, klucz i parsowanie miesiąca, przesunięcie, miesiąc współpracy", () => {
    expect(dniWMiesiacu(2026, 2)).toBe(28);
    expect(dniWMiesiacu(2028, 2)).toBe(29);
    expect(kluczMiesiaca(2026, 9)).toBe("2026-09");
    expect(parsujMiesiac("2026-09")).toEqual({ rok: 2026, miesiac: 9 });
    expect(parsujMiesiac("2026-13")).toBeNull();
    expect(parsujMiesiac("wrzesien")).toBeNull();
    expect(przesunMiesiac(2026, 12, 1)).toEqual({ rok: 2027, miesiac: 1 });
    expect(przesunMiesiac(2026, 1, -1)).toEqual({ rok: 2025, miesiac: 12 });
    expect(miesiacWspolpracy("2026-04-01", 2026, 9)).toBe(6);
    expect(miesiacWspolpracy(null, 2026, 9)).toBeNull();
    expect(czyPoprawnaDataLokalna("2026-02-29")).toBe(false);
    expect(czyPoprawnaDataLokalna("2028-02-29")).toBe(true);
    expect(czyPoprawnaDataLokalna("2026-9-1")).toBe(false);
  });
});
