import { NextResponse } from "next/server";
import { czyAutoryzowanyCron } from "@/lib/cron";
import { adresZapiera, zaleznosciOutbox } from "@/lib/outbox/baza";
import { uruchomWysylkeOutbox } from "@/lib/outbox/wysylka";

/**
 * Cron Vercela co minutę (vercel.json): wysyłka kolejki `outbox` do Zapiera (SPEC rozdz. 15).
 * Bez adresu webhooka nic nie wysyła i zostawia kolejkę nietkniętą. Nigdy nie woła go żądanie klienta.
 */
export async function GET(request: Request) {
  if (!czyAutoryzowanyCron(request)) return new NextResponse(null, { status: 401 });
  const url = adresZapiera();
  if (!url) return NextResponse.json({ brakAdresu: true, sprawdzone: 0, wyslane: [], ponowione: [], porzucone: [], pominiete: [] });
  const wynik = await uruchomWysylkeOutbox(zaleznosciOutbox(url));
  return NextResponse.json({ brakAdresu: false, ...wynik });
}
