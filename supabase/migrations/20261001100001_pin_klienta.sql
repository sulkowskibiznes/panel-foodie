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
  add column pin_pepper boolean not null default true,
  add column frozen_at timestamptz,
  add column last_lockout_24h_at timestamptz,
  add constraint access_links_kod_startowy_check check (pin_temporary or pin_temporary_expires_at is null);

comment on column public.access_links.pin_temporary is 'true = w pin_hash jest kod startowy od zespołu; po jego wpisaniu klient musi ustawić własny PIN';
comment on column public.access_links.pin_temporary_expires_at is 'termin kodu startowego (7 dni); null przy kodzie z czasów przed Etapem 2';
comment on column public.access_links.pin_pepper is 'false = hash sprzed Etapu 2, bez pieprzu; znika przy pierwszym ustawieniu PIN-u';
comment on column public.access_links.frozen_at is 'druga blokada 24 h w ciągu 30 dni: link zamrożony do decyzji zespołu (nowy kod startowy)';

-- Istniejące linki: PIN wydany przez zespół (bez pieprzu) działa dalej jako kod startowy bez terminu;
-- przy następnym logowaniu klient ustawi własny PIN.
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

-- Nieudana próba PIN-u: licznik, blokada 15 min (od 5.) i 24 h (od 10.) w JEDNYM zapisie, bez drugiego UPDATE
-- (różnica czasu zdradzałaby próg). Wszystkie wyrażenia odwołują się do wiersza docelowego, więc równoległe próby
-- nie gubią inkrementacji. `blokada_24h` tylko przy przejściu na 10 (jeden alarm), druga blokada 24 h w ciągu
-- 30 dni zamraża link (`zamrozony` = zamrożony tym wywołaniem).
drop function public.odnotuj_nieudane_logowanie(uuid);

create function public.odnotuj_nieudane_logowanie(p_link_id uuid)
returns table (proby int, zablokowany_do timestamptz, blokada_24h boolean, zamrozony boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proby int;
  v_do timestamptz;
  v_zamrozony timestamptz;
begin
  update public.access_links a set
    failed_attempts = public.proby_po_bledzie(a.failed_window_started_at, a.failed_attempts),
    failed_window_started_at = case
      when a.failed_window_started_at is null or a.failed_window_started_at < now() - interval '24 hours' then now()
      else a.failed_window_started_at end,
    locked_until = case
      when public.proby_po_bledzie(a.failed_window_started_at, a.failed_attempts) >= 10 then greatest(coalesce(a.locked_until, now()), now() + interval '24 hours')
      when public.proby_po_bledzie(a.failed_window_started_at, a.failed_attempts) >= 5 then greatest(coalesce(a.locked_until, now()), now() + interval '15 minutes')
      else a.locked_until end,
    last_lockout_24h_at = case
      when public.proby_po_bledzie(a.failed_window_started_at, a.failed_attempts) = 10 then now()
      else a.last_lockout_24h_at end,
    frozen_at = case
      when public.proby_po_bledzie(a.failed_window_started_at, a.failed_attempts) = 10 and a.last_lockout_24h_at > now() - interval '30 days' then coalesce(a.frozen_at, now())
      else a.frozen_at end
  where a.id = p_link_id
  returning a.failed_attempts, a.locked_until, a.frozen_at into v_proby, v_do, v_zamrozony;

  if v_proby is null then
    return query select 0, null::timestamptz, false, false;
    return;
  end if;

  return query select v_proby, v_do, v_proby = 10, v_zamrozony is not null and v_zamrozony = now();
end;
$$;

revoke all on function public.odnotuj_nieudane_logowanie(uuid) from public, anon, authenticated;
