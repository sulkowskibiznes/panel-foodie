import { NextResponse, type NextRequest } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { zakonczSesje } from "@/lib/sesja-klienta";
import { infoZadania } from "@/lib/zadanie";

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const sesja = await zakonczSesje();
  if (sesja) {
    const { ipHash } = await infoZadania();
    await zapiszAudyt({ actor_kind: "klient", action: "klient.wylogowanie", entity: "access_link", entity_id: sesja.linkId, client_id: sesja.clientId || null, ip_hash: ipHash });
  }
  return NextResponse.redirect(new URL(`/p/${token}`, request.url), 303);
}
