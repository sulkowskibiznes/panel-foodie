import "server-only";
import type { Database } from "@/lib/db-types";
import { dodajDoOutbox } from "@/lib/outbox";
import { adresPakietuZespolu } from "@/lib/pakiety/baza";
import { zbudujPayloadOutbox, type Aktor, type PakietDoPrzejscia } from "@/lib/pakiety/przejscia";
import { skutkiZmianyMaterialu, type RodzajZmiany, type SkutkiZmiany } from "@/lib/pakiety/zmiana-materialu";
import { usunObiekty, type OpisPliku } from "@/lib/pliki/upload";
import { supabaseSerwer } from "@/lib/supabase/server";

/**
 * Mutacje materiałów, plików i kampanii w panelu zespołu (SPEC rozdz. 12.3, 12.6). Każda zmiana przechodzi
 * przez `zastosujZmiane`, które liczy skutki wg statusu pakietu (lib/pakiety/zmiana-materialu.ts, czyste)
 * i zapisuje plakietki, przesunięcie auto-akceptacji, `changed_after_approval`, zdarzenie i outbox.
 * Status pakietu nigdy nie zmienia się tutaj (CLAUDE.md, zasada 9). Podmiana nie kasuje starego pliku (zasada 12).
 */
type Enums = Database["public"]["Enums"];
type Json = Database["public"]["Tables"]["package_events"]["Insert"]["payload"];
export type AktorZespolu = Extract<Aktor, { rodzaj: "zespol" }>;
export type TypMaterialu = Enums["item_type"];

export type PowodMutacji = "wymaga_potwierdzenia" | "brak_materialu" | "brak_pliku" | "zly_typ" | "brak_kampanii" | "ostatni_plik" | "tylko_szkic" | "istnieje" | "zle_dane";
export type WynikMutacji = { ok: true; materialId: string | null; skutki: SkutkiZmiany | null } | { ok: false; powod: PowodMutacji };

const GRUPA_POZYCJI: Record<TypMaterialu, TypMaterialu[]> = { post: ["post", "reels"], reels: ["post", "reels"], relacja: ["relacja"], reklama: ["reklama"] };

async function lokaleKlienta(clientId: string): Promise<{ kategoria: Enums["client_category"]; ids: string[] }> {
  const db = supabaseSerwer();
  const [{ data: klient }, { data: lokale }] = await Promise.all([db.from("clients").select("category").eq("id", clientId).single(), db.from("locations").select("id").eq("client_id", clientId).order("position")]);
  return { kategoria: klient?.category ?? "kat1", ids: (lokale ?? []).map((l) => l.id) };
}

/** Domyślne `location_ids` nowego materiału: kat1 puste (pakiet jest per lokal), kat2/kat3 wszystkie lokale. */
async function domyslneLokale(clientId: string): Promise<string[]> {
  const { kategoria, ids } = await lokaleKlienta(clientId);
  return kategoria === "kat1" ? [] : ids;
}

type Material = { id: string; type: TypMaterialu; position: number; title: string | null; caption: string | null; publish_at: string | null; location_ids: string[]; campaign_id: string | null };

async function materialWPakiecie(pakietId: string, materialId: string): Promise<Material | null> {
  const { data } = await supabaseSerwer().from("package_items").select("id, type, position, title, caption, publish_at, location_ids, campaign_id").eq("id", materialId).eq("package_id", pakietId).maybeSingle();
  return data;
}

type Plik = { id: string; item_id: string; position: number; storage_path: string; preview_path: string | null; thumb_path: string | null; superseded_at: string | null };

async function plikMaterialu(materialId: string, assetId: string): Promise<Plik | null> {
  const { data } = await supabaseSerwer().from("item_assets").select("id, item_id, position, storage_path, preview_path, thumb_path, superseded_at").eq("id", assetId).eq("item_id", materialId).maybeSingle();
  return data;
}

async function wstawPlik(materialId: string, opis: OpisPliku, position: number): Promise<void> {
  const { error } = await supabaseSerwer().from("item_assets").insert({
    id: opis.assetId,
    item_id: materialId,
    kind: opis.kind,
    storage_path: opis.storagePath,
    preview_path: opis.previewPath,
    thumb_path: opis.thumbPath,
    original_name: opis.originalName,
    mime: opis.mime,
    bytes: opis.bytes,
    width: opis.width,
    height: opis.height,
    position,
  });
  if (error) throw new Error(`wstawPlik: ${error.message}`);
}

