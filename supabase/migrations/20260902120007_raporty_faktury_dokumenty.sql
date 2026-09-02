-- Raporty, faktury, dokumenty (SPEC rozdz. 9, 10).

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,  -- kat1: raport per lokal
  period_year int not null check (period_year between 2024 and 2100),
  period_month int not null check (period_month between 1 and 12),
  title text not null,
  url text not null,                           -- https://raporty.foodiemedia.pl/r/<token>; host walidowany w kodzie
  cooperation_month int,
  published_at timestamptz not null default now(),
  source public.report_source not null default 'reczne',
  unique nulls not distinct (client_id, location_id, period_year, period_month)
);
alter table public.reports enable row level security;
create index reports_client_idx on public.reports (client_id, period_year desc, period_month desc);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  number text not null,
  issue_date date not null,
  due_date date not null,
  amount_net numeric(10,2) not null,
  amount_gross numeric(10,2) not null,
  status public.invoice_status not null default 'do_zaplaty',
  paid_at date,
  pdf_path text,
  fakturowo_id text,                           -- rezerwa pod ewentualną integrację
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, number)
);
-- 'po_terminie' NIE jest wpisywane ręcznie: cron przestawia status, gdy due_date < today i status = 'do_zaplaty'.
alter table public.invoices enable row level security;
create index invoices_client_status_idx on public.invoices (client_id, status);
create index invoices_overdue_idx on public.invoices (due_date) where status = 'do_zaplaty';
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind public.document_kind not null,
  title text not null,
  file_path text not null,
  valid_from date,
  uploaded_by uuid references public.team_members(id),
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create index documents_client_idx on public.documents (client_id);
