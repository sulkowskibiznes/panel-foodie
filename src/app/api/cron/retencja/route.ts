import { NextResponse } from "next/server";
import { czyAutoryzowanyCron } from "@/lib/cron";
import { zapiszPrzebiegCrona } from "@/lib/dane/crony";
import { odnotujWynikRetencji, zaleznosciCronaRetencji } from "@/lib/dane/retencja";
import { uruchomCronRetencji } from "@/lib/retencja/przeglad";

/**
 * Cron retencji (SPEC rozdz. 17): pierwszego dnia miesiąca (vercel.json). Zgłasza adminowi pakiety starsze niż
 * `retention_months`, NICZEGO z materiałów nie kasuje. Sprząta wyłącznie wygasłe sesje (90 dni) i audyt (12 miesięcy).
 */
export async function GET(request: Request) {
  if (!czyAutoryzowanyCron(request)) return new NextResponse(null, { status: 401 });
  const wynik = await uruchomCronRetencji(zaleznosciCronaRetencji());
  await odnotujWynikRetencji(wynik, { actor_kind: "system" });
  await zapiszPrzebiegCrona("retencja", 0);
  return NextResponse.json(wynik);
}
