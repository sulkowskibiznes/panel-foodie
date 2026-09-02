-- Audyt, outbox, ustawienia oraz odcięcie ról anon/authenticated (SPEC rozdz. 15, 16, 17).

create table public.audit_log (
  id bigserial primary key,
  actor_kind public.actor_kind not null,
  actor_id uuid,
  actor_label text,
  action text not null,
  entity text,
  entity_id uuid,
  client_id uuid,
  ip_hash text,
  ua text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index audit_log_client_idx on public.audit_log (client_id, created_at desc);
create index audit_log_created_idx on public.audit_log (created_at desc);

create table public.outbox (
  id bigserial primary key,
  event text not null,
  payload jsonb not null,
  status public.outbox_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.outbox enable row level security;
create index outbox_pending_idx on public.outbox (status, created_at);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.team_members(id)
);
alter table public.settings enable row level security;

insert into public.settings (key, value) values
  ('auto_approve_hours', '72'::jsonb),
  ('auto_approve_business_days', 'false'::jsonb),
  ('retention_months', '24'::jsonb),
  ('onboarding_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- Panel nie rozmawia z bazą kluczem publishable. RLS bez polityk to druga linia obrony;
-- pierwszą jest brak jakichkolwiek uprawnień ról anon i authenticated do schematu public.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
