-- SPEC 1.4, rozdz. 20 poz. 26: pakiet z wstrzymaną auto-akceptacją pokazuje na pulpicie zespołu
-- liczbę NIEPRZECZYTANYCH uwag klienta. Uwaga jest przeczytana, gdy ktoś z zespołu otworzył pakiet
-- (seen_by_team_at), niezależnie od tego, czy została załatwiona (resolved_at).

alter table public.comments
  add column seen_by_team_at timestamptz;

comment on column public.comments.seen_by_team_at is
  'Uwagi klienta: kiedy zespół je zobaczył; null = nieprzeczytana (licznik na pulpicie, rozdz. 12.1).';

create index comments_nieprzeczytane_zespol_idx on public.comments (package_id)
  where author_kind = 'klient' and seen_by_team_at is null;
