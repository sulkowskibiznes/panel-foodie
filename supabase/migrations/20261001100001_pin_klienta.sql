-- Plan domknięcia, Etap 2 (2026-09-29): własny PIN klienta.
-- Zespół wydaje jednorazowy kod startowy (6 cyfr z crypto.randomBytes, ważny 7 dni); po jego wpisaniu klient od razu
-- ustawia własny PIN (4-6 cyfr) i może go później zmienić. PIN hashowany argon2id z pieprzem (HMAC-SHA256 kluczem
-- PIN_PEPPER) po stronie aplikacji: kopia bazy bez zmiennych Vercela nie wystarcza do złamania PIN-u offline.
-- Każda zmiana hasha podbija `pin_version`; sesja z inną wersją przestaje działać.

alter table public.access_links
  add column pin_temporary boolean not null default true,
  add column pin_temporary_expires_at timestamptz,
  add column pin_set_at timestamptz,
  add column pin_version integer not null default 1,
  -- domyślnie false: link wstawiony starym kodem między migracją a wdrożeniem ma hash bez pieprzu
  add column pin_pepper boolean not null default false,
  add column frozen_at timestamptz,
  add column last_lockout_24h_at timestamptz,
  add constraint access_links_kod_startowy_check check (pin_temporary or pin_temporary_expires_at is null);

comment on column public.access_links.pin_temporary is 'true = w pin_hash jest kod startowy od zespołu; po jego wpisaniu klient musi ustawić własny PIN';
comment on column public.access_links.pin_temporary_expires_at is 'termin kodu startowego (7 dni); null przy kodzie z czasów przed Etapem 2';
comment on column public.access_links.pin_pepper is 'false = hash sprzed Etapu 2, bez pieprzu; znika przy pierwszym ustawieniu PIN-u';
comment on column public.access_links.frozen_at is 'druga blokada 24 h w ciągu 30 dni: link zamrożony do decyzji zespołu (nowy kod startowy)';

-- Istniejące linki: PIN wydany przez zespół (bez pieprzu) działa dalej jako kod startowy bez terminu;
-- przy następnym logowaniu klient ustawi własny PIN. Nowy kod zawsze zapisuje pin_pepper = true jawnie.
update public.access_links set pin_pepper = false, pin_temporary = true, pin_temporary_expires_at = null;

alter table public.client_sessions
  add column pin_version integer not null default 1,
  add column remember boolean not null default true;

comment on column public.client_sessions.pin_version is 'wersja PIN-u linku z chwili logowania; inna niż access_links.pin_version = sesja nieważna';
comment on column public.client_sessions.remember is '„Zapamiętaj mnie": true = 90 dni przesuwnie (maks. 180 od utworzenia), false = 12 h bezwzględnie';

-- Każda zmiana hasha PIN-u (reset przez zespół, ustawienie i zmiana przez klienta) podbija wersję.
create or replace function public.podbij_wersje_pinu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pin_hash is distinct from old.pin_hash then
    new.pin_version := old.pin_version + 1;
  end if;
  return new;
end;
$$;

create trigger access_links_wersja_pinu
before update of pin_hash on public.access_links
for each row execute function public.podbij_wersje_pinu();

revoke all on function public.podbij_wersje_pinu() from public, anon, authenticated;

