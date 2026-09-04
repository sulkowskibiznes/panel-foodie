/**
 * `pnpm dev:lokalny`: serwer deweloperski na porcie 3100 podpięty pod LOKALNY Supabase (Docker),
 * z kluczami z `supabase status`. Zmienne procesu mają pierwszeństwo przed .env.local, więc projekt
 * w chmurze zostaje nietknięty. Ten sam port i te same dane, co testy E2E (Playwright reużywa serwer).
 */
import { execSync, spawn } from "node:child_process";

const wynik = execSync("pnpm exec supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const stack = {};
for (const linia of wynik.split("\n")) {
  const m = /^([A-Z0-9_]+)="?([^"]*)"?$/.exec(linia.trim());
  if (m) stack[m[1]] = m[2];
}
if (!stack.API_URL) {
  console.error("Lokalny Supabase nie działa. Uruchom `pnpm db:start`.");
  process.exit(1);
}
const port = process.env.PORT ?? "3100";
const dziecko = spawn("pnpm", ["exec", "next", "dev", "-p", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
    SUPABASE_URL: stack.API_URL,
    SUPABASE_PUBLISHABLE_KEY: stack.PUBLISHABLE_KEY ?? stack.ANON_KEY ?? "",
    SUPABASE_SECRET_KEY: stack.SECRET_KEY ?? stack.SERVICE_ROLE_KEY ?? "",
  },
});
dziecko.on("exit", (kod) => process.exit(kod ?? 0));
