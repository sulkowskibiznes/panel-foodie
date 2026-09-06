import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { pobierzDokument } from "@/lib/dane/dokumenty";
import { assertClientAccess } from "@/lib/dostep";
import { pobierzKontekstKlienta } from "@/lib/kontekst-klienta";
import { podpiszPdf } from "@/lib/pliki/pdf";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

/** PDF dokumentu (SPEC rozdz. 5.6, 16.3): sesja, izolacja, 302 na signed URL ważny 10 minut. Cudzy = 404. */
export async function GET(_request: Request, ctx: { params: Promise<{ token: string; dokumentId: string }> }) {
  const { token, dokumentId } = await ctx.params;
  const kontekst = await pobierzKontekstKlienta(token);
  if (!kontekst || !czyUuid(dokumentId)) notFound();
  const dokument = await pobierzDokument(dokumentId);
  if (!dokument) notFound();
  assertClientAccess(kontekst.clientId, dokument.clientId);
  const adres = await podpiszPdf("dokumenty", dokument.filePath);
  if (!adres) notFound();
  const { ipHash } = await infoZadania();
  if (kontekst.tryb === "podglad") {
    await zapiszAudyt({ actor_kind: "zespol", actor_id: kontekst.memberId, actor_label: kontekst.memberName, action: "zespol.plik_pobrany", entity: "document", entity_id: dokumentId, client_id: kontekst.clientId, ip_hash: ipHash, meta: { podglad: true } });
  } else {
    await zapiszAudyt({ actor_kind: "klient", actor_id: kontekst.contactId, actor_label: kontekst.label, action: "klient.plik_pobrany", entity: "document", entity_id: dokumentId, client_id: kontekst.clientId, ip_hash: ipHash });
  }
  return NextResponse.redirect(adres, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
