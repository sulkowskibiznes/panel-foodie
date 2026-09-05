import "server-only";
import { BladDysku, MIME_DOCX, MIME_DOKUMENTU, MIME_SKROTU, type DriveApi, type MetadaneDysku, type PlikDysku, type ZawartoscPliku } from "@/lib/drive/api";
import { tekstZDocx } from "@/lib/drive/docx";
import { ADRES_TOKENU, odczytajKontoUslugi, zbudujAsercje, ZAKRES_DYSKU_ODCZYT, type KontoUslugi } from "@/lib/drive/google-jwt";
import { rodzajZMime } from "@/lib/drive/parowanie";

/**
 * Dysk Google przez konto usługi (SPEC rozdz. 13.1): tylko odczyt, klucz z GOOGLE_SERVICE_ACCOUNT_JSON.
 * Drive API v3 przez fetch, bez biblioteki googleapis. Token dostępu trzymany w pamięci procesu do wygaśnięcia,
 * błędy sieci i 5xx ponawiane trzy razy z rosnącym odstępem, 401 odświeża token raz.
 */
const API = "https://www.googleapis.com/drive/v3";
const POLA_PLIKU = "id,name,mimeType,parents,driveId,trashed,modifiedTime,size,imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis),shortcutDetails(targetId,targetMimeType)";
const POLA_LISTY = `nextPageToken,files(${POLA_PLIKU})`;

type WierszApi = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  driveId?: string;
  trashed?: boolean;
  modifiedTime?: string;
  size?: string;
  imageMediaMetadata?: { width?: number; height?: number };
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string };
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
  thumbnailLink?: string;
};

function naPlik(w: WierszApi): PlikDysku {
  const skrot = w.mimeType === MIME_SKROTU && w.shortcutDetails?.targetId ? w.shortcutDetails : null;
  const mime = skrot?.targetMimeType ?? w.mimeType;
  return {
    id: skrot?.targetId ?? w.id,
    nazwa: w.name,
    mime,
    rodzaj: rodzajZMime(mime),
    bytes: w.size !== undefined && skrot === null ? Number(w.size) : null,
    zmodyfikowanoO: w.modifiedTime ?? null,
    szerokosc: w.imageMediaMetadata?.width ?? w.videoMediaMetadata?.width ?? null,
    wysokosc: w.imageMediaMetadata?.height ?? w.videoMediaMetadata?.height ?? null,
    czasMs: w.videoMediaMetadata?.durationMillis !== undefined ? Number(w.videoMediaMetadata.durationMillis) : null,
  };
}

