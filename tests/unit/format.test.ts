import { describe, expect, it } from "vitest";
import { etykietaOkresu, liczebnik, tekstOdliczania } from "@/lib/format";

describe("format", () => {
  const teraz = new Date("2026-09-02T10:00:00Z");
  it("odliczanie do auto-akceptacji", () => {
    expect(tekstOdliczania(new Date("2026-09-04T14:00:00Z"), teraz)).toBe("za 2 dni 4 godz.");
    expect(tekstOdliczania(new Date("2026-09-03T10:00:00Z"), teraz)).toBe("za 1 dzień");
    expect(tekstOdliczania(new Date("2026-09-02T15:00:00Z"), teraz)).toBe("za 5 godz.");
    expect(tekstOdliczania(new Date("2026-09-02T10:30:00Z"), teraz)).toBe("za 30 min");
    expect(tekstOdliczania(new Date("2026-09-02T09:00:00Z"), teraz)).toBe("minął termin");
  });
  it("liczebniki po polsku", () => {
    expect(liczebnik(1, "post", "posty", "postów")).toBe("1 post");
    expect(liczebnik(3, "post", "posty", "postów")).toBe("3 posty");
    expect(liczebnik(6, "post", "posty", "postów")).toBe("6 postów");
    expect(liczebnik(12, "post", "posty", "postów")).toBe("12 postów");
    expect(liczebnik(22, "post", "posty", "postów")).toBe("22 posty");
  });
  it("etykieta okresu", () => {
    expect(etykietaOkresu(2026, 9)).toBe("wrzesień 2026");
  });
});
