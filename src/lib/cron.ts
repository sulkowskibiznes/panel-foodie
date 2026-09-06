import "server-only";
import { env } from "@/lib/env";
import { porownajStale } from "@/lib/krypto";

/** Cron Vercela dodaje `Authorization: Bearer CRON_SECRET` sam (vercel.json); bez niego trasa odpowiada 401 bez treści. */
export function czyAutoryzowanyCron(request: Request): boolean {
  const naglowek = request.headers.get("authorization") ?? "";
  const oczekiwany = `Bearer ${env().CRON_SECRET}`;
  return naglowek.length === oczekiwany.length && porownajStale(naglowek, oczekiwany);
}
