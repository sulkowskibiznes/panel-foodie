import { NextResponse, type NextRequest } from "next/server";
import { zapiszAudyt } from "@/lib/audyt";
import { klientAuthZespolu, pobierzCzlonkaZespolu } from "@/lib/auth-zespol";

export async function POST(request: NextRequest) {
  const czlonek = await pobierzCzlonkaZespolu();
  const auth = await klientAuthZespolu();
  await auth.auth.signOut();
  if (czlonek) await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.wylogowanie" });
  return NextResponse.redirect(new URL("/zespol/logowanie", request.url), 303);
}
