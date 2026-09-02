import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { hashujIp, sha256Hex, wyprowadzKlucz } from "@/lib/krypto";

export type InfoZadania = { ip: string; ipHash: string; ua: string; uaHash: string; pathname: string };

/** Adres IP (za Vercelem: pierwszy z X-Forwarded-For), User-Agent i ścieżka z nagłówka ustawianego w proxy.ts. */
export async function infoZadania(): Promise<InfoZadania> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") ?? "";
  const ip = (forwarded.split(",")[0] ?? "").trim() || h.get("x-real-ip") || "0.0.0.0";
  const ua = h.get("user-agent") ?? "";
  return {
    ip,
    ipHash: hashujIp(wyprowadzKlucz(env().SESSION_SECRET, "ip"), ip),
    ua,
    uaHash: sha256Hex(ua).slice(0, 32),
    pathname: h.get("x-pathname") ?? "",
  };
}
