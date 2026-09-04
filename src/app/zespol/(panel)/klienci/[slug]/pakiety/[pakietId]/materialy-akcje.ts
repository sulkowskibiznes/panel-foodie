"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { zapiszAudyt, type AkcjaAudytu } from "@/lib/audyt";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia, type CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { dodajKampanie, dodajMaterial, dodajPlik, edytujKampanie, edytujMaterial, edytujPakiet, podmienPlik, usunKampanie, usunMaterial, usunPlik, zapiszReklame, type AktorZespolu, type DaneKampanii, type DaneReklamy, type PowodMutacji, type WynikMutacji } from "@/lib/dane/materialy-zespol";
import { rozpoznajLinkDysku } from "@/lib/drive/linki";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { formatujDateCzas } from "@/lib/format";
import { czyPoprawnaDataLokalna, zlozDateLokalna } from "@/lib/harmonogram/kalendarz";
import { pobierzPakietDoPrzejscia } from "@/lib/pakiety/baza";
import type { PakietDoPrzejscia } from "@/lib/pakiety/przejscia";
import type { SkutkiZmiany } from "@/lib/pakiety/zmiana-materialu";
import { odczytajOpisPliku, przygotujUpload as przygotujUploadPliku, zakonczUpload as zakonczUploadPliku, type WynikPrzygotowania, type WynikZakonczenia } from "@/lib/pliki/upload";
import type { Zasob } from "@/lib/uprawnienia";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

/**
 * Akcje zespołu nad materiałami, plikami i kampaniami (SPEC rozdz. 12.3, 12.6). Content (posty, relacje, Reels)
 * wymaga `materialy: pelne`, reklamy i kampanie `kampanie: pelne` (media buyer edytuje kampanie, content creator
 * całość). Każda zmiana: audyt z IP i odświeżenie ekranu pakietu.
 */
type Kontekst = { czlonek: CzlonekZespolu; clientId: string; pakiet: PakietDoPrzejscia };

async function autoryzuj(slug: string, pakietId: string, zasob: Zasob = "materialy"): Promise<Kontekst> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, zasob, "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient || !czyUuid(pakietId)) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const pakiet = await pobierzPakietDoPrzejscia(pakietId);
  if (!pakiet || pakiet.clientId !== klient.id) notFound();
  return { czlonek, clientId: klient.id, pakiet };
}

function aktor(c: CzlonekZespolu): AktorZespolu {
  return { rodzaj: "zespol", memberId: c.id, name: c.name };
}

function odswiez(slug: string, pakietId: string) {
  revalidatePath(`/zespol/klienci/${slug}/pakiety/${pakietId}`);
  revalidatePath(`/zespol/klienci/${slug}/materialy`);
  revalidatePath(`/zespol/klienci/${slug}/harmonogram`);
  revalidatePath("/zespol");
}

export type WynikZmiany = WynikAkcji & { komunikat?: string; wymagaPotwierdzenia?: boolean; materialId?: string | null };

function komunikatSkutkow(skutki: SkutkiZmiany | null): string {
  const t = copy.zespol.materialy;
  if (!skutki) return t.zapisano;
  const czesci: string[] = [skutki.plakietka ? t.zapisanoPlakietka[skutki.plakietka] : t.zapisano];
  if (skutki.nowyTerminAuto) czesci.push(t.zapisanoTermin.replace("{termin}", formatujDateCzas(skutki.nowyTerminAuto)));
  return czesci.join(" ");
}

function naWynik(w: WynikMutacji): WynikZmiany {
  if (w.ok) return { ok: true, komunikat: komunikatSkutkow(w.skutki), materialId: w.materialId };
  const powod: PowodMutacji = w.powod;
  return { ok: false, blad: copy.zespol.materialy.bledy[powod], wymagaPotwierdzenia: powod === "wymaga_potwierdzenia" };
}

