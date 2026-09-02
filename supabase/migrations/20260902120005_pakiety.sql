-- Pakiety materiałów: serce systemu (SPEC rozdz. 3, 6).

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,  -- null = wspólny dla klienta
  period_year int not null check (period_year between 2024 and 2100),
  period_month int not null check (period_month between 1 and 12),
  cooperation_month int,
  title text,                                  -- domyślnie „Materiały - wrzesień 2026"
  status public.package_status not null default 'szkic',
  round int not null default 1,
  content_folder_url text,                     -- WKLEJONY przez content creatora
  content_folder_id text,
  submitted_at timestamptz,
  first_opened_at timestamptz,
  auto_approve_enabled boolean not null default true,
  auto_approve_at timestamptz,
  approved_at timestamptz,
  approved_by_contact_id uuid references public.client_contacts(id),
  approval_kind public.approval_kind,
  changed_after_approval boolean not null default false,
  period_from date,
  period_to date,
  created_by uuid references public.team_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- NULLS NOT DISTINCT: dla kat2/kat3 (location_id = null) zwykły unique nie działa
  unique nulls not distinct (client_id, location_id, period_year, period_month)
);
alter table public.packages enable row level security;
create index packages_client_status_idx on public.packages (client_id, status);
create index packages_auto_approve_idx on public.packages (auto_approve_at)
  where status = 'do_akceptacji';
create trigger packages_updated_at before update on public.packages
  for each row execute function public.set_updated_at();

-- Kampanii w miesiącu może być kilka. Każda ma własny folder z reklamami.
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  name text not null,
  goal public.campaign_goal,
  position int not null default 0,
  ads_folder_url text,
  ads_folder_id text,
  note text,                                   -- widoczne dla klienta: po co ta kampania
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create index campaigns_package_idx on public.campaigns (package_id, position);
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

create table public.package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,  -- tylko dla type = 'reklama'
  type public.item_type not null,
  position int not null,
  title text,
  caption text,
  publish_at timestamptz,                      -- null dla reklamy
  location_ids uuid[] not null default '{}',   -- kat2/kat3: lokale dla posta albo reklamy
  internal_note text,                          -- widoczne tylko dla zespołu
  origin public.item_origin not null default 'import',
  updated_in_round int,
  added_after_submit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint package_items_reklama_kampania check ((type = 'reklama') = (campaign_id is not null)),
  constraint package_items_reklama_bez_daty check (type <> 'reklama' or publish_at is null)
);
alter table public.package_items enable row level security;
create index package_items_package_idx on public.package_items (package_id, position);
create index package_items_campaign_idx on public.package_items (campaign_id) where campaign_id is not null;
create trigger package_items_updated_at before update on public.package_items
  for each row execute function public.set_updated_at();

create table public.item_assets (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.package_items(id) on delete cascade,
  kind public.asset_kind not null,
  storage_path text not null,                  -- oryginał w prywatnym buckecie materialy
  preview_path text,                           -- 1080 px webp
  thumb_path text,                             -- 400 px webp
  original_name text,
  mime text,
  bytes bigint,
  width int,
  height int,
  duration_ms int,
  position int not null default 0,             -- karuzela: kolejność slajdów
  drive_file_id text,
  superseded_at timestamptz,                   -- podmiana zachowuje historię
  superseded_by uuid references public.item_assets(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.item_assets enable row level security;
create index item_assets_item_idx on public.item_assets (item_id, position);
create trigger item_assets_updated_at before update on public.item_assets
  for each row execute function public.set_updated_at();

-- Jeden materiał 'reklama' na kampanię. Warianty wspólne mają location_id = null,
-- różnice per lokal (link, CTA, czasem tekst) to osobne wiersze z wypełnionym location_id.
create table public.ad_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.package_items(id) on delete cascade,
  kind public.variant_kind not null,
  position int not null default 0,
  label text,
  value_text text,                             -- dla tekst/naglowek/opis/cta/link
  asset_id uuid references public.item_assets(id) on delete cascade,  -- dla grafika
  location_id uuid references public.locations(id) on delete cascade, -- null = wspólny
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_variants_grafika_ma_plik check (kind <> 'grafika' or asset_id is not null),
  constraint ad_variants_tekst_ma_tresc check (kind = 'grafika' or value_text is not null)
);
alter table public.ad_variants enable row level security;
create index ad_variants_item_idx on public.ad_variants (item_id, kind, position);
create trigger ad_variants_updated_at before update on public.ad_variants
  for each row execute function public.set_updated_at();

-- „Obejrzano 12 z 19": materiał liczy się jako obejrzany po 2 s w polu widzenia
create table public.item_views (
  item_id uuid not null references public.package_items(id) on delete cascade,
  access_link_id uuid not null references public.access_links(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  primary key (item_id, access_link_id)
);
alter table public.item_views enable row level security;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  item_id uuid references public.package_items(id) on delete cascade,   -- null = komentarz do pakietu
  variant_id uuid references public.ad_variants(id) on delete set null,
  author_kind public.author_kind not null,
  author_contact_id uuid references public.client_contacts(id),
  author_member_id uuid references public.team_members(id),
  body text not null check (char_length(body) between 1 and 4000),
  round int not null,
  after_approval boolean not null default false,
  seen_by_client_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references public.team_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.comments enable row level security;
create index comments_package_idx on public.comments (package_id, created_at);
create index comments_unresolved_idx on public.comments (package_id) where resolved_at is null;
create index comments_item_idx on public.comments (item_id) where item_id is not null;
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

create table public.package_events (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  kind public.package_event_kind not null,     -- 'zaakceptowany' trzyma w payload migawkę materiałów
  actor_kind public.actor_kind,
  actor_id uuid,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.package_events enable row level security;
create index package_events_package_idx on public.package_events (package_id, created_at);