async function liczbaGrafik(materialId: string): Promise<number> {
  const { count } = await supabaseSerwer().from("ad_variants").select("id", { count: "exact", head: true }).eq("item_id", materialId).eq("kind", "grafika");
  return count ?? 0;
}

/** Nowa grafika reklamy = plik + wariant `grafika` (SPEC rozdz. 3: ad_variants.asset_id). */
async function dodajGrafikeReklamy(materialId: string, opis: OpisPliku): Promise<void> {
  const n = await liczbaGrafik(materialId);
  await wstawPlik(materialId, opis, n);
  const { error } = await supabaseSerwer().from("ad_variants").insert({ item_id: materialId, kind: "grafika", position: n, label: `Grafika ${n + 1}`, asset_id: opis.assetId });
  if (error) throw new Error(`dodajGrafikeReklamy: ${error.message}`);
}

/**
 * Serce mutacji: skutki wg statusu (bez zapisu, gdy trzeba potwierdzenia), potem plakietki, termin, flaga,
 * zdarzenie i outbox. Wywołujący zapisuje samą zmianę (plik, pola) MIĘDZY `policz` a `zapisz`.
 */
function policzSkutki(pakiet: PakietDoPrzejscia, rodzaj: RodzajZmiany, potwierdzono: boolean): SkutkiZmiany | { ok: false; powod: "wymaga_potwierdzenia" } {
  const skutki = skutkiZmianyMaterialu({ status: pakiet.status, round: pakiet.round, autoApproveEnabled: pakiet.autoApproveEnabled, autoApproveAt: pakiet.autoApproveAt }, rodzaj, { teraz: new Date(), potwierdzono });
  if (skutki.wymagaPotwierdzenia) return { ok: false, powod: "wymaga_potwierdzenia" };
  return skutki;
}

function czyOdmowa(s: SkutkiZmiany | { ok: false; powod: "wymaga_potwierdzenia" }): s is { ok: false; powod: "wymaga_potwierdzenia" } {
  return "ok" in s;
}

async function zapiszSkutki(pakiet: PakietDoPrzejscia, materialId: string, skutki: SkutkiZmiany, aktor: AktorZespolu, payload: Record<string, unknown>): Promise<void> {
  const db = supabaseSerwer();
  const zmianyMaterialu: Database["public"]["Tables"]["package_items"]["Update"] = {};
  if (skutki.updatedInRound !== null) zmianyMaterialu.updated_in_round = skutki.updatedInRound;
  if (skutki.addedAfterSubmit) zmianyMaterialu.added_after_submit = true;
  if (Object.keys(zmianyMaterialu).length > 0) {
    const { error } = await db.from("package_items").update(zmianyMaterialu).eq("id", materialId);
    if (error) throw new Error(`zapiszSkutki: ${error.message}`);
  }
  const zmianyPakietu: Database["public"]["Tables"]["packages"]["Update"] = {};
  if (skutki.nowyTerminAuto) zmianyPakietu.auto_approve_at = skutki.nowyTerminAuto;
  if (skutki.zmienionePoAkceptacji) zmianyPakietu.changed_after_approval = true;
  if (Object.keys(zmianyPakietu).length > 0) {
    const { error } = await db.from("packages").update(zmianyPakietu).eq("id", pakiet.id);
    if (error) throw new Error(`zapiszSkutki(pakiet): ${error.message}`);
  }
  const zdarzenia: Database["public"]["Tables"]["package_events"]["Insert"][] = [
    { package_id: pakiet.id, kind: skutki.zdarzenie, actor_kind: "zespol", actor_id: aktor.memberId, payload: { ...payload, item_id: materialId, round: pakiet.round, aktor: aktor.name, plakietka: skutki.plakietka, po_akceptacji: skutki.zmienionePoAkceptacji } as Json },
  ];
  if (skutki.nowyTerminAuto) {
    zdarzenia.push({ package_id: pakiet.id, kind: "auto_przesunieta", actor_kind: "system", actor_id: null, payload: { z: pakiet.autoApproveAt, na: skutki.nowyTerminAuto, powod: skutki.zdarzenie, item_id: materialId } as Json });
  }
  const { error } = await db.from("package_events").insert(zdarzenia);
  if (error) console.error("[materialy] nie zapisano zdarzenia", error.message);
  if (skutki.outbox) {
    await dodajDoOutbox(skutki.outbox, zbudujPayloadOutbox(skutki.outbox, pakiet, aktor, pakiet.round, adresPakietuZespolu(pakiet.klient.slug, pakiet.id), { item_id: materialId, rodzaj: skutki.zdarzenie }));
  }
}

