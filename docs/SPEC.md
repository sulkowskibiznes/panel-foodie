# SPEC — Panel Klienta Foodie Media (panel.foodiemedia.pl)

Wersja 1.2 · 2 września 2026 · autor specyfikacji: Szymon Sułkowski + Claude
Ten plik jest **jedynym źródłem prawdy** o zakresie. Zmieniasz zakres → zmieniasz ten plik.

**Zmiany w 1.1:** Fakturowo zamiast Fakturowni · import materiałów przez wklejane linki do
folderów zamiast wyliczanych ścieżek · wiele kampanii reklamowych w jednym miesiącu ·
dodawanie i podmiana pojedynczych materiałów · podglądy contentu dla **Facebooka** ·
brak logo klienta w interfejsie panelu · uproszczona wysyłka dostępu (sam link i PIN).

**Zmiany w 1.2:** reklamy podglądane w **sześciu placementach — Facebook i Instagram** ·
w ramce podglądu używamy **zdjęcia profilowego strony klienta** · auto-akceptacja liczona
w **dniach kalendarzowych (72 h)** · osobny link i PIN dla każdej osoby po stronie klienta.

---

## 0. Po co to powstaje

Agencja obsługuje ok. 80 restauracji. Co miesiąc każdy klient dostaje **6 postów, 10 relacji
i co najmniej jedną kampanię reklamową** (do 6 grafik × do 3 tekstów × 2–3 nagłówki).
Dziś materiały jadą linkiem do Dysku i akceptem na WhatsAppie.

**Twardy problem, który ten panel ma rozwiązać:** z ankiet Gosi (50 odpowiedzi) wynika,
że **52% kampanii mija zaplanowany termin, a 90% tych opóźnień to spóźniona akceptacja
klienta.** Panel ma zabrać tarcie z akceptacji i postawić widoczny licznik.

**Miara sukcesu po 3 miesiącach:**
- mediana czasu od „wysłane do akceptacji" do „zaakceptowane" ≤ 48 h,
- odsetek pakietów zaakceptowanych po terminie < 20%,
- zero pakietów, które utknęły bo nikt nie zauważył.

---

## 1. Stack i infrastruktura

| Warstwa | Wybór | Uzasadnienie |
|---|---|---|
| Framework | **Next.js 15+, App Router, TypeScript strict** | Server Components → dane klienta nigdy nie lecą do przeglądarki bez kontroli |
| UI | **Tailwind CSS + shadcn/ui** | szybkie, spójne, łatwe do brandowania |
| Baza + auth zespołu + pliki | **Supabase** (Postgres, Auth, Storage), region **eu-central-1 (Frankfurt)** | RODO, RLS, gotowe Storage z signed URL |
| Hosting | **Vercel**, region funkcji **fra1** | domena własna, preview deploys |
| Kolejki / zadania cykliczne | **Vercel Cron** + tabele `import_jobs` i `outbox` | auto-akceptacja, import, sprzątanie sesji |
| Obrazy | `next/image` + warianty generowane przy imporcie (`sharp`) | 80 klientów × ponad 20 plików/mies. — bez wariantów panel będzie mulił |
| Testy | **Vitest** (jednostkowe) + **Playwright** (E2E, w tym wizualne) | akceptacja to pieniądze, musi być testowana |
| Analityka | brak zewnętrznej; własny `audit_log` | mniej zgód RODO |

**Domeny**
- `panel.foodiemedia.pl` — panel (klient i zespół)
- `raporty.foodiemedia.pl` — **istniejący** Report Vault (Lovable + Supabase), zostaje bez zmian

**Nie przepisujemy Report Vault.** Panel tylko linkuje do raportów.

---

## 2. Role i uprawnienia

Dwa rozłączne światy uwierzytelniania:
- **Klient** — magic link + PIN, bez konta e-mail (rozdz. 4)
- **Zespół** — Supabase Auth, e-mail OTP, tylko adresy z allowlisty

| Rola | Klienci | Materiały | Harmonogram | Raporty | Faktury i dokumenty | Linki dostępu | Ustawienia systemu |
|---|---|---|---|---|---|---|---|
| `admin` (Szymon) | wszyscy | pełne | pełne | pełne | pełne | pełne | pełne |
| `csm` (Gosia, PM) | **tylko przypisani** | pełne | pełne | pełne | pełne | pełne | brak |
| `content_creator` | tylko przypisani | pełne | pełne | podgląd | **brak dostępu** | brak | brak |
| `media_buyer` (Stasiek) | tylko przypisani | podgląd | podgląd | pełne | brak dostępu | brak | brak |
| `sales` (Kuba) | wszyscy | podgląd | podgląd | podgląd | **brak dostępu** | brak | brak |

**„Wrażliwe rzeczy", do których CSM nie ma dostępu** (decyzja podjęta za Ciebie — zweryfikuj):
zarządzanie kontami zespołu i rolami, globalne ustawienia i sekrety, logi bezpieczeństwa,
eksport całej bazy, zestawienia przychodów agencji w skali wszystkich klientów.
CSM **ma** dostęp do faktur i kwot **swoich** klientów — bez tego nie zrobi swojej pracy.

**Podgląd oczami klienta (impersonacja)** — dla `admin`, `csm`, `sales`:
- wejście przyciskiem „Zobacz jak klient" z karty klienta,
- tryb **wyłącznie do odczytu** — akceptacja i komentarze zablokowane, przycisk pokazuje tooltip „niedostępne w podglądzie",
- stały pasek u góry ekranu: „PODGLĄD KLIENTA — {nazwa}. Wyjdź",
- każde wejście i wyjście do `audit_log`.

---

## 3. Model danych

Postgres. Wszystkie tabele w `public`, **RLS włączone wszędzie**, dostęp aplikacji przez
service role po stronie serwera (rozdz. 16).