async function audyt(k: Kontekst, action: AkcjaAudytu, entityId: string | null, meta: Record<string, unknown>) {
  const { ipHash, ua } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: k.czlonek.id, actor_label: k.czlonek.name, action, entity: "package_item", entity_id: entityId, client_id: k.clientId, ip_hash: ipHash, ua, meta: { package_id: k.pakiet.id, status: k.pakiet.status, ...meta } });
}

// ---------- Upload ----------

const schematPliku = z.object({ nazwa: z.string().min(1).max(200), mime: z.string().min(1).max(100), bytes: z.number().int().positive() });

/** Krok 1 uploadu: podpisany adres do Storage (bez klucza Supabase w przeglądarce). */
export async function przygotujUpload(slug: string, pakietId: string, plik: z.input<typeof schematPliku>): Promise<WynikPrzygotowania> {
  const k = await autoryzuj(slug, pakietId, "materialy");
  const parsed = schematPliku.safeParse(plik);
  if (!parsed.success) return { ok: false, powod: "nieobslugiwany" };
  return przygotujUploadPliku(k.clientId, parsed.data);
}

/** Krok 3 uploadu: magic bytes, EXIF, warianty, podpisany opis pliku dla mutacji. */
export async function zakonczUpload(slug: string, pakietId: string, pozwolenie: string): Promise<WynikZakonczenia> {
  const k = await autoryzuj(slug, pakietId, "materialy");
  return zakonczUploadPliku(k.clientId, String(pozwolenie ?? ""));
}

// ---------- Materiały ----------

const schematNowego = z.object({
  typ: z.enum(["post", "relacja", "reels", "reklama"]),
  kampaniaId: z.string().nullable(),
  tytul: z.string().trim().max(160).nullable(),
  pozycja: z.number().int().min(1).max(500).nullable(),
  opis: z.string().min(1),
  potwierdzono: z.boolean(),
});

export async function dodajMaterialAkcja(slug: string, pakietId: string, dane: z.input<typeof schematNowego>): Promise<WynikZmiany> {
  const parsed = schematNowego.safeParse(dane);
  if (!parsed.success) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const k = await autoryzuj(slug, pakietId, parsed.data.typ === "reklama" ? "kampanie" : "materialy");
  const opis = odczytajOpisPliku(k.clientId, parsed.data.opis);
  if (!opis) return { ok: false, blad: copy.zespol.materialy.upload.bledy.pozwolenie };
  const kampaniaId = parsed.data.kampaniaId && czyUuid(parsed.data.kampaniaId) ? parsed.data.kampaniaId : null;
  const w = await dodajMaterial(k.pakiet, { typ: parsed.data.typ, kampaniaId, tytul: parsed.data.tytul || null, pozycja: parsed.data.pozycja, opis, potwierdzono: parsed.data.potwierdzono }, aktor(k.czlonek));
  if (w.ok) {
    await audyt(k, "zespol.material_dodany", w.materialId, { typ: parsed.data.typ, asset_id: opis.assetId, plakietka: w.skutki?.plakietka ?? null });
    odswiez(slug, pakietId);
  }
  return naWynik(w);
}

const schematPodmiany = z.object({ materialId: z.string(), assetId: z.string(), opis: z.string().min(1), potwierdzono: z.boolean() });

export async function podmienPlikAkcja(slug: string, pakietId: string, dane: z.input<typeof schematPodmiany>): Promise<WynikZmiany> {
  const parsed = schematPodmiany.safeParse(dane);
  if (!parsed.success || !czyUuid(parsed.data.materialId) || !czyUuid(parsed.data.assetId)) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const k = await autoryzuj(slug, pakietId, "materialy");
  const opis = odczytajOpisPliku(k.clientId, parsed.data.opis);
  if (!opis) return { ok: false, blad: copy.zespol.materialy.upload.bledy.pozwolenie };
  const w = await podmienPlik(k.pakiet, { materialId: parsed.data.materialId, assetId: parsed.data.assetId, opis, potwierdzono: parsed.data.potwierdzono }, aktor(k.czlonek));
  if (w.ok) {
    await audyt(k, "zespol.material_podmieniony", w.materialId, { stary_asset_id: parsed.data.assetId, nowy_asset_id: opis.assetId, po_akceptacji: w.skutki?.zmienionePoAkceptacji ?? false });
    odswiez(slug, pakietId);
  }
  return naWynik(w);
}

