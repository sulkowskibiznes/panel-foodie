import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { pobierzFakture } from "@/lib/dane/faktury";
import { assertClientAccess } from "@/lib/dostep";
import { pobierzKontekstKlienta } from "@/lib/kontekst-klienta";
import { podpiszPdf } from "@/lib/pliki/pdf";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

/** PDF faktury (SPEC rozdz. 5.6, 16.3): sesja, izolacja, potem 302 na signed URL ważny 10 minut. Cudza albo bez PDF = 404. */
export async function GET(_request: Request, ctx: { params: Promise<{ token: string; fakturaId: string }> }) {
  const { token, fakturaId } = await ctx.params;
  const kontekst = await pobierzKontekstKlienta(token);
  if (!kontekst || !czyUuid(fakturaId)) notFound();
  const faktura = await pobierzFakture(fakturaId);
  if (!faktura) notFound();
  assertClientAccess(kontekst.clientId, faktura.clientId);
  if (!faktura.pdfPath) notFound();
  const adres = await podpiszPdf("faktury", faktura.pdfPath);
  if (!adres) notFound();
  const { ipHash } = await infoZadania();
  if (kontekst.tryb === "podglad") {
    await zapiszAudyt({ actor_kind: "zespol", actor_id: kontekst.memberId, actor_label: kontekst.memberName, action: "zespol.plik_pobrany", entity: "invoice", entity_id: fakturaId, client_id: kontekst.clientId, ip_hash: ipHash, meta: { podglad: true } });
  } else {
    await zapiszAudyt({ actor_kind: "klient", actor_id: kontekst.contactId, actor_label: kontekst.label, action: "klient.plik_pobrany", entity: "invoice", entity_id: fakturaId, client_id: kontekst.clientId, ip_hash: ipHash });
  }
  return NextResponse.redirect(adres, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