-- Zapis PIN-u z porównaniem wersji (CAS): kod startowy jest jednorazowy, a równoległe zmiany i reset nie nadpisują
-- się nawzajem. `p_tymczasowy` = nowy kod startowy od zespołu (odmraża link, zeruje „ustawiony przez klienta").
-- Zwraca nową wersję albo null, gdy wersja się nie zgadza, link jest wygaszony albo zamrożony.
create or replace function public.ustaw_pin_klienta(p_link uuid, p_wersja integer, p_hash text, p_tymczasowy boolean, p_wygasa timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wersja integer;
begin
  update public.access_links a set
    pin_hash = p_hash,
    pin_pepper = true,
    pin_temporary = p_tymczasowy,
    pin_temporary_expires_at = case when p_tymczasowy then p_wygasa else null end,
    pin_set_at = case when p_tymczasowy then null else now() end,
    failed_attempts = 0,
    failed_window_started_at = null,
    locked_until = null,
    frozen_at = case when p_tymczasowy then null else a.frozen_at end
  where a.id = p_link
    and a.pin_version = p_wersja
    and a.revoked_at is null
    and (p_tymczasowy or a.frozen_at is null)
  returning a.pin_version into v_wersja;
  return v_wersja;
end;
$$;

revoke all on function public.ustaw_pin_klienta(uuid, integer, text, boolean, timestamptz) from public, anon, authenticated;

-- Liczba nieudanych prób po kolejnej: okno 24 h (wcześniej 1 h, co dawało ok. 190 prób na dobę na link).
create or replace function public.proby_po_bledzie(p_okno timestamptz, p_proby integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select case when p_okno is null or p_okno < now() - interval '24 hours' then 1 else p_proby + 1 end;
$$;

revoke all on function public.proby_po_bledzie(timestamptz, integer) from public, anon, authenticated;

-- Próba PIN-u w dwóch krokach (przegląd Etapu 2): równoległe żądania nie mogą ominąć blokady, więc próbę rezerwujemy
-- ZANIM aplikacja policzy argon2. Rezerwacja pod blokadą wiersza (FOR UPDATE) nabija licznik jak nieudaną próbę,
-- od razu nakłada blokady (15 min od 5., 24 h od 10.) i mówi, czy wolno weryfikować: tylko gdy wiersz nie był
-- zablokowany ani zamrożony PRZED tą próbą. Każde żądanie dostaje własny numer próby. Po weryfikacji:
-- porażka → potwierdz_nieudana_probe_pinu (jeden alarm przy 10., zamrożenie przy drugiej blokadzie 24 h w 30 dni),
-- sukces → zeruj_proby_pinu (tylko jeśli nikt w międzyczasie nie dołożył próby).
drop function public.odnotuj_nieudane_logowanie(uuid);

create function public.zarezerwuj_probe_pinu(p_link_id uuid)
returns table (dozwolona boolean, proby int, zamrozony boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_okno timestamptz;
  v_proby int;
  v_blokada timestamptz;
  v_zamrozony timestamptz;
  v_nowe int;
begin
  select a.failed_window_started_at, a.failed_attempts, a.locked_until, a.frozen_at
    into v_okno, v_proby, v_blokada, v_zamrozony
    from public.access_links a
    where a.id = p_link_id
    for update;
  if not found then
    -- nieistniejący link (zły token): ta sama liczba zapytań, nic do zapisania
    return query select true, 0, false;
    return;
  end if;

  v_nowe := public.proby_po_bledzie(v_okno, v_proby);
  update public.access_links a set
    failed_attempts = v_nowe,
    failed_window_started_at = case when v_okno is null or v_okno < now() - interval '24 hours' then now() else v_okno end,
    locked_until = case
      when v_nowe >= 10 then greatest(coalesce(v_blokada, now()), now() + interval '24 hours')
      when v_nowe >= 5 then greatest(coalesce(v_blokada, now()), now() + interval '15 minutes')
      else v_blokada end
  where a.id = p_link_id;

  return query select (v_zamrozony is null and (v_blokada is null or v_blokada <= now())), v_nowe, v_zamrozony is not null;
end;
$$;

revoke all on function public.zarezerwuj_probe_pinu(uuid) from public, anon, authenticated;

-- Potwierdzona porażka próby o numerze p_proby. Alarm 24 h tylko dla próby nr 10 (każda próba ma własny numer,
-- więc alarm jest jeden); ta sama próba zapisuje blokadę 24 h i zamraża link, gdy poprzednia była w ciągu 30 dni.
create function public.potwierdz_nieudana_probe_pinu(p_link_id uuid, p_proby int)
returns table (blokada_24h boolean, zamrozony boolean, zablokowany_do timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_zamrozony timestamptz;
  v_do timestamptz;
begin
  if p_proby <> 10 then
    return query select false, false, (select a.locked_until from public.access_links a where a.id = p_link_id);
    return;
  end if;
  update public.access_links a set
    last_lockout_24h_at = now(),
    frozen_at = case when a.last_lockout_24h_at > now() - interval '30 days' then coalesce(a.frozen_at, now()) else a.frozen_at end
  where a.id = p_link_id
  returning a.frozen_at, a.locked_until into v_zamrozony, v_do;
  return query select found, coalesce(v_zamrozony = now(), false), v_do;
end;
$$;

revoke all on function public.potwierdz_nieudana_probe_pinu(uuid, int) from public, anon, authenticated;

-- Udana próba o numerze p_proby: zerowanie licznika i blokad, ale tylko gdy po naszej rezerwacji nikt nie dołożył
-- próby (równoległe błędne próby zostają policzone). Zwraca, czy wyzerowano.
create function public.zeruj_proby_pinu(p_link_id uuid, p_proby int)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with z as (
    update public.access_links a
      set failed_attempts = 0, failed_window_started_at = null, locked_until = null, last_used_at = now()
      where a.id = p_link_id and a.failed_attempts = p_proby
      returning a.id
  )
  select exists (select 1 from z);
$$;

revoke all on function public.zeruj_proby_pinu(uuid, int) from public, anon, authenticated;
