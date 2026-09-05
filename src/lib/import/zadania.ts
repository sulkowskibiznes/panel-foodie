import "server-only";
import { randomUUID } from "node:crypto";
import { zapiszAudyt } from "@/lib/audyt";
import { copy } from "@/lib/copy";
import { czyZawieszone, MINUT_DO_ZAWIESZENIA, planZadania } from "@/lib/dane/import";
import { domyslneLokale, type AktorZespolu } from "@/lib/dane/materialy-zespol";
import { BladDysku, type DriveApi } from "@/lib/drive/api";
import { konfiguracjaDysku, type KonfiguracjaDysku } from "@/lib/drive/klient";
import type { Database } from "@/lib/db-types";
import type { KartaWeryfikacyjna } from "@/lib/dto/import";
import { czyObslugiwanyMime, plikiPlanu, policzPostep, sprawdzLimity, type Plan, type PlikPlanu } from "@/lib/import/plan";
import { sciezkaOdKorzenia, zawartoscFolderu } from "@/lib/import/weryfikacja";
import { formatujMB, sprawdzPlik, type RodzajPliku } from "@/lib/pliki/magia";
import { zapiszPlikMaterialu } from "@/lib/pliki/przetwarzanie";
import { supabaseSerwer } from "@/lib/supabase/server";

/**
 * Zadania importu (SPEC rozdz. 13.4): jedno zadanie na folder (content albo reklamy kampanii) z planem
 * potwierdzonym na ekranie mapowania. Worker kopiuje pliki po kolei, po każdym pliku zapisuje postęp w planie
 * (assetId) i bicie serca, więc ponowienie po błędzie albo po zabiciu funkcji zaczyna od miejsca, w którym stanął.
 * Nic z tego nie zmienia statusu pakietu (CLAUDE.md, zasada 9). Import działa w szkicu; po wysyłce materiały
 * dochodzą pojedynczo przez „Dodaj materiał" ze skutkami z tabeli 12.6.
 */
type Json = Database["public"]["Tables"]["import_jobs"]["Insert"]["plan"];
type Wiersz = Database["public"]["Tables"]["import_jobs"]["Row"];

export type PakietDoImportu = { id: string; clientId: string; slug: string; status: Database["public"]["Enums"]["package_status"] };

export type PowodOdmowy = "tylko_szkic" | "zablokowany" | "zle_dane" | "nic_do_importu" | "w_toku" | "nie_skonfigurowany" | "brak_kampanii";
export type WynikStartu = { ok: true; zadaniaIds: string[] } | { ok: false; powod: PowodOdmowy };

const t = () => copy.zespol.import;

function wstaw(tekst: string, pola: Record<string, string | number>): string {
  return Object.entries(pola).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), tekst);
}

/**
 * Plan z przeglądarki ufa tylko identyfikatorom: nazwy, typy i wagi bierzemy z ponownego listowania folderu,
 * folder sprawdzamy jeszcze raz względem „Materiałów klientów". Zablokowany folder nie przejdzie nawet
 * z podrobionym planem.
 */
async function zweryfikujPlan(k: KonfiguracjaDysku, plan: Plan): Promise<{ ok: true; plan: Plan; sciezka: string[] } | { ok: false; powod: PowodOdmowy }> {
  const sciezka = await sciezkaOdKorzenia(k.drive, plan.folderId, k.korzenId);
  if (sciezka.stan !== "ok") return { ok: false, powod: "zablokowany" };
  const zawartosc = await zawartoscFolderu(k.drive, plan.folderId, plan.rodzaj);
  const znane = new Map(zawartosc.pliki.map((p) => [p.id, p]));
  const przepisz = (p: PlikPlanu): PlikPlanu | null => {
    const z = znane.get(p.id);
    if (!z || (z.rodzaj !== "obraz" && z.rodzaj !== "wideo") || !czyObslugiwanyMime(z.mime)) return null;
    return { id: z.id, nazwa: z.nazwa, mime: z.mime, bytes: z.bytes, assetId: null };
  };
  if (plan.rodzaj === "content") {
    const materialy: Plan & { rodzaj: "content" } = { ...plan, materialy: [] };
    for (const m of plan.materialy) {
      const pliki: PlikPlanu[] = [];
      for (const p of m.pliki) {
        const z = przepisz(p);
        if (!z) return { ok: false, powod: "zle_dane" };
        pliki.push(z);
      }
      materialy.materialy.push({ ...m, pliki, itemId: null });
    }
    return { ok: true, plan: materialy, sciezka: sciezka.pelna };
  }
  const grafiki: PlanReklamGrafika[] = [];
  for (const g of plan.grafiki) {
    const z = przepisz(g);
    if (!z) return { ok: false, powod: "zle_dane" };
    grafiki.push({ ...z, pominiety: g.pominiety });
  }
  return { ok: true, plan: { ...plan, grafiki, itemId: null, wariantyZapisane: false }, sciezka: sciezka.pelna };
}

