import { config as dotenv } from "dotenv";
import postgres from "postgres";

dotenv({ path: ".env.local" });

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

export type StatusTestowy = "szkic" | "do_akceptacji" | "poprawki" | "zaakceptowany" | "zaplanowany";

export type OpcjeKlonu = {
  rok: number;
  miesiac: number;
  status?: StatusTestowy;
  /** godziny temu; domyślnie 24 */
  wyslanoGodzinTemu?: number;
  /** godziny od teraz do auto-akceptacji; null = brak terminu; domyślnie 48 */
  autoZaGodzin?: number | null;
  autoWlaczona?: boolean;
};

export type PlikTestow = "akceptacja" | "cron" | "reklamy" | "zespol" | "harmonogram" | "kreator" | "skrzynka";
const ROK_PLIKU: Record<PlikTestow, number> = { akceptacja: 2027, cron: 2028, reklamy: 2029, zespol: 2030, harmonogram: 2031, kreator: 2032, skrzynka: 2033 };

/**
 * Okres na klony: osobny rok na plik testów i osobne półrocze na projekt Playwrighta (mobile 1-6, desktop 7-12),
 * żeby równoległe pliki i projekty nie kolidowały na unique (client, location, rok, miesiac). Przesunięcie 0-5.
 */
export function okresDlaProjektu(nazwaProjektu: string, plik: PlikTestow, przesuniecie = 0): { rok: number; miesiac: number } {
  if (przesuniecie < 0 || przesuniecie > 5) throw new Error("przesuniecie musi być w zakresie 0-5");
  const baza = nazwaProjektu.startsWith("mobile") ? 1 : 7;
  return { rok: ROK_PLIKU[plik], miesiac: baza + przesuniecie };
}

/**
 * Kopia pierwszego pakietu klienta z seedu w innym miesiącu: kampanie, materiały, pliki (te same ścieżki
 * w Storage), warianty. Testy zmieniające status pracują na klonie, seed zostaje nietknięty.
 */
export async function sklonujPakiet(slug: string, o: OpcjeKlonu): Promise<{ id: string; clientId: string }> {
  const status = o.status ?? "do_akceptacji";
  const wyslano = status === "szkic" ? null : new Date(Date.now() - (o.wyslanoGodzinTemu ?? 24) * 3_600_000).toISOString();
  const auto = o.autoZaGodzin === null || status === "szkic" ? null : new Date(Date.now() + (o.autoZaGodzin ?? 48) * 3_600_000).toISOString();
  return zBaza((s) =>
    s.begin(async (tx) => {
      const [zrodlo] = await tx<{ id: string; client_id: string }[]>`
        select p.id, p.client_id from public.packages p join public.clients c on c.id = p.client_id
        where c.slug = ${slug} order by p.created_at limit 1`;
      if (!zrodlo) throw new Error(`Brak pakietu klienta ${slug}`);
      // Pozostałość po przerwanym przebiegu w tym samym okresie: sprzątamy, zamiast wywracać test na unique.
      await tx`delete from public.comments where package_id in (select id from public.packages where client_id = ${zrodlo.client_id} and period_year = ${o.rok} and period_month = ${o.miesiac} and title like '% (test E2E)')`;
      await tx`delete from public.packages where client_id = ${zrodlo.client_id} and period_year = ${o.rok} and period_month = ${o.miesiac} and title like '% (test E2E)'`;
      const zaakceptowano = status === "zaakceptowany" || status === "zaplanowany" ? new Date().toISOString() : null;
      const [nowy] = await tx<{ id: string }[]>`
        insert into public.packages (client_id, location_id, period_year, period_month, cooperation_month, title, status, round,
          submitted_at, auto_approve_enabled, auto_approve_at, approved_at, approval_kind, period_from, period_to, created_by)
        select client_id, location_id, ${o.rok}, ${o.miesiac}, cooperation_month, title || ' (test E2E)', ${status}::public.package_status, 1,
          ${wyslano}::timestamptz, ${o.autoWlaczona ?? true}, ${auto}::timestamptz, ${zaakceptowano}::timestamptz,
          ${zaakceptowano ? "reczna" : null}::public.approval_kind, period_from, period_to, created_by
        from public.packages where id = ${zrodlo.id} returning id`;
      if (!nowy) throw new Error("Nie udało się sklonować pakietu");
      await tx`create temp table map_k on commit drop as select id as old_id, gen_random_uuid() as new_id from public.campaigns where package_id = ${zrodlo.id}`;
      await tx`insert into public.campaigns (id, package_id, name, goal, position, note)
        select m.new_id, ${nowy.id}, c.name, c.goal, c.position, c.note from public.campaigns c join map_k m on m.old_id = c.id`;
      await tx`create temp table map_m on commit drop as select id as old_id, gen_random_uuid() as new_id from public.package_items where package_id = ${zrodlo.id}`;
      await tx`insert into public.package_items (id, package_id, campaign_id, type, position, title, caption, publish_at, location_ids, origin)
        select mm.new_id, ${nowy.id}, mk.new_id, i.type, i.position, i.title, i.caption, i.publish_at, i.location_ids, i.origin
        from public.package_items i join map_m mm on mm.old_id = i.id left join map_k mk on mk.old_id = i.campaign_id`;
      await tx`create temp table map_p on commit drop as select a.id as old_id, gen_random_uuid() as new_id from public.item_assets a join map_m mm on mm.old_id = a.item_id`;
      await tx`insert into public.item_assets (id, item_id, kind, storage_path, preview_path, thumb_path, original_name, mime, bytes, width, height, duration_ms, position)
        select mp.new_id, mm.new_id, a.kind, a.storage_path, a.preview_path, a.thumb_path, a.original_name, a.mime, a.bytes, a.width, a.height, a.duration_ms, a.position
        from public.item_assets a join map_p mp on mp.old_id = a.id join map_m mm on mm.old_id = a.item_id`;
      await tx`insert into public.ad_variants (item_id, kind, position, label, value_text, asset_id, location_id)
        select mm.new_id, v.kind, v.position, v.label, v.value_text, mp.new_id, v.location_id
        from public.ad_variants v join map_m mm on mm.old_id = v.item_id left join map_p mp on mp.old_id = v.asset_id`;
      return { id: nowy.id, clientId: zrodlo.client_id };
    }),
  );
}

