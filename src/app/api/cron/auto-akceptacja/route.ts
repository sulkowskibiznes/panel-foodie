import { NextResponse } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { env } from "@/lib/env";
import { porownajStale } from "@/lib/krypto";
import { zaleznosciCrona } from "@/lib/pakiety/baza";
import { uruchomCronAutoAkceptacji } from "@/lib/pakiety/cron-auto-akceptacji";

/**
 * Cron Vercela co godzinę (vercel.json). Autoryzacja nagłówkiem `Authorization: Bearer CRON_SECRET`,
 * który Vercel dodaje sam; bez niego 401 bez treści.
 */
export async function GET(request: Request) {
  const naglowek = request.headers.get("authorization") ?? "";
  const oczekiwany = `Bearer ${env().CRON_SECRET}`;
  if (naglowek.length !== oczekiwany.length || !porownajStale(naglowek, oczekiwany)) {
    return new NextResponse(null, { status: 401 });
  }
  const wynik = await uruchomCronAutoAkceptacji(zaleznosciCrona());
  await Promise.all(
    wynik.zaakceptowane.map((id) => zapiszAudyt({ actor_kind: "system", action: "system.auto_akceptacja", entity: "package", entity_id: id })),
  );
  return NextResponse.json(wynik);
}
