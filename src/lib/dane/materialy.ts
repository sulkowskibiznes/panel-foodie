import "server-only";
import { copy } from "@/lib/copy";
import type { Database } from "@/lib/db-types";
import type { KampaniaDto, KomentarzDto, MaterialDto, PakietNaLiscie, PakietSzczegoly, PlikDto, StronaDto, WariantDto } from "@/lib/dto/materialy";
import { supabaseSerwer } from "@/lib/supabase/server";

type Enums = Database["public"]["Enums"];

/** Adresy plików budowane przez stronę: klient przez /p/[token]/plik, zespół przez /zespol/plik. */
export type Adresy = {
  plik: (assetId: string, wariant: "preview" | "thumb") => string;
  awatar: (lokalId: string) => string;
};

export type OpcjeSzczegolow = {
  adresy: Adresy;
  /** Klient: link, z którego liczymy „Obejrzano" (null w podglądzie zespołu: nic nie liczymy); zespół: null. */
  strona: { rodzaj: "klient"; linkId: string | null } | { rodzaj: "zespol" };
};

type WierszPliku = { id: string; kind: Enums["asset_kind"]; preview_path: string | null; thumb_path: string | null; width: number | null; height: number | null; duration_ms: number | null; position: number; original_name: string | null; superseded_at: string | null };
type WierszWariantu = { id: string; kind: Enums["variant_kind"]; position: number; label: string | null; value_text: string | null; asset_id: string | null; location_id: string | null };
type WierszMaterialu = {
  id: string;
  type: Enums["item_type"];
  position: number;
  title: string | null;
  caption: string | null;
  publish_at: string | null;
  location_ids: string[];
  campaign_id: string | null;
  updated_in_round: number | null;
  added_after_submit: boolean;
  item_assets: WierszPliku[];
  ad_variants: WierszWariantu[];
};
type WierszKomentarza = {
  id: string;
  item_id: string | null;
  variant_id: string | null;
  author_kind: Enums["author_kind"];
  author_label: string | null;
  body: string;
  round: number;
  after_approval: boolean;
  seen_by_client_at: string | null;
  seen_by_team_at: string | null;
  resolved_at: string | null;
  created_at: string;
  kontakt: { name: string } | null;
  czlonek: { name: string } | null;
};
type WierszPakietu = {
  id: string;
  client_id: string;
  location_id: string | null;
  title: string | null;
  status: Enums["package_status"];
  round: number;
  period_year: number;
  period_month: number;
  submitted_at: string | null;
  auto_approve_enabled: boolean;
  auto_approve_at: string | null;
  approved_at: string | null;
  approval_kind: Enums["approval_kind"] | null;
  changed_after_approval: boolean;
  content_folder_url: string | null;
  period_to: string | null;
  zaakceptowal: { name: string } | null;
  clients: { category: Enums["client_category"]; auto_approve_default: boolean };
};

const KOLUMNY_PAKIETU =
  "id, client_id, location_id, title, status, round, period_year, period_month, submitted_at, auto_approve_enabled, auto_approve_at, approved_at, approval_kind, changed_after_approval, content_folder_url, period_to, zaakceptowal:client_contacts!packages_approved_by_contact_id_fkey(name), clients!inner(category, auto_approve_default)";
const KOLUMNY_MATERIALU =
  "id, type, position, title, caption, publish_at, location_ids, campaign_id, updated_in_round, added_after_submit, item_assets(id, kind, preview_path, thumb_path, width, height, duration_ms, position, original_name, superseded_at), ad_variants(id, kind, position, label, value_text, asset_id, location_id)";
const KOLUMNY_KOMENTARZA =
  "id, item_id, variant_id, author_kind, author_label, body, round, after_approval, seen_by_client_at, seen_by_team_at, resolved_at, created_at, kontakt:client_contacts!comments_author_contact_id_fkey(name), czlonek:team_members!comments_author_member_id_fkey(name)";