/** Kasuje klon (kaskada); pliki w Storage są wspólne z seedem i zostają. */
export async function usunPakiet(id: string): Promise<void> {
  await zBaza(async (s) => {
    await s`delete from public.comments where package_id = ${id}`;
    await s`delete from public.packages where id = ${id}`;
  });
}

export type StanPakietu = {
  status: StatusTestowy;
  round: number;
  submitted_at: string | null;
  first_opened_at: string | null;
  auto_approve_enabled: boolean;
  auto_approve_at: string | null;
  approved_at: string | null;
  approved_by_contact_id: string | null;
  approval_kind: "reczna" | "automatyczna" | null;
};

export async function stanPakietu(id: string): Promise<StanPakietu> {
  return zBaza(async (s) => {
    const [w] = await s<StanPakietu[]>`select status, round, submitted_at, first_opened_at, auto_approve_enabled, auto_approve_at, approved_at, approved_by_contact_id, approval_kind from public.packages where id = ${id}`;
    if (!w) throw new Error(`Brak pakietu ${id}`);
    return w;
  });
}

export async function ustawPakiet(id: string, zmiany: Partial<Pick<StanPakietu, "status" | "auto_approve_at" | "auto_approve_enabled" | "submitted_at" | "round">>): Promise<void> {
  await zBaza(async (s) => {
    if (zmiany.status !== undefined) await s`update public.packages set status = ${zmiany.status}::public.package_status where id = ${id}`;
    if (zmiany.auto_approve_at !== undefined) await s`update public.packages set auto_approve_at = ${zmiany.auto_approve_at}::timestamptz where id = ${id}`;
    if (zmiany.auto_approve_enabled !== undefined) await s`update public.packages set auto_approve_enabled = ${zmiany.auto_approve_enabled} where id = ${id}`;
    if (zmiany.submitted_at !== undefined) await s`update public.packages set submitted_at = ${zmiany.submitted_at}::timestamptz where id = ${id}`;
    if (zmiany.round !== undefined) await s`update public.packages set round = ${zmiany.round} where id = ${id}`;
  });
}

export type MaterialTestowy = { id: string; type: "post" | "relacja" | "reels" | "reklama"; position: number; title: string | null; campaign_id: string | null };

