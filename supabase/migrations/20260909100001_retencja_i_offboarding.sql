-- Faza 6 (SPEC rozdz. 17): retencja materiałów z decyzją admina i offboarding klienta.

-- Przegląd retencyjny: cron pierwszego dnia miesiąca zgłasza pakiety, których okres skończył się ponad
-- `retention_months` (ustawienia, domyślnie 24) miesięcy temu. Wiersz bez decyzji czeka na admina; nic nie kasuje
-- się samo. „Zachowaj" odracza zgłoszenie do `keep_until` (12 miesięcy), „Usuń" kasuje pakiet z plikami, a wiersz
-- zostaje jako ślad (package_id -> null, migawka tytułu i okresu w kolumnach).
create type public.retention_decision as enum ('zachowaj', 'usun');

create table public.retention_reviews (
  id uuid primary key default gen_random_uuid(),
  package_id uuid unique references public.packages(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  package_title text not null,
  period_from date not null,
  period_to date not null,
  files_count int not null default 0,
  flagged_at timestamptz not null default now(),
  decision public.retention_decision,
  decided_at timestamptz,
  decided_by uuid references public.team_members(id) on delete set null,
  keep_until timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint retention_reviews_decyzja_spojna check (
    (decision is null and decided_at is null and keep_until is null and deleted_at is null)
    or (decision = 'zachowaj' and decided_at is not null and keep_until is not null and deleted_at is null)
    or (decision = 'usun' and decided_at is not null and deleted_at is not null)
  )
);
alter table public.retention_reviews enable row level security;
create index retention_reviews_oczekujace_idx on public.retention_reviews (flagged_at) where decision is null;
create index retention_reviews_client_idx on public.retention_reviews (client_id, flagged_at desc);

comment on table public.retention_reviews is
  'Zgłoszenia retencyjne (SPEC rozdz. 17): cron oznacza pakiety starsze niż retention_months, admin decyduje. Nic nie kasuje się samo.';

-- Offboarding (SPEC rozdz. 17): „Zakończ współpracę" wygasza linki, wylogowuje sesje i ustawia status zakonczony.
-- Data zakończenia zostaje na karcie klienta; wznowienie ją czyści.
alter table public.clients
  add column if not exists ended_at timestamptz;

comment on column public.clients.ended_at is
  'Kiedy zakończono współpracę (przycisk w Ustawieniach karty klienta). Null = współpraca trwa albo wznowiona.';
