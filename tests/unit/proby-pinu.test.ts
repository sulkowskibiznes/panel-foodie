import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Blokady PIN-u w bazie (przegląd Etapu 2): rezerwacja próby przed argon2 pod blokadą wiersza, alarm i zamrożenie po
 * potwierdzonej porażce, zerowanie tylko bez równoległych prób. Równoległe rezerwacje idą osobnymi połączeniami,
 * więc test sprawdza prawdziwą współbieżność. Wymaga SUPABASE_DB_URL (lokalny stack), inaczej pominięty.
 */
const url = process.env.SUPABASE_DB_URL;
const sql = url ? postgres(url, { max: 12 }) : undefined;
const slug = `test-proby-pinu-${randomBytes(4).toString("hex")}`;
let clientId = "";

type Rezerwacja = { dozwolona: boolean; proby: number; zamrozony: boolean };
type Potwierdzenie = { blokada_24h: boolean; zamrozony: boolean; zablokowany_do: string | null };

async function nowyLink(): Promise<string> {
  const token = randomBytes(16).toString("hex");
  const [w] = await sql!<{ id: string }[]>`
    insert into public.access_links (client_id, label, token_lookup, token_hash, token_enc, pin_hash, pin_temporary, pin_pepper)
    values (${clientId}, 'test prób', ${token.slice(0, 8)}, ${randomBytes(32).toString("hex")}, 'x', 'x', false, true)
    returning id`;
  return w!.id;
}

async function rezerwuj(id: string): Promise<Rezerwacja> {
  const [w] = await sql!<Rezerwacja[]>`select * from public.zarezerwuj_probe_pinu(${id}::uuid)`;
  return w!;
}

async function potwierdz(id: string, proby: number): Promise<Potwierdzenie> {
  const [w] = await sql!<Potwierdzenie[]>`select * from public.potwierdz_nieudana_probe_pinu(${id}::uuid, ${proby})`;
  return w!;
}

async function stan(id: string) {
  const [w] = await sql!<{ failed_attempts: number; locked_until: Date | null; frozen_at: Date | null; last_lockout_24h_at: Date | null }[]>`
    select failed_attempts, locked_until, frozen_at, last_lockout_24h_at from public.access_links where id = ${id}`;
  return w!;
}

describe.skipIf(!sql)("próby PIN-u: rezerwacja przed argon2, alarm, zamrożenie", () => {
  beforeAll(async () => {
    const [k] = await sql!<{ id: string }[]>`
      insert into public.clients (name, slug, category, tier) values ('Test prób PIN-u', ${slug}, 'kat2', 'foodie_one') returning id`;
    clientId = k!.id;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`delete from public.clients where slug = ${slug}`;
    await sql.end();
  });

  it("12 równoległych prób: weryfikację dostaje dokładnie 5, każda próba ma własny numer, link zablokowany na 15 min", async () => {
    const id = await nowyLink();
    const wyniki = await Promise.all(Array.from({ length: 12 }, () => rezerwuj(id)));
    expect(wyniki.filter((w) => w.dozwolona)).toHaveLength(5);
    expect(wyniki.map((w) => w.proby).sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(wyniki.filter((w) => w.dozwolona).map((w) => w.proby).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    const s = await stan(id);
    expect(s.failed_attempts).toBe(12);
    // od 10. próby blokada 24 h (rezerwacja nakłada ją od razu, zanim ktokolwiek policzy argon2)
    expect(s.locked_until!.getTime() - Date.now()).toBeGreaterThan(23 * 3_600_000);
  });

  it("alarm 24 h tylko dla próby nr 10; stara blokada sprzed ponad 30 dni nie zamraża", async () => {
    const id = await nowyLink();
    await sql!`update public.access_links set failed_attempts = 8, failed_window_started_at = now(), last_lockout_24h_at = now() - interval '40 days' where id = ${id}`;
    const r9 = await rezerwuj(id);
    const r10 = await rezerwuj(id);
    expect([r9.proby, r10.proby]).toEqual([9, 10]);
    expect(await potwierdz(id, r9.proby)).toMatchObject({ blokada_24h: false, zamrozony: false });
    expect(await potwierdz(id, r10.proby)).toMatchObject({ blokada_24h: true, zamrozony: false });
    const s = await stan(id);
    expect(s.frozen_at).toBeNull();
    expect(s.last_lockout_24h_at!.getTime()).toBeGreaterThan(Date.now() - 60_000);
    const r11 = await rezerwuj(id);
    expect(r11.dozwolona).toBe(false);
    expect(await potwierdz(id, r11.proby)).toMatchObject({ blokada_24h: false });
  });

  it("druga blokada 24 h w ciągu 30 dni zamraża link; zamrożony link nie dostaje weryfikacji", async () => {
    const id = await nowyLink();
    await sql!`update public.access_links set failed_attempts = 9, failed_window_started_at = now(), last_lockout_24h_at = now() - interval '10 days' where id = ${id}`;
    const r = await rezerwuj(id);
    expect(r).toMatchObject({ dozwolona: true, proby: 10, zamrozony: false });
    expect(await potwierdz(id, r.proby)).toMatchObject({ blokada_24h: true, zamrozony: true });
    expect((await stan(id)).frozen_at).not.toBeNull();
    expect(await rezerwuj(id)).toMatchObject({ dozwolona: false, zamrozony: true });
  });

  it("udana próba zeruje licznik tylko, gdy nikt równolegle nie dołożył próby", async () => {
    const id = await nowyLink();
    const moja = await rezerwuj(id);
    const obca = await rezerwuj(id);
    const [bezZmian] = await sql!<{ z: boolean }[]>`select public.zeruj_proby_pinu(${id}::uuid, ${moja.proby}) as z`;
    expect(bezZmian!.z).toBe(false);
    expect((await stan(id)).failed_attempts).toBe(2);
    const [zerowanie] = await sql!<{ z: boolean }[]>`select public.zeruj_proby_pinu(${id}::uuid, ${obca.proby}) as z`;
    expect(zerowanie!.z).toBe(true);
    expect(await stan(id)).toMatchObject({ failed_attempts: 0, locked_until: null });
  });

  it("nieistniejący link (zły token): rezerwacja i potwierdzenie bez błędu i bez zapisu", async () => {
    const pusty = "00000000-0000-0000-0000-000000000000";
    expect(await rezerwuj(pusty)).toMatchObject({ dozwolona: true, proby: 0, zamrozony: false });
    expect(await potwierdz(pusty, 0)).toMatchObject({ blokada_24h: false, zamrozony: false });
  });
});
