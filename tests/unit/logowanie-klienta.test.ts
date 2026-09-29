import { describe, expect, it, vi } from "vitest";
import { generujToken, hashujToken } from "@/lib/auth-klient";
import { weryfikujLogowanie, type LinkDoLogowania, type Rezerwacja, type ZaleznosciLogowania } from "@/lib/logowanie-klienta";
import { losujZZiarnem } from "../pomocnicze/losowosc";

const TOKEN = generujToken(losujZZiarnem(7));
const INNY_TOKEN = generujToken(losujZZiarnem(8));
const HASH_PINU = "$argon2id$prawdziwy";
const ATRAPA = "$argon2id$atrapa";

function link(nadpisania: Partial<LinkDoLogowania> = {}): LinkDoLogowania {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    client_id: "22222222-2222-4222-8222-222222222222",
    contact_id: null,
    label: "Test",
    can_approve: true,
    token_hash: hashujToken(TOKEN),
    pin_hash: HASH_PINU,
    pin_pepper: true,
    pin_temporary: false,
    pin_temporary_expires_at: null,
    pin_version: 1,
    revoked_at: null,
    locked_until: null,
    frozen_at: null,
    ...nadpisania,
  };
}

const WOLNA: Rezerwacja = { dozwolona: true, proby: 1, zamrozony: false };

function zaleznosci(l: LinkDoLogowania | null, pinOk: boolean, rezerwacja: Rezerwacja = WOLNA, teraz = new Date("2026-09-02T12:00:00Z")) {
  const weryfikuj = vi.fn(async () => pinOk);
  const rezerwuj = vi.fn(async () => rezerwacja);
  const d: ZaleznosciLogowania = { znajdzLink: vi.fn(async () => l), rezerwuj, weryfikuj, hashAtrapa: ATRAPA, teraz: () => teraz };
  return { d, weryfikuj, rezerwuj };
}

describe("weryfikujLogowanie: zawsze dokładnie jedno wywołanie argon2", () => {
  it("dobry token i PIN → ok, weryfikacja na hashu linku", async () => {
    const { d, weryfikuj } = zaleznosci(link(), true);
    const w = await weryfikujLogowanie(TOKEN, "1234", d);
    expect(w.ok).toBe(true);
    expect(weryfikuj).toHaveBeenCalledTimes(1);
    expect(weryfikuj).toHaveBeenCalledWith(HASH_PINU, "1234", true);
  });

  it("zły PIN → zly_pin, jedna weryfikacja na hashu linku", async () => {
    const { d, weryfikuj } = zaleznosci(link(), false);
    const w = await weryfikujLogowanie(TOKEN, "0000", d);
    expect(w).toMatchObject({ ok: false, powod: "zly_pin" });
    expect(weryfikuj).toHaveBeenCalledTimes(1);
    expect(weryfikuj).toHaveBeenCalledWith(HASH_PINU, "0000", true);
  });

  it("nieznany token → zly_token, jedna weryfikacja na atrapie (ten sam koszt czasu)", async () => {
    const { d, weryfikuj } = zaleznosci(null, true);
    const w = await weryfikujLogowanie(INNY_TOKEN, "1234", d);
    expect(w).toMatchObject({ ok: false, powod: "zly_token", link: null });
    expect(weryfikuj).toHaveBeenCalledTimes(1);
    expect(weryfikuj).toHaveBeenCalledWith(ATRAPA, "1234", true);
  });

  it("token o dobrym lookupie, ale złym hashu → zly_token na atrapie", async () => {
    const { d, weryfikuj } = zaleznosci(link({ token_hash: hashujToken(INNY_TOKEN) }), true);
    const w = await weryfikujLogowanie(TOKEN, "1234", d);
    expect(w).toMatchObject({ ok: false, powod: "zly_token" });
    expect(weryfikuj).toHaveBeenCalledWith(ATRAPA, "1234", true);
  });

  it("zły format tokenu → zly_format, bez zapytania do bazy, ale z jedną weryfikacją", async () => {
    const { d, weryfikuj } = zaleznosci(link(), true);
    const w = await weryfikujLogowanie("nie-token", "1234", d);
    expect(w).toMatchObject({ ok: false, powod: "zly_format" });
    expect(d.znajdzLink).not.toHaveBeenCalled();
    expect(weryfikuj).toHaveBeenCalledTimes(1);
  });

  it("wygaszony link → wygaszony, nawet z dobrym PIN-em", async () => {
    const { d, weryfikuj } = zaleznosci(link({ revoked_at: "2026-09-01T00:00:00Z" }), true);
    const w = await weryfikujLogowanie(TOKEN, "1234", d);
    expect(w).toMatchObject({ ok: false, powod: "wygaszony" });
    expect(weryfikuj).toHaveBeenCalledTimes(1);
  });

  it("rezerwacja odmówiła (link był zablokowany) → blokada, nawet z dobrym PIN-em (kryterium 2)", async () => {
    const { d, weryfikuj } = zaleznosci(link(), true, { dozwolona: false, proby: 6, zamrozony: false });
    const w = await weryfikujLogowanie(TOKEN, "1234", d);
    expect(w).toMatchObject({ ok: false, powod: "blokada", proby: 6 });
    expect(weryfikuj).toHaveBeenCalledTimes(1);
  });

  it("o blokadzie decyduje rezerwacja, nie odczytany wcześniej wiersz (równoległe próby)", async () => {
    // wiersz odczytany przed 5. porażką innej, równoległej próby: bez blokady; rezerwacja już ją widzi
    const { d } = zaleznosci(link({ locked_until: null }), true, { dozwolona: false, proby: 7, zamrozony: false });
    expect(await weryfikujLogowanie(TOKEN, "1234", d)).toMatchObject({ ok: false, powod: "blokada" });
    // i odwrotnie: stara blokada w odczycie nie przeszkadza, gdy rezerwacja pozwala (blokada minęła)
    const { d: d2 } = zaleznosci(link({ locked_until: "2026-09-02T12:10:00Z" }), true);
    expect((await weryfikujLogowanie(TOKEN, "1234", d2)).ok).toBe(true);
  });

  it("każda próba to dokładnie jedna rezerwacja, zły token rezerwuje „na pusto\"", async () => {
    const dobry = zaleznosci(link(), true);
    await weryfikujLogowanie(TOKEN, "1234", dobry.d);
    expect(dobry.rezerwuj).toHaveBeenCalledTimes(1);
    expect(dobry.rezerwuj).toHaveBeenCalledWith(link().id);
    const zly = zaleznosci(null, false);
    expect(await weryfikujLogowanie(INNY_TOKEN, "1234", zly.d)).toMatchObject({ ok: false, powod: "zly_token", proby: 0 });
    expect(zly.rezerwuj).toHaveBeenCalledTimes(1);
    expect(zly.rezerwuj).toHaveBeenCalledWith(null);
  });
});