const schematDodaniaPliku = z.object({ materialId: z.string(), opis: z.string().min(1), potwierdzono: z.boolean() });

export async function dodajPlikAkcja(slug: string, pakietId: string, dane: z.input<typeof schematDodaniaPliku>): Promise<WynikZmiany> {
  const parsed = schematDodaniaPliku.safeParse(dane);
  if (!parsed.success || !czyUuid(parsed.data.materialId)) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const k = await autoryzuj(slug, pakietId, "materialy");
  const opis = odczytajOpisPliku(k.clientId, parsed.data.opis);
  if (!opis) return { ok: false, blad: copy.zespol.materialy.upload.bledy.pozwolenie };
  const w = await dodajPlik(k.pakiet, { materialId: parsed.data.materialId, opis, potwierdzono: parsed.data.potwierdzono }, aktor(k.czlonek));
  if (w.ok) {
    await audyt(k, "zespol.material_podmieniony", w.materialId, { co: "dodatkowy_plik", asset_id: opis.assetId });
    odswiez(slug, pakietId);
  }
  return naWynik(w);
}

export async function usunPlikAkcja(slug: string, pakietId: string, dane: { materialId: string; assetId: string; potwierdzono: boolean }): Promise<WynikZmiany> {
  if (!czyUuid(dane.materialId) || !czyUuid(dane.assetId)) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const k = await autoryzuj(slug, pakietId, "materialy");
  const w = await usunPlik(k.pakiet, { materialId: dane.materialId, assetId: dane.assetId, potwierdzono: !!dane.potwierdzono }, aktor(k.czlonek));
  if (w.ok) {
    await audyt(k, "zespol.material_zmieniony", w.materialId, { co: "usuniety_plik", asset_id: dane.assetId });
    odswiez(slug, pakietId);
  }
  return naWynik(w);
}

const schematEdycji = z.object({
  materialId: z.string(),
  tytul: z.string().trim().max(160).nullable().optional(),
  opis: z.string().max(10_000).nullable().optional(),
  /** Lokalna data i godzina z pola datetime-local („2026-09-12T18:00") albo null. */
  publikacja: z.string().nullable().optional(),
  lokaleIds: z.array(z.string()).optional(),
  potwierdzono: z.boolean(),
});

function publikacjaZPola(wartosc: string | null | undefined): string | null | undefined | { blad: true } {
  if (wartosc === undefined) return undefined;
  if (wartosc === null || wartosc.trim() === "") return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(wartosc.trim());
  if (!m || !m[1] || !czyPoprawnaDataLokalna(m[1])) return { blad: true };
  const godzina = Number(m[2]);
  const minuta = Number(m[3]);
  if (godzina > 23 || minuta > 59) return { blad: true };
  return zlozDateLokalna(m[1], godzina, minuta).toISOString();
}

export async function edytujMaterialAkcja(slug: string, pakietId: string, dane: z.input<typeof schematEdycji>): Promise<WynikZmiany> {
  const parsed = schematEdycji.safeParse(dane);
  if (!parsed.success || !czyUuid(parsed.data.materialId)) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const k = await autoryzuj(slug, pakietId, "materialy");
  const publikacjaO = publikacjaZPola(parsed.data.publikacja);
  if (publikacjaO && typeof publikacjaO === "object") return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const w = await edytujMaterial(
    k.pakiet,
    {
      materialId: parsed.data.materialId,
      zmiany: {
        ...(parsed.data.tytul !== undefined ? { tytul: parsed.data.tytul || null } : {}),
        ...(parsed.data.opis !== undefined ? { opis: parsed.data.opis?.trim() || null } : {}),
        ...(publikacjaO !== undefined ? { publikacjaO } : {}),
        ...(parsed.data.lokaleIds !== undefined ? { lokaleIds: parsed.data.lokaleIds.filter(czyUuid) } : {}),
      },
      potwierdzono: parsed.data.potwierdzono,
    },
    aktor(k.czlonek),
  );
  if (w.ok && w.skutki !== null) {
    await audyt(k, "zespol.material_zmieniony", w.materialId, { co: "pola" });
    odswiez(slug, pakietId);
  }
  if (w.ok && w.skutki === null) return { ok: true, komunikat: copy.zespol.materialy.edycja.bezZmian, materialId: w.materialId };
  return naWynik(w);
}

