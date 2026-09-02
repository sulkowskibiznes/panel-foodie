import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Pilnuje zasady 3 z CLAUDE.md: każda tabela w public ma RLS, a role anon/authenticated
 * nie mają żadnych uprawnień (SPEC rozdz. 16.1-16.2). Wymaga bazy: SUPABASE_DB_URL
 * (lokalny stack: postgresql://postgres:postgres@127.0.0.1:54322/postgres).
 */
const url = process.env.SUPABASE_DB_URL;
const sql = url ? postgres(url, { max: 1 }) : undefined;

if (!url) {
  console.warn("[rls.test] Pominięty: brak SUPABASE_DB_URL. Uruchom `pnpm db:start` i ustaw zmienną.");
}

describe.skipIf(!sql)("RLS i uprawnienia w schemacie public", () => {
  afterAll(async () => {
    await sql?.end();
  });

  it("każda tabela ma włączone RLS", async () => {
    const wiersze = await sql!<{ relname: string }[]>`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
      order by 1`;
    expect(wiersze.map((w) => w.relname)).toEqual([]);
  });

  it("anon i authenticated nie mają uprawnień do żadnej tabeli", async () => {
    const wiersze = await sql!<{ table_name: string; grantee: string }[]>`
      select table_name, grantee
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')
      order by 1, 2`;
    expect(wiersze).toEqual([]);
  });

  it("schemat zawiera tabele z SPEC rozdz. 3", async () => {
    const wiersze = await sql!<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = 'public' order by 1`;
    const nazwy = wiersze.map((w) => w.table_name);
    for (const t of [
      "clients", "locations", "client_contacts", "team_members", "client_assignments",
      "access_links", "client_sessions", "rate_limits", "packages", "campaigns", "package_items",
      "item_assets", "ad_variants", "item_views", "comments", "package_events", "import_jobs",
      "reports", "invoices", "documents", "services", "service_interests", "onboarding_steps",
      "audit_log", "outbox", "settings",
    ]) {
      expect(nazwy, `brak tabeli ${t}`).toContain(t);
    }
  });
});
