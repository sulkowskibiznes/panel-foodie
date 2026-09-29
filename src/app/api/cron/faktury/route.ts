import { NextResponse } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { czyAutoryzowanyCron } from "@/lib/cron";
import { zapiszPrzebiegCrona } from "@/lib/dane/crony";
import { oznaczFakturyPoTerminie, pobierzFakturyDoZaplaty } from "@/lib/dane/faktury";
import { uruchomCronFaktur } from "@/lib/faktury/status";

/**
 * Cron statusów faktur (SPEC rozdz. 10): codziennie rano (vercel.json, 04:00 UTC = 6:00 czasu letniego)
 * `do_zaplaty` -> `po_terminie`, gdy termin płatności minął w Europe/Warsaw. Jedyna droga do `po_terminie`.
 */
export async function GET(request: Request) {
  if (!czyAutoryzowanyCron(request)) return new NextResponse(null, { status: 401 });
  const wynik = await uruchomCronFaktur({ pobierzDoZaplaty: pobierzFakturyDoZaplaty, oznaczPoTerminie: oznaczFakturyPoTerminie, teraz: () => new Date() });
  await Promise.all(wynik.przeterminowane.map((id) => zapiszAudyt({ actor_kind: "system", action: "system.faktura_po_terminie", entity: "invoice", entity_id: id, meta: { dzis: wynik.dzis } })));
  await zapiszPrzebiegCrona("faktury", 0);
  return NextResponse.json(wynik);
}
