-- Import z Dysku Google na wklejanych linkach (SPEC rozdz. 13).

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  package_id uuid references public.packages(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  item_id uuid references public.package_items(id) on delete cascade,  -- dla podmiany
  kind public.import_kind not null,
  source_url text not null,
  source_folder_id text,
  status public.import_status not null default 'oczekuje',
  files_total int,
  files_done int,
  warnings jsonb not null default '[]',
  error text,
  created_by uuid references public.team_members(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.import_jobs enable row level security;
create index import_jobs_source_folder_idx on public.import_jobs (source_folder_id);  -- powtórny import
create index import_jobs_package_idx on public.import_jobs (package_id);
