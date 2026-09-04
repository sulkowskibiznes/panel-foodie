import { describe, expect, it } from "vitest";
import { DOMYSLNY_PLACEMENT, PLACEMENTY, placementDostepny } from "@/components/podglad/reklama/placementy";

describe("placementy reklamy (SPEC rozdz. 7.4)", () => {
  it("dokładnie sześć: cztery na Facebooku, dwa na Instagramie", () => {
    expect(PLACEMENTY).toHaveLength(6);
    expect(PLACEMENTY.filter((p) => p.grupa === "facebook").map((p) => p.id)).toEqual(["fb_kanal_telefon", "fb_kanal_komputer", "fb_relacje", "fb_reels"]);
    expect(PLACEMENTY.filter((p) => p.grupa === "instagram").map((p) => p.id)).toEqual(["ig_kanal", "ig_relacje_reels"]);
  });
  it("tylko instagramowe wymagają nicka; bez nicka są niedostępne, ale nadal na liście", () => {
    expect(PLACEMENTY.filter((p) => p.wymagaIg).map((p) => p.id)).toEqual(["ig_kanal", "ig_relacje_reels"]);
    expect(PLACEMENTY.filter((p) => placementDostepny(p, null))).toHaveLength(4);
    expect(PLACEMENTY.filter((p) => placementDostepny(p, "burgerbrothers.pl"))).toHaveLength(6);
  });
  it("domyślny to kanał Facebooka na telefonie (klient otwiera z WhatsAppa)", () => {
    expect(DOMYSLNY_PLACEMENT).toBe("fb_kanal_telefon");
  });
});