export type NowyMaterial = { typ: TypMaterialu; kampaniaId: string | null; tytul: string | null; pozycja: number | null; opis: OpisPliku; potwierdzono: boolean };

/** „Dodaj materiał" (SPEC rozdz. 12.6): post, relacja albo Reels jako nowy wiersz z `origin = 'dodatkowy'`; reklama = nowa grafika w kampanii. */
export async function dodajMaterial(pakiet: PakietDoPrzejscia, n: NowyMaterial, aktor: AktorZespolu): Promise<WynikMutacji> {
  const db = supabaseSerwer();
  if (n.typ === "reklama") {
    if (!n.kampaniaId) return { ok: false, powod: "brak_kampanii" };
    const { data: reklama } = await db.from("package_items").select("id").eq("package_id", pakiet.id).eq("campaign_id", n.kampaniaId).eq("type", "reklama").maybeSingle();
    if (!reklama) return { ok: false, powod: "brak_kampanii" };
    const skutki = policzSkutki(pakiet, "podmieniony", n.potwierdzono);
    if (czyOdmowa(skutki)) return skutki;
    await dodajGrafikeReklamy(reklama.id, n.opis);
    await zapiszSkutki(pakiet, reklama.id, skutki, aktor, { co: "grafika_reklamy", asset_id: n.opis.assetId, campaign_id: n.kampaniaId });
    return { ok: true, materialId: reklama.id, skutki };
  }
  const skutki = policzSkutki(pakiet, "dodany", n.potwierdzono);
  if (czyOdmowa(skutki)) return skutki;
  const grupa = GRUPA_POZYCJI[n.typ];
  const { data: istniejace } = await db.from("package_items").select("id, position").eq("package_id", pakiet.id).in("type", grupa).order("position");
  const ostatnia = istniejace?.at(-1)?.position ?? 0;
  let pozycja = n.pozycja && n.pozycja >= 1 ? Math.min(n.pozycja, ostatnia + 1) : ostatnia + 1;
  if (pozycja <= ostatnia) {
    for (const m of [...(istniejace ?? [])].reverse()) {
      if (m.position >= pozycja) await db.from("package_items").update({ position: m.position + 1 }).eq("id", m.id);
    }
  } else {
    pozycja = ostatnia + 1;
  }
  const { data: nowy, error } = await db
    .from("package_items")
    .insert({ package_id: pakiet.id, type: n.typ, position: pozycja, title: n.tytul, caption: null, publish_at: null, location_ids: await domyslneLokale(pakiet.clientId), origin: "dodatkowy", added_after_submit: skutki.addedAfterSubmit })
    .select("id")
    .single();
  if (error || !nowy) throw new Error(`dodajMaterial: ${error?.message ?? "brak wiersza"}`);
  await wstawPlik(nowy.id, n.opis, 0);
  await zapiszSkutki(pakiet, nowy.id, { ...skutki, addedAfterSubmit: false }, aktor, { typ: n.typ, pozycja, asset_id: n.opis.assetId });
  return { ok: true, materialId: nowy.id, skutki };
}

/** „Podmień materiał": nowy plik na tej samej pozycji, stary dostaje `superseded_at` i `superseded_by`; komentarze i pozycja zostają. */
export async function podmienPlik(pakiet: PakietDoPrzejscia, p: { materialId: string; assetId: string; opis: OpisPliku; potwierdzono: boolean }, aktor: AktorZespolu): Promise<WynikMutacji> {
  const db = supabaseSerwer();
  const material = await materialWPakiecie(pakiet.id, p.materialId);
  if (!material) return { ok: false, powod: "brak_materialu" };
  const stary = await plikMaterialu(material.id, p.assetId);
  if (!stary || stary.superseded_at) return { ok: false, powod: "brak_pliku" };
  const skutki = policzSkutki(pakiet, "podmieniony", p.potwierdzono);
  if (czyOdmowa(skutki)) return skutki;
  await wstawPlik(material.id, p.opis, stary.position);
  const teraz = new Date().toISOString();
  const { error } = await db.from("item_assets").update({ superseded_at: teraz, superseded_by: p.opis.assetId }).eq("id", stary.id);
  if (error) throw new Error(`podmienPlik: ${error.message}`);
  if (material.type === "reklama") {
    const { error: bladWariantu } = await db.from("ad_variants").update({ asset_id: p.opis.assetId }).eq("item_id", material.id).eq("asset_id", stary.id);
    if (bladWariantu) throw new Error(`podmienPlik(wariant): ${bladWariantu.message}`);
  }
  await zapiszSkutki(pakiet, material.id, skutki, aktor, { co: "plik", stary_asset_id: stary.id, nowy_asset_id: p.opis.assetId });
  return { ok: true, materialId: material.id, skutki };
}

