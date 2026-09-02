import { describe, expect, it } from "vitest";
import {
  czyPoprawnyFormatTokenu,
  generujPin,
  generujToken,
  hashujPin,
  hashujToken,
  tokenLookup,
  weryfikujPin,
  type Losuj,
} from "@/lib/auth-klient";

/** Generator z ustalonym ziarnem (xorshift32) wyłącznie do testów: deterministyczne bajty, zero prawdziwej losowości. */
function losujZZiarnem(ziarno: number): Losuj {
  let stan = ziarno >>> 0 || 1;
  return (n: number) => {
    const bajty = Buffer.alloc(n);
    for (let i = 0; i < n; i++) {
      stan ^= stan << 13;
      stan >>>= 0;
      stan ^= stan >>> 17;
      stan ^= stan << 5;
      stan >>>= 0;
      bajty[i] = stan & 0xff;
    }
    return bajty;
  };
}

describe("token linku", () => {
  it("ma 32 znaki hex, lookup 8 znaków, hash sha256", () => {
    const token = generujToken();
    expect(czyPoprawnyFormatTokenu(token)).toBe(true);
    expect(tokenLookup(token)).toHaveLength(8);
    expect(hashujToken(token)).toHaveLength(64);
  });

  it("nie powtarza się", () => {
    const tokeny = new Set(Array.from({ length: 200 }, () => generujToken()));
    expect(tokeny.size).toBe(200);
  });

  it("jest deterministyczny przy generatorze z ziarnem (do testów E2E)", () => {
    expect(generujToken(losujZZiarnem(42))).toBe(generujToken(losujZZiarnem(42)));
    expect(generujToken(losujZZiarnem(42))).not.toBe(generujToken(losujZZiarnem(43)));
  });

  it("odrzuca zły format", () => {
    expect(czyPoprawnyFormatTokenu("zly-token")).toBe(false);
    expect(czyPoprawnyFormatTokenu("A3F1C9E0B2D4F6A8C0E2B4D6F8A0C2E4")).toBe(false);
  });
});

describe("PIN", () => {
  it("pin4 to 4 cyfry, pin6 to 6 cyfr, hasło ma 10 znaków bez mylących liter", () => {
    expect(generujPin("pin4")).toMatch(/^\d{4}$/);
    expect(generujPin("pin6")).toMatch(/^\d{6}$/);
    expect(generujPin("haslo")).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/);
  });

  it("odrzuca bajty >= 250, więc każda cyfra ma równe szanse", () => {
    const losuj: Losuj = (n) => Buffer.from(Array.from({ length: n }, (_, i) => (i === 0 ? 255 : 7)));
    expect(generujPin("pin4", losuj)).toBe("7777");
  });

  it("hash argon2id weryfikuje poprawny PIN i odrzuca zły", async () => {
    const pin = generujPin("pin4");
    const hash = await hashujPin(pin);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await weryfikujPin(hash, pin)).toBe(true);
    const zly = pin === "0000" ? "0001" : "0000";
    expect(await weryfikujPin(hash, zly)).toBe(false);
    expect(await weryfikujPin("nie-hash", pin)).toBe(false);
  });
});
