import { createSign } from "node:crypto";

/**
 * Asercja JWT konta usługi Google (RS256) do wymiany na token dostępu. Czysty Node, bez zależności:
 * sam podpis to 20 linii, a biblioteka googleapis ważyłaby więcej niż cały panel. Klucz z GOOGLE_SERVICE_ACCOUNT_JSON.
 */
export type KontoUslugi = { client_email: string; private_key: string; token_uri?: string };

export const ZAKRES_DYSKU_ODCZYT = "https://www.googleapis.com/auth/drive.readonly";
export const ADRES_TOKENU = "https://oauth2.googleapis.com/token";

function base64url(dane: string | Buffer): string {
  return Buffer.from(dane).toString("base64url");
}

/** Klucz z JSON-a konta usługi: surowy JSON albo base64 tego JSON-a (tak radzi .env.example, bo wieloliniowy klucz źle znosi .env). */
export function odczytajKontoUslugi(surowe: string): KontoUslugi {
  const tekst = surowe.trim();
  let json: unknown;
  try {
    json = JSON.parse(tekst.startsWith("{") ? tekst : Buffer.from(tekst, "base64").toString("utf8"));
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON nie jest poprawnym JSON-em ani base64 JSON-a konta usługi.");
  }
  const k = json as Partial<KontoUslugi>;
  if (!k || typeof k.client_email !== "string" || typeof k.private_key !== "string") {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON: brak pól client_email i private_key.");
  }
  return { client_email: k.client_email, private_key: k.private_key.replace(/\\n/g, "\n"), token_uri: typeof k.token_uri === "string" ? k.token_uri : undefined };
}

/** Podpisana asercja: iss = e-mail konta, scope, aud = adres tokenu, ważna godzinę od `teraz`. */
export function zbudujAsercje(konto: KontoUslugi, p: { zakres: string; teraz: Date; aud?: string }): string {
  const iat = Math.floor(p.teraz.getTime() / 1000);
  const naglowek = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const ladunek = base64url(JSON.stringify({ iss: konto.client_email, scope: p.zakres, aud: p.aud ?? konto.token_uri ?? ADRES_TOKENU, iat, exp: iat + 3600 }));
  const podpis = createSign("RSA-SHA256").update(`${naglowek}.${ladunek}`).end().sign(konto.private_key);
  return `${naglowek}.${ladunek}.${base64url(podpis)}`;
}
