-- Faza 3, SPEC rozdz. 8: harmonogram ustawia godzinę publikacji „domyślnie z ustawień klienta (np. 12:00 i 18:00)".
-- Materiał upuszczony na dzień w kalendarzu dostaje pierwszą wolną z tych godzin.

alter table public.clients
  add column default_publish_hours smallint[] not null default '{12,18}'
  check (array_length(default_publish_hours, 1) between 1 and 6);

comment on column public.clients.default_publish_hours is
  'Domyślne godziny publikacji (Europe/Warsaw) dla materiałów bez godziny w harmonogramie zespołu.';
