-- Etap 1 domknięcia (plan 2026-09-29): cykl życia klienta w panelu zespołu.
-- Nie rusza packages, package_items ani ad_variants.

-- Osoby kontaktowe: dezaktywacja zamiast usuwania (komentarze i akceptacje wskazują osobę). Przy dezaktywacji
-- aplikacja zeruje telefon i e-mail (RODO), imię zostaje do historii akceptacji.
alter table public.client_contacts
  add column if not exists archived_at timestamptz;

comment on column public.client_contacts.archived_at is
  'Osoba już nie współpracuje z agencją: znika z wyboru przy nowym linku, telefon i e-mail wyzerowane, imię zostaje w historii.';

-- Auto-akceptacja per klient: regulamin § 5 pozwala termin wyłącznie wydłużyć (72 h to minimum).
alter table public.clients drop constraint if exists clients_auto_approve_hours_check;
alter table public.clients
  add constraint clients_auto_approve_hours_check check (auto_approve_hours is null or auto_approve_hours between 72 and 720);

-- Nowy klient w jednej transakcji: wiersz klienta, lokale, osoby kontaktowe i przypisania zespołu.
-- Błąd w dowolnym kroku (np. zajęty slug: 23505) cofa całość, więc nie zostaje klient bez lokali.
create or replace function public.utworz_klienta(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_lokal jsonb;
  v_kontakt jsonb;
  v_czlonek text;
  v_i int := 0;
begin
  insert into public.clients (name, slug, category, tier, monthly_amount_net, extra_locations_count, slack_channel, cooperation_started_on, opiekun_id)
  values (
    p->>'name',
    p->>'slug',
    (p->>'category')::public.client_category,
    (p->>'tier')::public.package_tier,
    nullif(p->>'monthly_amount_net', '')::numeric,
    greatest(0, jsonb_array_length(coalesce(p->'lokale', '[]'::jsonb)) - 1),
    nullif(p->>'slack_channel', ''),
    nullif(p->>'cooperation_started_on', '')::date,
    nullif(p->>'opiekun_id', '')::uuid
  )
  returning id into v_id;

  for v_lokal in select * from jsonb_array_elements(coalesce(p->'lokale', '[]'::jsonb)) loop
    insert into public.locations (client_id, name, city, fb_page_name, ig_handle, separate_materials, position)
    values (v_id, v_lokal->>'name', nullif(v_lokal->>'city', ''), v_lokal->>'fb_page_name', nullif(v_lokal->>'ig_handle', ''), (p->>'category') = 'kat1', v_i);
    v_i := v_i + 1;
  end loop;

  v_i := 0;
  for v_kontakt in select * from jsonb_array_elements(coalesce(p->'kontakty', '[]'::jsonb)) loop
    insert into public.client_contacts (client_id, name, role_label, phone, email, is_primary)
    values (v_id, v_kontakt->>'name', nullif(v_kontakt->>'role_label', ''), nullif(v_kontakt->>'phone', ''), nullif(v_kontakt->>'email', ''), v_i = 0);
    v_i := v_i + 1;
  end loop;

  for v_czlonek in select jsonb_array_elements_text(coalesce(p->'przypisani', '[]'::jsonb)) loop
    insert into public.client_assignments (client_id, team_member_id)
    select v_id, t.id from public.team_members t where t.id = v_czlonek::uuid and t.active
    on conflict do nothing;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.utworz_klienta(jsonb) from public, anon, authenticated;
