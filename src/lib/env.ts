import "server-only";
import { z } from "zod";

const pusteToBrak = (wartosc: unknown) =>
  typeof wartosc === "string" && wartosc.trim() === "" ? undefined : wartosc;

const schemat = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z
    .string()
    .min(1)
    .refine((v) => !v.startsWith("eyJ"), "Użyj klucza sb_secret_, nie wycofywanego service_role"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET: co najmniej 32 znaki (openssl rand -hex 32)"),
  CRON_SECRET: z.string().min(16),
  TEAM_EMAIL_ALLOWLIST: z.preprocess(pusteToBrak, z.string().optional()),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.preprocess(pusteToBrak, z.string().optional()),
  GOOGLE_DRIVE_ROOT_FOLDER_ID: z.preprocess(pusteToBrak, z.string().optional()),
  ZAPIER_WEBHOOK_URL: z.preprocess(pusteToBrak, z.url().optional()),
  INGEST_TOKEN: z.preprocess(pusteToBrak, z.string().optional()),
});

export type Env = z.infer<typeof schemat>;

let zapamietane: Env | undefined;

/**
 * Zmienne środowiskowe serwera, walidowane leniwie przy pierwszym użyciu
 * (build strony statycznej nie wymaga sekretów).
 */
export function env(): Env {
  if (zapamietane) return zapamietane;
  const wynik = schemat.safeParse(process.env);
  if (!wynik.success) {
    const braki = wynik.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Błędna konfiguracja środowiska. ${braki}. Sprawdź .env.local wg .env.example.`);
  }
  zapamietane = wynik.data;
  return zapamietane;
}
