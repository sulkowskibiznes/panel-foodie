# Sesja startowa: plan faz 0 i 1, krytyka SPEC.md, decyzje, lista dla Ciebie

## Kontekst

Repo `panel-foodie` zawiera dziś tylko `CLAUDE.md`, `docs/SPEC.md` (v1.2), `docs/PROMPT-STARTOWY.md`,
`docs/PROMPTY-FAZ.md` i katalog `brand/`. Nie ma `git init`, nie ma kodu. Ta sesja nie pisze kodu
produkcyjnego. Dostarcza cztery rzeczy, o które prosisz w prompcie startowym, plus listę odchyleń
od schematu, które muszę mieć potwierdzone, zanim napiszę pierwszą migrację (CLAUDE.md, „Gdy utkniesz").

Cel nadrzędny, przez który filtruję każdą decyzję niżej: skrócić drogę od „materiały gotowe" do
„klient kliknął akceptuję". Tam, gdzie spec i ten cel się rozjeżdżają, piszę to wprost.

**Stan maszyny (sprawdzone):** Node v24.20.0 i pnpm są w `~/.nvm/versions/node/v24.20.0/bin`, ale nie ma
`~/.zshrc`, więc żadna nieinteraktywna powłoka (w tym moja) ich nie widzi. Brak: Homebrew, Docker,
Supabase CLI, Vercel CLI, gh. Jest git 2.50. Wnioski w sekcji 6.

**Założenia wersji:** Next.js 16.x (spec mówi „15+"; 16 jest stabilne od jesieni 2025, `proxy.ts`
zamiast `middleware.ts`), React 19, Tailwind 4 (tokeny w CSS przez `@theme`), shadcn/ui na Tailwind 4,
Node 24, pnpm 10. Po scaffoldingu poprawiam wersję w `CLAUDE.md`.

---

## 1. Faza 0: Fundament

Gałąź `faza/0-fundament`. Commit po każdym kroku. Kolejność jak w `PROMPTY-FAZ.md`: **schemat pokazuję
Ci przed napisaniem migracji** (sekcja 3 tego planu jest tą prezentacją).

### Krok 0.1: repo i narzędzia
- `git init`, `.gitignore` (node, `.env*.local`, `.next`, `supabase/.temp`, `playwright-report`, `test-results`).
- `.nvmrc` = `24`, `package.json` z `"packageManager": "pnpm@10.x"`.
- Supabase CLI jako devDependency (`supabase`), żeby nie wymagać Homebrew. Skrypt `pnpm db:*` woła `pnpm exec supabase`.

### Krok 0.2: scaffold Next.js
- `create-next-app` (App Router, TS strict, Tailwind, ESLint, `src/`), potem `shadcn init`.
- Pliki: `next.config.ts` (nagłówki: HSTS, `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`; pełne CSP z nonce zostaje w fazie 6 zgodnie ze spec-em), `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`), `eslint.config.mjs`, `vercel.json` (`"regions": ["fra1"]`, pusta lista cronów).
- `src/lib/env.ts`: walidacja zmiennych przez `zod` przy starcie, osobno `server` i `client` (tylko `NEXT_PUBLIC_APP_URL`).
- `.env.example` ze wszystkimi zmiennymi z CLAUDE.md, `.env.local` z pustymi polami (Ty uzupełniasz w edytorze).

### Krok 0.3: design system i marka
- `brand/cal-sans-*.woff2` → `src/app/fonts/`, licencja OFL → `src/app/fonts/LICENSE-cal-sans.txt`. `next/font/local` z **dwoma** `@font-face` (`latin` i `latin-ext` z `unicode-range`). Inter przez `next/font/google` (pobierany w buildzie, serwowany z naszej domeny, zero requestów do Google w przeglądarce).
- `brand/sygnet-*.svg` → `public/`. Komponent `src/components/marka/sygnet.tsx` (wariant `fiolet` | `bialy`).
- `src/app/globals.css`: tokeny z rozdz. 14 jako zmienne CSS i `@theme` Tailwinda (`--foodie-fiolet`, `--zielony`, `--bursztyn`, `--czerwony`, skala szarości, promień 12 px). Dodatkowo tokeny kolorów terminów z Bazy Klientów (niebieski/żółty/pomarańczowy/czerwony/szary) pod pulpit zespołu.
- shadcn: `button`, `card`, `input`, `badge`, `dialog`, `tabs`, `tooltip`, `sheet`, `sonner`, `checkbox`, `select`.
- `src/lib/copy.ts`: wszystkie teksty. Test jednostkowy pilnuje, że żaden tekst nie zawiera pauzy ani półpauzy.

### Krok 0.4: Supabase i migracje
- `pnpm exec supabase init`, `supabase/config.toml` (auth: OTP e-mail, podpisy `sb_publishable`/`sb_secret`).
- Migracje tematyczne w `supabase/migrations/` (każda tabela z `enable row level security` w tej samej migracji):
  1. `typy` (wszystkie enumy, także te dopisane, sekcja 3),
  2. `klienci` (`clients`, `locations`, `client_contacts`),
  3. `zespol` (`team_members`, `client_assignments`),
  4. `dostep` (`access_links`, `client_sessions`, `rate_limits`),
  5. `pakiety` (`packages`, `campaigns`, `package_items`, `item_assets`, `ad_variants`, `comments`, `package_events`),
  6. `import` (`import_jobs`),
  7. `raporty_faktury_dokumenty`,
  8. `uslugi_wdrozenie` (`services`, `service_interests`, `onboarding_steps`),
  9. `infrastruktura` (`audit_log`, `outbox`, `settings` + wiersze domyślne, funkcja `set_updated_at()`),
  10. `storage` (prywatne buckety `materialy`, `dokumenty`, `faktury`, `awatary`).
- `src/lib/supabase/server.ts` z `import 'server-only'` i kluczem `sb_secret_`. Żadnego klienta Supabase w komponentach klienckich.
- `pnpm db:types` → `src/lib/db-types.ts`.
- Test jednostkowy `tests/unit/rls.test.ts`: zapytanie do `pg_class` musi zwrócić zero tabel w `public` bez RLS. To pilnuje zasady 3 z CLAUDE.md automatycznie.

