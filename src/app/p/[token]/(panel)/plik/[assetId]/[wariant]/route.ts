import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { pobierzZasob } from "@/lib/dane/pakiety-klienta";
import { assertClientAccess } from "@/lib/dostep";
import { pobierzKontekstKlienta } from "@/lib/kontekst-klienta";
import { supabaseSerwer } from "@/lib/supabase/server";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

const WARIANTY = ["original", "preview", "thumb"] as const;
const SEKUND_WAZNOSCI = 600; // SPEC rozdz. 16.3: signed URL ważny 10 minut

/**
 * Pliki materiałów: sprawdzenie sesji i izolacji, potem 302 na signed URL (decyzja D3 z planu).
 * Bez sesji, bez pliku albo cudzy plik: zawsze 404.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ token: string; assetId: string; wariant: string }> }) {
  const { token, assetId, wariant } = await ctx.params;
  const kontekst = await pobierzKontekstKlienta(token);
  if (!kontekst) notFound();
  if (!czyUuid(assetId) || !(WARIANTY as readonly string[]).includes(wariant)) notFound();

  const zasob = await pobierzZasob(assetId);
  if (!zasob) notFound();
  assertClientAccess(kontekst.clientId, zasob.clientId);

  const sciezka = wariant === "original" ? zasob.storagePath : wariant === "preview" ? (zasob.previewPath ?? zasob.storagePath) : (zasob.thumbPath ?? zasob.storagePath);
  const { data, error } = await supabaseSerwer().storage.from("materialy").createSignedUrl(sciezka, SEKUND_WAZNOSCI);
  if (error || !data) notFound();

  if (wariant === "original") {
    const { ipHash } = await infoZadania();
    if (kontekst.tryb === "podglad") {
      await zapiszAudyt({ actor_kind: "zespol", actor_id: kontekst.memberId, actor_label: kontekst.memberName, action: "zespol.plik_pobrany", entity: "item_asset", entity_id: assetId, client_id: kontekst.clientId, ip_hash: ipHash, meta: { podglad: true } });
    } else {
      await zapiszAudyt({ actor_kind: "klient", actor_id: kontekst.contactId, actor_label: kontekst.label, action: "klient.plik_pobrany", entity: "item_asset", entity_id: assetId, client_id: kontekst.clientId, ip_hash: ipHash });
    }
  }

  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "private, max-age=540" } });
}