export async function usunMaterialAkcja(slug: string, pakietId: string, materialId: string): Promise<WynikZmiany> {
  if (!czyUuid(materialId)) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const k = await autoryzuj(slug, pakietId, "materialy");
  const w = await usunMaterial(k.pakiet, materialId);
  if (w.ok) {
    await audyt(k, "zespol.material_usuniety", materialId, {});
    odswiez(slug, pakietId);
  }
  return naWynik(w);
}

// ---------- Reklama ----------

const schematWariantu = z.object({ id: z.string().nullable(), tekst: z.string().max(2000) });
const schematReklamy = z.object({
  materialId: z.string(),
  teksty: z.array(schematWariantu).max(10),
  naglowki: z.array(schematWariantu).max(10),
  opis: z.string().max(500).nullable(),
  cta: z.string().max(60).nullable(),
  link: z.string().max(500).nullable(),
  perLokal: z.array(z.object({ lokalId: z.string(), link: z.string().max(500).nullable(), cta: z.string().max(60).nullable(), opis: z.string().max(500).nullable() })).max(50),
  potwierdzono: z.boolean(),
});

export async function zapiszReklameAkcja(slug: string, pakietId: string, dane: z.input<typeof schematReklamy>): Promise<WynikZmiany> {
  const parsed = schematReklamy.safeParse(dane);
  if (!parsed.success || !czyUuid(parsed.data.materialId)) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const k = await autoryzuj(slug, pakietId, "kampanie");
  const d = parsed.data;
  const daneReklamy: DaneReklamy = {
    teksty: d.teksty.map((t) => ({ id: t.id && czyUuid(t.id) ? t.id : null, tekst: t.tekst })),
    naglowki: d.naglowki.map((t) => ({ id: t.id && czyUuid(t.id) ? t.id : null, tekst: t.tekst })),
    opis: d.opis,
    cta: d.cta,
    link: d.link,
    perLokal: d.perLokal.filter((w) => czyUuid(w.lokalId)),
  };
  const w = await zapiszReklame(k.pakiet, { materialId: d.materialId, dane: daneReklamy, potwierdzono: d.potwierdzono }, aktor(k.czlonek));
  if (w.ok && w.skutki !== null) {
    await audyt(k, "zespol.material_zmieniony", w.materialId, { co: "warianty" });
    odswiez(slug, pakietId);
  }
  if (w.ok && w.skutki === null) return { ok: true, komunikat: copy.zespol.materialy.edycja.bezZmian, materialId: w.materialId };
  return naWynik(w);
}

// ---------- Kampanie ----------

const schematKampanii = z.object({
  nazwa: z.string().trim().min(1).max(120),
  cel: z.enum(["sprzedaz", "ruch", "polubienia", "leady", "zasieg", "inne"]).nullable(),
  notatka: z.string().trim().max(500).nullable(),
  folder: z.string().trim().max(500).nullable(),
  potwierdzono: z.boolean(),
});

function daneKampanii(d: z.infer<typeof schematKampanii>): DaneKampanii | { blad: string } {
  const link = d.folder ? rozpoznajLinkDysku(d.folder) : null;
  if (d.folder && !link) return { blad: copy.zespol.kreator.bledy.zlyLink };
  return { nazwa: d.nazwa, cel: d.cel, notatka: d.notatka || null, folderReklamUrl: link?.url ?? null, folderReklamId: link?.id ?? null };
}