```sql
-- === KLIENCI I STRUKTURA ===
create type client_category as enum ('kat1','kat2','kat3');
-- kat1: 1 lokal lub kilka RÓŻNYCH restauracji (osobne profile, osobne materiały)
-- kat2: kilka identycznych lokali, JEDEN profil FB/IG (jeden komplet materiałów, reklamy per lokal)
-- kat3: kilka identycznych lokali, OSOBNE profile (jeden komplet contentu, reklamy per lokal)

create type package_tier as enum ('foodie_one','foodie_360','siec');

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category client_category not null,
  tier package_tier not null,
  monthly_amount_net numeric(10,2),          -- np. 2000.00 / 3800.00
  extra_locations_count int not null default 0,
  drive_folder_url text,                     -- folder klienta w „Materiały klientów" (pomocniczo)
  slack_channel text,
  status text not null default 'aktywny',    -- aktywny | wstrzymany | zakonczony
  cooperation_started_on date,
  timezone text not null default 'Europe/Warsaw',
  created_at timestamptz not null default now()
);
-- UWAGA: żadnego logo ani kolorów klienta. Panel jest w 100% w brandingu Foodie Media.

create table locations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,                        -- np. „Nova Sushi Piotrkowska"
  city text,
  address text,
  fb_page_name text not null,                -- nazwa strony na FB — używana w podglądach 1:1
  ig_handle text,                            -- nick IG — używany w placementach reklamowych IG
  avatar_path text,                          -- zdjęcie profilowe strony, UŻYWANE WYŁĄCZNIE
                                             -- wewnątrz ramki podglądu (symulacja FB/IG).
                                             -- Nigdy w nagłówku panelu ani na kartach.
  separate_materials boolean not null default false, -- kat1: true
  position int not null default 0
);

create table client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  role_label text,                           -- „właściciel", „manager", „wspólniczka"
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- === ZESPÓŁ ===
create type team_role as enum ('admin','csm','content_creator','media_buyer','sales');

create table team_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,                  -- Supabase auth.users
  name text not null,
  email text not null unique,
  role team_role not null,
  active boolean not null default true
);

create table client_assignments (
  client_id uuid references clients(id) on delete cascade,
  team_member_id uuid references team_members(id) on delete cascade,
  primary key (client_id, team_member_id)
);

-- === DOSTĘP KLIENTA ===
create table access_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  contact_id uuid references client_contacts(id) on delete set null,
  label text not null,                       -- „Marek — właściciel"
  token_lookup text not null unique,         -- pierwsze 8 znaków tokenu, do wyszukania wiersza
  token_hash text not null,                  -- sha256 pełnego tokenu
  pin_hash text not null,                    -- argon2id
  pin_kind text not null default 'pin4',     -- pin4 | pin6 | haslo
  created_by uuid references team_members(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  failed_attempts int not null default 0,
  locked_until timestamptz
);

create table client_sessions (
  id uuid primary key default gen_random_uuid(),
  access_link_id uuid not null references access_links(id) on delete cascade,
  session_hash text not null unique,
  ua_hash text,
  ip_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

-- === PAKIETY MATERIAŁÓW (serce systemu) ===
create type package_status as enum (
  'szkic',            -- widoczny tylko dla zespołu
  'do_akceptacji',
  'poprawki',
  'zaakceptowany',
  'zaplanowany'
);

create table packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,  -- null = wspólny dla całego klienta
  period_year int not null,
  period_month int not null,
  cooperation_month int,                     -- „5. miesiąc współpracy"
  title text,                                -- domyślnie „Materiały — wrzesień 2026"
  status package_status not null default 'szkic',
  round int not null default 1,              -- 1, 2, 3… → UI pokazuje „Do akceptacji v2"
  content_folder_url text,                   -- WKLEJONY przez content creatora: posty i relacje
  content_folder_id text,                    -- wyciągnięty z URL
  submitted_at timestamptz,                  -- moment przejścia na do_akceptacji w bieżącej rundzie
  first_opened_at timestamptz,
  auto_approve_enabled boolean not null default true,
  auto_approve_at timestamptz,               -- wyliczane przy submit (rozdz. 6.4)
  approved_at timestamptz,
  approved_by_contact_id uuid references client_contacts(id),
  approval_kind text,                        -- reczna | automatyczna
  changed_after_approval boolean not null default false,
  period_from date,
  period_to date,                            -- „dzień zakończenia" z planu contentu
  created_by uuid references team_members(id),
  created_at timestamptz not null default now(),
  unique (client_id, location_id, period_year, period_month)
);

-- Kampanii w miesiącu może być kilka: standardowa, na imprezy okolicznościowe,
-- na polubienia strony… Każda ma własny folder z grafikami i tekstami na Dysku.
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  name text not null,                        -- „Kampania standardowa", „Imprezy okolicznościowe"
  goal text,                                 -- sprzedaz | ruch | polubienia | leady | zasieg | inne
  position int not null default 0,
  ads_folder_url text,                       -- WKLEJONY przez content creatora
  ads_folder_id text,
  note text,                                 -- widoczne dla klienta: po co ta kampania
  created_at timestamptz not null default now()
);

create type item_type as enum ('post','relacja','reels','reklama');

create table package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,  -- tylko dla type='reklama'
  type item_type not null,
  position int not null,
  title text,                                -- robocza nazwa, np. „Post 3 — nowa pizza"
  caption text,                              -- opis posta / tekst relacji
  publish_at timestamptz,                    -- NULL dla typu 'reklama'
  location_ids uuid[] default '{}',          -- kat2/kat3: na które lokale publikujemy
  internal_note text,                        -- widoczne tylko dla zespołu
  origin text not null default 'import',     -- import | reczny | dodatkowy
  updated_in_round int,                      -- runda, w której materiał zmieniono → plakietka
  added_after_submit boolean not null default false,
  created_at timestamptz not null default now()
);

create type asset_kind as enum ('image','video');

create table item_assets (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references package_items(id) on delete cascade,
  kind asset_kind not null,
  storage_path text not null,                -- oryginał w prywatnym buckecie
  preview_path text,                         -- 1080px webp
  thumb_path text,                           -- 400px webp
  original_name text,
  mime text,
  bytes bigint,
  width int, height int, duration_ms int,
  position int not null default 0,           -- karuzela: kolejność slajdów
  drive_file_id text,
  superseded_at timestamptz,                 -- podmiana zachowuje historię
  superseded_by uuid references item_assets(id)
);

-- Warianty reklamy: do 6 grafik + do 3 tekstów + 2–3 nagłówki + opis + CTA
create type variant_kind as enum ('grafika','tekst','naglowek','opis','cta','link');

create table ad_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references package_items(id) on delete cascade,
  kind variant_kind not null,
  position int not null default 0,
  label text,                                -- „Wariant A"
  value_text text,                           -- dla tekst/naglowek/opis/cta/link
  asset_id uuid references item_assets(id) on delete cascade -- dla grafika
);

-- === IMPORT Z DYSKU ===
create table import_jobs (
  id uuid primary key default gen_random_uuid(),
  package_id uuid references packages(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  item_id uuid references package_items(id) on delete cascade,  -- dla podmiany
  kind text not null,                        -- content | reklamy | dodatkowy | podmiana
  source_url text not null,
  source_folder_id text,
  status text not null default 'oczekuje',   -- oczekuje | trwa | zakonczony | blad
  files_total int, files_done int,
  warnings jsonb not null default '[]',
  error text,
  created_by uuid references team_members(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on import_jobs (source_folder_id);  -- do wykrywania powtórnego importu

-- === KOMENTARZE I ZDARZENIA ===
create table comments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  item_id uuid references package_items(id) on delete cascade, -- null = komentarz do pakietu
  variant_id uuid references ad_variants(id) on delete set null,
  author_kind text not null,                 -- klient | zespol
  author_contact_id uuid references client_contacts(id),
  author_member_id uuid references team_members(id),
  body text not null,
  round int not null,                        -- runda, w której powstał
  after_approval boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references team_members(id),
  created_at timestamptz not null default now()
);

create table package_events (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  kind text not null,                        -- utworzony | zaimportowany | wyslany | otwarty |
                                             -- komentarz | poprawki | material_dodany |
                                             -- material_podmieniony | zaakceptowany |
                                             -- auto_zaakceptowany | zaplanowany
  actor_kind text,                           -- klient | zespol | system
  actor_id uuid,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- === RAPORTY, FAKTURY, DOKUMENTY ===
create table reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  period_year int not null,
  period_month int not null,
  title text not null,                       -- „Raport miesięczny — sierpień 2026"
  url text not null,                         -- https://raporty.foodiemedia.pl/r/<token>
  cooperation_month int,
  published_at timestamptz not null default now(),
  source text not null default 'reczne',     -- reczne | webhook
  unique (client_id, period_year, period_month)
);

create type invoice_status as enum ('do_zaplaty','po_terminie','oplacona');

create table invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  number text not null,
  issue_date date not null,
  due_date date not null,
  amount_net numeric(10,2) not null,
  amount_gross numeric(10,2) not null,
  status invoice_status not null default 'do_zaplaty',
  paid_at date,
  pdf_path text,
  fakturowo_id text,                         -- rezerwa pod ewentualną integrację z Fakturowo
  note text,
  created_at timestamptz not null default now(),
  unique (client_id, number)
);
-- „po_terminie" NIE jest wpisywane ręcznie: cron przestawia status,
-- gdy due_date < today i status = 'do_zaplaty'.

create table documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null,                        -- umowa | aneks | powierzenie | inne
  title text not null,
  file_path text not null,
  valid_from date,
  uploaded_by uuid references team_members(id),
  created_at timestamptz not null default now()
);

-- === USŁUGI DODATKOWE ===
create table services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_desc text not null,
  body_md text,
  icon text,
  cta_label text not null default 'Chcę wiedzieć więcej',
  visible_for_tiers package_tier[] default '{foodie_one,foodie_360,siec}',
  active boolean not null default true,
  position int not null default 0
);

create table service_interests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  contact_id uuid references client_contacts(id),
  service_id uuid not null references services(id),
  note text,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

-- === WDROŻENIE (feature flag, wyłączone w MVP) ===
create table onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  position int not null,
  title text not null,
  body_md text,
  form_url text,                             -- Tally
  external_url text,                         -- np. Leadsie
  done_at timestamptz,
  done_by_contact_id uuid references client_contacts(id)
);

-- === INFRASTRUKTURA ===
create table audit_log (
  id bigserial primary key,
  actor_kind text not null,                  -- klient | zespol | system
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
create index on audit_log (client_id, created_at desc);

create table outbox (
  id bigserial primary key,
  event text not null,
  payload jsonb not null,
  status text not null default 'pending',    -- pending | sent | failed
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references team_members(id)
);
-- klucze m.in.: auto_approve_days=3, auto_approve_business_days=false (dni kalendarzowe),
-- retention_months=24, onboarding_enabled=false, zapier_webhook_url
```

