import { config as dotenv } from "dotenv";
import postgres from "postgres";

dotenv({ path: ".env.local" });

/** Klient jednorazowy do testów offboardingu (faza 6): własny wiersz, jeden lokal, jedna osoba kontaktowa, opiekun Gosia. */
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

export type KlientTestowy = { id: string; slug: string; name: string };

export async function utworzKlientaTestowego(slug: string, name: string, opiekunEmail = "gosia@foodiemedia.pl"): Promise<KlientTestowy> {
  return zBaza(async (s) => {
    await s`delete from public.comments where package_id in (select p.id from public.packages p join public.clients c on c.id = p.client_id where c.slug = ${slug})`;
    await s`delete from public.clients where slug = ${slug}`;
    const [opiekun] = await s<{ id: string }[]>`select id from public.team_members where lower(email) = lower(${opiekunEmail})`;
    const [klient] = await s<{ id: string }[]>`
      insert into public.clients (name, slug, category, tier, monthly_amount_net, slack_channel, cooperation_started_on, opiekun_id)
      values (${name}, ${slug}, 'kat2', 'foodie_360', 3800, ${"#" + slug}, current_date - 400, ${opiekun?.id ?? null})
      returning id`;
    if (!klient) throw new Error("Nie udało się utworzyć klienta testowego");
    await s`insert into public.locations (client_id, name, city, fb_page_name, ig_handle, position) values (${klient.id}, ${name + " Centrum"}, 'Łódź', ${name}, ${slug.replace(/-/g, "")}, 0)`;
    await s`insert into public.client_contacts (client_id, name, role_label, is_primary) values (${klient.id}, 'Ola Testowa', 'właścicielka', true)`;
    return { id: klient.id, slug, name };
  });
}

export type StanKlientaTestowego = { status: string; ended_at: string | null; aktywne_linki: number; aktywne_sesje: number };

export async function stanKlienta(id: string): Promise<StanKlientaTestowego | null> {
  return zBaza(async (s) => {
    const [w] = await s<StanKlientaTestowego[]>`
      select c.status::text as status, c.ended_at::text as ended_at,
        (select count(*)::int from public.access_links l where l.client_id = c.id and l.revoked_at is null) as aktywne_linki,
        (select count(*)::int from public.client_sessions cs join public.access_links l on l.id = cs.access_link_id where l.client_id = c.id and cs.revoked_at is null) as aktywne_sesje
      from public.clients c where c.id = ${id}`;
    return w ?? null;
  });
}

export async function klientIstnieje(id: string): Promise<boolean> {
  return zBaza(async (s) => (await s`select 1 from public.clients where id = ${id}`).length === 1);
}

export async function usunKlientaTestowego(slug: string): Promise<void> {
  await zBaza(async (s) => {
    await s`delete from public.comments where package_id in (select p.id from public.packages p join public.clients c on c.id = p.client_id where c.slug = ${slug})`;
    await s`delete from public.clients where slug = ${slug}`;
  });
}
