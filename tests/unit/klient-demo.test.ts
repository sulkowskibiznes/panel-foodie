import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Kryterium 28 (SPEC rozdz. 20 poz. 21): klient demonstracyjny nie dostaje linku dostępu ani faktury,
 * bo blokuje to trigger w bazie. Wymaga lokalnej bazy z seedem (SUPABASE_DB_URL), inaczej pominięty.
 */
const url = process.env.SUPABASE_DB_URL;
const sql = url ? postgres(url, { max: 1 }) : undefined;

async function idKlienta(slug: string): Promise<string | null> {
  const [w] = await sql!<{ id: string; demo: boolean }[]>`select id, demo from public.clients where slug = ${slug}`;
  return w?.id ?? null;
}

describe.skipIf(!sql)("klient demonstracyjny (clients.demo)", () => {
  afterAll(async () => {
    await sql?.end();
  });

  it("demo-bistro z seedu ma flagę demo, zwykły klient nie", async () => {
    const [demo] = await sql!<{ demo: boolean }[]>`select demo from public.clients where slug = 'demo-bistro'`;
    const [zwykly] = await sql!<{ demo: boolean }[]>`select demo from public.clients where slug = 'burger-brothers'`;
    expect(demo?.demo).toBe(true);
    expect(zwykly?.demo).toBe(false);
  });

  it("baza odrzuca link dostępu dla klienta demo, a przyjmuje dla zwykłego", async () => {
    const demoId = await idKlienta("demo-bistro");
    const zwyklyId = await idKlienta("burger-brothers");
    expect(demoId && zwyklyId).toBeTruthy();
    const wiersz = (clientId: string) => ({
      client_id: clientId,
      label: "test klient demo",
      token_lookup: randomBytes(4).toString("hex"),
      token_hash: randomBytes(32).toString("hex"),
      token_enc: randomBytes(16).toString("hex"),
      pin_hash: "$argon2id$test",
      pin_kind: "pin4",
    });
    await expect(sql!`insert into public.access_links ${sql!(wiersz(demoId!))}`).rejects.toThrow(/demonstracyjny/);
    const [link] = await sql!<{ id: string }[]>`insert into public.access_links ${sql!(wiersz(zwyklyId!))} returning id`;
    expect(link?.id).toBeTruthy();
    await sql!`delete from public.access_links where id = ${link!.id}`;
  });

  it("baza odrzuca fakturę dla klienta demo", async () => {
    const demoId = await idKlienta("demo-bistro");
    await expect(
      sql!`insert into public.invoices (client_id, number, issue_date, due_date, amount_net, amount_gross, status)
           values (${demoId!}, 'TEST/DEMO/1', '2026-09-01', '2026-09-15', 100, 123, 'do_zaplaty')`,
    ).rejects.toThrow(/demonstracyjny/);
  });
});
