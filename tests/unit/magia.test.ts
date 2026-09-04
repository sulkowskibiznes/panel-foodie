import { describe, expect, it } from "vitest";
import { MAKS_BAJTOW_OBRAZU, MAKS_BAJTOW_WIDEO, OSTRZEZENIE_BAJTOW_WIDEO, rozpoznajMagie, sprawdzPlik } from "@/lib/pliki/magia";

const bajty = (...b: (number | string)[]) => {
  const wynik: number[] = [];
  for (const x of b) {
    if (typeof x === "number") wynik.push(x);
    else for (const ch of x) wynik.push(ch.charCodeAt(0));
  }
  while (wynik.length < 16) wynik.push(0);
  return Uint8Array.from(wynik);
};

const JPEG = bajty(0xff, 0xd8, 0xff, 0xe0);
const PNG = bajty(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = bajty("RIFF", 0, 0, 0, 0, "WEBP");
const HEIC = bajty(0, 0, 0, 0x18, "ftyp", "heic");
const MP4 = bajty(0, 0, 0, 0x18, "ftyp", "isom");
const MOV = bajty(0, 0, 0, 0x14, "ftyp", "qt  ");

describe("magic bytes (SPEC rozdz. 16 pkt 11)", () => {
  it("rozpoznaje obsługiwane formaty po zawartości, nie po nazwie", () => {
    expect(rozpoznajMagie(JPEG)).toBe("image/jpeg");
    expect(rozpoznajMagie(PNG)).toBe("image/png");
    expect(rozpoznajMagie(WEBP)).toBe("image/webp");
    expect(rozpoznajMagie(HEIC)).toBe("image/heic");
    expect(rozpoznajMagie(MP4)).toBe("video/mp4");
    expect(rozpoznajMagie(MOV)).toBe("video/quicktime");
  });
  it("odrzuca inne formaty i zbyt krótkie dane", () => {
    expect(rozpoznajMagie(bajty("GIF89a"))).toBeNull();
    expect(rozpoznajMagie(bajty("%PDF-1.7"))).toBeNull();
    expect(rozpoznajMagie(bajty(0, 0, 0, 0x18, "ftyp", "xxxx"))).toBeNull();
    expect(rozpoznajMagie(Uint8Array.from([0xff, 0xd8]))).toBeNull();
  });
  it("pilnuje limitów: obraz 25 MB, wideo 300 MB, ostrzeżenie od 150 MB (SPEC rozdz. 13.4)", () => {
    expect(sprawdzPlik({ bajtyPoczatku: JPEG, bytes: MAKS_BAJTOW_OBRAZU, zadeklarowanyMime: "image/jpeg" })).toEqual({ ok: true, rodzaj: "image/jpeg", ostrzezenie: null });
    expect(sprawdzPlik({ bajtyPoczatku: JPEG, bytes: MAKS_BAJTOW_OBRAZU + 1, zadeklarowanyMime: "image/jpeg" })).toMatchObject({ ok: false, powod: "zaDuzy", limit: MAKS_BAJTOW_OBRAZU });
    expect(sprawdzPlik({ bajtyPoczatku: MP4, bytes: OSTRZEZENIE_BAJTOW_WIDEO + 1, zadeklarowanyMime: "video/mp4" })).toEqual({ ok: true, rodzaj: "video/mp4", ostrzezenie: "duzeWideo" });
    expect(sprawdzPlik({ bajtyPoczatku: MP4, bytes: MAKS_BAJTOW_WIDEO + 1, zadeklarowanyMime: "video/mp4" })).toMatchObject({ ok: false, powod: "zaDuzy" });
  });
  it("plik z rozszerzeniem obrazu, który jest wideo (albo odwrotnie), odpada", () => {
    expect(sprawdzPlik({ bajtyPoczatku: MP4, bytes: 10, zadeklarowanyMime: "image/png" })).toMatchObject({ ok: false, powod: "niezgodnyZDeklaracja" });
    expect(sprawdzPlik({ bajtyPoczatku: PNG, bytes: 10, zadeklarowanyMime: "video/mp4" })).toMatchObject({ ok: false, powod: "niezgodnyZDeklaracja" });
    expect(sprawdzPlik({ bajtyPoczatku: PNG, bytes: 10, zadeklarowanyMime: "image/jpeg" })).toMatchObject({ ok: true, rodzaj: "image/png" });
    expect(sprawdzPlik({ bajtyPoczatku: bajty("GIF89a"), bytes: 10, zadeklarowanyMime: "image/gif" })).toMatchObject({ ok: false, powod: "nieobslugiwany" });
  });
});