### 3.1 Trzy kategorie klientów — jak to działa w danych

| Kategoria | Lokale | Profile FB | Pakiety | Kampanie |
|---|---|---|---|---|
| **kat1** — 1 lokal albo różne restauracje | 1..n, `separate_materials = true` | osobne | **osobny pakiet na każdy lokal** (`packages.location_id` wypełnione) | osobne w każdym pakiecie |
| **kat2** — identyczne lokale, jeden profil | 1..n | jeden wspólny | **jeden pakiet** (`location_id = null`) | jedna kampania, w niej osobny `reklama` item na lokal (różne CTA) |
| **kat3** — identyczne lokale, osobne profile | 1..n | osobne | **jeden pakiet contentu** (`location_id = null`), `package_items.location_ids` mówi, na które profile idzie post | osobny `reklama` item na każdy lokal |

Podgląd posta w kat3 pokazuje przełącznik profilu (nazwa strony z `locations.fb_page_name`).

---

## 4. Logowanie klienta — magic link + PIN

**Wybrany model: link + PIN.** Link może zostać przekazany dalej (klient decyduje, komu
daje dostęp), ale sam link nie wystarczy.

### 4.1 Link
- Adres: `https://panel.foodiemedia.pl/p/<token>`
- `token` = 32 znaki hex z `crypto.randomBytes(16)` (128 bit). **Nigdy nie generowany przez model językowy.**
- W bazie: `token_lookup` = pierwsze 8 znaków (indeks), `token_hash` = sha256 całości.
- Link **nie wygasa** sam; wygaszany ręcznie (`revoked_at`) lub przy offboardingu klienta.
- Każda osoba kontaktowa może mieć własny link → widać, **kto** zaakceptował.

