import { describe, expect, it } from "vitest";
import { postepWdrozenia } from "@/lib/wdrozenie/postep";

describe("wdrożenie: pasek postępu (SPEC rozdz. 11)", () => {
  it("liczy zrobione kroki i procent", () => {
    expect(postepWdrozenia([{ doneAt: "2026-09-01" }, { doneAt: null }, { doneAt: "2026-09-02" }])).toEqual({ zrobione: 2, wszystkie: 3, procent: 67 });
  });
  it("bez kroków: zero, bez dzielenia przez zero", () => {
    expect(postepWdrozenia([])).toEqual({ zrobione: 0, wszystkie: 0, procent: 0 });
  });
});
