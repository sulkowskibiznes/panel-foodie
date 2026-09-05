-- Import z Dysku (SPEC rozdz. 13, faza 4). Zadanie dostaje plan po ekranie mapowania (co, z jakich plików,
-- z jakim opisem), migawkę karty weryfikacyjnej do audytu, bicie serca i licznik prób dla wznowienia
-- po błędzie albo po zabiciu funkcji w połowie. Postęp per plik siedzi w planie (assetId po skopiowaniu),
-- więc ponowienie pomija to, co już jest w Storage i w bazie.

alter table public.import_jobs
  add column plan jsonb not null default '{}',
  add column verification jsonb not null default '{}',
  add column heartbeat_at timestamptz,
  add column started_at timestamptz,
  add column attempts int not null default 0;

create index import_jobs_aktywne_idx on public.import_jobs (package_id, created_at)
  where status in ('oczekuje', 'trwa');
