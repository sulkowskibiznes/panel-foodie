import { describe, expect, it } from "vitest";
import { dniDoTerminu, kolorTerminu } from "@/lib/pakiety/terminy";

/** Piątek 4 września 2026, 10:30 w Warszawie. */
const TERAZ = new Date("2026-09-04T10:30:00+02:00");
const w = (iso: string) => new Date(iso);

describe("kolory terminów jak w Bazie Klientów (SPEC rozdz. 12.1)", () => {
  it("niebieski 6-7 dni, żółty 4-5, pomarańczowy 1-3, czerwony dziś, szary po terminie", () => {
    expect(kolorTerminu(w("2026-09-11T09:00:00+02:00"), TERAZ)).toBe("niebieski"); // 7 dni
    expect(kolorTerminu(w("2026-09-10T09:00:00+02:00"), TERAZ)).toBe("niebieski"); // 6 dni
    expect(kolorTerminu(w("2026-09-09T09:00:00+02:00"), TERAZ)).toBe("zolty"); // 5 dni
    expect(kolorTerminu(w("2026-09-08T23:00:00+02:00"), TERAZ)).toBe("zolty"); // 4 dni
    expect(kolorTerminu(w("2026-09-07T09:00:00+02:00"), TERAZ)).toBe("pomaranczowy"); // 3 dni
    expect(kolorTerminu(w("2026-09-05T00:30:00+02:00"), TERAZ)).toBe("pomaranczowy"); // jutro, choć za 14 godzin
    expect(kolorTerminu(w("2026-09-04T23:00:00+02:00"), TERAZ)).toBe("czerwony"); // dziś wieczorem
    expect(kolorTerminu(w("2026-09-04T10:00:00+02:00"), TERAZ)).toBe("szary"); // dziś, ale minął
    expect(kolorTerminu(w("2026-09-01T10:00:00+02:00"), TERAZ)).toBe("szary");
  });
  it("liczy dni kalendarzowe w Europe/Warsaw, nie pełne doby", () => {
    expect(dniDoTerminu(w("2026-09-05T00:30:00+02:00"), TERAZ)).toBe(1);
    expect(dniDoTerminu(w("2026-09-04T23:59:00+02:00"), TERAZ)).toBe(0);
    expect(dniDoTerminu(w("2026-09-03T23:59:00+02:00"), TERAZ)).toBe(-1);
    // 23:30 UTC 4 września to już 5 września w Warszawie
    expect(dniDoTerminu(w("2026-09-04T23:30:00Z"), TERAZ)).toBe(1);
  });
  it("dalej niż 7 dni też jest niebieski", () => {
    expect(kolorTerminu(w("2026-10-04T09:00:00+02:00"), TERAZ)).toBe("niebieski");
  });
});
