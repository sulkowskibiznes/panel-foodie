import { NextResponse } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { czyAutoryzowanyCron } from "@/lib/cron";
import { zapiszPrzebiegCrona } from "@/lib/dane/crony";
import { zaleznosciCrona } from "@/lib/pakiety/baza";
import { uruchomCronAutoAkceptacji } from "@/lib/pakiety/cron-auto-akceptacji";

/**
 * Cron Vercela co godzinę (vercel.json). Autoryzacja nagłówkiem `Authorization: Bearer CRON_SECRET`,
 * który Vercel dodaje sam; bez niego 401 bez treści.
 */
export async function GET(request: Request) {
  if (!czyAutoryzowanyCron(request)) return new NextResponse(null, { status: 401 });
  const wynik = await uruchomCronAutoAkceptacji(zaleznosciCrona());
  await Promise.all(
    wynik.zaakceptowane.map((id) => zapiszAudyt({ actor_kind: "system", action: "system.auto_akceptacja", entity: "package", entity_id: id })),
  );
  await zapiszPrzebiegCrona("auto-akceptacja", wynik.bledy.length);
  return NextResponse.json(wynik);
}
