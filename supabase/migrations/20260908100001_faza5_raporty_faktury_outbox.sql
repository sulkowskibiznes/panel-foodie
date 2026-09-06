-- Faza 5 (SPEC rozdz. 5.7, 5.8, 9, 10, 15): kolejka outbox z narastającym odstępem między próbami,
-- host adresu raportu pilnowany także w bazie, kanał kontaktu opiekuna pokazywany klientowi,
-- kto z zespołu obsłużył zainteresowanie usługą.

-- Outbox: cron co minutę bierze wiersze `pending`, których `next_attempt_at` minęło. Nieudana próba
-- przesuwa `next_attempt_at` (1, 5, 15, 60 min), piąta nieudana = `failed` (rozdz. 15).
alter table public.outbox
  add column if not exists next_attempt_at timestamptz not null default now();
drop index if exists public.outbox_pending_idx;
create index outbox_pending_idx on public.outbox (next_attempt_at) where status = 'pending';
create index outbox_created_idx on public.outbox (created_at desc);

-- Raporty: adres wyłącznie z systemu raportów (rozdz. 9). Kod waliduje pierwszy; to druga linia obrony,
-- żeby wyciek INGEST_TOKEN nie pozwolił podstawić klientowi obcego adresu nawet z pominięciem walidacji.
alter table public.reports
  add constraint reports_url_host_check check (url ~ '^https://raporty\.foodiemedia\.pl/');

-- „Twój pakiet" (rozdz. 5.7): imię opiekuna plus kanał kontaktu, bez numerów prywatnych zespołu.
-- Wpisuje admin w Ustawienia -> Zespół (np. służbowy WhatsApp albo adres e-mail). Null = ogólny kontakt agencji.
alter table public.team_members
  add column if not exists client_contact text check (char_length(client_contact) <= 200);

-- Zainteresowanie usługą (rozdz. 5.8): kto z zespołu oznaczył je jako załatwione.
alter table public.service_interests
  add column if not exists handled_by uuid references public.team_members(id) on delete set null;
