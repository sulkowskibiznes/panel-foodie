import "server-only";
import type { Adresy } from "@/lib/dane/materialy";
import type { Database } from "@/lib/db-types";
import type { HarmonogramMiesiaca, KampaniaWKalendarzu, MaterialWKalendarzu, PakietWKalendarzu } from "@/lib/dto/harmonogram";
import { czasLokalny, dataLokalna, kluczMiesiaca } from "@/lib/harmonogram/kalendarz";
import { supabaseSerwer } from "@/lib/supabase/server";

type Enums = Database["public"]["Enums"];

type WierszPakietu = {
  id: string;
  title: string | null;
  status: Enums["package_status"];
  round: number;
  period_to: string | null;
  lokal: { name: string } | null;
  package_items: Array<{ id: string; type: Enums["item_type"]; position: number; title: string | null; publish_at: string | null; item_assets: Array<{ id: string; position: number; superseded_at: string | null }> }>;
  campaigns: Array<{ id: string; name: string; goal: Enums["campaign_goal"] | null; note: string | null; position: number }>;
};

const KOLUMNY = "id, title, status, round, period_to, lokal:locations(name), package_items(id, type, position, title, publish_at, item_assets(id, position, superseded_at)), campaigns(id, name, goal, note, position)";

/**
 * Harmonogram klienta na dany miesiąc: pakiety tego okresu (kat1: kilka, po jednym na lokal) z materiałami
 * i kampaniami. Wywołujący sprawdza dostęp (assertClientAccess albo assertTeamClientAccess) PRZED wywołaniem,
 * bo funkcja filtruje wyłącznie po clientId z kontekstu.
 */
export async function pobierzHarmonogram(clientId: string, rok: number, miesiac: number, o: { zeSzkicami: boolean; adresy: Adresy }): Promise<HarmonogramMiesiaca> {
  const db = supabaseSerwer();
  let zapytanie = db.from("packages").select(KOLUMNY).eq("client_id", clientId).eq("period_year", rok).eq("period_month", miesiac).order("created_at");
  if (!o.zeSzkicami) zapytanie = zapytanie.neq("status", "szkic");
  let miesiace = db.from("packages").select("period_year, period_month").eq("client_id", clientId).order("period_year", { ascending: false }).order("period_month", { ascending: false });
  if (!o.zeSzkicami) miesiace = miesiace.neq("status", "szkic");
  const [{ data, error }, { data: klient }, { data: okresy }] = await Promise.all([zapytanie, db.from("clients").select("default_publish_hours").eq("id", clientId).maybeSingle(), miesiace]);
  if (error) throw new Error(`pobierzHarmonogram: ${error.message}`);
  const pakiety = (data ?? []) as unknown as WierszPakietu[];

  const materialy: MaterialWKalendarzu[] = [];
  const kampanie: KampaniaWKalendarzu[] = [];
  for (const p of pakiety) {
    for (const m of [...p.package_items].sort((a, b) => a.position - b.position)) {
      if (m.type === "reklama") continue;
      const plik = m.item_assets.filter((a) => a.superseded_at === null).sort((a, b) => a.position - b.position)[0];
      materialy.push({
        id: m.id,
        pakietId: p.id,
        typ: m.type,
        tytul: m.title ?? `${m.type} ${m.position}`,
        pozycja: m.position,
        publikacjaO: m.publish_at,
        data: m.publish_at ? dataLokalna(m.publish_at) : null,
        godzina: m.publish_at ? czasLokalny(m.publish_at) : null,
        thumbUrl: plik ? o.adresy.plik(plik.id, "thumb") : null,
        statusPakietu: p.status,
        nazwaLokalu: p.lokal?.name ?? null,
      });
    }
    for (const k of [...p.campaigns].sort((a, b) => a.position - b.position)) {
      kampanie.push({ id: k.id, pakietId: p.id, nazwa: k.name, cel: k.goal, notatka: k.note, statusPakietu: p.status });
    }
  }
  const godziny = (klient?.default_publish_hours ?? [12, 18]).filter((g) => Number.isInteger(g) && g >= 0 && g <= 23);
  return {
    rok,
    miesiac,
    pakiety: pakiety.map<PakietWKalendarzu>((p) => ({ id: p.id, tytul: p.title ?? "", status: p.status, runda: p.round, nazwaLokalu: p.lokal?.name ?? null, koniecOkresu: p.period_to })),
    materialy,
    kampanie,
    domyslneGodziny: godziny.length > 0 ? godziny : [12, 18],
    miesiaceZPakietami: [...new Set((okresy ?? []).map((w) => kluczMiesiaca(w.period_year, w.period_month)))],
  };
}

/** Domyślny miesiąc harmonogramu: najnowszy z pakietem w toku, inaczej najnowszy z pakietem, inaczej bieżący. */
export async function domyslnyMiesiac(clientId: string, o: { zeSzkicami: boolean }, teraz = new Date()): Promise<{ rok: number; miesiac: number }> {
  const db = supabaseSerwer();
  let zapytanie = db.from("packages").select("period_year, period_month, status").eq("client_id", clientId).order("period_year", { ascending: false }).order("period_month", { ascending: false });
  if (!o.zeSzkicami) zapytanie = zapytanie.neq("status", "szkic");
  const { data } = await zapytanie;
  const wToku = (data ?? []).find((p) => p.status === "do_akceptacji" || p.status === "poprawki" || p.status === "szkic");
  const wybrany = wToku ?? data?.[0];
  if (wybrany) return { rok: wybrany.period_year, miesiac: wybrany.period_month };
  return { rok: teraz.getFullYear(), miesiac: teraz.getMonth() + 1 };
}

/** Pierwsza domyślna godzina, której nie zajmuje inny materiał tego dnia; gdy wszystkie zajęte, pierwsza z listy. */
export function wolnaGodzina(domyslne: number[], zajete: string[]): number {
  const wolna = domyslne.find((g) => !zajete.includes(`${String(g).padStart(2, "0")}:00`));
  return wolna ?? domyslne[0] ?? 12;
}