function naPlik(p: WierszPliku, adresy: Adresy): PlikDto {
  return {
    id: p.id,
    rodzaj: p.kind === "video" ? "wideo" : "obraz",
    previewUrl: adresy.plik(p.id, "preview"),
    thumbUrl: adresy.plik(p.id, "thumb"),
    szerokosc: p.width,
    wysokosc: p.height,
    czasMs: p.duration_ms,
    pozycja: p.position,
    nazwa: p.original_name,
  };
}

function naKomentarz(k: WierszKomentarza, strona: OpcjeSzczegolow["strona"]): KomentarzDto {
  const autorNazwa = k.author_label ?? k.kontakt?.name ?? k.czlonek?.name ?? (k.author_kind === "zespol" ? copy.marka.nazwa : copy.zespol.pakietyMaterialow.nikt);
  return {
    id: k.id,
    autor: k.author_kind,
    autorNazwa,
    tresc: k.body,
    runda: k.round,
    poAkceptacji: k.after_approval,
    utworzonoO: k.created_at,
    zalatwionoO: k.resolved_at,
    nieprzeczytany: strona.rodzaj === "klient" ? k.author_kind === "zespol" && k.seen_by_client_at === null : k.author_kind === "klient" && k.seen_by_team_at === null,
    materialId: k.item_id,
    wariantId: k.variant_id,
  };
}

function naMaterial(m: WierszMaterialu, runda: number, komentarze: KomentarzDto[], adresy: Adresy): MaterialDto {
  const wszystkiePliki = new Map(m.item_assets.map((a) => [a.id, naPlik(a, adresy)]));
  const aktualne = m.item_assets.filter((a) => a.superseded_at === null).sort((a, b) => a.position - b.position);
  return {
    id: m.id,
    typ: m.type,
    pozycja: m.position,
    tytul: m.title ?? `${copy.wysylka.typ[m.type]} ${m.position}`,
    opis: m.caption,
    publikacjaO: m.publish_at,
    lokaleIds: m.location_ids,
    poprawiony: m.updated_in_round !== null && m.updated_in_round === runda,
    nowy: m.added_after_submit,
    pliki: aktualne.map((a) => wszystkiePliki.get(a.id)).filter((p): p is PlikDto => !!p),
    warianty: [...m.ad_variants]
      .sort((a, b) => a.position - b.position)
      .map<WariantDto>((v) => ({
        id: v.id,
        rodzaj: v.kind,
        pozycja: v.position,
        etykieta: v.label,
        tekst: v.value_text,
        plik: v.asset_id ? (wszystkiePliki.get(v.asset_id) ?? null) : null,
        lokalId: v.location_id,
      })),
    kampaniaId: m.campaign_id,
    komentarze: komentarze.filter((k) => k.materialId === m.id),
  };
}

/**
 * Pełny pakiet do ekranu akceptacji. BEZ filtra po kliencie: strona klienta musi wywołać
 * assertClientAccess(sesja.clientId, wynik.clientId), strona zespołu assertTeamClientAccess.
 */
