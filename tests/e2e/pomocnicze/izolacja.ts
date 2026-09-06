import { config as dotenv } from "dotenv";
import postgres from "postgres";

dotenv({ path: ".env.local" });

/** Pomocnicze do testu izolacji klientów (faza 6): identyfikatory zasobów klienta B, po które sięga klient A. */
function sql() {
  const url = process.env.E2E_DB_URL;
  if (!url) throw new Error("Brak E2E_DB_URL (ustawia go global-setup).");
  return postgres(url, { max: 1 });
}

async function zBaza<T>(fn: (s: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const s = sql();
  try {
    return await fn(s);
  } finally {
    await s.end();
  }
}

export type PlikKlienta = { id: string; storage_path: string; thumb_path: string | null; preview_path: string | null };

/** Pierwszy plik materiału klienta razem ze ścieżkami w Storage (do próby podmiany ścieżki w signed URL). */
export async function plikKlienta(slug: string): Promise<PlikKlienta> {
  return zBaza(async (s) => {
    const [w] = await s<PlikKlienta[]>`
      select a.id, a.storage_path, a.thumb_path, a.preview_path from public.item_assets a
      join public.package_items i on i.id = a.item_id
      join public.packages p on p.id = i.package_id
      join public.clients c on c.id = p.client_id
      where c.slug = ${slug} and a.superseded_at is null order by a.created_at limit 1`;
    if (!w) throw new Error(`Brak pliku klienta ${slug}`);
    return w;
  });
}

export async function lokalKlienta(slug: string): Promise<string> {
  return zBaza(async (s) => {
    const [w] = await s<{ id: string }[]>`select l.id from public.locations l join public.clients c on c.id = l.client_id where c.slug = ${slug} and l.avatar_path is not null order by l.position limit 1`;
    if (!w) throw new Error(`Brak lokalu z awatarem u klienta ${slug}`);
    return w.id;
  });
}

export async function fakturyKlienta(slug: string): Promise<string[]> {
  return zBaza(async (s) => (await s<{ id: string }[]>`select i.id from public.invoices i join public.clients c on c.id = i.client_id where c.slug = ${slug} order by i.issue_date`).map((w) => w.id));
}

export async function dokumentyKlienta(slug: string): Promise<string[]> {
  return zBaza(async (s) => (await s<{ id: string }[]>`select d.id from public.documents d join public.clients c on c.id = d.client_id where c.slug = ${slug} order by d.created_at`).map((w) => w.id));
}

/** Komentarze z danym fragmentem treści (gdziekolwiek w bazie): po próbie ataku ma ich nie być. */
export async function komentarzeZTrescia(fragment: string): Promise<Array<{ id: string; package_id: string; item_id: string | null }>> {
  return zBaza((s) => s<Array<{ id: string; package_id: string; item_id: string | null }>>`select id, package_id, item_id from public.comments where body like ${"%" + fragment + "%"}`);
}

export async function idKlientaPoSlugu(slug: string): Promise<string> {
  return zBaza(async (s) => {
    const [w] = await s<{ id: string }[]>`select id from public.clients where slug = ${slug}`;
    if (!w) throw new Error(`Brak klienta ${slug}`);
    return w.id;
  });
}