### Krok 0.5: seed
- `supabase/seed/seed.ts` (uruchamiany przez `tsx`, klucz secret, lokalnie lub na projekt testowy).
- Trzech klientów: kat1 z dwiema różnymi restauracjami (dwa pakiety), kat2 z pięcioma lokalami na jednym profilu (jeden pakiet, jedna kampania), kat3 z trzema lokalami na osobnych profilach (jeden pakiet, **dwie kampanie**: standardowa i na imprezy okolicznościowe).
- Każdy pakiet: 6 postów, 10 relacji, kampanie z 6 grafikami × 3 teksty × 3 nagłówki + opis, CTA, link.
- Grafiki zastępcze generowane przez `sharp` w seedzie (kolorowe kwadraty 1:1 i 4:5 z numerem) i wgrywane do bucketu `materialy` jako oryginał + `preview` + `thumb`. Dzięki temu faza 2 od razu ma na czym renderować podglądy.
- Zespół z `team_members` (dane od Ciebie, pytanie P8), `services` (7 usług z rozdz. 5.8), `settings`.
- Tokeny i PIN-y **wyłącznie** z generatora w `src/lib/auth-klient.ts` (`crypto.randomBytes`). Seed wypisuje link i PIN na stdout raz, nic nie zapisuje w plikach.

