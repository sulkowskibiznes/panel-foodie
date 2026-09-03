-- 1.4, rozdz. 20 poz. 21: klient demonstracyjny istnieje także na produkcji i ma flagę,
-- której nie da się obejść z interfejsu: baza odrzuca link dostępu i fakturę dla takiego klienta.

alter table public.clients
  add column demo boolean not null default false;

comment on column public.clients.demo is
  'Klient demonstracyjny dla roli sales: bez linków dostępu i faktur (trigger zablokuj_dla_klienta_demo).';

create or replace function public.zablokuj_dla_klienta_demo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.clients c where c.id = new.client_id and c.demo) then
    raise exception 'Klient demonstracyjny nie może mieć wiersza w tabeli %', tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger access_links_bez_klienta_demo
  before insert or update of client_id on public.access_links
  for each row execute function public.zablokuj_dla_klienta_demo();

create trigger invoices_bez_klienta_demo
  before insert or update of client_id on public.invoices
  for each row execute function public.zablokuj_dla_klienta_demo();
