import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { odczytajKontoUslugi, zbudujAsercje, ZAKRES_DYSKU_ODCZYT } from "@/lib/drive/google-jwt";

describe("asercja JWT konta usługi Google", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("buduje podpisany RS256 token z iss, scope, aud, iat i exp", () => {
    const konto = { client_email: "panel@projekt.iam.gserviceaccount.com", private_key: pem };
    const teraz = new Date("2026-09-06T10:00:00Z");
    const jwt = zbudujAsercje(konto, { zakres: ZAKRES_DYSKU_ODCZYT, teraz });
    const [naglowek, ladunek, podpis] = jwt.split(".");
    expect(JSON.parse(Buffer.from(naglowek!, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const dane = JSON.parse(Buffer.from(ladunek!, "base64url").toString());
    expect(dane).toMatchObject({ iss: konto.client_email, scope: ZAKRES_DYSKU_ODCZYT, aud: "https://oauth2.googleapis.com/token", iat: 1788688800, exp: 1788692400 });
    const ok = createVerify("RSA-SHA256").update(`${naglowek}.${ladunek}`).end().verify(publicKey, Buffer.from(podpis!, "base64url"));
    expect(ok).toBe(true);
  });

  it("czyta klucz z surowego JSON-a i z base64, odrzuca śmieci", () => {
    const json = JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n" });
    expect(odczytajKontoUslugi(json).private_key).toContain("\nABC\n");
    expect(odczytajKontoUslugi(Buffer.from(json).toString("base64")).client_email).toBe("a@b.iam.gserviceaccount.com");
    expect(() => odczytajKontoUslugi("nie json")).toThrow();
    expect(() => odczytajKontoUslugi(JSON.stringify({ client_email: "x" }))).toThrow();
  });
});
