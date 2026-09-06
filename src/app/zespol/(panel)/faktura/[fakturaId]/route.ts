import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { assertTeamClientAccess, pobierzCzlonkaZespolu } from "@/lib/auth-zespol";
import { pobierzFakture } from "@/lib/dane/faktury";
import { podpiszPdf } from "@/lib/pliki/pdf";
import { maUprawnienie } from "@/lib/uprawnienia";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

/** PDF faktury dla zespołu: rola z prawem do faktur i dostęp do klienta, potem 302 na signed URL (10 min). */
export async function GET(_request: Request, ctx: { params: Promise<{ fakturaId: string }> }) {
  const { fakturaId } = await ctx.params;
  const czlonek = await pobierzCzlonkaZespolu();
  if (!czlonek || !maUprawnienie(czlonek.role, "faktury", "podglad") || !czyUuid(fakturaId)) notFound();
  const faktura = await pobierzFakture(fakturaId);
  if (!faktura || !faktura.pdfPath) notFound();
  await assertTeamClientAccess(czlonek, faktura.clientId);
  const adres = await podpiszPdf("faktury", faktura.pdfPath);
  if (!adres) notFound();
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.plik_pobrany", entity: "invoice", entity_id: fakturaId, client_id: faktura.clientId, ip_hash: ipHash });
  return NextResponse.redirect(adres, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
