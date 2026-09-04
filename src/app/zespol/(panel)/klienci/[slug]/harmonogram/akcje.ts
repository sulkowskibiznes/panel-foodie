"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { zapiszAudyt } from "@/lib/audyt";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia, type CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { wolnaGodzina } from "@/lib/dane/harmonogram";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { edytujMaterial, edytujPakiet } from "@/lib/dane/materialy-zespol";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { czasLokalny, czyPoprawnaDataLokalna, dataLokalna, zlozDateLokalna } from "@/lib/harmonogram/kalendarz";
import { pobierzPakietDoPrzejscia } from "@/lib/pakiety/baza";
import { supabaseSerwer } from "@/lib/supabase/server";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

export type WynikHarmonogramu = WynikAkcji & { wymagaPotwierdzenia?: boolean; publikacjaO?: string | null };

async function autoryzuj(slug: string): Promise<{ czlonek: CzlonekZespolu; clientId: string }> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "harmonogram", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  return { czlonek, clientId: klient.id };
}

function odswiez(slug: string, pakietId: string) {
  revalidatePath(`/zespol/klienci/${slug}/harmonogram`);
  revalidatePath(`/zespol/klienci/${slug}/pakiety/${pakietId}`);
}

const schematPrzesuniecia = z.object({
  pakietId: z.string(),
  materialId: z.string(),
  /** YYYY-MM-DD w Europe/Warsaw albo null = „Niezaplanowane". */
  data: z.string().nullable(),
  /** HH:MM; brak = zachowaj godzinę materiału, a bez niej pierwsza wolna domyślna godzina klienta. */
  godzina: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  potwierdzono: z.boolean().optional(),
});

/**
 * Przeciągnięcie materiału na dzień (albo do „Niezaplanowane") i ustawienie godziny (SPEC rozdz. 8).
 * Zmiana daty w wysłanym pakiecie idzie ścieżką edycji materiału (plakietka, termin auto-akceptacji, potwierdzenie po akceptacji).
 * Endpoint istnieje wyłącznie w panelu zespołu: klient nie ma jak przesunąć materiału (kryterium 22).
 */
export async function przesunMaterialAkcja(slug: string, dane: z.input<typeof schematPrzesuniecia>): Promise<WynikHarmonogramu> {
  const parsed = schematPrzesuniecia.safeParse(dane);
  if (!parsed.success || !czyUuid(parsed.data.pakietId) || !czyUuid(parsed.data.materialId)) return { ok: false, blad: copy.zespol.harmonogram.bledy.zlaData };
  const { czlonek, clientId } = await autoryzuj(slug);
  const pakiet = await pobierzPakietDoPrzejscia(parsed.data.pakietId);
  if (!pakiet || pakiet.clientId !== clientId) notFound();
  const db = supabaseSerwer();
  const { data: material } = await db.from("package_items").select("id, type, publish_at").eq("id", parsed.data.materialId).eq("package_id", pakiet.id).maybeSingle();
  if (!material || material.type === "reklama") return { ok: false, blad: copy.zespol.materialy.bledy.brak_materialu };

  let publikacjaO: string | null = null;
  if (parsed.data.data !== null) {
    if (!czyPoprawnaDataLokalna(parsed.data.data)) return { ok: false, blad: copy.zespol.harmonogram.bledy.zlaData };
    let godzina: number;
    let minuta = 0;
    if (parsed.data.godzina) {
      [godzina, minuta] = parsed.data.godzina.split(":").map(Number) as [number, number];
      if (godzina > 23 || minuta > 59) return { ok: false, blad: copy.zespol.harmonogram.bledy.zlaData };
    } else if (material.publish_at) {
      [godzina, minuta] = czasLokalny(material.publish_at).split(":").map(Number) as [number, number];
    } else {
      const [{ data: klient }, { data: tegoDnia }] = await Promise.all([
        db.from("clients").select("default_publish_hours").eq("id", clientId).single(),
        db.from("package_items").select("publish_at").eq("package_id", pakiet.id).neq("id", material.id).not("publish_at", "is", null),
      ]);
      const zajete = (tegoDnia ?? []).filter((m) => m.publish_at && dataLokalna(m.publish_at) === parsed.data.data).map((m) => czasLokalny(m.publish_at as string));
      godzina = wolnaGodzina(klient?.default_publish_hours ?? [12, 18], zajete);
    }
    publikacjaO = zlozDateLokalna(parsed.data.data, godzina, minuta).toISOString();
  }

  const w = await edytujMaterial(pakiet, { materialId: material.id, zmiany: { publikacjaO }, potwierdzono: !!parsed.data.potwierdzono }, { rodzaj: "zespol", memberId: czlonek.id, name: czlonek.name });
  if (!w.ok) return { ok: false, blad: copy.zespol.materialy.bledy[w.powod], wymagaPotwierdzenia: w.powod === "wymaga_potwierdzenia" };
  if (w.skutki !== null) {
    const { ipHash, ua } = await infoZadania();
    await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.harmonogram_zmieniony", entity: "package_item", entity_id: material.id, client_id: clientId, ip_hash: ipHash, ua, meta: { package_id: pakiet.id, publish_at: publikacjaO, plakietka: w.skutki.plakietka } });
  }
  odswiez(slug, pakiet.id);
  return { ok: true, publikacjaO };
}

const schematUstawien = z.object({ pakietId: z.string(), koniecOkresu: z.string().nullable().optional(), godziny: z.string().max(60).optional() });

/** Dzień zakończenia pakietu (period_to) i domyślne godziny publikacji klienta. */
export async function zapiszUstawieniaHarmonogramu(slug: string, dane: z.input<typeof schematUstawien>): Promise<WynikAkcji> {
  const parsed = schematUstawien.safeParse(dane);
  if (!parsed.success || !czyUuid(parsed.data.pakietId)) return { ok: false, blad: copy.zespol.harmonogram.bledy.zlaData };
  const { czlonek, clientId } = await autoryzuj(slug);
  const pakiet = await pobierzPakietDoPrzejscia(parsed.data.pakietId);
  if (!pakiet || pakiet.clientId !== clientId) notFound();
  if (parsed.data.koniecOkresu !== undefined) {
    if (parsed.data.koniecOkresu && !czyPoprawnaDataLokalna(parsed.data.koniecOkresu)) return { ok: false, blad: copy.zespol.harmonogram.bledy.zlaData };
    await edytujPakiet(pakiet.id, { periodTo: parsed.data.koniecOkresu || null });
  }
  if (parsed.data.godziny !== undefined) {
    const godziny = parsed.data.godziny.split(/[,\s;]+/).filter(Boolean).map(Number);
    if (godziny.length < 1 || godziny.length > 6 || godziny.some((g) => !Number.isInteger(g) || g < 0 || g > 23)) return { ok: false, blad: copy.zespol.harmonogram.bledy.zleGodziny };
    const { error } = await supabaseSerwer().from("clients").update({ default_publish_hours: [...new Set(godziny)].sort((a, b) => a - b) }).eq("id", clientId);
    if (error) throw new Error(`zapiszUstawieniaHarmonogramu: ${error.message}`);
  }
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.pakiet_zmieniony", entity: "package", entity_id: pakiet.id, client_id: clientId, ip_hash: ipHash, meta: { koniec_okresu: parsed.data.koniecOkresu, godziny: parsed.data.godziny } });
  odswiez(slug, pakiet.id);
  return { ok: true };
}
