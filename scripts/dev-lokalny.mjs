/**
 * `pnpm dev:lokalny`: serwer deweloperski na porcie 3100 podpięty pod LOKALNY Supabase (Docker),
 * z kluczami z `supabase status`. Zmienne procesu mają pierwszeństwo przed .env.local, więc projekt
 * w chmurze zostaje nietknięty. Ten sam port i te same dane, co testy E2E (Playwright reużywa serwer).
 *
 * Dysk Google: domyślnie atrapa w pamięci (DRIVE_ATRAPA=1, jak w E2E). `pnpm dev:lokalny:dysk` (flaga --dysk)
 * podpina prawdziwe konto usługi z .env.local przy lokalnej bazie: do sprawdzenia importu realnego miesiąca bez produkcji.
 */
import { execSync, spawn } from "node:child_process";

const prawdziwyDysk = process.argv.includes("--dysk") || process.env.DRIVE_ATRAPA === "0";

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
    DRIVE_ATRAPA: prawdziwyDysk ? "0" : "1",
    // Z prawdziwym Dyskiem identyfikator korzenia i klucz konta usługi czyta Next z .env.local (pusta zmienna by je nadpisała).
    ...(prawdziwyDysk ? {} : { GOOGLE_DRIVE_ROOT_FOLDER_ID: "atrapa-materialy-klientow" }),
  },
});
dziecko.on("exit", (kod) => process.exit(kod ?? 0));