### Krok 0.6: strony
- `src/app/layout.tsx` (fonty, `metadata.robots = noindex, nofollow, noarchive`, neutralne OG „Panel klienta Foodie Media").
- `src/app/page.tsx`: strona startowa w brandzie (sygnet, jedno zdanie, link do regulaminu). Bez niczego o klientach.
- `src/app/regulamin/page.tsx`, `src/app/prywatnosc/page.tsx`: szkielet z nagłówkami sekcji do wypełnienia (w tym pusta sekcja „Automatyczna akceptacja").
- `src/app/robots.ts`: `Disallow: /p/`, `Disallow: /zespol/`. `src/app/not-found.tsx` w brandzie.

### Krok 0.7: testy i CI
- `vitest.config.ts`, `tests/unit/` (copy, rls, env). `playwright.config.ts` (projekty `mobile-390` i `desktop-1440`, `webServer`, `globalSetup` = `supabase db reset` + seed na lokalnym stacku).
- `tests/e2e/dymny.spec.ts`: strona startowa renderuje sygnet, nagłówek w Cal Sans, `/regulamin` odpowiada 200.
- `.github/workflows/ci.yml`: typecheck, lint, test, build; E2E dochodzi w fazie 1 (Supabase CLI w CI potrafi postawić lokalny stack).

### Krok 0.8: wdrożenie i POSTEP
- Vercel z GitHuba, region `fra1`, zmienne środowiskowe, wdrożenie na domenie testowej.
- `docs/POSTEP.md`: tabela 26 kryteriów z rozdz. 18 (wszystkie puste) + sekcja „Faza 0: co działa / odłożone / do decyzji".
- Definicja ukończenia: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone, `supabase db reset` wchodzi bez błędu, strona startowa widoczna na adresie testowym.

---

## 2. Faza 1: Dostęp

Gałąź `faza/1-dostep`. Testy 1–6 z rozdz. 18 pisane **razem** z kodem, nie po.

### Krok 1.1: kryptografia i sesje (`src/lib/`)
- `krypto.ts`: `sha256`, `hmac`, `timingSafeEqual`, szyfrowanie AES-256-GCM, `hashujIp` (z pieprzem). Trzy klucze wyprowadzane z `SESSION_SECRET` przez HKDF (podpis cookie, szyfrowanie tokenu, pieprz IP). Jeden sekret w Vercelu, zero nowych zmiennych.
- `auth-klient.ts`:
  - `generujToken()` = `randomBytes(16).toString('hex')`; `token_lookup` = 8 pierwszych znaków; `token_hash` = sha256; `token_enc` (decyzja D1).
  - `generujPin(pin_kind)` z `randomBytes` z odrzucaniem (bez błędu modulo); `hashujPin` / `weryfikujPin` przez `@node-rs/argon2` (argon2id). Ścieżka „zły token" **zawsze** wykonuje jedno `verify` na stałym hashu-atrapie, żeby czas był identyczny ze ścieżką „zły PIN".
  - `utworzSesje()`: losowe 32 bajty → `session_hash` w bazie, cookie `__Host-fm_sesja` = `token.hmac`, `httpOnly`, `Secure`, `SameSite=Lax`, 30 dni (bez `Max-Age`, gdy klient odznaczy „Zapamiętaj mnie").
  - `pobierzSesjeKlienta()` (owinięte w `cache()`): czyta cookie, sprawdza HMAC, wiersz sesji, `revoked_at`, `expires_at`, `revoked_at` linku, oraz że `token_hash` linku zgadza się z tokenem z URL. Rotacja: nowy token sesji, gdy od `rotated_at` minęły 24 h, stary ważny jeszcze 2 min (równoległe żądania).
  - `uniewaznijSesjeLinku()` (reset PIN-u, wygaszenie, „Wyloguj wszystkie urządzenia").
- `limity.ts`: blokada linku (5 → 15 min, 10 w oknie godziny → 24 h + `outbox` `bezpieczenstwo.blokada`) i limit IP 20/10 min na tabeli `rate_limits` (bez Redisa, atomowy `upsert ... returning`).
- `dostep.ts`: `assertClientAccess(sessionClientId, resourceClientId)` → `notFound()`. Jedyne miejsce. Test jednostkowy.
- `auth-zespol.ts`: `@supabase/ssr` z kluczem publishable **tylko** do Auth; `pobierzCzlonkaZespolu()` (auth user → `team_members` z `active = true`), `wymagajRoli()`, `assertTeamClientAccess(czlonek, clientId)` (admin i sales: wszyscy; reszta: `client_assignments`).
- `uprawnienia.ts`: macierz z rozdz. 2 jako dane + test jednostkowy, żeby zmiana roli była zmianą w jednym miejscu.
- `audyt.ts`, `outbox.ts`: `zapiszAudyt()`, `dodajDoOutbox()`. Nic nie czeka na webhook.
- `kontekst-klienta.ts`: `pobierzKontekstKlienta()` zwraca `{ clientId, contactId, accessLinkId, tryb: 'klient' }`. W fazie 3 dojdzie `tryb: 'podglad'` z sesji zespołu. Wszystkie strony klienta biorą kontekst stąd, więc impersonacja nie rozwidli kodu.
- Zasada DTO: strony klienta mapują wiersze na typy z `src/lib/dto/` (nigdy surowy wiersz do komponentu). To zamyka wycieki `internal_note` zanim powstaną.

### Krok 1.2: trasy klienta (`src/app/p/[token]/`)
- `page.tsx`: bez sesji → ekran PIN (mobile first: `inputmode="numeric"`, autowysyłka po 4 cyfrach, checkbox „Zapamiętaj mnie" zaznaczony). Z sesją → redirect do `start`. Zły token pokazuje **ten sam** ekran PIN.
- `akcje.ts`: server action `zalogujPinem()`: limit IP → link po `token_lookup` → `timingSafeEqual` na `token_hash` → blokady → argon2 → sesja → audyt (udane i nieudane). Jeden komunikat błędu z `copy.ts`: co zrobić, nie co się zepsuło.
- `(panel)/layout.tsx`: wymaga sesji; nawigacja dolna (mobile) / boczna (desktop) z pozycjami z rozdz. 5 (aktywna w fazie 1 tylko Start).
- `(panel)/start/page.tsx`: „Wszystko na bieżąco" jako placeholder. `(panel)/wyloguj/route.ts`.
- `wdrozenie/page.tsx`: `notFound()` przy `onboarding_enabled = false` (rozdz. 11).

### Krok 1.3: panel zespołu (`src/app/zespol/`)
- `logowanie/page.tsx` + `akcje.ts`: e-mail → sprawdzenie w `team_members` (i domeny z `TEAM_EMAIL_ALLOWLIST`) → `signInWithOtp` → pole na kod. Nieznany e-mail dostaje ten sam komunikat co znany.
- `(panel)/layout.tsx`: wymaga członka zespołu; `page.tsx`: lista klientów wg roli (zalążek pulpitu z 12.1, kolumny statusów dojdą w fazie 3).
- `(panel)/klienci/[slug]/layout.tsx`: nagłówek karty (nazwa, kategoria, pakiet, kwota, lokale, Slack) i zakładki z 12.2; w fazie 1 aktywna **Dostęp**, `faktury/page.tsx` już zwraca 404 dla `content_creator` (test 23 przy okazji).
- `(panel)/klienci/[slug]/dostep/page.tsx` + `akcje.ts`: lista linków, „Utwórz link" (wybór kontaktu, `pin_kind`), dialog z **dwoma polami i trzema przyciskami kopiowania** (link, PIN, oba) pokazany raz, „Wygaś link", „Wyloguj wszystkie urządzenia", „Zresetuj PIN", „Historia logowań" z `audit_log`. Kopiowanie i reset trafiają do `audit_log`.
- Komponenty: `src/components/zespol/pola-kopiowania.tsx` (jedyny komponent kliencki z `navigator.clipboard`), `dialog-nowego-linku.tsx`, `lista-linkow.tsx`.
- Admin: `(panel)/ustawienia/zespol/page.tsx`: dodanie członka tworzy usera w Supabase Auth przez admin API (rejestracja publiczna wyłączona, pytanie P10).

### Krok 1.4: testy
- Jednostkowe: format tokenu i PIN-u, brak powtórzeń generatora, argon2 round-trip, arytmetyka blokad (5/15 min, 10/godz.), obie ścieżki błędu wykonują dokładnie jedno `verify`, HMAC cookie, `assertClientAccess`, macierz ról.
- E2E `tests/e2e/dostep.spec.ts` (kryteria 1–6) na lokalnym Supabase; pomocnicze `tests/e2e/pomocnicze/{baza,klient,czas,mailpit}.ts`: tworzenie linku generatorem z ustalonym ziarnem, przesuwanie `created_at` sesji o 25 h (kryterium 3), wygaszenie i reset PIN-u przez UI zespołu (logowanie OTP z Mailpita w lokalnym stacku).
- Definicja ukończenia: 1–6 zielone lokalnie i w CI, wdrożenie na Vercelu, `POSTEP.md` z odhaczonymi 1–6.

---

## 3. Odchylenia od schematu z rozdz. 3 (do potwierdzenia przed migracjami)

Pozycje oznaczone **[PYT]** dotykają `packages` / `package_items` / `ad_variants` albo sesji i wymagają Twojego „tak" zgodnie z CLAUDE.md. Reszta to poprawki, które wprowadzam, chyba że zaprotestujesz.

| # | Zmiana | Dlaczego |
|---|---|---|
| S1 **[PYT]** | `packages`: `unique nulls not distinct (client_id, location_id, period_year, period_month)` | W Postgresie zwykły `unique` traktuje `NULL` jako różne wartości, więc dla kat2/kat3 (`location_id = null`) da się założyć dowolnie wiele pakietów na ten sam miesiąc. Błąd w SQL spec-u. |
| S2 **[PYT]** | `package_items`: `check ((type = 'reklama') = (campaign_id is not null))`, `check (type <> 'reklama' or publish_at is null)` | Spec opisuje te reguły w komentarzach; baza ma je egzekwować. |
| S3 **[PYT]** | `ad_variants.location_id uuid null references locations` | Decyzja D2 (jeden materiał reklamowy na kampanię, warianty per lokal). |
| S4 **[PYT]** | `updated_at` + trigger na `clients`, `locations`, `packages`, `campaigns`, `package_items`, `item_assets`, `ad_variants`, `comments`, `invoices` | Bez tego nie da się uczciwie policzyć „zmienione po wysyłce" ani „zmienione po akceptacji" (pytania P13, P15). |
| S5 **[PYT]** | `access_links`: `token_enc text` (D1), `failed_window_started_at timestamptz` (okno „10 w godzinę"), `can_approve boolean default true` (P3) | `failed_attempts` bez znacznika czasu nie pozwala policzyć okna godzinnego. |
| S6 **[PYT]** | `client_sessions`: `rotated_at`, `previous_session_hash`, indeks `(access_link_id)` | Rotacja z 2‑minutową łaską dla równoległych żądań. |
| S7 | Nowa tabela `rate_limits (key text pk, window_started_at, count)` z RLS | Limit na IP z 4.3 bez Redisa. |
| S8 | `clients`: `auto_approve_default boolean default true`, `opiekun_id uuid references team_members` (P4), `auto_approve_hours int null` (P5) | Rozdz. 6.4 mówi o wyłączaniu auto‑akceptacji „na karcie klienta", ale kolumny nie ma. Rozdz. 5.7 pokazuje „dane opiekuna", ale nic nie mówi, kto nim jest. |
| S9 | Kolumny `text` z listą wartości w komentarzu → enumy: `client_status`, `approval_kind`, `pin_kind`, `author_kind`, `actor_kind`, `item_origin`, `campaign_goal`, `import_kind`, `import_status`, `outbox_status`, `document_kind`, `report_source`, `package_event_kind` | Spójność z resztą schematu i darmowe typy unii w `db-types.ts` pod TS strict. |
| S10 | Indeksy: `packages (client_id, status)`, częściowy `packages (auto_approve_at) where status = 'do_akceptacji'`, `package_items (package_id, position)`, `item_assets (item_id)`, `ad_variants (item_id)`, `comments (package_id, created_at)`, częściowy `comments (package_id) where resolved_at is null`, `package_events (package_id, created_at)`, `outbox (status, created_at)`, `access_links (client_id)`, `invoices (client_id, status)` | Spec ma tylko dwa indeksy. Cron auto‑akceptacji i pulpit bez nich będą skanować tabele. |
| S11 | Ścieżki w Storage: `{client_id}/{asset_id}/{original.ext | preview.webp | thumb.webp}`; buckety `materialy`, `dokumenty`, `faktury`, `awatary` (prywatne) | Spec mówi „assets/{uuid}/…" bez doprecyzowania. `client_id` w ścieżce daje tanie „Usuń dane klienta" w fazie 6 i nie zdradza nazwy. |
| S12 | `settings`: usuwam klucz `zapier_webhook_url` | Ta sama wartość jest w `ZAPIER_WEBHOOK_URL`. Jedno źródło: env. |
| S13 | `reports.location_id uuid null` + `unique nulls not distinct (client_id, location_id, period_year, period_month)` | Warunkowo, jeśli P6 = „raport per lokal". |
| S14 (faza 2) | `item_views (item_id, access_link_id, first_viewed_at)` oraz `comments.seen_by_client_at` | Pasek „Obejrzano 12 z 19" (6.2) i plakietki „nieprzeczytane komentarze zespołu" nie mają w spec-u żadnej tabeli. Wspominam teraz, tworzę w fazie 2. |

---

## 4. Co w SPEC.md jest niedookreślone albo sprzeczne

### 4.1 Uprawnienia (rozdz. 2)

- **U1. `sales` ma impersonację, ale nie ma dostępu do faktur.** Rozdz. 2 daje „Zobacz jak klient" roli `sales`, a zakładka Faktury (5.6) jest częścią widoku klienta. Sprzeczność. Rekomendacja: `sales` nie dostaje impersonacji, dostaje **klienta demonstracyjnego** z seedu (pokazywanie panelu potencjalnym klientom to jego realny przypadek użycia, a nie zaglądanie do faktur istniejących). Alternatywa: impersonacja ukrywa zakładki, do których rola nie ma prawa, ale wtedy „widzę dokładnie to, co klient" przestaje być prawdą. → P7.
- **U2. `media_buyer` ma „Materiały: podgląd", ale ktoś musi wypełnić warianty `cta`, `link`, `opis` i cel kampanii.** Content creator wkleja folder z grafikami i tekstami; link do Restaumatica i CTA to wiedza media buyera. Rekomendacja: `media_buyer` dostaje **edycję kampanii i `ad_variants`**, nadal bez edycji postów i relacji. Uprawnienia zapisuję jako macierz zasób × rola, nie kolumnę „Materiały".
- **U3. Kto jest opiekunem klienta?** `client_assignments` nie ma roli w kontekście klienta, a 5.7 pokazuje klientowi „dane opiekuna". Przy dwóch przypisanych osobach (CSM + content creator) nie wiadomo, kogo pokazać. Rekomendacja: `clients.opiekun_id` (S8) + `client_assignments` dla reszty. → P4.
- **U4. Allowlista zespołu: trzy różne definicje.** SPEC 2: „adresy z allowlisty"; PROMPTY-FAZ: „allowlista domen"; CLAUDE.md: `TEAM_EMAIL_ALLOWLIST` = adresy. Adresy w zmiennej środowiskowej oznaczają redeploy przy każdym nowym pracowniku. Rekomendacja: env trzyma **domeny** (`foodiemedia.pl`) jako gruby filtr, a prawdziwą allowlistą jest `team_members.active`, zarządzana przez admina w panelu; rejestracja publiczna w Supabase Auth wyłączona, konta tworzy panel przez admin API. → P10.
- **U5. Kto po stronie klienta może akceptować?** Każdy kontakt z linkiem (4.1). Menedżer zmiany z linkiem „do oglądania" może kliknąć „Akceptuję wszystko" w imieniu właściciela. Rekomendacja: `access_links.can_approve` (S5), domyślnie `true`, CSM odznacza przy tworzeniu linku „tylko podgląd". Kosztuje jedną kolumnę teraz, migrację wszystkich linków później. → P3.
- **U6. Pierwszy admin.** Nikt nie może dodać admina, zanim admin istnieje. Seed tworzy Twoje konto z listy w P8.

### 4.2 Przejścia statusów (rozdz. 6.8)

- **T1. Brak przejścia `zaakceptowany → poprawki`**, choć 6.6 mówi o przycisku „Cofnij do poprawek". Dopisuję do maszyny stanów (zespół, z powodem w `package_events`).
- **T2. Brak przejścia `do_akceptacji → szkic` („Wycofaj").** Wysłano zły miesiąc albo za wcześnie. Cały rozdz. 13 broni się przed materiałami z innego miesiąca, a nie ma sposobu, żeby wycofać już wysłany pakiet inaczej niż przez kasowanie. Rekomendacja: dopisać „Wycofaj do szkicu" (zeruje `submitted_at`, `auto_approve_at`; `round` bez zmian; klient widzi „Nic nie czeka"). → P19.
- **T3. Czy `zaplanowany` jest naprawdę końcowy?** Podmiana po zaplanowaniu jest dozwolona (12.6), więc status zostaje, a materiał dostaje plakietkę. Spójne. Ale „Cofnij do poprawek" z `zaplanowany` też ma sens (klient dopisał „Uwaga po akceptacji" i zespół chce ją realnie obsłużyć). Rekomendacja: dozwolone, zespół. → P19.
- **T4. Klient w `poprawki` nie może już zaakceptować.** Zmienił zdanie („jednak OK"), a spec każe czekać na v2. Rekomendacja zachowawcza: zostawić jak w spec-u (zespół mógł już zacząć podmieniać pliki, a klient zaakceptowałby stan pośredni), ale **„Wyślij v2" ma działać bez obowiązkowej zmiany materiałów**, jednym kliknięciem. Tarcie ląduje po stronie zespołu, nie klienta. → P15.
- **T5. `round` przy „Wycofaj + wyślij ponownie".** Definiuję: `round` rośnie wyłącznie na `poprawki → do_akceptacji`.
- **T6. Nie ma migawki tego, co klient zaakceptował.** `changed_after_approval` dotyczy tylko podmiany pliku (12.6). Edycja `caption` albo `naglowek` po akceptacji nie zostawia śladu, a przy sporze („nie to akceptowałem") panel nie ma dowodu. Rekomendacja: zdarzenie `zaakceptowany` zapisuje w `payload` listę `item_id` + `asset_id` + skróty treści; każda edycja treści w `zaakceptowany`/`zaplanowany` idzie tą samą ścieżką co podmiana pliku (plakietka, flaga, baner). Faza 2, ale wymaga S4.

### 4.3 Auto-akceptacja (rozdz. 6.4)

- **A1. Zmiana materiałów w trakcie `do_akceptacji` nie rusza licznika.** Zespół może podmienić pięć z sześciu postów na godzinę przed auto‑akceptacją i klient zaakceptuje „automatycznie" rzeczy, których nie widział. To wprost łamie „musi być uczciwa". Rekomendacja: dodanie albo podmiana materiału w `do_akceptacji` ustawia `auto_approve_at = max(auto_approve_at, teraz + 24 h)` i wysyła zdarzenie. Uważam brak tej zasady za błąd spec-u. → P13.
- **A2. Nierozwiązane uwagi klienta nie zatrzymują licznika, tylko przycisk.** Klient, który napisał trzy komentarze i nie kliknął „Zgłaszam uwagi" (bo na telefonie nie zauważył przycisku), zostanie auto‑zaakceptowany wbrew temu, co napisał. Rekomendacja: komentarze nie zatrzymują licznika (to by było niejasne dla klienta), ale **cron nie auto‑akceptuje pakietu z nierozwiązanymi uwagami klienta z bieżącej rundy**; zamiast tego wysyła `pakiet.auto_wstrzymana_uwagi` do zespołu, a CSM decyduje. → P14.
- **A3. „Zaokrąglenie do pełnej godziny": w górę czy w dół?** Rekomendacja: w górę (klient nigdy nie dostaje mniej niż 72 h). Cron auto‑akceptacji co godzinę o pełnej.
- **A4. Klient bez otwartego linku nie ma żadnego kanału powiadomień.** Licznik widać dopiero po wejściu. Jedyne, co panel ma, to webhooki do zespołu. Rekomendacja: dwa zdarzenia więcej w rozdz. 15: `pakiet.nieotwarty_po_24h` i `pakiet.auto_za_24h`, żeby CSM miał konkretny moment na WhatsAppową szturchańcę. → P20.
- **A5. Dni robocze bez definicji.** Pon–pt? Święta polskie? Rekomendacja w MVP: pon–pt w `Europe/Warsaw`, bez świąt; lista świąt to osobna decyzja, jeśli przełącznik kiedykolwiek zostanie włączony. → P18.
- **A6. Wyłączenie auto‑akceptacji „dla klienta" nie ma kolumny.** S8.
- **A7. `auto_approve_days` jest globalne.** Jeśli jeden klient wynegocjuje 5 dni, nie ma gdzie tego wpisać. Rekomendacja: `clients.auto_approve_hours` jako nadpisanie (S8). → P5.
- **A8. Zmiana ustawienia po wysyłce.** Test 11 mówi o przełączeniu na dni robocze. Definiuję: dotyczy pakietów wysłanych po zmianie; istniejących `auto_approve_at` nie przeliczam.

### 4.4 Pakiet → kampanie → materiały (rozdz. 3, 3.1)

- **M1. Unikalność pakietu przy `location_id = null`.** S1, błąd.
- **M2. kat2: „osobny `reklama` item na lokal".** Pięć identycznych lokali = pięć niemal identycznych sekcji reklamowych do przewinięcia przez klienta i 5 × (6 + 3 + 3) wierszy wariantów do wyklikania przez zespół, choć różni się tylko link i CTA. Decyzja D2 niżej. → P1.
- **M3. Gdzie są Reels?** `item_type` ma `reels`, a zakładki to Posty (6) · Relacje (10) · Kampanie. Rekomendacja: Reels liczą się do postów i siedzą w zakładce Posty z plakietką „Reels" (na Facebooku lądują w kanale). → P16.
- **M4. Pakiet bez kampanii.** „Co najmniej jedna" w opisie, ale czy walidacja przed wysyłką ma to blokować? Klient bez budżetu reklamowego w danym miesiącu to realny przypadek. Rekomendacja: ostrzeżenie, nie blokada. → P17.
- **M5. Zakres pakietu (Foodie One / 360° / Sieć)** ma być wypunktowany na ekranie „Twój pakiet" (5.7), a nigdzie nie ma treści ani kolumny. Rekomendacja: stała w `copy.ts` per `package_tier` w MVP.
- **M6. `cooperation_month` w dwóch miejscach.** `clients.cooperation_started_on` i `packages.cooperation_month` mogą się rozjechać. Rekomendacja: liczyć z daty startu; zostawić kolumnę tylko w `reports` (przychodzi z webhooka).
- **M7. Raporty kat1 z kilkoma restauracjami.** `reports` ma `unique (client_id, rok, miesiąc)`, a Report Vault prawdopodobnie robi raport per restaurację. S13. → P6.
- **M8. Post wideo (nie Reels) na FB.** Rozdz. 7.1 opisuje tylko grafiki; `item_assets.kind = 'video'` w poście jest możliwe. Podgląd posta ma obsłużyć wideo (odtwarzacz, wyciszony). Faza 2, notuję.
- **M9. Proporcje w placementach 9:16.** Grafiki są 1:1 lub 4:5, a relacje i Reels to 9:16. Spec nie mówi, jak pokazać grafikę 1:1 w ramce 9:16. Rekomendacja: jak Meta: grafika wyśrodkowana, tło z rozmytej grafiki, tekst reklamy pod spodem. Faza 2.

### 4.5 Warianty reklamowe (`ad_variants`)

- **W1. `opis`, `cta`, `link` to warianty czy pojedyncze pola?** Trzy listy rozwijane obejmują tylko grafikę, tekst, nagłówek. Definiuję: `opis`/`cta`/`link` mają maksymalnie jeden wiersz na (item, lokal); walidacja przy wysyłce.
- **W2. CTA jako wolny tekst.** Meta ma zamkniętą listę przycisków. Rekomendacja: lista w `copy.ts` (Zarezerwuj, Zamów teraz, Więcej informacji, Wyślij wiadomość, Polub stronę…), wartość w `value_text` z tej listy, żeby podgląd renderował dokładnie to, co pokaże Facebook.
- **W3. Limity 6 × 3 × 3.** Egzekwowane w walidacji wysyłki i w UI, nie w bazie (przyszłe zmiany limitów Meta).
- **W4. Nazwa `grafika` obejmuje wideo.** OK, ale w UI mówimy „kreacja" tam, gdzie może być wideo.

### 4.6 Dostęp i sesje (rozdz. 4, 16)

- **D1a. Sam `token_hash` w bazie a „Kopiuj dostęp" na pulpicie.** Pulpit (12.1) i zakładka Dostęp (4.4, 12.4) zakładają, że link można skopiować w dowolnej chwili. Z samym hashem link po zamknięciu dialogu jest nie do odtworzenia. Sprzeczność. Decyzja D1 niżej.
- **D2a. „Rotacja tokenu przy odświeżeniu" bez definicji.** Rotacja przy każdym żądaniu psuje równoległe żądania (obrazki, prefetch). Definiuję: raz na 24 h z 2‑minutową łaską (S6).
- **D3a. 30 dni: sztywno czy przesuwnie?** Klient wchodzi raz w miesiącu; sztywne 30 dni oznacza PIN niemal co wejście. Rekomendacja: 30 dni od ostatniej aktywności (przesuwnie), bez sztywnego maksimum; wygaszanie i tak jest w rękach CSM‑a. → P11.
- **D4a. Okno „10 nieudanych w ciągu godziny"** nie ma znacznika czasu w `access_links`. S5.
- **D5a. Cookie `__Host-` a `localhost`.** Safari nie przyjmie `Secure` na `http://localhost`. W `development` nazwa bez prefiksu; w produkcji zawsze `__Host-`.
- **D6a. Webhook raportów przyjmuje dowolny URL.** Wyciek `INGEST_TOKEN` = możliwość podstawienia klientowi obcego linku „Otwórz raport". Walidacja: host musi być `raporty.foodiemedia.pl`. Faza 5, notuję.

### 4.7 Drobne, ale prosisz o sprzeczności

- **X1. Pauzy w tekstach.** CLAUDE.md zakazuje pauz i półpauz w tekstach dla klienta, a SPEC używa ich w każdym przykładowym tekście UI („Materiały — wrzesień 2026", „Raport miesięczny — sierpień 2026", „Marek — właściciel"). Wygrywa CLAUDE.md: w `copy.ts` i domyślnych tytułach zwykły myślnik. Test pilnuje.
- **X2. Vercel Cron co minutę (15) wymaga planu Pro.** Hobby pozwala tylko na crony raz dziennie. Sekcja 6.
- **X3. Domyślny SMTP Supabase** wysyła kilka maili na godzinę i tylko do adresów z organizacji. OTP dla zespołu bez własnego SMTP nie zadziała. Sekcja 6.
- **X4. Retencja (17) „zgłasza do akceptacji admina"** nie ma tabeli ani ekranu. Faza 6; wtedy zaproponuję `retention_reviews`.
- **X5. `clients.timezone`** istnieje, a wszystko liczymy w `Europe/Warsaw`. Zostawiam kolumnę, kod używa jej w formatowaniu dat; nie planuję przełączania.

---

## 5. Trzy decyzje techniczne inne niż w spec-u

### D1. Token linku szyfrowany w bazie (`token_enc`), nie tylko hashowany
Spec (4.1): w bazie wyłącznie `token_lookup` + `token_hash`. Jednocześnie pulpit i zakładka Dostęp zakładają
„Kopiuj dostęp" w każdej chwili. Model zagrożeń: hash chroni przed wyciekiem **samej bazy**. Szyfrowanie
AES‑256‑GCM kluczem wyprowadzonym z `SESSION_SECRET` (żyjącym tylko w Vercelu) chroni przed tym samym
wyciekiem, a dodatkowo pozwala CSM‑owi skopiować link do szturchnięcia klienta bez generowania nowego.
Weryfikacja nadal idzie po `token_hash` (`timingSafeEqual`). PIN pozostaje wyłącznie w argon2id i jest
pokazywany raz, jak w spec-u. Koszt: jedna kolumna i 30 linii kodu.

### D2. Jeden materiał `reklama` na kampanię, warianty z opcjonalnym `location_id`
Spec (3.1): kat2 i kat3 mają osobny `reklama` item na każdy lokal. Kreacja (grafiki, teksty, nagłówki)
jest wspólna, różni się link, CTA, czasem adres w tekście. Proponuję: jeden item na kampanię,
`package_items.location_ids` (kolumna już istnieje i już robi to samo dla postów w kat3) mówi, na które
lokale idzie reklama, a `ad_variants.location_id = null` oznacza „wspólny", wypełnione oznacza
„tylko dla tego lokalu". Podgląd dostaje czwartą listę „Lokal", widoczną tylko, gdy istnieją warianty
per lokal, i przełącza nazwę strony (kat3) oraz link/CTA (kat2). Efekt: klient z pięcioma lokalami widzi
jedną sekcję reklamy, nie pięć; zespół wypełnia 5 linków, nie 60 wierszy. Ten sam mechanizm, który spec
już zastosował do postów, tylko rozciągnięty na reklamy. Dotyka `ad_variants`, więc **wymaga Twojej zgody** (P1).

### D3. Bez `next/image` dla materiałów; warianty z importu + signed URL przez własną trasę
Spec (1): `next/image` + warianty z `sharp`. Signed URL zmienia się co 10 minut, więc optymalizator
`next/image` traktuje każdy podgląd jako nowy obraz: brak trafień w cache, podwójny transfer, płatne
transformacje na Vercelu. Skoro `preview` (1080 px webp) i `thumb` (400 px webp) i tak powstają przy
imporcie, serwuję je zwykłym `<img>` z wymiarami, przez trasę `GET /p/[token]/plik/[assetId]/[wariant]`,
która robi `assertClientAccess()` i odpowiada 302 na signed URL z `Cache-Control: private`. `next/image`
zostaje wyłącznie dla statycznych elementów interfejsu. Zgodne z wymogiem 16.3 (signed URL 10 min,
generowany po sprawdzeniu dostępu).

---

## 6. Lista rzeczy dla Ciebie, w kolejności

Wartości sekretów wklejasz **do `.env.local` i do Vercela**, nigdy do czatu. Ja tworzę `.env.local` z pustymi polami.

### Teraz, przed fazą 0

1. **Powłoka widzi Node.** Nie masz `~/.zshrc`, więc nvm nie ładuje się w żadnej powłoce poza tą, w której go instalowałeś. Utwórz plik `~/.zshrc` z dwiema liniami:
   ```
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
   ```
   Potem `nvm alias default 24`. Bez tego każde moje polecenie musi ręcznie dopisywać PATH.
2. **Docker Desktop albo OrbStack** (lokalny Supabase do testów E2E i `db:types`). Docker Desktop jest darmowy dla firm poniżej 250 osób: https://www.docker.com/products/docker-desktop/ . Lżejsza alternatywa: https://orbstack.dev . Bez tego E2E pójdą na projekt w chmurze, wolniej i z ryzykiem dla danych.
3. **GitHub: prywatne repo `panel-foodie`** (puste, bez README): https://github.com/new . Podaj mi adres remote. `git init` i pierwszy commit zrobię ja.
4. **Supabase: organizacja, plan Pro, projekt w `eu-central-1`**: https://supabase.com/dashboard/new . Nazwa `panel-foodie-test` (drugi projekt produkcyjny założymy przed pilotażem, P12). Po utworzeniu: *Project Settings → API Keys* → zakładka nowych kluczy → `Project URL`, `sb_publishable_…`, `sb_secret_…` do `.env.local`. Do `supabase link` i `db push` potrzebujesz jeszcze: jednorazowe `pnpm exec supabase login` w Twoim terminalu (otwiera przeglądarkę) oraz hasło bazy (ustawione przy tworzeniu projektu; CLI o nie zapyta).
5. **Vercel: konto lub team, plan Pro, import repo**: https://vercel.com/new . Pro jest potrzebne przez crony (Hobby: raz dziennie; auto‑akceptacja i outbox potrzebują co godzinę i co minutę). Po imporcie: *Settings → Functions → Region: Frankfurt (fra1)*; *Settings → Environment Variables*: wszystkie z `.env.example`; *Settings → Deployment Protection*: włącz Vercel Authentication dla Preview i Production do czasu pilotażu (w bazie będą klienci z seedu).
6. **Domena testowa.** Rekomendacja: do fazy 4 używamy `panel-foodie.vercel.app` (nic nie robisz). Jeśli wolisz `panel-test.foodiemedia.pl`: rekord CNAME → `cname.vercel-dns.com` u dostawcy DNS, a w Vercelu *Settings → Domains*. Docelową `panel.foodiemedia.pl` podpinamy w fazie 5.
7. **Sekrety generowane przez Ciebie**: `SESSION_SECRET` i `CRON_SECRET`. W terminalu `openssl rand -hex 32` dwa razy, wyniki do `.env.local` i Vercela.
8. **Lista zespołu do seedu `team_members`**: imię, e‑mail służbowy, rola z rozdz. 2 (Ty jako `admin`, Gosia `csm`, Stasiek `media_buyer`, Kuba `sales`, content creatorzy). Odpowiedz w czacie (P8).
9. **Odpowiedzi na pytania z sekcji 7** i potwierdzenie pozycji 1, 2, 3, 4, 5, 11 z rozdz. 20 (nadal „do potwierdzenia").

### Przed fazą 1

10. **Supabase Auth**: *Authentication → Providers → Email*: wyłącz „Allow new users to sign up" (konta zespołu tworzy panel przez admin API). *Authentication → Emails → SMTP Settings*: własny SMTP, bo domyślny wysyła kilka maili na godzinę. Rekomendacja **Resend** (darmowy do 3000/mies.): https://resend.com → *Domains* → dodaj `foodiemedia.pl` → wpisz rekordy DKIM/SPF w DNS (Resend używa własnej subdomeny do SPF, nie koliduje z Google Workspace) → *API Keys* → klucz. W Supabase: host `smtp.resend.com`, port `465`, user `resend`, hasło = klucz API, nadawca `panel@foodiemedia.pl`. Szablon maila z kodem OTP po polsku dostaniesz ode mnie w fazie 1 do wklejenia.

### Przed fazą 2

11. **Materiały jednego prawdziwego miesiąca jednego klienta** (posty z opisami, relacje, reklamy z tekstami i nagłówkami), nazwa strony FB, nick IG, zdjęcie profilowe. Bez tego podglądy 1:1 będą wierne wobec moich wyobrażeń, nie wobec Facebooka.
12. **Treść `/regulamin` (z zasadą auto‑akceptacji) i `/prywatnosc`.** Zadanie dla Ciebie i prawnika, nie dla kodu (rozdz. 6.4, 20).

### Przed fazą 4

13. **Google Cloud**: projekt → włącz Drive API (https://console.cloud.google.com/apis/library/drive.googleapis.com) → konto usługi (https://console.cloud.google.com/iam-admin/serviceaccounts) → klucz JSON → `base64` do `GOOGLE_SERVICE_ACCOUNT_JSON`. Udostępnij folder „Materiały klientów" na adres konta usługi jako Przeglądający i podaj ID folderu (`GOOGLE_DRIVE_ROOT_FOLDER_ID`, z adresu folderu).

### Przed fazą 5

14. **Zapier**: Zap „Webhooks by Zapier → Catch Hook" → adres do `ZAPIER_WEBHOOK_URL`; routing do kanałów Slack po polu `slack_channel`: https://zapier.com/apps/webhook/integrations .
15. **`INGEST_TOKEN`** (`openssl rand -hex 32`) do Vercela i do Zapa „Slack → POST `/api/ingest/report`".
16. **Drugi projekt Supabase `panel-foodie-prod`** + dodatek PITR (płatny, cenę sprawdź w panelu) + drugi zestaw zmiennych w Vercelu (Production vs Preview).

Koszty stałe, orientacyjnie: Supabase Pro ~25 USD/mies. na organizację (drugi projekt dolicza compute), Vercel Pro ~20 USD/mies. na osobę, Resend 0, Docker 0.

---

## 7. Pytania, na które proszę o odpowiedź (z moją rekomendacją, żebyś mógł odpowiedzieć „wszystko wg rekomendacji poza…")

**Blokujące fazę 0 (schemat)**

| # | Pytanie | Rekomendacja |
|---|---|---|
| P1 | Reklamy w kat2/kat3: osobny item na lokal (spec) czy jeden item + warianty per lokal (D2)? | D2 |
| P2 | Token linku szyfrowany w bazie, żeby „Kopiuj dostęp" działało zawsze (D1)? | tak |
| P3 | `access_links.can_approve`: CSM może wydać link „tylko podgląd"? | tak, domyślnie może akceptować |
| P4 | Opiekun klienta jako `clients.opiekun_id` (to, co widzi klient w „Twój pakiet")? | tak |
| P5 | Nadpisanie liczby godzin auto‑akceptacji per klient (`auto_approve_hours`)? | tak, domyślnie puste = globalne 72 h |
| P6 | Raport miesięczny w kat1 z kilkoma restauracjami: jeden na klienta czy jeden na lokal? | per lokal (`reports.location_id`) |
| P7 | `sales`: impersonacja (i faktury przy okazji) czy klient demonstracyjny? | klient demo, bez impersonacji |
| P8 | Lista zespołu (imię, e‑mail, rola) do seedu. | odpowiedź w czacie |
| P9 | Potwierdzenie pozycji 1, 2, 3, 4, 5, 11 z rozdz. 20. | potwierdzić |

**Blokujące fazę 1 (dostęp)**

| # | Pytanie | Rekomendacja |
|---|---|---|
| P10 | Allowlista zespołu: domena w env + `team_members.active` jako prawdziwa lista, rejestracja publiczna wyłączona? | tak |
| P11 | Sesja klienta 30 dni: sztywno od logowania czy przesuwnie od ostatniej aktywności? | przesuwnie |
| P12 | Jeden projekt Supabase teraz (test) i drugi przed pilotażem (prod)? | tak |

**Nieblokujące, ale wolisz odpowiedzieć teraz (faza 2)**

| # | Pytanie | Rekomendacja |
|---|---|---|
| P13 | Podmiana lub dodanie materiału w `do_akceptacji` przesuwa `auto_approve_at` na co najmniej 24 h od zmiany? | tak (A1) |
| P14 | Cron nie auto‑akceptuje pakietu z nierozwiązanymi uwagami klienta z bieżącej rundy, tylko powiadamia zespół? | tak (A2) |
| P15 | Klient w `poprawki` nie akceptuje; „Wyślij v2" działa bez obowiązkowych zmian? | tak (T4) |
| P16 | Reels w zakładce Posty z plakietką? | tak |
| P17 | Pakiet bez kampanii: ostrzeżenie czy blokada wysyłki? | ostrzeżenie |
| P18 | Dni robocze = pon–pt bez świąt (jeśli przełącznik kiedyś włączony)? | tak |
| P19 | Dopisać przejścia: `do_akceptacji → szkic` (Wycofaj), `zaakceptowany → poprawki`, `zaplanowany → poprawki` (zespół)? | tak |
| P20 | Dodać zdarzenia `pakiet.nieotwarty_po_24h` i `pakiet.auto_za_24h` do rozdz. 15? | tak |

Po Twoich odpowiedziach aktualizuję `docs/SPEC.md` (rozdz. 3, 6.8, 15, 20) i `CLAUDE.md` (wersja Next, allowlista), żeby spec został źródłem prawdy, i dopiero wtedy zaczynam fazę 0.

---

## 8. Weryfikacja

**Faza 0 ukończona, gdy:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone;
- `pnpm exec supabase db reset` (migracje + seed) przechodzi lokalnie bez błędu, `pnpm db:migrate` na projekt testowy również;
- test `rls.test.ts` potwierdza RLS na każdej tabeli w `public`;
- Playwright dymny: strona startowa na 390 px i 1440 px z sygnetem i Cal Sans, `/regulamin` i `/prywatnosc` 200, `/robots.txt` z `Disallow: /p/`;
- wdrożenie widoczne na adresie testowym, `docs/POSTEP.md` istnieje.

**Faza 1 ukończona, gdy:**
- kryteria 1–6 z rozdz. 18 zielone lokalnie i w CI (Playwright na lokalnym Supabase, OTP zespołu z Mailpita);
- testy jednostkowe: obie ścieżki błędu logowania wykonują dokładnie jedno `argon2.verify`; blokady 5/15 min i 10/24 h; `assertClientAccess` zwraca 404; macierz ról;
- ręcznie na telefonie z adresu testowego: link z WhatsAppa → PIN → Start, bez zastanawiania się, co kliknąć;
- `docs/POSTEP.md` z odhaczonymi 1–6 i listą rzeczy odłożonych.