const uspij = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GoogleDrive implements DriveApi {
  private token: { wartosc: string; wygasaO: number } | null = null;

  constructor(private readonly konto: KontoUslugi) {}

  static zEnv(surowyJson: string): GoogleDrive {
    return new GoogleDrive(odczytajKontoUslugi(surowyJson));
  }

  private async tokenDostepu(wymus = false): Promise<string> {
    if (!wymus && this.token && this.token.wygasaO > Date.now() + 60_000) return this.token.wartosc;
    const asercja = zbudujAsercje(this.konto, { zakres: ZAKRES_DYSKU_ODCZYT, teraz: new Date() });
    const odp = await fetch(this.konto.token_uri ?? ADRES_TOKENU, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: asercja }),
    }).catch((e: unknown) => {
      throw new BladDysku(`Nie udało się połączyć z Google (token): ${e instanceof Error ? e.message : String(e)}`, "siec");
    });
    if (!odp.ok) throw new BladDysku(`Google odrzuciło konto usługi (${odp.status}). Sprawdź GOOGLE_SERVICE_ACCOUNT_JSON.`, "autoryzacja", odp.status);
    const dane = (await odp.json()) as { access_token?: string; expires_in?: number };
    if (!dane.access_token) throw new BladDysku("Google nie zwróciło tokenu dostępu.", "autoryzacja");
    this.token = { wartosc: dane.access_token, wygasaO: Date.now() + (dane.expires_in ?? 3600) * 1000 };
    return this.token.wartosc;
  }

  /** Żądanie z tokenem; 401 = odśwież token i spróbuj raz; 429/5xx i błędy sieci = do trzech prób. */
  private async zapytanie(url: string, init: RequestInit = {}): Promise<Response> {
    let ostatni: BladDysku | null = null;
    for (let proba = 0; proba < 3; proba++) {
      const token = await this.tokenDostepu(proba > 0 && ostatni?.status === 401);
      let odp: Response;
      try {
        odp = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });
      } catch (e) {
        ostatni = new BladDysku(`Błąd sieci przy rozmowie z Dyskiem: ${e instanceof Error ? e.message : String(e)}`, "siec");
        await uspij(500 * (proba + 1));
        continue;
      }
      if (odp.ok) return odp;
      if (odp.status === 401) {
        ostatni = new BladDysku("Dysk odrzucił token dostępu.", "autoryzacja", 401);
        continue;
      }
      if (odp.status === 429 || odp.status >= 500) {
        ostatni = new BladDysku(`Dysk odpowiedział ${odp.status}.`, odp.status === 429 ? "limit" : "odpowiedz", odp.status);
        await uspij(800 * (proba + 1));
        continue;
      }
      return odp;
    }
    throw ostatni ?? new BladDysku("Dysk nie odpowiada.", "siec");
  }

  async metadane(id: string): Promise<MetadaneDysku | null> {
    const url = `${API}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=${encodeURIComponent(POLA_PLIKU)}`;
    const odp = await this.zapytanie(url);
    if (odp.status === 404 || odp.status === 403) return null;
    if (!odp.ok) throw new BladDysku(`Dysk odpowiedział ${odp.status} przy odczycie ${id}.`, "odpowiedz", odp.status);
    const w = (await odp.json()) as WierszApi;
    return { ...naPlik(w), rodzice: w.parents ?? [], driveId: w.driveId ?? null, wKoszu: !!w.trashed };
  }

  async listuj(folderId: string): Promise<PlikDysku[]> {
    const wynik: PlikDysku[] = [];
    let strona: string | undefined;
    do {
      const p = new URLSearchParams({
        q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`,
        fields: POLA_LISTY,
        pageSize: "1000",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        orderBy: "name_natural",
      });
      if (strona) p.set("pageToken", strona);
      const odp = await this.zapytanie(`${API}/files?${p.toString()}`);
      if (!odp.ok) throw new BladDysku(`Dysk odpowiedział ${odp.status} przy listowaniu folderu.`, "odpowiedz", odp.status);
      const dane = (await odp.json()) as { nextPageToken?: string; files?: WierszApi[] };
      for (const w of dane.files ?? []) wynik.push(naPlik(w));
      strona = dane.nextPageToken;
    } while (strona);
    return wynik;
  }

  async pobierz(id: string, opcje: { pierwszeBajty?: number } = {}): Promise<ZawartoscPliku | null> {
    const naglowki: Record<string, string> = {};
    if (opcje.pierwszeBajty) naglowki.range = `bytes=0-${opcje.pierwszeBajty - 1}`;
    const odp = await this.zapytanie(`${API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, { headers: naglowki });
    if (odp.status === 404 || odp.status === 403) return null;
    if (!odp.ok) throw new BladDysku(`Dysk odpowiedział ${odp.status} przy pobieraniu pliku.`, "odpowiedz", odp.status);
    const bajty = new Uint8Array(await odp.arrayBuffer());
    const zakres = odp.headers.get("content-range");
    const calosc = zakres ? Number(zakres.split("/")[1]) : Number(odp.headers.get("content-length") ?? bajty.length);
    return { bajty, mime: odp.headers.get("content-type"), rozmiar: Number.isFinite(calosc) ? calosc : bajty.length };
  }

  async eksportujTekst(id: string, mime: string): Promise<string | null> {
    if (mime === MIME_DOKUMENTU) {
      const odp = await this.zapytanie(`${API}/files/${encodeURIComponent(id)}/export?mimeType=text%2Fplain&supportsAllDrives=true`);
      if (odp.ok) return (await odp.text()).replace(/^\ufeff/, "");
      if (odp.status === 404) return null;
      throw new BladDysku(`Dysk odpowiedział ${odp.status} przy eksporcie dokumentu.`, "odpowiedz", odp.status);
    }
    const plik = await this.pobierz(id);
    if (!plik) return null;
    if (mime === MIME_DOCX) return tekstZDocx(plik.bajty);
    return Buffer.from(plik.bajty).toString("utf8").replace(/^\ufeff/, "");
  }

  async miniatura(id: string): Promise<ZawartoscPliku | null> {
    const odp = await this.zapytanie(`${API}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=thumbnailLink`);
    if (!odp.ok) return null;
    const { thumbnailLink } = (await odp.json()) as { thumbnailLink?: string };
    if (!thumbnailLink) return null;
    const adres = thumbnailLink.replace(/=s\d+(?:-c)?$/, "=s400");
    const obraz = await this.zapytanie(adres);
    if (!obraz.ok) return null;
    const bajty = new Uint8Array(await obraz.arrayBuffer());
    return { bajty, mime: obraz.headers.get("content-type") ?? "image/jpeg", rozmiar: bajty.length };
  }
}
