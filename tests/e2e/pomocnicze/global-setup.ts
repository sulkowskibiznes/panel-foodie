import { execSync } from "node:child_process";
import postgres from "postgres";
import { lokalnyStack } from "./lokalny-stack";

/**
 * Przed testami: lokalny stack musi stać, a w bazie muszą być klienci z seedu.
 * Ziarno generatora testowego jest jawne w logu, żeby dało się odtworzyć przebieg.
 */
export default async function globalSetup() {
  const stack = lokalnyStack();
  process.env.E2E_DB_URL = stack.dbUrl;
  process.env.E2E_MAILPIT_URL = stack.mailpitUrl;
  process.env.E2E_API_URL = stack.apiUrl;
  process.env.E2E_SECRET_KEY = stack.secretKey;
  process.env.E2E_SEED ??= String(Date.now() % 2_000_000_000);
  console.log(`[e2e] ziarno generatora: ${process.env.E2E_SEED}`);

  const sql = postgres(stack.dbUrl, { max: 1 });
  try {
    const [wiersz] = await sql<{ n: number }[]>`select count(*)::int as n from public.clients where slug in ('burger-brothers', 'pierogarnia-babci')`;
    if ((wiersz?.n ?? 0) < 2) {
      console.log("[e2e] brak klientów z seedu, uruchamiam pnpm db:seed na lokalnym stacku");
      execSync("pnpm db:seed", {
        stdio: "inherit",
        env: { ...process.env, SUPABASE_URL: stack.apiUrl, SUPABASE_SECRET_KEY: stack.secretKey, NEXT_PUBLIC_APP_URL: process.env.E2E_BASE_URL ?? "http://localhost:3100" },
      });
    }
  } finally {
    await sql.end();
  }

  await fetch(`${stack.mailpitUrl}/api/v1/messages`, { method: "DELETE" }).catch(() => undefined);
}
