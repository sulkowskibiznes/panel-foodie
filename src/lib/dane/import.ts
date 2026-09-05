import "server-only";
import type { Database } from "@/lib/db-types";
import type { StanImportu, ZadanieImportuDto } from "@/lib/dto/import";
import type { PoprzednieUzycie } from "@/lib/import/ocena";
import { planSchemat, policzPostep, type Plan } from "@/lib/import/plan";
import { supabaseSerwer } from "@/lib/supabase/server";

/**
 * Odczyty zadań importu (SPEC rozdz. 13.4) i poprzednich użyć folderu (13.2). Zapisy robi lib/import/zadania.ts.
 */
type Wiersz = Database["public"]["Tables"]["import_jobs"]["Row"];

/** Po tylu minutach bez bicia serca zadanie „trwa" uznajemy za zawieszone (funkcja umarła) i pozwalamy wznowić. */
export const MINUT_DO_ZAWIESZENIA = 3;

export function planZadania(w: Pick<Wiersz, "plan">): Plan | null {
  const parsed = planSchemat.safeParse(w.plan);
  return parsed.success ? parsed.data : null;
}

export function czyZawieszone(w: Pick<Wiersz, "status" | "heartbeat_at" | "started_at">, teraz = new Date()): boolean {
  if (w.status !== "trwa") return false;
  const ostatnie = w.heartbeat_at ?? w.started_at;
  if (!ostatnie) return true;
  return teraz.getTime() - new Date(ostatnie).getTime() > MINUT_DO_ZAWIESZENIA * 60_000;
}

export function naDto(w: Wiersz, kampaniaNazwa: string | null): ZadanieImportuDto {
  const plan = planZadania(w);
  const postep = plan ? policzPostep(plan) : { razem: w.files_total ?? 0, gotowe: w.files_done ?? 0 };
  const weryfikacja = (w.verification ?? {}) as { sciezka?: unknown };
  return {
    id: w.id,
    rodzaj: w.kind,
    kampaniaNazwa,
    status: w.status,
    razem: postep.razem,
    gotowe: postep.gotowe,
    ostrzezenia: Array.isArray(w.warnings) ? w.warnings.filter((x): x is string => typeof x === "string") : [],
    blad: w.error,
    sciezka: Array.isArray(weryfikacja.sciezka) ? weryfikacja.sciezka.filter((x): x is string => typeof x === "string") : [],
    utworzonoO: w.created_at,
    zakonczonoO: w.finished_at,
    proby: w.attempts,
    zawieszone: czyZawieszone(w),
  };
}

export async function stanImportuPakietu(pakietId: string): Promise<StanImportu> {
  const db = supabaseSerwer();
  const { data, error } = await db.from("import_jobs").select("*, campaigns(name)").eq("package_id", pakietId).in("kind", ["content", "reklamy"]).order("created_at");
  if (error) throw new Error(`stanImportuPakietu: ${error.message}`);
  const zadania = (data ?? []).map((w) => naDto(w, (w.campaigns as { name: string } | null)?.name ?? null));
  return { zadania, wToku: zadania.some((z) => z.status === "oczekuje" || (z.status === "trwa" && !z.zawieszone)) };
}

/** Ostatnia seria importu pakietu: zadania od ostatniego „nowego importu" (te same created_at co do minuty). */
export function ostatniaSeria(stan: StanImportu): StanImportu {
  const ostatnie = stan.zadania.at(-1);
  if (!ostatnie) return stan;
  const granica = new Date(ostatnie.utworzonoO).getTime() - 60_000;
  const zadania = stan.zadania.filter((z) => new Date(z.utworzonoO).getTime() >= granica);
  return { zadania, wToku: zadania.some((z) => z.status === "oczekuje" || (z.status === "trwa" && !z.zawieszone)) };
}

/**
 * Gdzie ten folder był już użyty (SPEC rozdz. 13.2, kryterium 18): zakończone importy oraz pakiety i kampanie
 * z tym samym identyfikatorem folderu, poza bieżącym pakietem. Data importu, gdy była.
 */
export async function poprzednieUzyciaFolderu(folderId: string, pomijajPakietId: string): Promise<PoprzednieUzycie[]> {
  const db = supabaseSerwer();
  type Pakiet = { id: string; title: string | null; period_year: number; period_month: number; clients: { slug: string } };
  const [importy, pakiety, kampanie] = await Promise.all([
    db.from("import_jobs").select("package_id, finished_at, packages!inner(id, title, period_year, period_month, clients!inner(slug))").eq("source_folder_id", folderId).eq("status", "zakonczony").neq("package_id", pomijajPakietId).order("finished_at", { ascending: false }),
    db.from("packages").select("id, title, period_year, period_month, clients!inner(slug)").eq("content_folder_id", folderId).neq("id", pomijajPakietId),
    db.from("campaigns").select("packages!inner(id, title, period_year, period_month, clients!inner(slug))").eq("ads_folder_id", folderId).neq("package_id", pomijajPakietId),
  ]);
  const wynik = new Map<string, PoprzednieUzycie>();
  const dodaj = (p: Pakiet, kiedy: string | null) => {
    const stare = wynik.get(p.id);
    if (stare && (stare.zaimportowanoO || !kiedy)) return;
    wynik.set(p.id, { pakietId: p.id, slug: p.clients.slug, tytul: p.title ?? "", okres: { rok: p.period_year, miesiac: p.period_month }, zaimportowanoO: kiedy });
  };
  for (const w of importy.data ?? []) dodaj(w.packages as unknown as Pakiet, w.finished_at);
  for (const p of pakiety.data ?? []) dodaj(p as unknown as Pakiet, null);
  for (const k of kampanie.data ?? []) dodaj(k.packages as unknown as Pakiet, null);
  return [...wynik.values()];
}

export type PakietDoImportuDto = {
  id: string;
  clientId: string;
  status: Database["public"]["Enums"]["package_status"];
  miesiacWspolpracy: number | null;
  okres: { rok: number; miesiac: number };
  folderContentuId: string | null;
  folderContentuUrl: string | null;
  kampanie: Array<{ id: string; nazwa: string; folderReklamId: string | null; folderReklamUrl: string | null }>;
};

/** Pakiet z linkami do folderów (content i każda kampania) na potrzeby kart weryfikacyjnych. Wywołujący sprawdza klienta. */
export async function pobierzPakietDoImportu(pakietId: string): Promise<PakietDoImportuDto | null> {
  const { data } = await supabaseSerwer().from("packages").select("id, client_id, status, cooperation_month, period_year, period_month, content_folder_id, content_folder_url, campaigns(id, name, position, ads_folder_id, ads_folder_url)").eq("id", pakietId).maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    clientId: data.client_id,
    status: data.status,
    miesiacWspolpracy: data.cooperation_month,
    okres: { rok: data.period_year, miesiac: data.period_month },
    folderContentuId: data.content_folder_id,
    folderContentuUrl: data.content_folder_url,
    kampanie: [...(data.campaigns ?? [])].sort((a, b) => a.position - b.position).map((k) => ({ id: k.id, nazwa: k.name, folderReklamId: k.ads_folder_id, folderReklamUrl: k.ads_folder_url })),
  };
}