export async function dodajKampanieAkcja(slug: string, pakietId: string, dane: z.input<typeof schematKampanii>): Promise<WynikZmiany & { kampaniaId?: string }> {
  const parsed = schematKampanii.safeParse(dane);
  if (!parsed.success) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const k = await autoryzuj(slug, pakietId, "kampanie");
  const d = daneKampanii(parsed.data);
  if ("blad" in d) return { ok: false, blad: d.blad };
  const w = await dodajKampanie(k.pakiet, d, aktor(k.czlonek), parsed.data.potwierdzono);
  if (w.ok) {
    await audyt(k, "zespol.kampania_dodana", w.materialId, { campaign_id: w.kampaniaId, nazwa: d.nazwa });
    odswiez(slug, pakietId);
    return { ...naWynik(w), kampaniaId: w.kampaniaId };
  }
  return naWynik(w);
}

export async function edytujKampanieAkcja(slug: string, pakietId: string, kampaniaId: string, dane: z.input<typeof schematKampanii>): Promise<WynikZmiany> {
  const parsed = schematKampanii.safeParse(dane);
  if (!parsed.success || !czyUuid(kampaniaId)) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const k = await autoryzuj(slug, pakietId, "kampanie");
  const d = daneKampanii(parsed.data);
  if ("blad" in d) return { ok: false, blad: d.blad };
  const w = await edytujKampanie(k.pakiet, kampaniaId, d, aktor(k.czlonek), parsed.data.potwierdzono);
  if (w.ok) {
    await audyt(k, "zespol.kampania_zmieniona", w.materialId, { campaign_id: kampaniaId });
    odswiez(slug, pakietId);
  }
  return naWynik(w);
}

export async function usunKampanieAkcja(slug: string, pakietId: string, kampaniaId: string): Promise<WynikZmiany> {
  if (!czyUuid(kampaniaId)) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const k = await autoryzuj(slug, pakietId, "kampanie");
  const w = await usunKampanie(k.pakiet, kampaniaId);
  if (w.ok) {
    await audyt(k, "zespol.kampania_usunieta", null, { campaign_id: kampaniaId });
    odswiez(slug, pakietId);
  }
  return naWynik(w);
}

// ---------- Pakiet ----------

const schematPakietu = z.object({ tytul: z.string().trim().min(1).max(160).optional(), folder: z.string().trim().max(500).nullable().optional(), koniecOkresu: z.string().nullable().optional() });

export async function edytujPakietAkcja(slug: string, pakietId: string, dane: z.input<typeof schematPakietu>): Promise<WynikZmiany> {
  const parsed = schematPakietu.safeParse(dane);
  if (!parsed.success) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const k = await autoryzuj(slug, pakietId, "materialy");
  const zmiany: Parameters<typeof edytujPakiet>[1] = {};
  if (parsed.data.tytul !== undefined) zmiany.tytul = parsed.data.tytul;
  if (parsed.data.folder !== undefined) {
    if (parsed.data.folder) {
      const link = rozpoznajLinkDysku(parsed.data.folder);
      if (!link) return { ok: false, blad: copy.zespol.kreator.bledy.zlyLink };
      zmiany.folderContentuUrl = link.url;
      zmiany.folderContentuId = link.id;
    } else {
      zmiany.folderContentuUrl = null;
      zmiany.folderContentuId = null;
    }
  }
  if (parsed.data.koniecOkresu !== undefined) {
    if (parsed.data.koniecOkresu && !czyPoprawnaDataLokalna(parsed.data.koniecOkresu)) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
    zmiany.periodTo = parsed.data.koniecOkresu || null;
  }
  await edytujPakiet(k.pakiet.id, zmiany);
  await audyt(k, "zespol.pakiet_zmieniony", null, { pola: Object.keys(zmiany) });
  odswiez(slug, pakietId);
  return { ok: true, komunikat: copy.zespol.materialy.zapisano };
}
