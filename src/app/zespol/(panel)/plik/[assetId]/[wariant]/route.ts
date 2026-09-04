import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { czyWidziKlienta, pobierzCzlonkaZespolu } from "@/lib/auth-zespol";
import { pobierzZasob } from "@/lib/dane/pakiety-klienta";
import { czyWariantPliku, podpiszSciezke, sciezkaWariantu } from "@/lib/dane/pliki";
import { czyUuid } from "@/lib/walidacja";

/** Pliki materiałów w podglądzie zespołu: członek zespołu z dostępem do klienta, potem 302 na signed URL. Inaczej 404. */
export async function GET(_request: Request, ctx: RouteContext<"/zespol/plik/[assetId]/[wariant]">) {
  const { assetId, wariant } = await ctx.params;
  const czlonek = await pobierzCzlonkaZespolu();
  if (!czlonek || !czyUuid(assetId) || !czyWariantPliku(wariant)) notFound();
  const zasob = await pobierzZasob(assetId);
  if (!zasob || !(await czyWidziKlienta(czlonek, zasob.clientId))) notFound();
  const url = await podpiszSciezke("materialy", sciezkaWariantu(zasob, wariant));
  if (!url) notFound();
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=540" } });
}