/** Dodatkowy slajd karuzeli (post) albo dodatkowa grafika reklamy. Relacja i Reels mają jeden plik. */
export async function dodajPlik(pakiet: PakietDoPrzejscia, p: { materialId: string; opis: OpisPliku; potwierdzono: boolean }, aktor: AktorZespolu): Promise<WynikMutacji> {
  const material = await materialWPakiecie(pakiet.id, p.materialId);
  if (!material) return { ok: false, powod: "brak_materialu" };
  if (material.type !== "post" && material.type !== "reklama") return { ok: false, powod: "zly_typ" };
  const skutki = policzSkutki(pakiet, "podmieniony", p.potwierdzono);
  if (czyOdmowa(skutki)) return skutki;
  if (material.type === "reklama") {
    await dodajGrafikeReklamy(material.id, p.opis);
  } else {
    const { data } = await supabaseSerwer().from("item_assets").select("position").eq("item_id", material.id).is("superseded_at", null).order("position", { ascending: false }).limit(1);
    await wstawPlik(material.id, p.opis, (data?.[0]?.position ?? -1) + 1);
  }
  await zapiszSkutki(pakiet, material.id, skutki, aktor, { co: "dodatkowy_plik", asset_id: p.opis.assetId });
  return { ok: true, materialId: material.id, skutki };
}

/** Usunięcie slajdu albo grafiki reklamy: plik dostaje `superseded_at` (historia zostaje), wariant grafiki znika. */
export async function usunPlik(pakiet: PakietDoPrzejscia, p: { materialId: string; assetId: string; potwierdzono: boolean }, aktor: AktorZespolu): Promise<WynikMutacji> {
  const db = supabaseSerwer();
  const material = await materialWPakiecie(pakiet.id, p.materialId);
  if (!material) return { ok: false, powod: "brak_materialu" };
  const plik = await plikMaterialu(material.id, p.assetId);
  if (!plik || plik.superseded_at) return { ok: false, powod: "brak_pliku" };
  const { count } = await db.from("item_assets").select("id", { count: "exact", head: true }).eq("item_id", material.id).is("superseded_at", null);
  if ((count ?? 0) <= 1 && pakiet.status !== "szkic") return { ok: false, powod: "ostatni_plik" };
  const skutki = policzSkutki(pakiet, "edytowany", p.potwierdzono);
  if (czyOdmowa(skutki)) return skutki;
  const { error } = await db.from("item_assets").update({ superseded_at: new Date().toISOString() }).eq("id", plik.id);
  if (error) throw new Error(`usunPlik: ${error.message}`);
  if (material.type === "reklama") await db.from("ad_variants").delete().eq("item_id", material.id).eq("asset_id", plik.id);
  await zapiszSkutki(pakiet, material.id, skutki, aktor, { co: "usuniety_plik", asset_id: plik.id });
  return { ok: true, materialId: material.id, skutki };
}

export type ZmianyMaterialu = { tytul?: string | null; opis?: string | null; publikacjaO?: string | null; lokaleIds?: string[] };

