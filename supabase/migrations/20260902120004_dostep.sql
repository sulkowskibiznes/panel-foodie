-- Dostęp klienta: linki, sesje, limity (SPEC rozdz. 4, 16).

create table public.access_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contact_id uuid references public.client_contacts(id) on delete set null,
  label text not null,                         -- „Marek - właściciel"
  token_lookup text not null unique,           -- pierwsze 8 znaków tokenu, do wyszukania wiersza
  token_hash text not null,                    -- sha256 pełnego tokenu; weryfikacja ZAWSZE po hashu
  token_enc text not null,                     -- AES-256-GCM kluczem z SESSION_SECRET; tylko do „Kopiuj dostęp"
  pin_hash text not null,                      -- argon2id
  pin_kind public.pin_kind not null default 'pin4',
  can_approve boolean not null default true,   -- false = link tylko do podglądu i komentarzy
  created_by uuid references public.team_members(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  failed_attempts int not null default 0,
  failed_window_started_at timestamptz,        -- początek okna „10 nieudanych w godzinę"
  locked_until timestamptz
);
alter table public.access_links enable row level security;
create index access_links_client_id_idx on public.access_links (client_id);

create table public.client_sessions (
  id uuid primary key default gen_random_uuid(),
  access_link_id uuid not null references public.access_links(id) on delete cascade,
  session_hash text not null unique,
  previous_session_hash text,                  -- po rotacji poprzedni token ważny jeszcze 2 min
  rotated_at timestamptz not null default now(),
  ua_hash text,
  ip_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,             -- 30 dni od ostatniej aktywności (przesuwnie)
  revoked_at timestamptz
);
alter table public.client_sessions enable row level security;
create index client_sessions_access_link_id_idx on public.client_sessions (access_link_id);
create index client_sessions_previous_hash_idx on public.client_sessions (previous_session_hash)
  where previous_session_hash is not null;

-- Limit prób PIN-u na IP bez Redisa: key = 'pin:ip:<ip_hash>'
create table public.rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  count int not null default 0
);
alter table public.rate_limits enable row level security;