### 4.2 PIN
- Domyślnie 4 cyfry, do wyboru 6 cyfr albo proste hasło (`pin_kind`).
- Hash **argon2id**, nigdy plaintext, nigdy w logach.
- Panel po wpisaniu PIN-u ustawia sesję na **30 dni** (cookie `httpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefix).
- „Zapamiętaj mnie na tym urządzeniu" domyślnie zaznaczone.

### 4.3 Ochrona przed zgadywaniem — wymóg twardy
- 5 nieudanych prób → blokada linku na 15 min (`locked_until`), komunikat bez ujawniania,
  czy token istnieje.
- 10 nieudanych w ciągu godziny → blokada na 24 h + zdarzenie w `outbox` (Slack).
- Rate limit na IP: 20 prób PIN / 10 min.
- **Odpowiedź na zły token i na zły PIN musi wyglądać identycznie** (ten sam ekran, ten sam
  czas odpowiedzi ±, żeby nie dało się enumerować tokenów).
- `robots.txt`: `Disallow: /p/`, na wszystkich stronach klienta `noindex, nofollow, noarchive`.
- Podgląd linku w komunikatorach (OG tags) **neutralny**: „Panel klienta Foodie Media" — bez
  nazwy lokalu, bez liczb. Dokładnie jak przy raportach.

### 4.4 Zarządzanie z panelu zespołu
CSM na karcie klienta ma: listę linków, „Utwórz link", jednorazowe odsłonięcie PIN-u przy
tworzeniu, „Wygaś link", „Wyloguj wszystkie urządzenia", „Historia logowań". Kopiowanie
linku i PIN-u opisane w rozdz. 12.4.

### 4.5 Świadomie odrzucone
- Logowanie e-mail + hasło — restaurator tego nie przejdzie, a to podwaja powierzchnię ataku.
- Wiązanie z urządzeniem — klient ma prawo dać dostęp komu chce.

---

## 5. Panel klienta — ekrany

Nawigacja (lewy pasek na desktopie, dolny na mobile — **mobile first, klient otworzy to z WhatsAppa**):

1. **Start** — co wymaga Twojej uwagi
2. **Materiały do akceptacji** ← domyślny ekran, gdy coś czeka
3. **Harmonogram**
4. **Archiwum materiałów**
5. **Raporty**
6. **Faktury i dokumenty**
7. **Twój pakiet**
8. **Co jeszcze możemy zrobić**
9. *(Wdrożenie — ukryte za flagą)*

**Panel jest w całości w brandingu Foodie Media.** Nigdzie w interfejsie — w nagłówku,
na kartach, w nawigacji — nie pokazujemy logo ani kolorów klienta. Jedyny wyjątek to
**wnętrze ramki podglądu**, gdzie zdjęcie profilowe strony jest częścią symulacji Facebooka
i Instagrama, a nie brandingiem panelu.

### 5.1 Start
- Jeden duży kafel akcji, gdy jest pakiet `do_akceptacji`: nazwa miesiąca, ile materiałów,
  **licznik do auto-akceptacji**, przycisk „Przejrzyj materiały".
- Pod spodem: najnowszy raport, najbliższa publikacja, faktura po terminie (jeśli jest).
- Gdy nic nie czeka: „Wszystko na bieżąco" + skrót do harmonogramu.

### 5.2 Materiały do akceptacji — patrz rozdz. 6

### 5.3 Harmonogram
- Widok miesiąca + lista. **Read-only dla klienta**, z możliwością komentarza do materiału.
- Przy każdym poście i relacji **data publikacji**. Kampanie reklamowe **nie mają daty** —
  wchodzą do osobnej sekcji „Kampanie w tym miesiącu" pod kalendarzem, każda z nazwą i celem.
- Kolory statusów: szary = szkic, fiolet = do akceptacji, zielony = zaakceptowany,
  bursztyn = poprawki, czarny = opublikowany.

### 5.4 Archiwum
Pakiety z poprzednich miesięcy, filtr po miesiącu i typie. Ten sam podgląd co w akceptacji,
tylko bez przycisków decyzji. Retencja 24 miesiące (konfigurowalna, rozdz. 17).

### 5.5 Raporty
Lista kart: miesiąc, „X. miesiąc współpracy", przycisk „Otwórz raport" → link
`raporty.foodiemedia.pl/r/<token>` w nowej karcie. Bez osadzania w iframe.

### 5.6 Faktury i dokumenty
- Tabela faktur: numer, data wystawienia, termin, kwota netto i brutto, **status**, pobierz PDF.
- Status „Po terminie" na czerwono z liczbą dni.
- Osobna sekcja **Dokumenty**: umowa, aneksy, umowa powierzenia — pobieranie PDF.

### 5.7 Twój pakiet
Nazwa pakietu (Foodie One / Foodie 360° / Sieć), kwota netto miesięcznie, wypunktowany
zakres, lista lokali objętych współpracą, dane opiekuna (imię + kanał kontaktu — **bez
numerów prywatnych zespołu**), data startu współpracy.

### 5.8 Co jeszcze możemy zrobić
Karty usług z `services`: sesja zdjęciowa, FoodieQR, strona WWW i branding, Restaumatic
(zamówienia online + POS), Google Ads, SMS i e-mail marketing, dodatkowe lokale.
Przycisk „Chcę wiedzieć więcej" → modal z jednym polem „Napisz w dwóch zdaniach, co Cię
interesuje" → zapis `service_interests` + zdarzenie do `outbox` (rozdz. 15).
Klient dostaje potwierdzenie: „Odezwiemy się w ciągu jednego dnia roboczego."

---

## 6. Akceptacja materiałów — mechanika (najważniejszy rozdział)

### 6.1 Jednostka decyzji
Klient akceptuje **cały pakiet miesięczny jednym przyciskiem** — razem z contentem
i **wszystkimi kampaniami** tego miesiąca. Komentować może **każdy materiał z osobna**
(post, relację, konkretny wariant reklamy) oraz cały pakiet.

Klient **nie edytuje** opisów. Może tylko komentować.

### 6.2 Ekran pakietu
Górny pasek (przyklejony, zawsze widoczny):

```
Materiały — wrzesień 2026 · 6 postów · 10 relacji · 2 kampanie
Do akceptacji · Automatyczna akceptacja za 2 dni 4 godz.   [Zgłaszam uwagi]  [Akceptuję wszystko]
```

Zakładki: **Posty (6)** · **Relacje (10)** · **Kampanie (2)** · **Wszystko**
Przy każdej zakładce plakietka z liczbą nieprzeczytanych komentarzy zespołu.

W zakładce Kampanie każda kampania to osobna sekcja z nagłówkiem — nazwa, cel i jedno zdanie
od zespołu („Kampania na imprezy okolicznościowe — chcemy dowozić rezerwacje na urodziny
i komunie"). Klient ma rozumieć, po co ta druga kampania w ogóle jest.

Pasek postępu przeglądania: „Obejrzano 12 z 19". Materiał liczy się jako obejrzany po
2 sekundach w polu widzenia. **To nie blokuje akceptacji** — ma tylko pokazać klientowi,
czego jeszcze nie widział, a zespołowi dać sygnał w audycie.

### 6.3 Dwie decyzje

**„Akceptuję wszystko"**
- Modal z podsumowaniem: „Akceptujesz 6 postów, 10 relacji i 2 kampanie reklamowe.
  Zaplanujemy publikację zgodnie z harmonogramem." + checkbox „Sprawdziłem daty publikacji".
- Jeśli są **nierozwiązane komentarze klienta** → ostrzeżenie: „Masz 2 nierozwiązane uwagi.
  Akceptacja oznacza, że mimo nich ruszamy z publikacją." — ale **nie blokuje**.
- Po akceptacji: `status = zaakceptowany`, `approved_at`, `approved_by_contact_id`,
  `approval_kind = 'reczna'`, zdarzenie `zaakceptowany`, wpis do `outbox`.

**„Zgłaszam uwagi"**
- Aktywne tylko, gdy jest **co najmniej jeden komentarz**. Inaczej przycisk podpowiada:
  „Napisz najpierw, co poprawić — kliknij komentarz przy materiale."
- `status = poprawki`, zdarzenie `poprawki`, wpis do `outbox`, **licznik auto-akceptacji zatrzymany**.
- Klient widzi: „Przekazaliśmy uwagi zespołowi. Odezwiemy się z poprawioną wersją."

### 6.4 Automatyczna akceptacja po 3 dniach

To jest funkcja, która rozwiązuje problem z 52% kampanii po terminie. Musi być
**uczciwa i widoczna**, inaczej zrobi więcej szkody niż pożytku.

**Zasady:**
- Licznik startuje w momencie ustawienia statusu `do_akceptacji`, nie w momencie otwarcia linku.
- **3 dni kalendarzowe, czyli równo 72 godziny.** Zaokrąglenie do pełnej godziny.
  Ustawienie `auto_approve_business_days` istnieje w `settings` i przełącza na dni robocze,
  gdyby okazało się, że weekendy zjadają za dużo — domyślnie **wyłączone**.
- Widoczność: licznik w pasku pakietu i na ekranie Start.
- Na 24 h przed: pasek zmienia kolor na bursztynowy, tekst „Zostało 24 godziny".
- Zgłoszenie uwag **zatrzymuje** licznik. Wysłanie wersji v2 startuje go od nowa.
- CSM może **wyłączyć** auto-akceptację dla konkretnego pakietu (checkbox przy wysyłce)
  albo dla konkretnego klienta (ustawienie na karcie klienta).
- Auto-akceptacja zapisuje `approval_kind = 'automatyczna'`, `approved_by_contact_id = null`,
  zdarzenie `auto_zaakceptowany` i **osobne powiadomienie do zespołu**.
- Klient po auto-akceptacji widzi baner: „Materiały zostały zatwierdzone automatycznie
  {data}, zgodnie z zasadami panelu. Nadal możesz dodać uwagi — sprawdzimy je przed publikacją."

**Podstawa formalna:** zasadę auto-akceptacji trzeba dopisać do regulaminu panelu
(`/regulamin`) i wspomnieć w umowie lub aneksie. **To zadanie dla Ciebie, nie dla kodu.**

### 6.5 Rundy poprawek
- **Bez limitu rund.**
- Zespół wprowadza poprawki → zmienia materiały → naciska „Wyślij v2".
  `round += 1`, `status = do_akceptacji`, nowy `submitted_at` i `auto_approve_at`.
- Nagłówek pokazuje „Do akceptacji · wersja 2".
- Przy materiałach zmienionych w tej rundzie (`updated_in_round = round`): plakietka **„Poprawione"**.
  Przy materiałach dopisanych po wysyłce: plakietka **„Nowe"**.
- Komentarze z poprzednich rund zwinięte w „Historia uwag (runda 1)", z odpowiedziami zespołu.

### 6.6 Po akceptacji
- Zielony baner: „Zaakceptowano {data, godz.} przez {imię}." albo „…automatycznie {data}."
- Przyciski decyzji znikają. **Komentowanie zostaje włączone.**
- Komentarz po akceptacji ma `after_approval = true`, wyświetla się zespołowi jako
  **„Uwaga po akceptacji"** z wyższym priorytetem i osobnym zdarzeniem w `outbox`.
- Status pakietu **nie cofa się automatycznie** — decyduje zespół (przycisk „Cofnij do poprawek").
- Jeśli zespół podmieni materiał po akceptacji (rozdz. 12.6), klient widzi baner:
  „Po akceptacji podmieniliśmy 1 materiał — jest oznaczony plakietką."

### 6.7 Komentarze
- Zwykły wątek pod materiałem (bez pinezek na grafice).
- Wątek = komentarz + odpowiedzi zespołu. Zespół może oznaczyć wątek jako „Załatwione".
- Klient widzi odpowiedzi zespołu w tym samym miejscu — to zastępuje część rozmowy na WhatsAppie.
- Limit 4000 znaków, bez HTML, bez linków klikalnych w treści klienta.

### 6.8 Statusy — pełny automat

```
szkic ──(CSM: Wyślij do akceptacji)──▶ do_akceptacji (v1)
                                          │
                        ┌─────────────────┼─────────────────┐
            klient: Akceptuję      klient: Uwagi        cisza 72 godziny
                    │                     │                 │
                    ▼                     ▼                 ▼
             zaakceptowany            poprawki       zaakceptowany (auto)
                    │                     │                 │
                    │        (zespół poprawia, Wyślij v2)   │
                    │                     ▼                 │
                    │              do_akceptacji (v2) ──────┤
                    │                                        │
                    └────────(zespół: Zaplanowano)───────────┘
                                        ▼
                                   zaplanowany
```

`zaplanowany` ustawia zespół po ustawieniu publikacji w Meta Business Suite. To ostatni
status — panel nie publikuje sam.

---

## 7. Podglądy 1:1

**Content — posty, relacje, Reels — podglądamy wyłącznie na Facebooku.** Tam publikujemy
i tam klient rozpoznaje swoje materiały.
**Reklamy podglądamy w sześciu placementach: cztery na Facebooku i dwa na Instagramie**,
bo tak realnie się wyświetlają.

Wierność wizualna jest wymogiem, nie ozdobą — ale bez kopiowania grafik i logotypów Meta:
rysujemy neutralne, rozpoznawalne ramki interfejsu. **Wewnątrz ramki używamy zdjęcia
profilowego strony klienta** (`locations.avatar_path`) — jest częścią symulacji, nie
brandingiem panelu. Poza ramką podglądu logo klienta nie pojawia się nigdzie.
Gdy zdjęcia brakuje, rysujemy neutralne kółko z pierwszą literą nazwy strony.

### 7.1 Post na stronie na Facebooku
- Nagłówek: zdjęcie profilowe strony, **nazwa strony** (`locations.fb_page_name`), pod spodem data
  publikacji i ikona widoczności publicznej, po prawej „•••".
- **Tekst posta nad grafiką**, skracany po ok. 3 linijkach z **„Zobacz więcej"** — dokładnie
  jak na Facebooku, żeby klient zobaczył, co się urywa. Hashtagi i linki w kolorze odnośnika.
- Grafika w proporcji **1:1, 4:5 i 1.91:1** (przełącznik). Karuzela: strzałki i kropki.
- Pod grafiką: pasek reakcji z licznikami, a niżej **Lubię to! · Komentarz · Udostępnij**.
- Data publikacji nad ramką: „Publikacja: czwartek, 11 września, 18:00".
- Dla kat3 przełącznik profilu — ten sam post na różnych stronach.

### 7.2 Relacja na Facebooku (9:16)
- Pełnoekranowa ramka 9:16, pasek postępu u góry (tyle segmentów, ile relacji w pakiecie),
  awatar + nazwa strony + „2 godz.", pole „Odpowiedz" na dole.
- Nawigacja strzałkami i tapnięciem między relacjami — klient przechodzi całą serię.
- Wideo: odtwarzacz, domyślnie wyciszony.

### 7.3 Reels na Facebooku
- Ramka 9:16 w układzie Reels: opis na dole po lewej, kolumna ikon po prawej,
  pasek audio. Wideo z kontrolką odtwarzania.

### 7.4 Reklama — sześć placementów, Facebook i Instagram

Przełącznik w dwóch grupach:

**Facebook:** kanał (telefon) · kanał (komputer) · relacje · Reels
**Instagram:** kanał · relacje i Reels (wspólna ramka 9:16 z interfejsem IG)

Ramka instagramowa używa nicka z `locations.ig_handle` i tego samego zdjęcia profilowego.
Gdy klient nie ma `ig_handle`, placementy instagramowe są wyszarzone z podpowiedzią
„uzupełnij nick na Instagramie w karcie klienta" — nie znikają po cichu.

Nad podglądem trzy listy rozwijane — **to serce ekranu reklam**:

```
Grafika:  [Wariant 1 ▾ z 6]     Tekst:  [Wariant A ▾ z 3]     Nagłówek: [Wariant 1 ▾ z 3]
```

- Zmiana dowolnej listy przerysowuje podgląd natychmiast. Klient może obejrzeć **każdą
  kombinację** — a jest ich do 6 × 3 × 3 = 54.
- Pod podglądem: „Zobacz wszystkie warianty" → siatka miniatur wszystkich grafik i lista
  wszystkich tekstów i nagłówków obok siebie, do porównania.
- Element reklamowy na Facebooku: nazwa strony, „Sponsorowane", tekst główny z „Zobacz więcej",
  grafika, pod nią pasek z wyświetlaną domeną, nagłówkiem, opisem i przyciskiem CTA.
  Na Instagramie: nick, „Sponsorowane", grafika, przycisk CTA nad opisem, tekst pod grafiką.
- **Komentarz można przypiąć do konkretnego wariantu** (`comments.variant_id`).
- Reklama **nie ma daty publikacji**. Zamiast niej: nazwa i cel kampanii.

### 7.5 Wymóg techniczny
Podglądy muszą być poprawne na telefonie (klient otwiera z WhatsAppa) i na desktopie.
Testy Playwright robią zrzuty każdego z podglądów w dwóch szerokościach (390 px i 1440 px)
i porównują z zatwierdzonymi wzorcami.

---

## 8. Harmonogram

**Zespół** (`content_creator`, `csm`, `admin`):
- Widok miesiąca z **przeciąganiem** materiałów między dniami (dnd-kit).
- Panel boczny „Niezaplanowane" — materiały bez `publish_at`.
- Ustawianie godziny publikacji, domyślnie z ustawień klienta (np. 12:00 i 18:00).
- Walidacja przy wysyłce do akceptacji: **każdy post i każda relacja musi mieć datę**;
  brak daty blokuje wysyłkę z komunikatem, który dokładnie mówi, czego brakuje.
- Kampanie reklamowe nie wchodzą do kalendarza — mają własną sekcję.
- Data zakończenia pakietu (`period_to`) = „dzień zakończenia" z planu contentu.

**Klient**: ten sam kalendarz, tylko do odczytu, z komentarzem przy każdym materiale.

To zastępuje dotychczasowy plan contentu robiony jako grafika.

---

## 9. Raporty

- Panel **nie generuje** raportów. System raportów działa i zostaje.
- `reports` trzyma link `https://raporty.foodiemedia.pl/r/<token>` + metadane.
- **Dwie drogi dodania:**
  1. **Ręcznie** — CSM wkleja link, wybiera miesiąc. 15 sekund. Działa od pierwszego dnia.
  2. **Webhookiem** — `POST /api/ingest/report` z nagłówkiem `Authorization: Bearer <INGEST_TOKEN>`,
     body `{ "client_slug": "...", "period": "2026-08", "url": "...", "title": "...", "cooperation_month": 5 }`.
     Podpinasz to w Zapierze do wiadomości ze Slacka.
- Start od bieżącego miesiąca. Starych raportów nie migrujemy.

---

## 10. Faktury i dokumenty

- Faktury wystawiacie w **Fakturowo** (fakturowo.pl). Do panelu wpisywane **ręcznie** przez
  CSM/admin: numer, daty, kwoty, status, PDF.
- Status **`po_terminie` liczony automatycznie** — cron codziennie o 6:00 przestawia
  `do_zaplaty` → `po_terminie`, gdy `due_date < today`. Ręcznie ustawia się tylko `oplacona`.
- Fakturowo udostępnia API (aktywacja jednorazowo 100 zł brutto): wystawianie, edycja
  i pobieranie dokumentów. Publiczna dokumentacja **nie potwierdza** pobierania listy faktur
  ze statusami płatności ani pobierania PDF, więc automatycznej synchronizacji **nie
  planujemy w MVP** — pole `fakturowo_id` zostaje w schemacie jako rezerwa. Decyzję
  o integracji podejmiemy po pilotażu, sprawdzając realny zakres API.
- **Bez linków do płatności w MVP.**
- Dokumenty: umowa, aneksy, umowa powierzenia przetwarzania. Upload PDF, kategoria, data.

---

## 11. Wdrożenie nowego klienta — przygotowane, wyłączone

Schemat i trasa istnieją, **flaga `onboarding_enabled = false`**, pozycja nie pojawia się
w nawigacji.

W kodzie ma zostać:
- tabela `onboarding_steps`,
- trasa `/p/[token]/wdrozenie` zwracająca 404 przy wyłączonej fladze,
- w panelu zespołu zakładka „Wdrożenie (wkrótce)" nieaktywna.

Docelowo: kroki z paskiem postępu, formularze Tally, Leadsie do zbierania dostępów do BM
i wizytówki Google, instrukcje wideo.

---

## 12. Panel zespołu

### 12.1 Pulpit
Jedna tabela, którą Gosia otwiera rano:

| Klient | Miesiąc | Status | Wysłano | Czeka | Auto-akcept za | Uwagi | Akcja |
|---|---|---|---|---|---|---|---|
| Nova Sushi | wrzesień | Do akceptacji v1 | 3 dni temu | 3 dni | **za 6 godz.** | 0 | Kopiuj dostęp |
| HipHipKura | wrzesień | Poprawki | — | — | wstrzymane | 3 | Zobacz uwagi |

Kolorystyka terminów **taka sama jak w Bazie Klientów** (niebieski 6–7 dni, żółty 4–5,
pomarańczowy 1–3, czerwony dziś, szary po terminie) — zespół zna ten kod.

Filtry: moi klienci / wszyscy (wg roli), status, miesiąc.

### 12.2 Karta klienta
Zakładki: **Materiały · Harmonogram · Raporty · Faktury · Dokumenty · Dostęp · Ustawienia**
Na górze: nazwa, kategoria, pakiet, kwota, lokale, kanał Slack, przycisk „Zobacz jak klient".

### 12.3 Kreator pakietu — praca na wklejanych linkach

Content creator **nie szuka folderów** i panel ich **nie zgaduje**. Wkleja gotowe linki,
bo to eliminuje najgorszy możliwy błąd: zaimportowanie materiałów z innego miesiąca.

1. **Klient i miesiąc.** Panel proponuje `location_id` na podstawie kategorii klienta.
2. **Link do folderu z contentem** — jeden folder, w którym są posty i relacje.
   Panel pokazuje **kartę weryfikacyjną** (rozdz. 13.2) i czeka na potwierdzenie.
3. **Kampanie.** Przycisk „Dodaj kampanię": nazwa, cel, notatka dla klienta i **link do
   folderu z reklamami** (grafiki + dokumenty z tekstami i nagłówkami).
   **Kampanii może być kilka** — standardowa, na imprezy okolicznościowe, na polubienia
   strony. Panel nie zakłada, że jest jedna.
4. **Import** → ekran mapowania (rozdz. 13.3).
5. Uzupełnienie opisów, daty publikacji, złożenie wariantów reklamowych.
6. **Podgląd oczami klienta** — te same komponenty co w panelu klienta.
7. Walidacja przed wysyłką (lista braków), potem „Wyślij do akceptacji".

### 12.4 Przekazanie dostępu klientowi

Panel **nie układa wiadomości**. Pokazuje dwa pola i przyciski kopiowania:

```
Link:  https://panel.foodiemedia.pl/p/a3f1…      [Kopiuj]
PIN:   4821                                      [Kopiuj]
                                                 [Kopiuj link i PIN]
```

- Wiadomość na WhatsAppie pisze człowiek. Panel nie generuje treści i nie otwiera WhatsAppa.
- **PIN pokazywany tylko przy pierwszym wygenerowaniu.** Potem widoczny jest wyłącznie
  przycisk „Zresetuj PIN" (reset wylogowuje wszystkie sesje tego linku).
- Skopiowanie i reset odnotowujemy w `audit_log`.

### 12.5 Skrzynka uwag
Jedna lista wszystkich nierozwiązanych komentarzy klientów ze wszystkich pakietów, z filtrem
po kliencie i typie. Zespół odpowiada stąd, oznacza „Załatwione".

### 12.6 Dodanie i podmiana materiału

Dwie operacje dostępne w każdej chwili, nie tylko przy tworzeniu pakietu:

**„Dodaj materiał"** — pojedynczy plik z komputera albo link do pojedynczego pliku na Dysku.
Wybierasz typ (post / relacja / reels / reklama w danej kampanii) i pozycję.
Nowy materiał dostaje `origin = 'dodatkowy'`.

**„Podmień materiał"** — wymienia grafikę lub wideo w istniejącym materiale.
Stary plik **nie znika**: dostaje `superseded_at` i `superseded_by`, więc historia zostaje.
Komentarze i pozycja materiału są zachowane.

Zachowanie zależy od statusu pakietu:

| Status pakietu | Co się dzieje |
|---|---|
| `szkic` | bez ograniczeń, bez plakietek |
| `do_akceptacji`, `poprawki` | materiał dostaje plakietkę **„Poprawione"** albo **„Nowe"**, zdarzenie w `package_events` |
| `zaakceptowany`, `zaplanowany` | modal z ostrzeżeniem „ten materiał jest już zaakceptowany", po potwierdzeniu: plakietka, `packages.changed_after_approval = true`, baner dla klienta i zdarzenie do `outbox` |

---

## 13. Import z Google Drive — na wklejanych linkach

### 13.1 Skąd biorą się linki
Content creator pracuje na Dysku wedle procesu agencji i **kopiuje link do folderu**, który
właśnie skończył. Struktura na Dysku pozostaje bez zmian:

```
Materiały klientów/
└── {Klient}/
    ├── content/
    │   └── content {N} mies/
    │       ├── 1. Posty/       ← grafiki + dokumenty z opisami
    │       └── 2. Relacje/     ← grafiki i wideo
    └── reklamy/
        └── reklamy {N} mies/   ← grafiki + dokumenty z tekstami i nagłówkami
```

Panel przyjmuje **link do folderu `content {N} mies`** (znajdzie w nim podfoldery „1. Posty"
i „2. Relacje") oraz **link do folderu z reklamami dla każdej kampanii z osobna**.
Jeśli kampanie mają w folderze reklam osobne podfoldery — wklejasz link do podfolderu.

**Dostęp:** konto usługi Google (service account), folder „Materiały klientów" udostępniony
na jego adres z prawem odczytu. Klucz w zmiennej środowiskowej, **nie w repo**.

Panel akceptuje wszystkie spotykane formaty adresu:
`/drive/folders/<id>`, `/drive/u/0/folders/<id>`, `?id=<id>`, `/file/d/<id>`.

### 13.2 Karta weryfikacyjna — zabezpieczenie przed pomyłką miesiąca

Zanim cokolwiek trafi do bazy, panel pokazuje:

- **pełną ścieżkę folderu na Dysku** (`Materiały klientów / Nova Sushi / content / content 5 mies`),
- liczbę plików i ich typy,
- datę ostatniej modyfikacji folderu,
- nazwy pierwszych kilku plików.

I ostrzega, gdy:
- folder **leży poza** „Materiałami klientów" → **import zablokowany**,
- nazwa folderu klienta na Dysku nie pasuje do wybranego klienta → ostrzeżenie,
- numer miesiąca w nazwie folderu nie zgadza się z wybranym miesiącem współpracy → ostrzeżenie,
- **ten sam folder był już importowany do innego pakietu** → ostrzeżenie z linkiem do tamtego
  pakietu i datą importu. To jest główne zabezpieczenie przed materiałami z innego miesiąca.

Ostrzeżenie da się świadomie zignorować (jednym kliknięciem, z zapisem w `audit_log`),
blokada dotycząca folderu spoza „Materiałów klientów" — nie.

### 13.3 Parowanie i mapowanie
- Grafiki sortowane **naturalnie** (`1, 2, …, 10`, nie `1, 10, 2`).
- Dokumenty Google eksportowane jako `text/plain`. Jeśli jeden dokument zawiera wszystkie
  opisy — dzielony po nagłówkach (`Post 1`, `Post 2`…), z podglądem podziału.
- W folderze z reklamami panel rozpoznaje: grafiki → warianty `grafika`,
  dokument → sekcje `Teksty` i `Nagłówki` → warianty `tekst` i `naglowek`.
- **Ekran mapowania jest obowiązkowy.** Człowiek widzi „grafika ↔ opis" i poprawia, zanim
  cokolwiek trafi do bazy. Nigdy nie tworzymy pakietu bez tego kroku.

### 13.4 Kopiowanie plików
- Pliki **kopiowane do Supabase Storage**, nie linkowane do Dysku: oryginał + `preview`
  1080 px webp + `thumb` 400 px webp. Dysk może zostać przemeblowany, archiwum panelu ma przetrwać.
- Ograniczenia: obraz ≤ 25 MB, **wideo ≤ 300 MB** (ostrzeżenie powyżej 150 MB),
  formaty `jpg/png/webp/heic` i `mp4/mov`. Plik ponad limit → import przerwany z jasnym
  komunikatem, który plik i ile waży.
- Import idzie w tle (`import_jobs`), z paskiem postępu, listą ostrzeżeń i możliwością ponowienia.
- Strip EXIF, sprawdzanie magic bytes.

**Szacunek objętości:** 80 klientów × ponad 20 plików × ~3 MB ≈ **5–7 GB/mies.**,
ok. **70 GB/rok** z wariantami. Supabase Pro (100 GB w cenie) wystarcza na pierwszy rok.

---

## 14. Design system

Z brandbooka 2025 i kierunku Foodie 2.0:

```css
--foodie-czern:  #1B1B1B;   /* tekst, tła sekcji ciemnych */
--foodie-fiolet: #7600F4;   /* akcent, CTA, aktywne stany */
--foodie-biel:   #FFFFFF;
/* pochodne do interfejsu (wyliczone, nie z brandbooka): */
--fiolet-050: #F4EDFE; --fiolet-100: #E4D3FD; --fiolet-600: #6600D6; --fiolet-700: #5200AB;
--szary-050: #FAFAFA; --szary-100: #F2F2F3; --szary-300: #D6D6D8; --szary-600: #6B6B70;
--zielony: #12855C;  /* zaakceptowany */
--bursztyn: #B45309; /* poprawki, ostrzeżenia */
--czerwony: #B42318; /* po terminie */
```

- **Font: Cal Sans** (nagłówki), self-hosted woff2 przez `next/font/local`.
  Tekst: **Inter**. Fallback: `system-ui, -apple-system, Segoe UI, sans-serif`.
- Logo Foodie: sygnet SVG (fioletowy na jasnym, biały na ciemnym).
- **Żadnego logo ani kolorów klienta w interfejsie panelu** — nagłówek, karty, nawigacja,
  faktury, raporty. Panel jest narzędziem Foodie Media i wygląda jak Foodie Media.
  Jedyny wyjątek: zdjęcie profilowe strony **wewnątrz ramki podglądu**, bo bez niego
  symulacja Facebooka przestaje być symulacją.
- Zaokrąglenia 12 px, cienie miękkie, dużo powietrza. Panel ma wyglądać na **premium
  narzędzie**, nie na arkusz.
- Tryb ciemny: **nie w MVP.** Jasny motyw, zdefiniowany explicite.
- Dostępność: kontrast AA, focus widoczny, obsługa klawiaturą w podglądach, `alt` na grafikach.
- Wszystkie teksty interfejsu w **jednym pliku** `lib/copy.ts`.

---

## 15. Powiadomienia i integracje

**Jeden generyczny webhook do Zapiera.** Panel nie zna Slacka — wysyła zdarzenie, Zapier
routuje do kanału klienta. Konfigurujesz Zapiera sam.

`POST {ZAPIER_WEBHOOK_URL}` z ciałem:
```json
{
  "event": "pakiet.zaakceptowany",
  "client_slug": "nova-sushi",
  "client_name": "Nova Sushi",
  "slack_channel": "#nova-sushi",
  "period": "2026-09",
  "actor": "Marek (właściciel)",
  "url": "https://panel.foodiemedia.pl/zespol/klienci/nova-sushi/pakiety/...",
  "summary": "Nova Sushi zaakceptowała materiały na wrzesień."
}
```

Zdarzenia:
| event | kiedy |
|---|---|
| `pakiet.wyslany` | CSM wysłał do akceptacji |
| `pakiet.otwarty` | klient otworzył pakiet pierwszy raz |
| `pakiet.zaakceptowany` | akceptacja ręczna |
| `pakiet.zaakceptowany_auto` | auto-akceptacja po 3 dniach |
| `pakiet.poprawki` | klient zgłosił uwagi (z liczbą uwag) |
| `komentarz.po_akceptacji` | uwaga po akceptacji |
| `material.podmieniony_po_akceptacji` | zespół podmienił materiał w zaakceptowanym pakiecie |
| `usluga.zainteresowanie` | klient kliknął „Chcę wiedzieć więcej" |
| `bezpieczenstwo.blokada` | 10 nieudanych PIN-ów |

Wysyłka przez tabelę `outbox` + cron co minutę, 5 prób z narastającym odstępem.
**Nigdy nie blokujemy odpowiedzi HTTP dla klienta czekaniem na webhook.**

**ClickUp: nie integrujemy.**
**WhatsApp: ręcznie** — panel udostępnia tylko link i PIN do skopiowania (rozdz. 12.4).

---

## 16. Bezpieczeństwo — wymogi twarde

1. **Żadnego klucza Supabase w przeglądarce dla danych klienta.** Wszystkie odczyty
   i zapisy panelu klienta idą przez Route Handlers / Server Actions z kluczem `sb_secret_…`,
   po sprawdzeniu sesji. Używamy nowych kluczy Supabase (`publishable` / `secret`) —
   stare `anon` i `service_role` są wycofywane do końca 2026.
2. **RLS włączone na każdej tabeli**, domyślnie brak polityk.
3. **Pliki w prywatnym buckecie.** Do wyświetlenia generujemy **signed URL ważny 10 minut**,
   zawsze po stronie serwera, zawsze po sprawdzeniu, że sesja ma prawo do tego klienta.
   Ścieżki w Storage nie zawierają nazwy klienta — `assets/{uuid}/...`.
4. **Izolacja klientów** — każde zapytanie o pakiet, komentarz, fakturę czy plik musi
   sprawdzić `client_id` z sesji. Jedna funkcja `assertClientAccess()`, używana wszędzie;
   test E2E ma próbować sięgnąć po zasób innego klienta i dostać 404 (nie 403).
5. **Sesje**: rotacja tokenu przy odświeżeniu, `expires_at` 30 dni, wygaszanie wszystkich
   sesji linku przy resecie PIN-u i przy `revoked_at`.
6. **CSP** bez `unsafe-inline` dla skryptów, `frame-ancestors 'none'`, HSTS,
   `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
7. **Bez `dangerouslySetInnerHTML`** dla czegokolwiek, co pochodzi od użytkownika.
8. **Audyt**: logowanie (udane i nieudane), otwarcie pakietu, akceptacja, komentarz,
   pobranie pliku, impersonacja, wygenerowanie linku, reset PIN-u, skopiowanie dostępu,
   import z Dysku, podmiana materiału, zmiana faktury.
9. **Sekrety** wyłącznie w zmiennych środowiskowych Vercela. `.env.local` w `.gitignore`.
10. **`robots.txt`**: `Disallow: /p/`, `Disallow: /zespol/`. Meta `noindex` na wszystkich trasach.
11. Upload plików: sprawdzanie **magic bytes**, nie tylko rozszerzenia; strip EXIF.

---

## 17. RODO

- **Dane w UE**: Supabase `eu-central-1` (Frankfurt), funkcje Vercel `fra1`.
- **Zakres danych osobowych**: imię i nazwisko, telefon, e-mail osób kontaktowych klienta.
  Nic więcej. Nie zbieramy danych gości restauracji.
- **Retencja materiałów: 24 miesiące** (`retention_months`). Cron miesięczny oznacza starsze
  pakiety i **zgłasza je do akceptacji admina** — nic nie kasuje się samo.
- **Retencja `audit_log`: 12 miesięcy.** Sesje wygasłe: kasowane po 90 dniach.
- **Offboarding klienta** = jeden przycisk „Zakończ współpracę": wygasza linki, wyloguje
  sesje, ustawia `status = zakonczony`. Osobny przycisk „Usuń dane klienta" kasuje wszystko
  ze Storage i bazy (z potwierdzeniem wpisaniem nazwy).
- **Umowa powierzenia przetwarzania** — dokument w sekcji Dokumenty każdego klienta.
- Strony statyczne: `/regulamin` (w tym **zasada auto-akceptacji**) i `/prywatnosc`.
- Cookies: wyłącznie techniczne. **Bez banera zgody.**

---

## 18. Kryteria odbioru

Panel jest gotowy, gdy przechodzą wszystkie poniższe testy E2E:

**Dostęp**
1. Otwarcie `/p/<zły-token>` → ten sam ekran co przy złym PIN-ie, bez wskazówki.
2. 5 złych PIN-ów → blokada na 15 min; 6. próba z **dobrym** PIN-em też odrzucona.
3. Po poprawnym PIN-ie sesja żyje po odświeżeniu i po 24 h.
4. Klient A nie otwiera pakietu klienta B (404), również przez bezpośredni URL do pliku.
5. Wygaszenie linku wylogowuje otwartą sesję przy następnym żądaniu.
6. Reset PIN-u wylogowuje wszystkie urządzenia tego linku.

**Akceptacja**
7. Pakiet 6 postów + 10 relacji + **2 kampanie** renderuje się na 390 px i 1440 px.
8. „Akceptuję wszystko" ustawia status, datę, osobę i wysyła zdarzenie do `outbox`.
9. „Zgłaszam uwagi" bez komentarza jest zablokowane z podpowiedzią.
10. Zgłoszenie uwag zatrzymuje licznik auto-akceptacji.
11. Cron auto-akceptacji po 72 godzinach ustawia `approval_kind = 'automatyczna'`
    i **nie rusza** pakietu z wyłączoną flagą ani pakietu w statusie `poprawki`.
    Przełączenie `auto_approve_business_days` na `true` zmienia liczenie na dni robocze.
12. Wysłanie v2 podbija `round`, restartuje licznik, pokazuje plakietki „Poprawione".
13. Komentarz po akceptacji nie zmienia statusu, ale wysyła zdarzenie.

**Kampanie i reklamy**
14. Przełączanie 6 grafik × 3 teksty × 3 nagłówki daje 54 poprawne kombinacje bez przeładowania,
    w każdym z sześciu placementów. Brak `ig_handle` wyszarza placementy instagramowe
    z podpowiedzią, zamiast je ukrywać.
15. Komentarz przypięty do wariantu wraca w panelu zespołu przy tym wariancie.
16. Dwie kampanie w jednym miesiącu są widoczne jako osobne sekcje i akceptowane razem.

**Import i podmiana**
17. Wklejenie linku do folderu **spoza** „Materiałów klientów" blokuje import.
18. Wklejenie folderu już użytego w innym pakiecie pokazuje ostrzeżenie z linkiem do tamtego pakietu.
19. Podmiana materiału w pakiecie `zaakceptowany` wymaga potwierdzenia, zapisuje zdarzenie,
    oznacza materiał plakietką i pokazuje klientowi baner.
20. Stary plik po podmianie nadal istnieje z `superseded_at`.

**Harmonogram**
21. Wysyłka pakietu z postem bez daty publikacji jest zablokowana z listą braków.
22. Klient nie może przesunąć materiału w kalendarzu (brak uchwytów, brak endpointu).

**Zespół**
23. `content_creator` dostaje 404 na trasie faktur.
24. `csm` widzi tylko przypisanych klientów.
25. Impersonacja blokuje przyciski decyzji i zapisuje wejście do `audit_log`.

**Wygląd**
26. Zrzuty podglądów zgodne ze wzorcami w obu szerokościach: post, relacja i Reels na
    Facebooku oraz reklama w sześciu placementach (cztery FB, dwa IG).

---

## 19. Fazy budowy

Każda faza kończy się **działającym wdrożeniem na Vercelu**, nie tylko kodem.

| Faza | Zakres | Definicja ukończenia |
|---|---|---|
| **0. Fundament** | repo, Next.js, Tailwind, shadcn, Supabase, migracje, seed 3 klientów (po jednym z każdej kategorii, jeden z dwiema kampaniami), design system, `/regulamin`, `/prywatnosc` | strona startowa w brandzie na domenie testowej |
| **1. Dostęp** | magic link + PIN, sesje, rate limit, panel zespołu z logowaniem, role, `audit_log`, kopiowanie linku i PIN-u | testy 1–6 przechodzą |
| **2. Serce** | pakiety, kampanie, itemy, warianty, podglądy Facebooka, akceptacja, komentarze, rundy, auto-akceptacja | testy 7–16 przechodzą |
| **3. Zespół** | kreator pakietu, upload, dodawanie i podmiana materiałów, harmonogram z przeciąganiem, pulpit, skrzynka uwag, impersonacja | testy 19–25 przechodzą |
| **4. Import z Dysku** | service account, import po wklejonym linku, karta weryfikacyjna, wykrywanie powtórnego folderu, parowanie, ekran mapowania, warianty obrazów, kolejka | testy 17–18 przechodzą; import realnego miesiąca dla jednego klienta bez ręcznych poprawek |
| **5. Reszta panelu klienta** | raporty, faktury, dokumenty, pakiet, usługi dodatkowe, webhook Zapier, cron statusów faktur | pierwszy klient dostaje link |
| **6. Utwardzenie** | CSP, testy bezpieczeństwa, retencja, offboarding, kopie zapasowe, dokumentacja obsługi | audyt kryteriów 1–26, przekazanie zespołowi |

**Pilotaż:** faza 5 kończy się jednym klientem, miesiąc obserwacji, dopiero potem reszta.

---

## 20. Decyzje podjęte bez Ciebie — do potwierdzenia

| # | Sprawa | Decyzja | Status |
|---|---|---|---|
| 1 | Stack (odpowiedź „dom") | Odczytane jako „domyślnie" = Next.js + Supabase + Vercel | do potwierdzenia |
| 2 | Logowanie e-mail + hasło | **Nie robimy.** Tylko link + PIN | do potwierdzenia |
| 3 | Maksymalna waga wideo | 300 MB, ostrzeżenie od 150 MB; obrazy 25 MB | do potwierdzenia |
| 4 | „Wrażliwe rzeczy" dla CSM | Ustawienia systemu, konta zespołu, logi bezpieczeństwa, eksport bazy, przychody zbiorcze. Faktury swoich klientów — dostępne | do potwierdzenia |
| 5 | RODO | Serwery UE, retencja 24 mies., audyt 12 mies., offboarding jednym przyciskiem | do potwierdzenia |
| 6 | Zakres MVP | Wszystko naraz, w 7 fazach z wdrożeniem po każdej | ustalone |
| 7 | Dni auto-akceptacji | **3 dni kalendarzowe (72 h)**; przełącznik na dni robocze zostaje w ustawieniach | **potwierdzone** |
| 8 | Linki dostępu | **Osobny link i PIN na każdą osobę kontaktową**, żeby wiedzieć, kto zaakceptował | **potwierdzone** |
| 9 | Tryb ciemny | Nie w MVP | ustalone |
| 10 | Płatności z panelu | Nie w MVP | ustalone |
| 11 | Integracja z Fakturowo | Nie w MVP — API istnieje, ale nie potwierdza pobierania statusów i PDF. Decyzja po pilotażu | do potwierdzenia |
| 12 | Awatar w podglądach | **Zdjęcie profilowe strony klienta, wyłącznie wewnątrz ramki podglądu.** Poza ramką logo klienta nie występuje | **potwierdzone** |
| 13 | Podglądy contentu | Wyłącznie Facebook — post, relacja, Reels | **potwierdzone** |
| 14 | Placementy reklam | **Sześć: FB kanał (telefon), FB kanał (komputer), FB relacje, FB Reels, IG kanał, IG relacje i Reels** | **potwierdzone** |

**Zadanie dla Ciebie, nie dla kodu:** dopisać zasadę auto-akceptacji do regulaminu panelu
i wspomnieć o niej w umowie lub aneksie.
