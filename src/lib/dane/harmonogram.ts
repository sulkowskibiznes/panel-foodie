import "server-only";
import type { Adresy } from "@/lib/dane/materialy";
import type { Database } from "@/lib/db-types";
import type { HarmonogramOkresu, KampaniaWKalendarzu, MaterialWKalendarzu, PakietWKalendarzu } from "@/lib/dto/harmonogram";
import { czasLokalny, dataLokalna } from "@/lib/harmonogram/kalendarz";
import { supabaseSerwer } from "@/lib/supabase/server";

type Enums = Database["public"]["Enums"];

type WierszPakietu = {
  id: string;
  title: string | null;
  status: Enums["package_status"];
  round: number;
  period_from: string;
  period_to: string;
  created_at: string;
  lokal: { name: string } | null;
  package_items: Array<{ id: string; type: Enums["item_type"]; position: number; title: string | null; publish_at: string | null; item_assets: Array<{ id: string; position: number; superseded_at: string | null }> }>;
  campaigns: Array<{ id: string; name: string; goal: Enums["campaign_goal"] | null; note: string | null; position: number }>;
};

const KOLUMNY = "id, title, status, round, period_from, period_to, created_at, lokal:locations(name), package_items(id, type, position, title, publish_at, item_assets(id, position, superseded_at)), campaigns(id, name, goal, note, position)";

function naPakiet(p: WierszPakietu): PakietWKalendarzu {
  return { id: p.id, tytul: p.title ?? "", status: p.status, runda: p.round, nazwaLokalu: p.lokal?.name ?? null, okres: { od: p.period_from, do: p.period_to } };
}

/**
 * Harmonogram okresu pakietu (SPEC rozdz. 8): pakiet ogniskowy, pakiety klienta zachodzące na jego okres
 * (kat1: po jednym na lokal) z materiałami i kampaniami, oraz poprzedni i następny pakiet po dacie startu.
 * Wywołujący sprawdza dostęp (assertClientAccess albo assertTeamClientAccess) PRZED wywołaniem; funkcja
 * filtruje wyłącznie po clientId z kontekstu, więc cudzy pakietId daje null (strona odpowiada 404, nigdy 403).
 */
export async function pobierzHarmonogramOkresu(clientId: string, pakietId: string, o: { zeSzkicami: boolean; adresy: Adresy }): Promise<HarmonogramOkresu | null> {
  const db = supabaseSerwer();
  let ogniskowy = db.from("packages").select(KOLUMNY).eq("id", pakietId).eq("client_id", clientId);
  if (!o.zeSzkicami) ogniskowy = ogniskowy.neq("status", "szkic");
  const { data: dane, error } = await ogniskowy.maybeSingle();
  if (error) throw new Error(`pobierzHarmonogramOkresu: ${error.message}`);
  if (!dane) return null;
  const pakiet = dane as unknown as WierszPakietu;
  let zachodzace = db.from("packages").select(KOLUMNY).eq("client_id", clientId).lte("period_from", pakiet.period_to).gte("period_to", pakiet.period_from).order("created_at");
  let wszystkie = db.from("packages").select("id, period_from, created_at").eq("client_id", clientId).order("period_from").order("created_at");
  if (!o.zeSzkicami) {
    zachodzace = zachodzace.neq("status", "szkic");
    wszystkie = wszystkie.neq("status", "szkic");
  }
  const [{ data: wiersze, error: bladZachodzacych }, { data: lista }, { data: klient }] = await Promise.all([zachodzace, wszystkie, db.from("clients").select("default_publish_hours").eq("id", clientId).maybeSingle()]);
  if (bladZachodzacych) throw new Error(`pobierzHarmonogramOkresu(zachodzace): ${bladZachodzacych.message}`);
  const pakiety = (wiersze ?? []) as unknown as WierszPakietu[];
  if (!pakiety.some((p) => p.id === pakiet.id)) pakiety.unshift(pakiet);

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
  // Nawigacja: ostro wcześniejszy i ostro późniejszy start, żeby rodzeństwo kat1 z tym samym okresem (już w widoku) nie robiło pętli.
  const kolejnosc = lista ?? [];
  const wczesniejsze = kolejnosc.filter((p) => p.period_from < pakiet.period_from);
  const pozniejsze = kolejnosc.filter((p) => p.period_from > pakiet.period_from);
  const godziny = (klient?.default_publish_hours ?? [12, 18]).filter((g) => Number.isInteger(g) && g >= 0 && g <= 23);
  return {
    pakiet: naPakiet(pakiet),
    pakiety: pakiety.map(naPakiet),
    materialy,
    kampanie,
    domyslneGodziny: godziny.length > 0 ? godziny : [12, 18],
    nawigacja: { poprzedniId: wczesniejsze.at(-1)?.id ?? null, nastepnyId: pozniejsze[0]?.id ?? null },
  };
}

/** Domyślny pakiet harmonogramu: najnowszy w toku (szkic, do akceptacji, poprawki), inaczej najnowszy po dacie startu, inaczej null. */
export async function domyslnyPakiet(clientId: string, o: { zeSzkicami: boolean }): Promise<string | null> {
  let zapytanie = supabaseSerwer().from("packages").select("id, status").eq("client_id", clientId).order("period_from", { ascending: false }).order("created_at", { ascending: false });
  if (!o.zeSzkicami) zapytanie = zapytanie.neq("status", "szkic");
  const { data } = await zapytanie;
  const wToku = (data ?? []).find((p) => p.status === "do_akceptacji" || p.status === "poprawki" || p.status === "szkic");
  return (wToku ?? data?.[0])?.id ?? null;
}

/** Pierwsza domyślna godzina, której nie zajmuje inny materiał tego dnia; gdy wszystkie zajęte, pierwsza z listy. */
export function wolnaGodzina(domyslne: number[], zajete: string[]): number {
  const wolna = domyslne.find((g) => !zajete.includes(`${String(g).padStart(2, "0")}:00`));
  return wolna ?? domyslne[0] ?? 12;
}
