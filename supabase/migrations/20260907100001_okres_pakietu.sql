-- Okres pakietu jako dowolny zakres dat od-do (decyzja Szymona z 2026-09-05, SPEC rozdz. 20 poz. 35):
-- każdy klient zaczyna miesiąc innego dnia (np. 20.09 do 19.10), a po wstrzymaniu współpraca wraca od innego dnia.
-- Jedno źródło prawdy to period_from i period_to; period_year i period_month oraz unikalność po miesiącu znikają.
-- Nakładające się okresy są dozwolone (panel tylko ostrzega). Raporty (reports) zostają miesięczne.

update public.packages
   set period_from = coalesce(period_from, make_date(period_year, period_month, 1)),
       period_to   = coalesce(period_to, (make_date(period_year, period_month, 1) + interval '1 month - 1 day')::date);

-- Ręcznie ustawiony „dzień zakończenia" przed początkiem: wyrównujemy zamiast wywracać migrację.
update public.packages set period_to = period_from where period_to < period_from;

alter table public.packages
  drop constraint if exists packages_client_id_location_id_period_year_period_month_key,
  drop column period_year,
  drop column period_month,
  alter column period_from set not null,
  alter column period_to set not null,
  add constraint packages_okres_poprawny check (period_to >= period_from),
  add constraint packages_okres_zakres check (period_from >= date '2024-01-01' and period_to <= date '2100-12-31');

create index packages_client_period_from_idx on public.packages (client_id, period_from desc);