describe("weryfikujLogowanie: kod startowy, zamrożenie i hashe sprzed pieprzu (Etap 2)", () => {
  it("zwykły PIN klienta → ok bez ustawiania PIN-u", async () => {
    const { d } = zaleznosci(link(), true);
    expect(await weryfikujLogowanie(TOKEN, "1234", d)).toMatchObject({ ok: true, ustawPin: false });
  });

  it("ważny kod startowy → ok z ustawieniem własnego PIN-u zamiast sesji i numerem próby do wyzerowania", async () => {
    const { d } = zaleznosci(link({ pin_temporary: true, pin_temporary_expires_at: "2026-09-05T12:00:00Z" }), true, { dozwolona: true, proby: 3, zamrozony: false });
    expect(await weryfikujLogowanie(TOKEN, "1234", d)).toMatchObject({ ok: true, ustawPin: true, proby: 3 });
  });

  it("kod startowy sprzed Etapu 2 (bez terminu, bez pieprzu) → ok, weryfikacja bez pieprzu, ustawienie PIN-u", async () => {
    const { d, weryfikuj } = zaleznosci(link({ pin_temporary: true, pin_temporary_expires_at: null, pin_pepper: false }), true);
    expect(await weryfikujLogowanie(TOKEN, "1234", d)).toMatchObject({ ok: true, ustawPin: true });
    expect(weryfikuj).toHaveBeenCalledWith(HASH_PINU, "1234", false);
  });

  it("wygasły kod: dobry → kod_wygasl, zły → zly_pin; zawsze jedno argon2", async () => {
    const wygasly = link({ pin_temporary: true, pin_temporary_expires_at: "2026-09-02T11:59:59Z" });
    const dobry = zaleznosci(wygasly, true);
    expect(await weryfikujLogowanie(TOKEN, "1234", dobry.d)).toMatchObject({ ok: false, powod: "kod_wygasl" });
    expect(dobry.weryfikuj).toHaveBeenCalledTimes(1);
    const zly = zaleznosci(wygasly, false);
    expect(await weryfikujLogowanie(TOKEN, "0000", zly.d)).toMatchObject({ ok: false, powod: "zly_pin" });
  });

  it("zamrożony link (według rezerwacji) → zamrozony nawet z dobrym PIN-em, jedno argon2", async () => {
    const { d, weryfikuj } = zaleznosci(link({ frozen_at: "2026-09-01T00:00:00Z" }), true, { dozwolona: false, proby: 11, zamrozony: true });
    expect(await weryfikujLogowanie(TOKEN, "1234", d)).toMatchObject({ ok: false, powod: "zamrozony" });
    expect(weryfikuj).toHaveBeenCalledTimes(1);
  });

  it("nieznany token weryfikuje na atrapie z pieprzem (ten sam koszt co link z pieprzem)", async () => {
    const { d, weryfikuj } = zaleznosci(null, false);
    await weryfikujLogowanie(INNY_TOKEN, "1234", d);
    expect(weryfikuj).toHaveBeenCalledWith(ATRAPA, "1234", true);
  });
});
