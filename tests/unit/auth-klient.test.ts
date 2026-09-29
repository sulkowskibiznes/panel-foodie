import { hash } from "@node-rs/argon2";
import { afterEach, describe, expect, it } from "vitest";
import {
  czyPoprawnyFormatTokenu,
  generujKodStartowy,
  generujPin,
  generujToken,
  hashujPin,
  hashujToken,
  PARAMETRY_ARGON2,
  pieprzZSrodowiska,
  tokenLookup,
  walidujPinKlienta,
  weryfikujPin,
  type Losuj,
} from "@/lib/auth-klient";

/** Pieprz testowy z generatora z ziarnem (nie z głowy); prawdziwy PIN_PEPPER żyje tylko w zmiennych środowiska. */
const PIEPRZ = generujToken(losujZZiarnem(1)) + generujToken(losujZZiarnem(2));
const INNY_PIEPRZ = generujToken(losujZZiarnem(3)) + generujToken(losujZZiarnem(4));

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
    const h = await hashujPin(pin, PIEPRZ);
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await weryfikujPin(h, pin, PIEPRZ)).toBe(true);
    const zly = pin === "0000" ? "0001" : "0000";
    expect(await weryfikujPin(h, zly, PIEPRZ)).toBe(false);
    expect(await weryfikujPin("nie-hash", pin, PIEPRZ)).toBe(false);
  });
});

describe("pieprz PIN-u (Etap 2)", () => {
  const zapamietany = process.env.PIN_PEPPER;
  afterEach(() => {
    if (zapamietany === undefined) delete process.env.PIN_PEPPER;
    else process.env.PIN_PEPPER = zapamietany;
  });

  it("hash z pieprzem weryfikuje się tylko z tym samym pieprzem, nie z innym i nie bez pieprzu", async () => {
    const pin = generujKodStartowy(losujZZiarnem(5));
    const h = await hashujPin(pin, PIEPRZ);
    expect(await weryfikujPin(h, pin, PIEPRZ)).toBe(true);
    expect(await weryfikujPin(h, pin, INNY_PIEPRZ)).toBe(false);
    expect(await weryfikujPin(h, pin, null)).toBe(false);
  });

  it("hash sprzed Etapu 2 (bez pieprzu) weryfikuje się wyłącznie ścieżką bez pieprzu", async () => {
    const pin = generujPin("pin4", losujZZiarnem(6));
    const stary = await hash(pin, PARAMETRY_ARGON2);
    expect(await weryfikujPin(stary, pin, null)).toBe(true);
    expect(await weryfikujPin(stary, pin, PIEPRZ)).toBe(false);
  });

  it("brak albo za krótki PIN_PEPPER to błąd konfiguracji, nie cichy hash bez pieprzu", async () => {
    delete process.env.PIN_PEPPER;
    expect(() => pieprzZSrodowiska()).toThrow(/PIN_PEPPER/);
    process.env.PIN_PEPPER = PIEPRZ.slice(0, 16);
    expect(() => pieprzZSrodowiska()).toThrow(/PIN_PEPPER/);
    process.env.PIN_PEPPER = PIEPRZ;
    expect(pieprzZSrodowiska()).toBe(PIEPRZ);
  });
});

describe("kod startowy (Etap 2)", () => {
  it("6 cyfr z generatora; deterministyczny przy ziarnie", () => {
    expect(generujKodStartowy()).toMatch(/^\d{6}$/);
    expect(generujKodStartowy(losujZZiarnem(9))).toBe(generujKodStartowy(losujZZiarnem(9)));
  });
});

describe("walidujPinKlienta (Etap 2: 4 do 6 cyfr)", () => {
  it("odrzuca zły format: za krótki, za długi, litery, spacje", () => {
    for (const pin of ["", "123", "1234567", "12a4", "12 34"]) expect(walidujPinKlienta(pin), pin).toEqual({ ok: false, powod: "format" });
  });

  it("odrzuca powtórzenia, ciągi (także przez 9→0), bloki i podwojenia", () => {
    for (const pin of ["1111", "00000", "999999", "1234", "7890", "8901", "3210", "0987", "12345", "654321", "1212", "12121", "121212", "123123", "1122", "112233"]) {
      expect(walidujPinKlienta(pin), pin).toEqual({ ok: false, powod: "slaby" });
    }
  });

  it("odrzuca lata 1940-2039 i daty DDMM, MMDD, DDMMRR, MMDDRR", () => {
    for (const pin of ["1940", "1985", "2001", "2039", "3112", "1231", "0229", "2508", "150385", "120399"]) {
      expect(walidujPinKlienta(pin), pin).toEqual({ ok: false, powod: "slaby" });
    }
  });

  it("odrzuca popularne PIN-y spoza reguł (klawiatura, symbole)", () => {
    for (const pin of ["2580", "6969", "0852", "1004", "159753", "147258", "314159"]) expect(walidujPinKlienta(pin), pin).toEqual({ ok: false, powod: "slaby" });
  });

  it("przepuszcza większość losowych PIN-ów: ok. 90% czterocyfrowych i sześciocyfrowych (daty odrzucają kilka procent)", () => {
    const losuj = losujZZiarnem(2026);
    const odsetek = (rodzaj: "pin4" | "pin6") => {
      let ok = 0;
      for (let i = 0; i < 2000; i++) if (walidujPinKlienta(generujPin(rodzaj, losuj)).ok) ok++;
      return ok / 2000;
    };
    const cztery = odsetek("pin4");
    expect(cztery).toBeGreaterThan(0.85);
    expect(cztery).toBeLessThan(0.97);
    expect(odsetek("pin6")).toBeGreaterThan(0.9);
  });
});
