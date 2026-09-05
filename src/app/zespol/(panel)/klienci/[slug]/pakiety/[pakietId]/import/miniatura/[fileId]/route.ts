import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { konfiguracjaDysku } from "@/lib/drive/klient";
import { sprawdzTokenMiniatury } from "@/lib/import/mapowanie";
import { czyUuid } from "@/lib/walidacja";

/**
 * Miniatura pliku z Dysku na ekranie mapowania: sesja zespołu, dostęp do klienta i podpisany token wystawiony
 * przez propozycję mapowania dla tego pakietu i pliku. Przeglądarka nigdy nie rozmawia z Google sama.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/zespol/klienci/[slug]/pakiety/[pakietId]/import/miniatura/[fileId]">) {
  const { slug, pakietId, fileId } = await ctx.params;
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "materialy", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient || !czyUuid(pakietId)) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!sprawdzTokenMiniatury(token, pakietId, fileId)) notFound();
  const konf = konfiguracjaDysku();
  if (!konf) notFound();
  const miniatura = await konf.drive.miniatura(fileId).catch(() => null);
  if (!miniatura) notFound();
  return new Response(Buffer.from(miniatura.bajty), { headers: { "content-type": miniatura.mime ?? "image/jpeg", "cache-control": "private, max-age=600", "x-robots-tag": "noindex" } });
}
