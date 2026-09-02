import { NextResponse, type NextRequest } from "next/server";
import { rotujSesje } from "@/lib/sesja-klienta";

/** Rotacja tokenu sesji raz na 24 h (SPEC rozdz. 16.5). Trasa, bo komponent serwerowy nie może ustawić cookie. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ok = await rotujSesje(token);
  const wroc = request.nextUrl.searchParams.get("wroc") ?? "";
  const bezpieczny = wroc.startsWith(`/p/${token}/`) && !wroc.includes("//") && !wroc.includes("..");
  const cel = ok ? (bezpieczny ? wroc : `/p/${token}/start`) : `/p/${token}`;
  return NextResponse.redirect(new URL(cel, request.url), 303);
}