/** Edycja pól materiału (tytuł, opis, data publikacji, lokale). Bez realnej zmiany nic się nie dzieje. */
export async function edytujMaterial(pakiet: PakietDoPrzejscia, p: { materialId: string; zmiany: ZmianyMaterialu; potwierdzono: boolean }, aktor: AktorZespolu): Promise<WynikMutacji> {
  const db = supabaseSerwer();
  const material = await materialWPakiecie(pakiet.id, p.materialId);
  if (!material) return { ok: false, powod: "brak_materialu" };
  const zmiany: Database["public"]["Tables"]["package_items"]["Update"] = {};
  const pola: string[] = [];
  if (p.zmiany.tytul !== undefined && (p.zmiany.tytul ?? null) !== material.title) {
    zmiany.title = p.zmiany.tytul ?? null;
    pola.push("tytul");
  }
  if (p.zmiany.opis !== undefined && material.type !== "reklama" && (p.zmiany.opis ?? null) !== material.caption) {
    zmiany.caption = p.zmiany.opis ?? null;
    pola.push("opis");
  }
  if (p.zmiany.publikacjaO !== undefined && material.type !== "reklama") {
    const nowa = p.zmiany.publikacjaO ? new Date(p.zmiany.publikacjaO).toISOString() : null;
    const stara = material.publish_at ? new Date(material.publish_at).toISOString() : null;
    if (nowa !== stara) {
      zmiany.publish_at = nowa;
      pola.push("publikacja");
    }
  }
  if (p.zmiany.lokaleIds !== undefined) {
    const { ids } = await lokaleKlienta(pakiet.clientId);
    const nowe = p.zmiany.lokaleIds.filter((id) => ids.includes(id));
    if ([...nowe].sort().join(",") !== [...material.location_ids].sort().join(",")) {
      zmiany.location_ids = nowe;
      pola.push("lokale");
    }
  }
  if (pola.length === 0) return { ok: true, materialId: material.id, skutki: null };
  const skutki = policzSkutki(pakiet, "edytowany", p.potwierdzono);
  if (czyOdmowa(skutki)) return skutki;
  const { error } = await db.from("package_items").update(zmiany).eq("id", material.id);
  if (error) throw new Error(`edytujMaterial: ${error.message}`);
  await zapiszSkutki(pakiet, material.id, skutki, aktor, { co: "pola", pola });
  return { ok: true, materialId: material.id, skutki };
}

/** Usunięcie materiału: tylko w szkicu i tylko post, relacja, Reels (reklamę usuwa się razem z kampanią). Pliki ze Storage znikają. */
export async function usunMaterial(pakiet: PakietDoPrzejscia, materialId: string): Promise<WynikMutacji> {
  const db = supabaseSerwer();
  if (pakiet.status !== "szkic") return { ok: false, powod: "tylko_szkic" };
  const material = await materialWPakiecie(pakiet.id, materialId);
  if (!material) return { ok: false, powod: "brak_materialu" };
  if (material.type === "reklama") return { ok: false, powod: "zly_typ" };
  const { data: pliki } = await db.from("item_assets").select("storage_path, preview_path, thumb_path").eq("item_id", material.id);
  const { error } = await db.from("package_items").delete().eq("id", material.id);
  if (error) throw new Error(`usunMaterial: ${error.message}`);
  await usunObiekty((pliki ?? []).flatMap((p) => [p.storage_path, p.preview_path ?? "", p.thumb_path ?? ""]));
  return { ok: true, materialId: material.id, skutki: null };
}

// ---------- Warianty reklamy ----------

export type WariantTekstowy = { id: string | null; tekst: string };
export type WersjaLokalu = { lokalId: string; link: string | null; cta: string | null; opis: string | null };
export type DaneReklamy = { teksty: WariantTekstowy[]; naglowki: WariantTekstowy[]; opis: string | null; cta: string | null; link: string | null; perLokal: WersjaLokalu[] };

type WierszWariantu = { id: string; kind: Enums["variant_kind"]; position: number; value_text: string | null; location_id: string | null };

/**
 * Teksty, nagłówki, opis, przycisk i link reklamy (SPEC rozdz. 7.4; wersje per lokal z 1.4 poz. 15).
 * Istniejące wiersze zachowują id (komentarze klienta wskazują na `variant_id`), usunięte znikają, nowe dostają
 * kolejne pozycje. Pola pojedyncze (opis, cta, link) to najwyżej jeden wiersz na (materiał, lokal).
 */
