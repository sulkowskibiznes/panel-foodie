import "server-only";
import { BladDysku, type DriveApi } from "@/lib/drive/api";
import { ATRAPA_KORZEN, AtrapaDysku } from "@/lib/drive/atrapa";
import { GoogleDrive } from "@/lib/drive/google";
import { env } from "@/lib/env";

/**
 * Jedno miejsce wyboru implementacji Dysku: konto usługi z env albo atrapa (DRIVE_ATRAPA=1, tylko poza produkcją).
 * Zwraca też identyfikator folderu „Materiały klientów", względem którego karta weryfikacyjna liczy ścieżkę.
 */
export type KonfiguracjaDysku = { drive: DriveApi; korzenId: string; atrapa: boolean };

let google: GoogleDrive | undefined;
let atrapa: AtrapaDysku | undefined;

export function konfiguracjaDysku(): KonfiguracjaDysku | null {
  const e = env();
  if (e.DRIVE_ATRAPA === "1") {
    if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production") throw new BladDysku("DRIVE_ATRAPA nie może być włączona na produkcji.", "konfiguracja");
    atrapa ??= new AtrapaDysku();
    return { drive: atrapa, korzenId: e.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? ATRAPA_KORZEN, atrapa: true };
  }
  if (!e.GOOGLE_SERVICE_ACCOUNT_JSON || !e.GOOGLE_DRIVE_ROOT_FOLDER_ID) return null;
  google ??= GoogleDrive.zEnv(e.GOOGLE_SERVICE_ACCOUNT_JSON);
  return { drive: google, korzenId: e.GOOGLE_DRIVE_ROOT_FOLDER_ID, atrapa: false };
}

export function wymagajDysku(): KonfiguracjaDysku {
  const k = konfiguracjaDysku();
  if (!k) throw new BladDysku("Import z Dysku nie jest skonfigurowany (GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_ROOT_FOLDER_ID).", "konfiguracja");
  return k;
}