export async function pobierzPakietSzczegoly(pakietId: string, o: OpcjeSzczegolow): Promise<{ clientId: string; pakiet: PakietSzczegoly } | null> {
  const db = supabaseSerwer();
  const { data: p0, error } = await db.from("packages").select(KOLUMNY_PAKIETU).eq("id", pakietId).maybeSingle();
  if (error) throw new Error(`pobierzPakietSzczegoly: ${error.message}`);
  if (!p0) return null;
  const p = p0 as unknown as WierszPakietu;

  const [lokale, materialy, kampanie, komentarze, zdarzenia, obejrzane] = await Promise.all([
    db.from("locations").select("id, name, fb_page_name, ig_handle, avatar_path, position").eq("client_id", p.client_id).order("position"),
    db.from("package_items").select(KOLUMNY_MATERIALU).eq("package_id", pakietId).order("position"),
    db.from("campaigns").select("id, name, goal, note, position, ads_folder_url").eq("package_id", pakietId).order("position"),
    db.from("comments").select(KOLUMNY_KOMENTARZA).eq("package_id", pakietId).order("created_at"),
    db
      .from("package_events")
      .select("kind, payload, created_at")
      .eq("package_id", pakietId)
      .in("kind", ["wyslany", "wycofany", "poprawki", "zaakceptowany", "auto_zaakceptowany", "cofniety_do_poprawek"])
      .order("created_at", { ascending: false })
      .limit(1),
    o.strona.rodzaj === "klient" && o.strona.linkId ? db.from("item_views").select("item_id").eq("access_link_id", o.strona.linkId) : Promise.resolve({ data: [] as { item_id: string }[], error: null }),
  ]);
  for (const w of [lokale, materialy, kampanie, komentarze, zdarzenia, obejrzane]) {
    if (w.error) throw new Error(`pobierzPakietSzczegoly: ${w.error.message}`);
  }

  const lokaleDto: StronaDto[] = (lokale.data ?? [])
    .filter((l) => p.location_id === null || l.id === p.location_id)
    .map((l) => ({ lokalId: l.id, nazwaLokalu: l.name, nazwaStrony: l.fb_page_name, igHandle: l.ig_handle, avatarUrl: l.avatar_path ? o.adresy.awatar(l.id) : null }));

  const komentarzeDto = ((komentarze.data ?? []) as unknown as WierszKomentarza[]).map((k) => naKomentarz(k, o.strona));
  const materialyDto = ((materialy.data ?? []) as unknown as WierszMaterialu[]).map((m) => naMaterial(m, p.round, komentarzeDto, o.adresy));
  const reklamy = new Map(materialyDto.filter((m) => m.typ === "reklama" && m.kampaniaId).map((m) => [m.kampaniaId as string, m]));

  const ostatnie = zdarzenia.data?.[0];
  const powod = ostatnie && typeof ostatnie.payload === "object" && ostatnie.payload && "powod" in ostatnie.payload ? String((ostatnie.payload as { powod?: unknown }).powod ?? "") : "";
  const cofniecie = p.status === "poprawki" && ostatnie?.kind === "cofniety_do_poprawek" ? { kiedyO: ostatnie.created_at, powod } : null;

  const uwagiKlienta = komentarzeDto.filter((k) => k.autor === "klient" && k.runda === p.round);
  const posty = materialyDto.filter((m) => m.typ === "post" || m.typ === "reels");
  const relacje = materialyDto.filter((m) => m.typ === "relacja");

  return {
    clientId: p.client_id,
    pakiet: {
      id: p.id,
      kategoria: p.clients.category,
      tytul: p.title ?? "",
      status: p.status,
      runda: p.round,
      okres: { rok: p.period_year, miesiac: p.period_month },
      wyslanoO: p.submitted_at,
      autoWlaczona: p.auto_approve_enabled,
      autoDomyslnaKlienta: p.clients.auto_approve_default,
      autoAkceptacjaO: p.auto_approve_enabled ? p.auto_approve_at : null,
      zaakceptowanoO: p.approved_at,
      zaakceptowal: p.zaakceptowal?.name ?? null,
      rodzajAkceptacji: p.approval_kind,
      cofniecie,
      zmienionePoAkceptacji: p.changed_after_approval,
      folderContentuUrl: o.strona.rodzaj === "zespol" ? p.content_folder_url : null,
      koniecOkresu: p.period_to,
      lokale: lokaleDto,
      posty,
      relacje,
      kampanie: (kampanie.data ?? []).map<KampaniaDto>((k) => ({ id: k.id, nazwa: k.name, cel: k.goal, notatka: k.note, pozycja: k.position, reklama: reklamy.get(k.id) ?? null, folderReklamUrl: o.strona.rodzaj === "zespol" ? k.ads_folder_url : null })),
      komentarzePakietu: komentarzeDto.filter((k) => k.materialId === null),
      obejrzane: (obejrzane.data ?? []).map((v) => v.item_id),
      liczbaMaterialow: posty.length + relacje.length + reklamy.size,
      uwagiKlientaWRundzie: uwagiKlienta.length,
      nierozwiazaneUwagiKlienta: uwagiKlienta.filter((k) => k.zalatwionoO === null).length,
    },
  };
}

