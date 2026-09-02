import { describe, expect, it, vi } from "vitest";
import { generujToken, hashujToken } from "@/lib/auth-klient";
import { weryfikujLogowanie, type LinkDoLogowania, type ZaleznosciLogowania } from "@/lib/logowanie-klienta";
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
    revoked_at: null,
    locked_until: null,
    ...nadpisania,
  };
}

function zaleznosci(l: LinkDoLogowania | null, pinOk: boolean, teraz = new Date("2026-09-02T12:00:00Z")) {
  const weryfikuj = vi.fn(async () => pinOk);
  const d: ZaleznosciLogowania = { znajdzLink: vi.fn(async () => l), weryfikuj, hashAtrapa: ATRAPA, teraz: () => teraz };
  return { d, weryfikuj };
}

describe("weryfikujLogowanie: zawsze dokładnie jedno wywołanie argon2", () => {
  it("dobry token i PIN → ok, weryfikacja na hashu linku", async () => {
    const { d, weryfikuj } = zaleznosci(link(), true);
    const w = await weryfikujLogowanie(TOKEN, "1234", d);
    expect(w.ok).toBe(true);
    expect(weryfikuj).toHaveBeenCalledTimes(1);
    expect(weryfikuj).toHaveBeenCalledWith(HASH_PINU, "1234");
  });

  it("zły PIN → zly_pin, jedna weryfikacja na hashu linku", async () => {
    const { d, weryfikuj } = zaleznosci(link(), false);
    const w = await weryfikujLogowanie(TOKEN, "0000", d);
    expect(w).toMatchObject({ ok: false, powod: "zly_pin" });
    expect(weryfikuj).toHaveBeenCalledTimes(1);
    expect(weryfikuj).toHaveBeenCalledWith(HASH_PINU, "0000");
  });

  it("nieznany token → zly_token, jedna weryfikacja na atrapie (ten sam koszt czasu)", async () => {
    const { d, weryfikuj } = zaleznosci(null, true);
    const w = await weryfikujLogowanie(INNY_TOKEN, "1234", d);
    expect(w).toMatchObject({ ok: false, powod: "zly_token", link: null });
    expect(weryfikuj).toHaveBeenCalledTimes(1);
    expect(weryfikuj).toHaveBeenCalledWith(ATRAPA, "1234");
  });

  it("token o dobrym lookupie, ale złym hashu → zly_token na atrapie", async () => {
    const { d, weryfikuj } = zaleznosci(link({ token_hash: hashujToken(INNY_TOKEN) }), true);
    const w = await weryfikujLogowanie(TOKEN, "1234", d);
    expect(w).toMatchObject({ ok: false, powod: "zly_token" });
    expect(weryfikuj).toHaveBeenCalledWith(ATRAPA, "1234");
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

  it("blokada w przyszłości → blokada, nawet z dobrym PIN-em (kryterium 2)", async () => {
    const { d, weryfikuj } = zaleznosci(link({ locked_until: "2026-09-02T12:10:00Z" }), true);
    const w = await weryfikujLogowanie(TOKEN, "1234", d);
    expect(w).toMatchObject({ ok: false, powod: "blokada" });
    expect(weryfikuj).toHaveBeenCalledTimes(1);
  });

  it("blokada, która już minęła, nie blokuje", async () => {
    const { d } = zaleznosci(link({ locked_until: "2026-09-02T11:00:00Z" }), true);
    const w = await weryfikujLogowanie(TOKEN, "1234", d);
    expect(w.ok).toBe(true);
  });
});
