-- Typy wyliczeniowe i funkcje pomocnicze (SPEC rozdz. 3).
-- Wszystkie zbiory wartości są enumami, żeby db-types.ts dawał typy unii pod TS strict.

create type public.client_category as enum ('kat1','kat2','kat3');
-- kat1: 1 lokal lub kilka RÓŻNYCH restauracji (osobne profile, osobne materiały)
-- kat2: kilka identycznych lokali, JEDEN profil FB/IG
-- kat3: kilka identycznych lokali, OSOBNE profile
create type public.package_tier as enum ('foodie_one','foodie_360','siec');
create type public.client_status as enum ('aktywny','wstrzymany','zakonczony');
create type public.team_role as enum ('admin','csm','content_creator','media_buyer','sales');
create type public.pin_kind as enum ('pin4','pin6','haslo');
create type public.package_status as enum ('szkic','do_akceptacji','poprawki','zaakceptowany','zaplanowany');
create type public.approval_kind as enum ('reczna','automatyczna');
create type public.campaign_goal as enum ('sprzedaz','ruch','polubienia','leady','zasieg','inne');
create type public.item_type as enum ('post','relacja','reels','reklama');
create type public.item_origin as enum ('import','reczny','dodatkowy');
create type public.asset_kind as enum ('image','video');
create type public.variant_kind as enum ('grafika','tekst','naglowek','opis','cta','link');
create type public.import_kind as enum ('content','reklamy','dodatkowy','podmiana');
create type public.import_status as enum ('oczekuje','trwa','zakonczony','blad');
create type public.author_kind as enum ('klient','zespol');
create type public.actor_kind as enum ('klient','zespol','system');
create type public.package_event_kind as enum (
  'utworzony','zaimportowany','wyslany','wycofany','otwarty','komentarz','poprawki',
  'material_dodany','material_podmieniony','zaakceptowany','auto_zaakceptowany',
  'auto_przesunieta','auto_wstrzymana','cofniety_do_poprawek','zaplanowany'
);
create type public.invoice_status as enum ('do_zaplaty','po_terminie','oplacona');
create type public.report_source as enum ('reczne','webhook');
create type public.document_kind as enum ('umowa','aneks','powierzenie','inne');
create type public.outbox_status as enum ('pending','sent','failed');

-- updated_at utrzymywane triggerem na każdej tabeli z tą kolumną
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
