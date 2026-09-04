import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { czyWidziKlienta, pobierzCzlonkaZespolu } from "@/lib/auth-zespol";
import { pobierzAwatarLokalu, podpiszSciezke } from "@/lib/dane/pliki";
import { czyUuid } from "@/lib/walidacja";

export async function GET(_request: Request, ctx: RouteContext<"/zespol/awatar/[lokalId]">) {
  const { lokalId } = await ctx.params;
  const czlonek = await pobierzCzlonkaZespolu();
  if (!czlonek || !czyUuid(lokalId)) notFound();
  const awatar = await pobierzAwatarLokalu(lokalId);
  if (!awatar || !awatar.avatarPath || !(await czyWidziKlienta(czlonek, awatar.clientId))) notFound();
  const url = await podpiszSciezke("awatary", awatar.avatarPath);
  if (!url) notFound();
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=540" } });
}
