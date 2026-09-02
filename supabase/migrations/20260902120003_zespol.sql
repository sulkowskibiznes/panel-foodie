-- Zespół i przypisania (SPEC rozdz. 2, 3).

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,                    -- Supabase auth.users
  name text not null,
  email text not null unique,
  role public.team_role not null,
  active boolean not null default true,        -- prawdziwa allowlista logowania zespołu
  created_at timestamptz not null default now()
);
alter table public.team_members enable row level security;
create unique index team_members_email_lower_idx on public.team_members (lower(email));

create table public.client_assignments (
  client_id uuid not null references public.clients(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  primary key (client_id, team_member_id)
);
alter table public.client_assignments enable row level security;
create index client_assignments_member_idx on public.client_assignments (team_member_id);

alter table public.clients
  add constraint clients_opiekun_id_fkey
  foreign key (opiekun_id) references public.team_members(id) on delete set null;
