-- Usługi dodatkowe i wdrożenie za flagą (SPEC rozdz. 5.8, 11).

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_desc text not null,
  body_md text,
  icon text,
  cta_label text not null default 'Chcę wiedzieć więcej',
  visible_for_tiers public.package_tier[] not null default '{foodie_one,foodie_360,siec}',
  active boolean not null default true,
  position int not null default 0
);
alter table public.services enable row level security;

create table public.service_interests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contact_id uuid references public.client_contacts(id),
  service_id uuid not null references public.services(id),
  note text,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
alter table public.service_interests enable row level security;
create index service_interests_client_idx on public.service_interests (client_id);

create table public.onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  position int not null,
  title text not null,
  body_md text,
  form_url text,                               -- Tally
  external_url text,                           -- np. Leadsie
  done_at timestamptz,
  done_by_contact_id uuid references public.client_contacts(id)
);
alter table public.onboarding_steps enable row level security;
create index onboarding_steps_client_idx on public.onboarding_steps (client_id, position);
