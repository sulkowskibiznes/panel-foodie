-- Funkcje atomowe do logowania klienta (SPEC rozdz. 4.3). Wywoływane kluczem secret przez RPC.

-- Limit prób na klucz (np. 'pin:ip:<hash>'): zwraca liczbę prób w bieżącym oknie.
create or replace function public.zwieksz_limit(p_key text, p_okno_sekund int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.rate_limits as r (key, window_started_at, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when r.window_started_at < now() - make_interval(secs => p_okno_sekund) then 1 else r.count + 1 end,
    window_started_at = case when r.window_started_at < now() - make_interval(secs => p_okno_sekund) then now() else r.window_started_at end
  returning r.count into v_count;
  return v_count;
end;
$$;

-- Nieudana próba PIN-u: 5 w oknie godziny → blokada 15 min, 10 → 24 h (blokada_24h = true → zdarzenie do outbox).
create or replace function public.odnotuj_nieudane_logowanie(p_link_id uuid)
returns table (proby int, zablokowany_do timestamptz, blokada_24h boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proby int;
  v_blokada timestamptz;
  v_24h boolean := false;
begin
  update public.access_links a set
    failed_attempts = case when a.failed_window_started_at is null or a.failed_window_started_at < now() - interval '1 hour' then 1 else a.failed_attempts + 1 end,
    failed_window_started_at = case when a.failed_window_started_at is null or a.failed_window_started_at < now() - interval '1 hour' then now() else a.failed_window_started_at end
  where a.id = p_link_id
  returning a.failed_attempts into v_proby;

  if v_proby is null then
    return query select 0, null::timestamptz, false;
    return;
  end if;

  if v_proby >= 10 then
    v_blokada := now() + interval '24 hours';
    v_24h := true;
  elsif v_proby >= 5 then
    v_blokada := now() + interval '15 minutes';
  end if;

  if v_blokada is not null then
    update public.access_links a set locked_until = greatest(coalesce(a.locked_until, v_blokada), v_blokada) where a.id = p_link_id;
  end if;

  return query select v_proby, v_blokada, v_24h;
end;
$$;

revoke all on function public.zwieksz_limit(text, int) from public, anon, authenticated;
revoke all on function public.odnotuj_nieudane_logowanie(uuid) from public, anon, authenticated;
