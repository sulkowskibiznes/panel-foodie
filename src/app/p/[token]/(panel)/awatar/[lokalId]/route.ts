import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { pobierzAwatarLokalu, podpiszSciezke } from "@/lib/dane/pliki";
import { assertClientAccess } from "@/lib/dostep";
import { pobierzKontekstKlienta } from "@/lib/kontekst-klienta";
import { czyUuid } from "@/lib/walidacja";

/** Zdjęcie profilowe strony do ramki podglądu (SPEC rozdz. 7): sesja, izolacja, 302 na signed URL. */
export async function GET(_request: Request, ctx: RouteContext<"/p/[token]/awatar/[lokalId]">) {
  const { token, lokalId } = await ctx.params;
  const kontekst = await pobierzKontekstKlienta(token);
  if (!kontekst || !czyUuid(lokalId)) notFound();
  const awatar = await pobierzAwatarLokalu(lokalId);
  if (!awatar) notFound();
  assertClientAccess(kontekst.clientId, awatar.clientId);
  if (!awatar.avatarPath) notFound();
  const url = await podpiszSciezke("awatary", awatar.avatarPath);
  if (!url) notFound();
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=540" } });
}
