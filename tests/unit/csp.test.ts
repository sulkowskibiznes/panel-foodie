import { describe, expect, it } from "vitest";
import { dyrektywa, nowyNonce, originZAdresu, zbudujCsp } from "@/lib/csp";

/** SPEC rozdz. 16.6: skrypty bez `unsafe-inline`, `frame-ancestors 'none'`; Storage Supabase dopuszczony tylko tam, gdzie trzeba. */
describe("zbudujCsp", () => {
  const produkcja = zbudujCsp({ nonce: "abc123", dev: false, supabaseUrl: "https://projekt.supabase.co/" });
  const dev = zbudujCsp({ nonce: "abc123", dev: true, supabaseUrl: "http://127.0.0.1:54321" });

  it("skrypty: własne, z nonce i strict-dynamic, nigdy unsafe-inline", () => {
    expect(dyrektywa(produkcja, "script-src")).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(produkcja).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(dev).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("unsafe-eval tylko w trybie deweloperskim (React odtwarza stosy błędów przez eval)", () => {
    expect(dyrektywa(produkcja, "script-src")).not.toContain("unsafe-eval");
    expect(dyrektywa(dev, "script-src")).toContain("'unsafe-eval'");
  });

  it("frame-ancestors 'none', object-src 'none', base-uri i form-action tylko własne", () => {
    expect(dyrektywa(produkcja, "frame-ancestors")).toBe("'none'");
    expect(dyrektywa(produkcja, "object-src")).toBe("'none'");
    expect(dyrektywa(produkcja, "base-uri")).toBe("'self'");
    expect(dyrektywa(produkcja, "form-action")).toBe("'self'");
  });

  it("obrazy, wideo i połączenia: własny adres plus origin Supabase (signed URL, PUT uploadu)", () => {
    expect(dyrektywa(produkcja, "img-src")).toBe("'self' blob: data: https://projekt.supabase.co");
    expect(dyrektywa(produkcja, "media-src")).toBe("'self' blob: https://projekt.supabase.co");
    expect(dyrektywa(produkcja, "connect-src")).toBe("'self' https://projekt.supabase.co");
  });

  it("bez adresu Supabase zostaje wyłącznie własny adres", () => {
    const bez = zbudujCsp({ nonce: "n", dev: false, supabaseUrl: null });
    expect(dyrektywa(bez, "img-src")).toBe("'self' blob: data:");
    expect(dyrektywa(bez, "connect-src")).toBe("'self'");
  });

  it("upgrade-insecure-requests tylko na produkcji; w dev HMR po ws://", () => {
    expect(produkcja).toContain("upgrade-insecure-requests");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(dyrektywa(dev, "connect-src")).toContain("ws://localhost:*");
  });

  it("nagłówek nie ma nowych linii ani podwójnych spacji", () => {
    expect(produkcja).not.toMatch(/\n|\s{2,}/);
  });
});

describe("nowyNonce", () => {
  it("daje 16 bajtów w base64, za każdym razem inne", () => {
    const a = nowyNonce();
    const b = nowyNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(a).not.toBe(b);
  });
});

describe("originZAdresu", () => {
  it("zwraca origin bez ścieżki, a dla śmieci null", () => {
    expect(originZAdresu("https://projekt.supabase.co/storage/v1")).toBe("https://projekt.supabase.co");
    expect(originZAdresu("nie-adres")).toBeNull();
    expect(originZAdresu(null)).toBeNull();
  });
});