export async function materialyPakietu(id: string): Promise<MaterialTestowy[]> {
  return zBaza((s) => s<MaterialTestowy[]>`select id, type, position, title, campaign_id from public.package_items where package_id = ${id} order by type, position`);
}

export type WariantTestowy = { id: string; kind: "grafika" | "tekst" | "naglowek" | "opis" | "cta" | "link"; position: number; value_text: string | null; asset_id: string | null; location_id: string | null };

export async function wariantyMaterialu(itemId: string): Promise<WariantTestowy[]> {
  return zBaza((s) => s<WariantTestowy[]>`select id, kind, position, value_text, asset_id, location_id from public.ad_variants where item_id = ${itemId} order by kind, location_id nulls first, position`);
}

/** Materiał „poprawiony w rundzie" (podmiana dochodzi w fazie 3; tu ustawiamy flagę wprost). */
export async function oznaczPoprawiony(itemId: string, runda: number): Promise<void> {
  await zBaza((s) => s`update public.package_items set updated_in_round = ${runda} where id = ${itemId}`);
}

export type KomentarzTestowy = { id: string; item_id: string | null; variant_id: string | null; author_kind: "klient" | "zespol"; body: string; round: number; after_approval: boolean; resolved_at: string | null; seen_by_team_at: string | null };

export async function komentarzePakietu(id: string): Promise<KomentarzTestowy[]> {
  return zBaza((s) => s<KomentarzTestowy[]>`select id, item_id, variant_id, author_kind, body, round, after_approval, resolved_at, seen_by_team_at from public.comments where package_id = ${id} order by created_at`);
}

/** Uwaga klienta wstawiona wprost (do ustawiania scenariuszy, np. wstrzymanej auto-akceptacji). */
export async function dodajUwageKlienta(pakietId: string, itemId: string | null, body: string, runda = 1): Promise<string> {
  return zBaza(async (s) => {
    const [w] = await s<{ id: string }[]>`insert into public.comments (package_id, item_id, author_kind, author_label, body, round) values (${pakietId}, ${itemId}, 'klient', 'Test E2E', ${body}, ${runda}) returning id`;
    if (!w) throw new Error("Nie udało się dodać uwagi");
    return w.id;
  });
}

export async function liczbaZdarzenOutbox(event: string, pakietId: string): Promise<number> {
  return zBaza(async (s) => {
    const [w] = await s<{ n: number }[]>`select count(*)::int as n from public.outbox where event = ${event} and payload->>'package_id' = ${pakietId}`;
    return w?.n ?? 0;
  });
}

export async function liczbaZdarzenPakietu(pakietId: string, kind: string): Promise<number> {
  return zBaza(async (s) => {
    const [w] = await s<{ n: number }[]>`select count(*)::int as n from public.package_events where package_id = ${pakietId} and kind = ${kind}::public.package_event_kind`;
    return w?.n ?? 0;
  });
}

export async function ostatnieZdarzenie(pakietId: string, kind: string): Promise<Record<string, unknown> | null> {
  return zBaza(async (s) => {
    const [w] = await s<{ payload: Record<string, unknown> }[]>`select payload from public.package_events where package_id = ${pakietId} and kind = ${kind}::public.package_event_kind order by created_at desc limit 1`;
    return w?.payload ?? null;
  });
}

/** Wartość jako JSON (boolean, liczba), nie jako napis: `"true"` w jsonb to nie to samo, co `true`. */
export async function ustawUstawienie(klucz: string, wartosc: boolean | number): Promise<void> {
  await zBaza((s) => s`insert into public.settings (key, value) values (${klucz}, ${s.json(wartosc)}) on conflict (key) do update set value = excluded.value`);
}

/** Seedowe pakiety po terminie dostają odległy termin, żeby test crona nie zmieniał danych z seedu. */
export async function odsunTerminySeedu(wyjatki: string[]): Promise<void> {
  await zBaza((s) => s`update public.packages set auto_approve_at = now() + interval '30 days' where status = 'do_akceptacji' and auto_approve_at < now() and id <> all(${wyjatki}::uuid[])`);
}

/** Sprząta wszystkie klony testowe (po przerwanym przebiegu); wołane z global-setup. */
export async function usunWszystkieKlony(): Promise<number> {
  return zBaza(async (s) => {
    await s`delete from public.comments where package_id in (select id from public.packages where title like '% (test E2E)')`;
    const usuniete = await s`delete from public.packages where title like '% (test E2E)' returning id`;
    return usuniete.length;
  });
}

