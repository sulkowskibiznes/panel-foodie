import { describe, expect, it } from "vitest";
import { MACIERZ_UPRAWNIEN, maUprawnienie, MOZE_IMPERSONOWAC, poziomUprawnienia, WIDZI_WSZYSTKICH_KLIENTOW } from "@/lib/uprawnienia";

describe("macierz uprawnień (SPEC rozdz. 2)", () => {
  it("content_creator nie ma dostępu do faktur (kryterium 23)", () => {
    expect(poziomUprawnienia("content_creator", "faktury")).toBe("brak");
    expect(maUprawnienie("content_creator", "faktury", "podglad")).toBe(false);
  });
  it("csm ma faktury swoich klientów, ale nie ustawienia systemu", () => {
    expect(maUprawnienie("csm", "faktury", "pelne")).toBe(true);
    expect(poziomUprawnienia("csm", "ustawienia")).toBe("brak");
  });
  it("media_buyer edytuje kampanie, content tylko ogląda", () => {
    expect(maUprawnienie("media_buyer", "kampanie", "pelne")).toBe(true);
    expect(maUprawnienie("media_buyer", "materialy", "pelne")).toBe(false);
    expect(maUprawnienie("media_buyer", "materialy", "podglad")).toBe(true);
  });
  it("tylko admin i sales widzą wszystkich klientów; sales bez impersonacji", () => {
    expect([...WIDZI_WSZYSTKICH_KLIENTOW].sort()).toEqual(["admin", "sales"]);
    expect(MOZE_IMPERSONOWAC).not.toContain("sales");
    expect(MOZE_IMPERSONOWAC).toContain("csm");
  });
  it("tylko admin i csm zarządzają linkami dostępu", () => {
    const zDostepem = (Object.keys(MACIERZ_UPRAWNIEN) as Array<keyof typeof MACIERZ_UPRAWNIEN>).filter((r) => maUprawnienie(r, "dostep", "pelne"));
    expect(zDostepem.sort()).toEqual(["admin", "csm"]);
  });
});