export async function zapiszReklame(pakiet: PakietDoPrzejscia, p: { materialId: string; dane: DaneReklamy; potwierdzono: boolean }, aktor: AktorZespolu): Promise<WynikMutacji> {
  const db = supabaseSerwer();
  const material = await materialWPakiecie(pakiet.id, p.materialId);
  if (!material || material.type !== "reklama") return { ok: false, powod: "brak_materialu" };
  const { data: obecne0 } = await db.from("ad_variants").select("id, kind, position, value_text, location_id").eq("item_id", material.id);
  const obecne = (obecne0 ?? []) as WierszWariantu[];
  const { ids: lokale } = await lokaleKlienta(pakiet.clientId);

  type Operacja = { typ: "insert"; wiersz: Database["public"]["Tables"]["ad_variants"]["Insert"] } | { typ: "update"; id: string; wiersz: Database["public"]["Tables"]["ad_variants"]["Update"] } | { typ: "delete"; id: string };
  const operacje: Operacja[] = [];

  const listy: Array<{ kind: "tekst" | "naglowek"; nowe: WariantTekstowy[]; etykieta: (i: number) => string }> = [
    { kind: "tekst", nowe: p.dane.teksty, etykieta: (i) => `Tekst ${"ABCDEFGHIJ"[i] ?? i + 1}` },
    { kind: "naglowek", nowe: p.dane.naglowki, etykieta: (i) => `Nagłówek ${i + 1}` },
  ];
  for (const lista of listy) {
    const stare = obecne.filter((w) => w.kind === lista.kind && w.location_id === null);
    const zostaja = new Set(lista.nowe.map((n) => n.id).filter((id): id is string => !!id));
    for (const s of stare) if (!zostaja.has(s.id)) operacje.push({ typ: "delete", id: s.id });
    lista.nowe.forEach((n, i) => {
      const tekst = n.tekst.trim();
      if (!tekst) return;
      const stary = n.id ? stare.find((s) => s.id === n.id) : undefined;
      if (stary) {
        if (stary.value_text !== tekst || stary.position !== i) operacje.push({ typ: "update", id: stary.id, wiersz: { value_text: tekst, position: i, label: lista.etykieta(i) } });
      } else {
        operacje.push({ typ: "insert", wiersz: { item_id: material.id, kind: lista.kind, position: i, label: lista.etykieta(i), value_text: tekst } });
      }
    });
  }

  const pojedyncze = (kind: "opis" | "cta" | "link", wartosc: string | null, lokalId: string | null) => {
    const tekst = wartosc?.trim() || null;
    const stary = obecne.find((w) => w.kind === kind && w.location_id === lokalId);
    if (!tekst) {
      if (stary) operacje.push({ typ: "delete", id: stary.id });
      return;
    }
    if (stary) {
      if (stary.value_text !== tekst) operacje.push({ typ: "update", id: stary.id, wiersz: { value_text: tekst } });
    } else {
      operacje.push({ typ: "insert", wiersz: { item_id: material.id, kind, position: 0, value_text: tekst, location_id: lokalId } });
    }
  };
  pojedyncze("opis", p.dane.opis, null);
  pojedyncze("cta", p.dane.cta, null);
  pojedyncze("link", p.dane.link, null);
  for (const lokalId of lokale) {
    const wersja = p.dane.perLokal.find((w) => w.lokalId === lokalId);
    pojedyncze("link", wersja?.link ?? null, lokalId);
    pojedyncze("cta", wersja?.cta ?? null, lokalId);
    pojedyncze("opis", wersja?.opis ?? null, lokalId);
  }

  if (operacje.length === 0) return { ok: true, materialId: material.id, skutki: null };
  const skutki = policzSkutki(pakiet, "edytowany", p.potwierdzono);
  if (czyOdmowa(skutki)) return skutki;
  for (const o of operacje) {
    const wynik = o.typ === "insert" ? await db.from("ad_variants").insert(o.wiersz) : o.typ === "update" ? await db.from("ad_variants").update(o.wiersz).eq("id", o.id) : await db.from("ad_variants").delete().eq("id", o.id);
    if (wynik.error) throw new Error(`zapiszReklame(${o.typ}): ${wynik.error.message}`);
  }
  await zapiszSkutki(pakiet, material.id, skutki, aktor, { co: "warianty", operacje: operacje.length });
  return { ok: true, materialId: material.id, skutki };
}

// ---------- Kampanie ----------

export type DaneKampanii = { nazwa: string; cel: Enums["campaign_goal"] | null; notatka: string | null; folderReklamUrl: string | null; folderReklamId: string | null };