export async function wpisyAudytuPakietu(pakietId: string, action: string): Promise<number> {
  return zBaza(async (s) => {
    const [w] = await s<{ n: number }[]>`select count(*)::int as n from public.audit_log where entity_id = ${pakietId}::uuid and action = ${action}`;
    return w?.n ?? 0;
  });
}

export type PlikTestowyMaterialu = { id: string; position: number; storage_path: string; superseded_at: string | null; superseded_by: string | null; original_name: string | null };

/** Pliki materiału z historią podmian (kryterium 20: stary plik zostaje z superseded_at). */
export async function plikiMaterialu(itemId: string): Promise<PlikTestowyMaterialu[]> {
  return zBaza((s) => s<PlikTestowyMaterialu[]>`select id, position, storage_path, superseded_at, superseded_by, original_name from public.item_assets where item_id = ${itemId} order by created_at`);
}

export async function stanMaterialu(itemId: string): Promise<{ updated_in_round: number | null; added_after_submit: boolean; publish_at: string | null; title: string | null; caption: string | null } | null> {
  return zBaza(async (s) => {
    const [w] = await s<{ updated_in_round: number | null; added_after_submit: boolean; publish_at: string | null; title: string | null; caption: string | null }[]>`select updated_in_round, added_after_submit, publish_at, title, caption from public.package_items where id = ${itemId}`;
    return w ?? null;
  });
}

export async function ustawDatePublikacji(itemId: string, publishAt: string | null): Promise<void> {
  await zBaza((s) => s`update public.package_items set publish_at = ${publishAt}::timestamptz where id = ${itemId}`);
}

export async function flagaPoAkceptacji(pakietId: string): Promise<boolean> {
  return zBaza(async (s) => {
    const [w] = await s<{ changed_after_approval: boolean }[]>`select changed_after_approval from public.packages where id = ${pakietId}`;
    return w?.changed_after_approval ?? false;
  });
}

/** Wpisy audytu danej akcji dla klienta (np. wejście w podgląd „Zobacz jak klient", kryterium 25). */
export async function wpisyAudytuKlienta(clientId: string, action: string, od: Date): Promise<number> {
  return zBaza(async (s) => {
    const [w] = await s<{ n: number }[]>`select count(*)::int as n from public.audit_log where client_id = ${clientId}::uuid and action = ${action} and created_at >= ${od.toISOString()}::timestamptz`;
    return w?.n ?? 0;
  });
}

/** Id klienta po slugu. */
export async function idKlienta(slug: string): Promise<string> {
  return zBaza(async (s) => {
    const [w] = await s<{ id: string }[]>`select id from public.clients where slug = ${slug}`;
    if (!w) throw new Error(`Brak klienta ${slug}`);
    return w.id;
  });
}

export type SzczegolyPakietu = { status: StatusTestowy; content_folder_id: string | null; content_folder_url: string | null; location_id: string | null; cooperation_month: number | null; kampanie: Array<{ name: string; goal: string | null; ads_folder_id: string | null; position: number }>; reklamy: number };

/** Pakiet z kreatora: foldery, lokal, kampanie i liczba materiałów `reklama` (SPEC rozdz. 12.3). */
export async function szczegolyPakietu(id: string): Promise<SzczegolyPakietu> {
  return zBaza(async (s) => {
    const [p] = await s<Array<Omit<SzczegolyPakietu, "kampanie" | "reklamy">>>`select status, content_folder_id, content_folder_url, location_id, cooperation_month from public.packages where id = ${id}`;
    if (!p) throw new Error(`Brak pakietu ${id}`);
    const kampanie = await s<SzczegolyPakietu["kampanie"]>`select name, goal, ads_folder_id, position from public.campaigns where package_id = ${id} order by position`;
    const [r] = await s<{ n: number }[]>`select count(*)::int as n from public.package_items where package_id = ${id} and type = 'reklama'`;
    return { ...p, kampanie, reklamy: r?.n ?? 0 };
  });
}

export async function pochodzenieMaterialu(itemId: string): Promise<string | null> {
  return zBaza(async (s) => {
    const [w] = await s<{ origin: string }[]>`select origin from public.package_items where id = ${itemId}`;
    return w?.origin ?? null;
  });
}
