-- Podsumowanie pakietów per klient i lokal (przegląd Etapu 3 planu domknięcia).
-- Pulpit („Klienci bez pakietu na następny okres") i lista klientów ściągały całą tabelę packages, a PostgREST
-- ucina odpowiedź na max_rows = 1000 bez błędu: przy 80 klientach tabela przekracza to w ciągu roku i część
-- klientów znikałaby z list albo pokazywała zły koniec okresu. Agregacja idzie w bazie: jeden wiersz na parę
-- (klient, lokal), czyli najwyżej kilkaset wierszy. Dla kat1 (osobny pakiet na lokal) pulpit ocenia każdy lokal osobno.
create function public.podsumowanie_pakietow(p_client_ids uuid[] default null)
returns table (client_id uuid, location_id uuid, ostatni_do date, do_akceptacji integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.client_id,
         p.location_id,
         max(p.period_to) as ostatni_do,
         count(*) filter (where p.status = 'do_akceptacji')::integer as do_akceptacji
    from public.packages p
   where p_client_ids is null or p.client_id = any (p_client_ids)
   group by p.client_id, p.location_id;
$$;

revoke all on function public.podsumowanie_pakietow(uuid[]) from public, anon, authenticated;