/** „Dodaj kampanię": kampania + jeden materiał `reklama` (SPEC rozdz. 3.1). Po wysyłce liczy się jak dodany materiał. */
export async function dodajKampanie(pakiet: PakietDoPrzejscia, d: DaneKampanii, aktor: AktorZespolu, potwierdzono: boolean): Promise<WynikMutacji & { kampaniaId?: string }> {
  const db = supabaseSerwer();
  const skutki = policzSkutki(pakiet, "dodany", potwierdzono);
  if (czyOdmowa(skutki)) return skutki;
  const { count } = await db.from("campaigns").select("id", { count: "exact", head: true }).eq("package_id", pakiet.id);
  const pozycja = count ?? 0;
  const { data: kampania, error } = await db.from("campaigns").insert({ package_id: pakiet.id, name: d.nazwa, goal: d.cel, note: d.notatka, position: pozycja, ads_folder_url: d.folderReklamUrl, ads_folder_id: d.folderReklamId }).select("id").single();
  if (error || !kampania) throw new Error(`dodajKampanie: ${error?.message ?? "brak wiersza"}`);
  const { data: reklama, error: bladReklamy } = await db
    .from("package_items")
    .insert({ package_id: pakiet.id, campaign_id: kampania.id, type: "reklama", position: pozycja + 1, title: d.nazwa, location_ids: await domyslneLokale(pakiet.clientId), origin: pakiet.status === "szkic" ? "reczny" : "dodatkowy", added_after_submit: skutki.addedAfterSubmit })
    .select("id")
    .single();
  if (bladReklamy || !reklama) throw new Error(`dodajKampanie(reklama): ${bladReklamy?.message ?? "brak wiersza"}`);
  await zapiszSkutki(pakiet, reklama.id, { ...skutki, addedAfterSubmit: false }, aktor, { co: "kampania", campaign_id: kampania.id, nazwa: d.nazwa });
  return { ok: true, materialId: reklama.id, skutki, kampaniaId: kampania.id };
}

export async function edytujKampanie(pakiet: PakietDoPrzejscia, kampaniaId: string, d: DaneKampanii, aktor: AktorZespolu, potwierdzono: boolean): Promise<WynikMutacji> {
  const db = supabaseSerwer();
  const { data: kampania } = await db.from("campaigns").select("id, name, goal, note, ads_folder_url, ads_folder_id").eq("id", kampaniaId).eq("package_id", pakiet.id).maybeSingle();
  if (!kampania) return { ok: false, powod: "brak_kampanii" };
  const { data: reklama } = await db.from("package_items").select("id").eq("campaign_id", kampania.id).eq("type", "reklama").maybeSingle();
  const widoczneDlaKlienta = kampania.name !== d.nazwa || kampania.goal !== d.cel || (kampania.note ?? null) !== (d.notatka ?? null);
  const zmianaFolderu = (kampania.ads_folder_url ?? null) !== (d.folderReklamUrl ?? null);
  if (!widoczneDlaKlienta && !zmianaFolderu) return { ok: true, materialId: reklama?.id ?? null, skutki: null };
  let skutki: SkutkiZmiany | null = null;
  if (widoczneDlaKlienta && reklama) {
    const policzone = policzSkutki(pakiet, "edytowany", potwierdzono);
    if (czyOdmowa(policzone)) return policzone;
    skutki = policzone;
  }
  const { error } = await db.from("campaigns").update({ name: d.nazwa, goal: d.cel, note: d.notatka, ads_folder_url: d.folderReklamUrl, ads_folder_id: d.folderReklamId }).eq("id", kampania.id);
  if (error) throw new Error(`edytujKampanie: ${error.message}`);
  if (reklama && widoczneDlaKlienta) await db.from("package_items").update({ title: d.nazwa }).eq("id", reklama.id);
  if (skutki && reklama) await zapiszSkutki(pakiet, reklama.id, skutki, aktor, { co: "kampania_pola", campaign_id: kampania.id });
  return { ok: true, materialId: reklama?.id ?? null, skutki };
}

/** Usunięcie kampanii razem z reklamą: tylko w szkicu. */
export async function usunKampanie(pakiet: PakietDoPrzejscia, kampaniaId: string): Promise<WynikMutacji> {
  const db = supabaseSerwer();
  if (pakiet.status !== "szkic") return { ok: false, powod: "tylko_szkic" };
  const { data: kampania } = await db.from("campaigns").select("id").eq("id", kampaniaId).eq("package_id", pakiet.id).maybeSingle();
  if (!kampania) return { ok: false, powod: "brak_kampanii" };
  const { data: pliki } = await db.from("item_assets").select("storage_path, preview_path, thumb_path, package_items!inner(campaign_id)").eq("package_items.campaign_id", kampania.id);
  const { error } = await db.from("campaigns").delete().eq("id", kampania.id);
  if (error) throw new Error(`usunKampanie: ${error.message}`);
  await usunObiekty((pliki ?? []).flatMap((p) => [p.storage_path, p.preview_path ?? "", p.thumb_path ?? ""]));
  return { ok: true, materialId: null, skutki: null };
}

// ---------- Kreator pakietu ----------