type WierszListy = {
  id: string;
  client_id: string;
  title: string | null;
  status: Enums["package_status"];
  round: number;
  period_year: number;
  period_month: number;
  submitted_at: string | null;
  auto_approve_enabled: boolean;
  auto_approve_at: string | null;
  lokal: { name: string } | null;
  package_items: { type: Enums["item_type"] }[];
  campaigns: { id: string }[];
  comments: { author_kind: Enums["author_kind"]; round: number; resolved_at: string | null; seen_by_team_at: string | null }[];
};

const KOLUMNY_LISTY =
  "id, client_id, title, status, round, period_year, period_month, submitted_at, auto_approve_enabled, auto_approve_at, lokal:locations(name), package_items(type), campaigns(id), comments(author_kind, round, resolved_at, seen_by_team_at)";

function naPakietNaLiscie(w: WierszListy): PakietNaLiscie {
  const typy = w.package_items.map((i) => i.type);
  const uwagi = w.comments.filter((k) => k.author_kind === "klient" && k.round === w.round);
  return {
    id: w.id,
    tytul: w.title ?? "",
    status: w.status,
    runda: w.round,
    okres: { rok: w.period_year, miesiac: w.period_month },
    nazwaLokalu: w.lokal?.name ?? null,
    wyslanoO: w.submitted_at,
    autoAkceptacjaO: w.auto_approve_enabled ? w.auto_approve_at : null,
    autoWlaczona: w.auto_approve_enabled,
    liczbaPostow: typy.filter((t) => t === "post" || t === "reels").length,
    liczbaRelacji: typy.filter((t) => t === "relacja").length,
    liczbaKampanii: w.campaigns.length,
    nierozwiazaneUwagi: uwagi.filter((k) => k.resolved_at === null).length,
    nieprzeczytaneUwagi: uwagi.filter((k) => k.seen_by_team_at === null).length,
  };
}

/** Lista pakietów klienta widoczna dla klienta (bez szkiców) albo dla zespołu (wszystkie). */
export async function pobierzPakietyKlienta(clientId: string, o: { zeSzkicami: boolean }): Promise<PakietNaLiscie[]> {
  let zapytanie = supabaseSerwer().from("packages").select(KOLUMNY_LISTY).eq("client_id", clientId).order("period_year", { ascending: false }).order("period_month", { ascending: false }).order("created_at", { ascending: false });
  if (!o.zeSzkicami) zapytanie = zapytanie.neq("status", "szkic");
  const { data, error } = await zapytanie;
  if (error) throw new Error(`pobierzPakietyKlienta: ${error.message}`);
  return ((data ?? []) as unknown as WierszListy[]).map(naPakietNaLiscie);
}

export type PakietNaPulpicie = PakietNaLiscie & { klient: { id: string; slug: string; name: string }; wstrzymana: boolean };

/** Pakiety w toku (poza zaplanowanymi) dla pulpitu zespołu (SPEC rozdz. 12.1), z osobnym stanem „wstrzymana" (1.4, poz. 26). */
export async function pobierzPakietyNaPulpit(clientIds: string[] | null, teraz = new Date()): Promise<PakietNaPulpicie[]> {
  let zapytanie = supabaseSerwer().from("packages").select(`${KOLUMNY_LISTY}, clients!inner(id, slug, name)`).neq("status", "zaplanowany").order("submitted_at", { ascending: true, nullsFirst: false });
  if (clientIds) {
    if (clientIds.length === 0) return [];
    zapytanie = zapytanie.in("client_id", clientIds);
  }
  const { data, error } = await zapytanie;
  if (error) throw new Error(`pobierzPakietyNaPulpit: ${error.message}`);
  return ((data ?? []) as unknown as Array<WierszListy & { clients: { id: string; slug: string; name: string } }>).map((w) => {
    const p = naPakietNaLiscie(w);
    const wstrzymana = p.status === "do_akceptacji" && p.autoAkceptacjaO !== null && new Date(p.autoAkceptacjaO).getTime() <= teraz.getTime() && p.nierozwiazaneUwagi > 0;
    return { ...p, klient: w.clients, wstrzymana };
  });
}
