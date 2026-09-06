import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { assertTeamClientAccess, pobierzCzlonkaZespolu } from "@/lib/auth-zespol";
import { pobierzDokument } from "@/lib/dane/dokumenty";
import { podpiszPdf } from "@/lib/pliki/pdf";
import { maUprawnienie } from "@/lib/uprawnienia";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

/** PDF dokumentu dla zespołu: rola z prawem do dokumentów i dostęp do klienta, potem 302 na signed URL (10 min). */
export async function GET(_request: Request, ctx: { params: Promise<{ dokumentId: string }> }) {
  const { dokumentId } = await ctx.params;
  const czlonek = await pobierzCzlonkaZespolu();
  if (!czlonek || !maUprawnienie(czlonek.role, "dokumenty", "podglad") || !czyUuid(dokumentId)) notFound();
  const dokument = await pobierzDokument(dokumentId);
  if (!dokument) notFound();
  await assertTeamClientAccess(czlonek, dokument.clientId);
  const adres = await podpiszPdf("dokumenty", dokument.filePath);
  if (!adres) notFound();
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.plik_pobrany", entity: "document", entity_id: dokumentId, client_id: dokument.clientId, ip_hash: ipHash });
  return NextResponse.redirect(adres, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