export type NowyPakiet = {
  rok: number;
  miesiac: number;
  lokalId: string | null;
  tytul: string;
  miesiacWspolpracy: number | null;
  folderContentuUrl: string | null;
  folderContentuId: string | null;
  kampanie: DaneKampanii[];
};

/**
 * Kreator pakietu (SPEC rozdz. 12.3): pakiet w szkicu z wklejonymi linkami do folderów i kampaniami
 * (każda z własnym folderem reklam i jednym materiałem `reklama`). Materiały wchodzą potem ręcznie
 * („Dodaj materiał") albo importem z Dysku (faza 4). Nigdy z wyliczonej ścieżki (CLAUDE.md, zasada 11).
 */
export async function utworzPakiet(clientId: string, n: NowyPakiet, aktor: AktorZespolu): Promise<{ ok: true; pakietId: string } | { ok: false; powod: "istnieje" | "zle_dane" }> {
  const db = supabaseSerwer();
  const { kategoria, ids } = await lokaleKlienta(clientId);
  if (kategoria === "kat1" && (!n.lokalId || !ids.includes(n.lokalId))) return { ok: false, powod: "zle_dane" };
  const lokalId = kategoria === "kat1" ? n.lokalId : null;
  const ostatniDzien = new Date(Date.UTC(n.rok, n.miesiac, 0)).getUTCDate();
  const { data: pakiet, error } = await db
    .from("packages")
    .insert({
      client_id: clientId,
      location_id: lokalId,
      period_year: n.rok,
      period_month: n.miesiac,
      cooperation_month: n.miesiacWspolpracy,
      title: n.tytul,
      status: "szkic",
      round: 1,
      content_folder_url: n.folderContentuUrl,
      content_folder_id: n.folderContentuId,
      period_from: `${n.rok}-${String(n.miesiac).padStart(2, "0")}-01`,
      period_to: `${n.rok}-${String(n.miesiac).padStart(2, "0")}-${String(ostatniDzien).padStart(2, "0")}`,
      created_by: aktor.memberId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, powod: "istnieje" };
    throw new Error(`utworzPakiet: ${error.message}`);
  }
  if (!pakiet) throw new Error("utworzPakiet: brak wiersza");
  const lokaleMaterialu = kategoria === "kat1" ? [] : ids;
  for (const [i, k] of n.kampanie.entries()) {
    const { data: kampania, error: bladKampanii } = await db.from("campaigns").insert({ package_id: pakiet.id, name: k.nazwa, goal: k.cel, note: k.notatka, position: i, ads_folder_url: k.folderReklamUrl, ads_folder_id: k.folderReklamId }).select("id").single();
    if (bladKampanii || !kampania) throw new Error(`utworzPakiet(kampania): ${bladKampanii?.message ?? "brak wiersza"}`);
    const { error: bladReklamy } = await db.from("package_items").insert({ package_id: pakiet.id, campaign_id: kampania.id, type: "reklama", position: i + 1, title: k.nazwa, location_ids: lokaleMaterialu, origin: "reczny" });
    if (bladReklamy) throw new Error(`utworzPakiet(reklama): ${bladReklamy.message}`);
  }
  await db.from("package_events").insert({ package_id: pakiet.id, kind: "utworzony", actor_kind: "zespol", actor_id: aktor.memberId, payload: { aktor: aktor.name, kampanie: n.kampanie.length, folder_contentu: n.folderContentuId } as Json });
  return { ok: true, pakietId: pakiet.id };
}

export type ZmianyPakietu = { tytul?: string; folderContentuUrl?: string | null; folderContentuId?: string | null; periodTo?: string | null };

/** Tytuł, link do folderu z contentem i dzień zakończenia (period_to). Bez skutków dla klienta. */
export async function edytujPakiet(pakietId: string, z: ZmianyPakietu): Promise<void> {
  const zmiany: Database["public"]["Tables"]["packages"]["Update"] = {};
  if (z.tytul !== undefined) zmiany.title = z.tytul;
  if (z.folderContentuUrl !== undefined) zmiany.content_folder_url = z.folderContentuUrl;
  if (z.folderContentuId !== undefined) zmiany.content_folder_id = z.folderContentuId;
  if (z.periodTo !== undefined) zmiany.period_to = z.periodTo;
  if (Object.keys(zmiany).length === 0) return;
  const { error } = await supabaseSerwer().from("packages").update(zmiany).eq("id", pakietId);
  if (error) throw new Error(`edytujPakiet: ${error.message}`);
}
