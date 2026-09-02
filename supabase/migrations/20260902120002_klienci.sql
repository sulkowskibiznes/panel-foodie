-- Klienci, lokale, osoby kontaktowe (SPEC rozdz. 3, 3.1).

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category public.client_category not null,
  tier public.package_tier not null,
  monthly_amount_net numeric(10,2),
  extra_locations_count int not null default 0,
  drive_folder_url text,                       -- folder klienta w „Materiały klientów" (pomocniczo)
  slack_channel text,
  status public.client_status not null default 'aktywny',
  cooperation_started_on date,
  timezone text not null default 'Europe/Warsaw',
  opiekun_id uuid,                             -- FK do team_members dodawany w migracji zespołu
  auto_approve_default boolean not null default true,
  auto_approve_hours int check (auto_approve_hours is null or auto_approve_hours between 1 and 720),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- UWAGA: żadnego logo ani kolorów klienta. Panel jest w 100% w brandingu Foodie Media.
alter table public.clients enable row level security;
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  city text,
  address text,
  fb_page_name text not null,                  -- nazwa strony na FB, używana w podglądach 1:1
  ig_handle text,                              -- nick IG, używany w placementach reklamowych IG
  avatar_path text,                            -- zdjęcie profilowe strony, WYŁĄCZNIE wewnątrz ramki podglądu
  separate_materials boolean not null default false,
  position int not null default 0
);
alter table public.locations enable row level security;
create index locations_client_id_idx on public.locations (client_id, position);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  role_label text,                             -- „właściciel", „manager", „wspólniczka"
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.client_contacts enable row level security;
create index client_contacts_client_id_idx on public.client_contacts (client_id);
