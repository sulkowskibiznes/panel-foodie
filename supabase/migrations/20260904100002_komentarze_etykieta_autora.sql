-- Faza 2: komentarz niesie etykietę autora z chwili zapisu (osoba z linku dostępu, np. „Marek - właściciel",
-- albo imię z zespołu). Link może nie mieć osoby kontaktowej (author_contact_id null), a nazwy się zmieniają;
-- etykieta zostaje taka, jaką klient widział, gdy pisał.

alter table public.comments
  add column author_label text;

comment on column public.comments.author_label is
  'Etykieta autora z chwili zapisu: label linku dostępu (klient) albo imię członka zespołu.';
