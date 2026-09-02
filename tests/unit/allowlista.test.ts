import { describe, expect, it } from "vitest";
import { czyDozwolonyAdres } from "@/lib/allowlista";

describe("allowlista zespołu", () => {
  const lista = "foodiemedia.pl, stan.morawski88@gmail.com ,annaocicka@o2.pl";
  it("domena przepuszcza każdy adres w domenie", () => {
    expect(czyDozwolonyAdres("gosia@foodiemedia.pl", lista)).toBe(true);
    expect(czyDozwolonyAdres("KTOS@FoodieMedia.pl", lista)).toBe(true);
  });
  it("adres spoza domeny przechodzi tylko, gdy wpisany dokładnie", () => {
    expect(czyDozwolonyAdres("stan.morawski88@gmail.com", lista)).toBe(true);
    expect(czyDozwolonyAdres("inny@gmail.com", lista)).toBe(false);
  });
  it("brak filtra = decyduje wyłącznie team_members", () => {
    expect(czyDozwolonyAdres("ktokolwiek@example.com", undefined)).toBe(true);
    expect(czyDozwolonyAdres("ktokolwiek@example.com", "")).toBe(true);
  });
  it("odrzuca niepoprawne adresy", () => {
    expect(czyDozwolonyAdres("bez-malpy", lista)).toBe(false);
    expect(czyDozwolonyAdres("@foodiemedia.pl", lista)).toBe(false);
  });
});
