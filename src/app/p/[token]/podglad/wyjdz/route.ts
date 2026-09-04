import { NextResponse, type NextRequest } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { pobierzKontekstKlienta } from "@/lib/kontekst-klienta";
import { infoZadania } from "@/lib/zadanie";

/** „Wyjdź" z podglądu klienta: wpis w audycie i powrót na kartę klienta. Token jest bezstanowy, więc wygasa sam. */
export async function POST(request: NextRequest, ctx: RouteContext<"/p/[token]/podglad/wyjdz">) {
  const { token } = await ctx.params;
  const kontekst = await pobierzKontekstKlienta(token);
  if (!kontekst || kontekst.tryb !== "podglad") return NextResponse.redirect(new URL("/zespol", request.url), 303);
  const { ipHash, ua } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: kontekst.memberId, actor_label: kontekst.memberName, action: "zespol.podglad_klienta_koniec", entity: "client", entity_id: kontekst.clientId, client_id: kontekst.clientId, ip_hash: ipHash, ua });
  return NextResponse.redirect(new URL(`/zespol/klienci/${kontekst.slug}`, request.url), 303);
}