type PlanReklamGrafika = (Plan & { rodzaj: "reklamy" })["grafiki"][number];

export type StartImportu = {
  plany: Plan[];
  karty: KartaWeryfikacyjna[];
  /** Foldery, przy których człowiek świadomie zignorował ostrzeżenia (audyt, SPEC 13.2). */
  zignorowane: string[];
  aktor: AktorZespolu;
  ipHash: string | null;
  ua: string | null;
};

export async function rozpocznijImport(pakiet: PakietDoImportu, s: StartImportu): Promise<WynikStartu> {
  const k = konfiguracjaDysku();
  if (!k) return { ok: false, powod: "nie_skonfigurowany" };
  if (pakiet.status !== "szkic") return { ok: false, powod: "tylko_szkic" };
  const db = supabaseSerwer();
  const { data: aktywne } = await db.from("import_jobs").select("id, status, heartbeat_at, started_at").eq("package_id", pakiet.id).in("status", ["oczekuje", "trwa"]);
  if ((aktywne ?? []).some((z) => z.status === "oczekuje" || !czyZawieszone(z))) return { ok: false, powod: "w_toku" };
  const { data: kampanie } = await db.from("campaigns").select("id").eq("package_id", pakiet.id);
  const idsKampanii = new Set((kampanie ?? []).map((c) => c.id));
  const zweryfikowane: Array<{ plan: Plan; sciezka: string[] }> = [];
  for (const plan of s.plany) {
    if (plan.rodzaj === "reklamy" && !idsKampanii.has(plan.kampaniaId)) return { ok: false, powod: "brak_kampanii" };
    const w = await zweryfikujPlan(k, plan);
    if (!w.ok) return w;
    if (plikiPlanu(w.plan).length === 0 && (w.plan.rodzaj === "content" || (w.plan.teksty.length === 0 && w.plan.naglowki.length === 0))) continue;
    const limit = sprawdzLimity(plikiPlanu(w.plan));
    if (limit) return { ok: false, powod: "zle_dane" };
    zweryfikowane.push(w);
  }
  if (zweryfikowane.length === 0) return { ok: false, powod: "nic_do_importu" };
  const ids: string[] = [];
  for (const { plan, sciezka } of zweryfikowane) {
    const karta = s.karty.find((c) => c.folderId === plan.folderId);
    const { data, error } = await db
      .from("import_jobs")
      .insert({
        package_id: pakiet.id,
        campaign_id: plan.rodzaj === "reklamy" ? plan.kampaniaId : null,
        kind: plan.rodzaj,
        source_url: karta?.url ?? `https://drive.google.com/drive/folders/${plan.folderId}`,
        source_folder_id: plan.folderId,
        status: "oczekuje",
        files_total: plikiPlanu(plan).length,
        files_done: 0,
        plan: plan as unknown as Json,
        verification: { sciezka, ostrzezenia: karta?.ostrzezenia ?? [], zignorowano: s.zignorowane.includes(plan.folderId), liczbaPlikow: karta?.liczbaPlikow ?? null, zmodyfikowanoO: karta?.zmodyfikowanoO ?? null } as unknown as Json,
        created_by: s.aktor.memberId,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`rozpocznijImport: ${error?.message ?? "brak wiersza"}`);
    ids.push(data.id);
    await zapiszAudyt({ actor_kind: "zespol", actor_id: s.aktor.memberId, actor_label: s.aktor.name, action: "zespol.import_uruchomiony", entity: "import_job", entity_id: data.id, client_id: pakiet.clientId, ip_hash: s.ipHash, ua: s.ua, meta: { package_id: pakiet.id, rodzaj: plan.rodzaj, folder: plan.folderId, pliki: plikiPlanu(plan).length, sciezka } });
    if (s.zignorowane.includes(plan.folderId) && (karta?.ostrzezenia.length ?? 0) > 0) {
      await zapiszAudyt({ actor_kind: "zespol", actor_id: s.aktor.memberId, actor_label: s.aktor.name, action: "zespol.import_ostrzezenie_zignorowane", entity: "import_job", entity_id: data.id, client_id: pakiet.clientId, ip_hash: s.ipHash, ua: s.ua, meta: { package_id: pakiet.id, folder: plan.folderId, ostrzezenia: karta?.ostrzezenia.map((o) => o.kod) ?? [] } });
    }
  }
  return { ok: true, zadaniaIds: ids };
}

/** Zadanie z błędem albo zawieszone wraca do kolejki; wywołujący uruchamia worker. */
export async function przygotujWznowienie(jobId: string, pakietId: string, aktor: AktorZespolu): Promise<boolean> {
  const db = supabaseSerwer();
  const { data } = await db.from("import_jobs").select("id, status, heartbeat_at, started_at, package_id, campaign_id").eq("id", jobId).eq("package_id", pakietId).maybeSingle();
  if (!data) return false;
  if (data.status !== "blad" && !czyZawieszone(data)) return false;
  const { error } = await db.from("import_jobs").update({ status: "oczekuje", error: null, heartbeat_at: null }).eq("id", jobId);
  if (error) throw new Error(`przygotujWznowienie: ${error.message}`);
  await zapiszAudyt({ actor_kind: "zespol", actor_id: aktor.memberId, actor_label: aktor.name, action: "zespol.import_wznowiony", entity: "import_job", entity_id: jobId, meta: { package_id: pakietId } });
  return true;
}

// ---------- Worker ----------

class BladImportu extends Error {
  constructor(readonly komunikat: string) {
    super(komunikat);
    this.name = "BladImportu";
  }
}

async function przejmij(db: ReturnType<typeof supabaseSerwer>, pakietId: string): Promise<Wiersz | null> {
  const { data: kandydaci } = await db.from("import_jobs").select("*").eq("package_id", pakietId).in("status", ["oczekuje", "trwa"]).order("created_at");
  const kandydat = (kandydaci ?? []).find((z) => z.status === "oczekuje" || czyZawieszone(z));
  if (!kandydat) return null;
  const teraz = new Date().toISOString();
  const granica = new Date(Date.now() - MINUT_DO_ZAWIESZENIA * 60_000).toISOString();
  const { data } = await db
    .from("import_jobs")
    .update({ status: "trwa", started_at: kandydat.started_at ?? teraz, heartbeat_at: teraz, attempts: kandydat.attempts + 1 })
    .eq("id", kandydat.id)
    .or(`status.eq.oczekuje,and(status.eq.trwa,heartbeat_at.lt."${granica}"),and(status.eq.trwa,heartbeat_at.is.null)`)
    .select("*")
    .maybeSingle();
  return data ?? null;
}

type Kontekst = { db: ReturnType<typeof supabaseSerwer>; drive: DriveApi; job: Wiersz; pakietId: string; clientId: string; ostrzezenia: string[]; plan: Plan; istniejace: Map<string, string> };

async function zapiszPostep(c: Kontekst): Promise<void> {
  const postep = policzPostep(c.plan);
  const { error } = await c.db.from("import_jobs").update({ plan: c.plan as unknown as Json, files_done: postep.gotowe, files_total: postep.razem, warnings: c.ostrzezenia as unknown as Json, heartbeat_at: new Date().toISOString() }).eq("id", c.job.id);
  if (error) throw new Error(`zapiszPostep: ${error.message}`);
}

/** Pobranie z Dysku, magic bytes, limit rzeczywistej wagi, EXIF i warianty; zwraca assetId wstawionego pliku. */
async function skopiujPlik(c: Kontekst, plik: PlikPlanu, itemId: string, position: number): Promise<string> {
  const zDysku = await c.drive.pobierz(plik.id);
  if (!zDysku) throw new BladImportu(wstaw(t().bledy.pobieranie, { nazwa: plik.nazwa }));
  const sprawdzenie = sprawdzPlik({ bajtyPoczatku: zDysku.bajty.subarray(0, 32), bytes: zDysku.bajty.length, zadeklarowanyMime: plik.mime });
  if (!sprawdzenie.ok) {
    if (sprawdzenie.powod === "zaDuzy") throw new BladImportu(wstaw(t().bledy.limit, { nazwa: plik.nazwa, waga: formatujMB(zDysku.bajty.length), limit: formatujMB(sprawdzenie.limit ?? 0) }));
    throw new BladImportu(wstaw(t().bledy.magia, { nazwa: plik.nazwa }));
  }
  if (sprawdzenie.ostrzezenie === "duzeWideo") c.ostrzezenia.push(wstaw(t().ostrzezeniaZadania.duzeWideo, { nazwa: plik.nazwa }));
  const rodzaj: RodzajPliku = sprawdzenie.rodzaj;
  const assetId = randomUUID();
  const zapis = await zapiszPlikMaterialu(Buffer.from(zDysku.bajty), rodzaj, c.clientId, assetId);
  if (zapis.ostrzezenia.includes("bezPodgladu")) c.ostrzezenia.push(wstaw(t().ostrzezeniaZadania.bezPodgladu, { nazwa: plik.nazwa }));
  const { error } = await c.db.from("item_assets").insert({
    id: assetId,
    item_id: itemId,
    kind: rodzaj.startsWith("image/") ? "image" : "video",
    storage_path: zapis.storagePath,
    preview_path: zapis.previewPath,
    thumb_path: zapis.thumbPath,
    original_name: plik.nazwa.slice(0, 200),
    mime: rodzaj,
    bytes: zDysku.bajty.length,
    width: zapis.width,
    height: zapis.height,
    position,
    drive_file_id: plik.id,
  });
  if (error) throw new Error(`skopiujPlik: ${error.message}`);
  c.istniejace.set(plik.id, assetId);
  return assetId;
}

async function wykonajContent(c: Kontekst, plan: Plan & { rodzaj: "content" }): Promise<void> {
  const { data: obecne } = await c.db.from("package_items").select("type, position").eq("package_id", c.pakietId);
  let pozycjaPostow = Math.max(0, ...(obecne ?? []).filter((m) => m.type === "post" || m.type === "reels").map((m) => m.position));
  let pozycjaRelacji = Math.max(0, ...(obecne ?? []).filter((m) => m.type === "relacja").map((m) => m.position));
  const lokale = await domyslneLokale(c.clientId);
  for (const m of plan.materialy) {
    if (m.pominiety) continue;
    const doSkopiowania = m.pliki.filter((p) => !p.assetId);
    // Wszystkie pliki materiału już w pakiecie (np. drugi import tego samego folderu): pomijamy z ostrzeżeniem.
    if (!m.itemId && doSkopiowania.every((p) => c.istniejace.has(p.id))) {
      for (const p of doSkopiowania) {
        c.ostrzezenia.push(wstaw(t().ostrzezeniaZadania.juzWPakiecie, { nazwa: p.nazwa }));
        p.assetId = c.istniejace.get(p.id) ?? null;
      }
      m.pominiety = true;
      await zapiszPostep(c);
      continue;
    }
    if (!m.itemId) {
      const position = m.rodzaj === "relacja" ? ++pozycjaRelacji : ++pozycjaPostow;
      const { data, error } = await c.db
        .from("package_items")
        .insert({ package_id: c.pakietId, type: m.rodzaj, position, title: m.tytul.slice(0, 160), caption: m.opis, publish_at: null, location_ids: lokale, origin: "import" })
        .select("id")
        .single();
      if (error || !data) throw new Error(`wykonajContent(item): ${error?.message ?? "brak wiersza"}`);
      m.itemId = data.id;
      await zapiszPostep(c);
    }
    for (const [i, p] of m.pliki.entries()) {
      if (p.assetId) continue;
      const istnieje = c.istniejace.get(p.id);
      if (istnieje) {
        c.ostrzezenia.push(wstaw(t().ostrzezeniaZadania.juzWPakiecie, { nazwa: p.nazwa }));
        p.assetId = istnieje;
      } else {
        p.assetId = await skopiujPlik(c, p, m.itemId, i);
      }
      await zapiszPostep(c);
    }
  }
}

async function wykonajReklamy(c: Kontekst, plan: Plan & { rodzaj: "reklamy" }): Promise<void> {
  const { data: reklama } = await c.db.from("package_items").select("id").eq("package_id", c.pakietId).eq("campaign_id", plan.kampaniaId).eq("type", "reklama").maybeSingle();
  if (!reklama) throw new BladImportu(t().bledy.brak_reklamy);
  plan.itemId = reklama.id;
  const { data: warianty } = await c.db.from("ad_variants").select("id, kind, position, value_text, asset_id, location_id").eq("item_id", reklama.id);
  const obecne = warianty ?? [];
  let pozycjaGrafik = Math.max(-1, ...obecne.filter((w) => w.kind === "grafika").map((w) => w.position)) + 1;
  const zAssetem = new Set(obecne.filter((w) => w.asset_id).map((w) => w.asset_id as string));
  for (const g of plan.grafiki) {
    if (g.pominiety || g.assetId) continue;
    const istnieje = c.istniejace.get(g.id);
    let assetId: string;
    if (istnieje) {
      c.ostrzezenia.push(wstaw(t().ostrzezeniaZadania.juzWPakiecie, { nazwa: g.nazwa }));
      assetId = istnieje;
    } else {
      assetId = await skopiujPlik(c, g, reklama.id, pozycjaGrafik);
    }
    if (!zAssetem.has(assetId)) {
      const { error } = await c.db.from("ad_variants").insert({ item_id: reklama.id, kind: "grafika", position: pozycjaGrafik, label: `Grafika ${pozycjaGrafik + 1}`, asset_id: assetId });
      if (error) throw new Error(`wykonajReklamy(grafika): ${error.message}`);
      zAssetem.add(assetId);
      pozycjaGrafik += 1;
    }
    g.assetId = assetId;
    await zapiszPostep(c);
  }
  if (!plan.wariantyZapisane) {
    const wiersze: Database["public"]["Tables"]["ad_variants"]["Insert"][] = [];
    const listy: Array<{ kind: "tekst" | "naglowek"; wartosci: string[]; etykieta: (i: number) => string }> = [
      { kind: "tekst", wartosci: plan.teksty, etykieta: (i) => `Tekst ${"ABCDEFGHIJ"[i] ?? i + 1}` },
      { kind: "naglowek", wartosci: plan.naglowki, etykieta: (i) => `Nagłówek ${i + 1}` },
    ];
    for (const lista of listy) {
      const stare = obecne.filter((w) => w.kind === lista.kind && w.location_id === null);
      const znane = new Set(stare.map((w) => (w.value_text ?? "").trim()));
      let pozycja = Math.max(-1, ...stare.map((w) => w.position)) + 1;
      for (const w of lista.wartosci) {
        const tekst = w.trim();
        if (!tekst) continue;
        if (znane.has(tekst)) {
          c.ostrzezenia.push(t().ostrzezeniaZadania.powtorzonyTekst);
          continue;
        }
        znane.add(tekst);
        wiersze.push({ item_id: reklama.id, kind: lista.kind, position: pozycja, label: lista.etykieta(pozycja), value_text: tekst });
        pozycja += 1;
      }
    }
    for (const [kind, wartosc] of [["opis", plan.opis], ["cta", plan.cta], ["link", plan.link]] as const) {
      const tekst = wartosc?.trim();
      if (!tekst || obecne.some((w) => w.kind === kind && w.location_id === null)) continue;
      wiersze.push({ item_id: reklama.id, kind, position: 0, value_text: tekst });
    }
    if (wiersze.length > 0) {
      const { error } = await c.db.from("ad_variants").insert(wiersze);
      if (error) throw new Error(`wykonajReklamy(warianty): ${error.message}`);
    }
    plan.wariantyZapisane = true;
    await zapiszPostep(c);
  }
}

async function wykonajZadanie(db: ReturnType<typeof supabaseSerwer>, drive: DriveApi, job: Wiersz): Promise<void> {
  const plan = planZadania(job);
  if (!plan || !job.package_id) {
    await db.from("import_jobs").update({ status: "blad", error: t().bledy.zle_dane, finished_at: new Date().toISOString() }).eq("id", job.id);
    return;
  }
  const { data: pakiet } = await db.from("packages").select("id, client_id, clients!inner(slug)").eq("id", job.package_id).single();
  if (!pakiet) return;
  const { data: pliki } = await db.from("item_assets").select("id, drive_file_id, package_items!inner(package_id)").eq("package_items.package_id", pakiet.id).is("superseded_at", null).not("drive_file_id", "is", null);
  const istniejace = new Map<string, string>();
  for (const p of pliki ?? []) if (p.drive_file_id) istniejace.set(p.drive_file_id, p.id);
  const ostrzezenia = Array.isArray(job.warnings) ? job.warnings.filter((x): x is string => typeof x === "string") : [];
  const c: Kontekst = { db, drive, job, pakietId: pakiet.id, clientId: pakiet.client_id, ostrzezenia, plan, istniejace };
  try {
    if (plan.rodzaj === "content") await wykonajContent(c, plan);
    else await wykonajReklamy(c, plan);
    const postep = policzPostep(plan);
    const teraz = new Date().toISOString();
    await db.from("import_jobs").update({ status: "zakonczony", finished_at: teraz, heartbeat_at: teraz, error: null, plan: plan as unknown as Json, files_done: postep.gotowe, files_total: postep.razem, warnings: [...new Set(c.ostrzezenia)] as unknown as Json }).eq("id", job.id);
    const materialy = plan.rodzaj === "content" ? plan.materialy.filter((m) => !m.pominiety).length : 1;
    await db.from("package_events").insert({ package_id: pakiet.id, kind: "zaimportowany", actor_kind: "zespol", actor_id: job.created_by, payload: { job_id: job.id, rodzaj: plan.rodzaj, folder: plan.folderId, materialy, pliki: postep.gotowe, ostrzezenia: c.ostrzezenia.length } as Json });
    await zapiszAudyt({ actor_kind: "zespol", actor_id: job.created_by, action: "zespol.import_zakonczony", entity: "import_job", entity_id: job.id, client_id: pakiet.client_id, meta: { package_id: pakiet.id, rodzaj: plan.rodzaj, pliki: postep.gotowe, ostrzezenia: c.ostrzezenia.length, proby: job.attempts } });
  } catch (blad) {
    const komunikat = blad instanceof BladImportu ? blad.komunikat : blad instanceof BladDysku ? wstaw(t().bledy.dysk, { komunikat: blad.message }) : t().bledy.ogolny;
    console.error("[import] zadanie przerwane", job.id, blad instanceof Error ? blad.message : blad);
    const postep = policzPostep(plan);
    await db.from("import_jobs").update({ status: "blad", error: komunikat, plan: plan as unknown as Json, files_done: postep.gotowe, warnings: [...new Set(c.ostrzezenia)] as unknown as Json, heartbeat_at: new Date().toISOString() }).eq("id", job.id);
    await zapiszAudyt({ actor_kind: "zespol", actor_id: job.created_by, action: "zespol.import_blad", entity: "import_job", entity_id: job.id, client_id: pakiet.client_id, meta: { package_id: pakiet.id, blad: komunikat, proby: job.attempts } });
  }
}

/** Kolejka pakietu: bierze zadania po kolei (oczekujące albo zawieszone), aż nic nie zostanie. Bezpieczne do wielokrotnego wywołania. */
export async function uruchomImportPakietu(pakietId: string): Promise<void> {
  const k = konfiguracjaDysku();
  if (!k) return;
  const db = supabaseSerwer();
  for (let i = 0; i < 50; i++) {
    let job: Wiersz | null;
    try {
      job = await przejmij(db, pakietId);
    } catch (blad) {
      console.error("[import] nie udało się przejąć zadania", blad instanceof Error ? blad.message : blad);
      return;
    }
    if (!job) return;
    await wykonajZadanie(db, k.drive, job);
  }
}
