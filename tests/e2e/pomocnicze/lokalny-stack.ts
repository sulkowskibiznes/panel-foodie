import { execSync } from "node:child_process";

export type LokalnyStack = {
  apiUrl: string;
  dbUrl: string;
  mailpitUrl: string;
  publishableKey: string;
  secretKey: string;
};

/** Adresy i klucze lokalnego Supabase z `supabase status`. Wymaga uruchomionego stacku (pnpm db:start). */
export function lokalnyStack(): LokalnyStack {
  const wynik = execSync("pnpm exec supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const env: Record<string, string> = {};
  for (const linia of wynik.split("\n")) {
    const m = /^([A-Z0-9_]+)="?([^"]*)"?$/.exec(linia.trim());
    if (m && m[1] && m[2] !== undefined) env[m[1]] = m[2];
  }
  const apiUrl = env.API_URL;
  const dbUrl = env.DB_URL;
  if (!apiUrl || !dbUrl) throw new Error("Lokalny Supabase nie działa. Uruchom `pnpm db:start` i spróbuj ponownie.");
  return {
    apiUrl,
    dbUrl,
    mailpitUrl: env.MAILPIT_URL ?? "http://127.0.0.1:54324",
    publishableKey: env.PUBLISHABLE_KEY ?? env.ANON_KEY ?? "",
    secretKey: env.SECRET_KEY ?? env.SERVICE_ROLE_KEY ?? "",
  };
}
