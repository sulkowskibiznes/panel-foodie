import { describe, expect, it } from "vitest";
import {
  hashujIp,
  hmacHex,
  odszyfruj,
  porownajStale,
  sha256Hex,
  wyprowadzKlucz,
  zaszyfruj,
} from "@/lib/krypto";

const SEKRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("krypto", () => {
  it("sha256 zgodne ze znanym wektorem", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("HKDF daje różne klucze dla różnych celów i ten sam klucz dla tego samego celu", () => {
    const cookie = wyprowadzKlucz(SEKRET, "cookie");
    const token = wyprowadzKlucz(SEKRET, "token");
    const ip = wyprowadzKlucz(SEKRET, "ip");
    expect(cookie.length).toBe(32);
    expect(cookie.equals(token)).toBe(false);
    expect(token.equals(ip)).toBe(false);
    expect(wyprowadzKlucz(SEKRET, "cookie").equals(cookie)).toBe(true);
  });

  it("odrzuca za krótki sekret", () => {
    expect(() => wyprowadzKlucz("krotki", "cookie")).toThrow();
  });

  it("szyfrowanie i odszyfrowanie wracają do jawnego tekstu, a szyfrogramy się nie powtarzają", () => {
    const klucz = wyprowadzKlucz(SEKRET, "token");
    const jawny = "a3f1c9e0b2d4f6a8c0e2b4d6f8a0c2e4";
    const a = zaszyfruj(klucz, jawny);
    const b = zaszyfruj(klucz, jawny);
    expect(a).not.toBe(b);
    expect(odszyfruj(klucz, a)).toBe(jawny);
    expect(odszyfruj(klucz, b)).toBe(jawny);
  });

  it("odszyfrowanie innym kluczem albo zmienionego szyfrogramu rzuca błąd", () => {
    const klucz = wyprowadzKlucz(SEKRET, "token");
    const inny = wyprowadzKlucz(SEKRET, "cookie");
    const szyfrogram = zaszyfruj(klucz, "tajne");
    expect(() => odszyfruj(inny, szyfrogram)).toThrow();
    const zepsuty = szyfrogram.slice(0, -2) + (szyfrogram.endsWith("AA") ? "BB" : "AA");
    expect(() => odszyfruj(klucz, zepsuty)).toThrow();
  });

  it("porównanie w stałym czasie działa dla równych i różnych wartości", () => {
    expect(porownajStale("abc", "abc")).toBe(true);
    expect(porownajStale("abc", "abd")).toBe(false);
    expect(porownajStale("abc", "abcd")).toBe(false);
  });

  it("HMAC i hash IP są deterministyczne i zależne od klucza", () => {
    const k1 = wyprowadzKlucz(SEKRET, "ip");
    const k2 = wyprowadzKlucz(SEKRET, "cookie");
    expect(hashujIp(k1, "10.0.0.1")).toBe(hashujIp(k1, " 10.0.0.1 "));
    expect(hashujIp(k1, "10.0.0.1")).not.toBe(hashujIp(k2, "10.0.0.1"));
    expect(hmacHex(k1, "x")).toHaveLength(64);
  });
});
