# CLAUDE.md — Panel Klienta Foodie Media

Ten plik czytasz na starcie każdej sesji. `SPEC.md` w katalogu `docs/` jest źródłem prawdy
o zakresie — gdy coś tu i tam się rozjeżdża, wygrywa `SPEC.md`, a ten plik poprawiasz.

## Czym jest ten projekt

Panel dla ok. 80 restauracji-klientów agencji Foodie Media, pod `panel.foodiemedia.pl`.
Klient akceptuje w nim miesięczny pakiet materiałów (6 postów, 10 relacji i **co najmniej
jedna kampania reklamowa** — bywa ich w miesiącu kilka), ogląda harmonogram publikacji,
raporty, faktury i dokumenty. Zespół zarządza tym wszystkim z części administracyjnej.

**Content (posty, relacje, Reels) podglądamy na Facebooku. Reklamy w sześciu placementach:
cztery na Facebooku, dwa na Instagramie.**

**Problem biznesowy, do którego to wszystko sprowadza się:** 52% kampanii mija termin,
90% tych opóźnień to spóźniona akceptacja klienta. Wszystko, co przyspiesza akceptację,
jest ważniejsze niż wszystko inne.

## Stack

- Next.js 16 App Router (`proxy.ts` zamiast `middleware.ts`) · TypeScript **strict** · Tailwind 4 · shadcn/ui
- Supabase (Postgres + Auth zespołu + Storage), region `eu-central-1`
- Vercel, funkcje w regionie `fra1`
- Vitest (jednostkowe) + Playwright (E2E i wizualne)
- `pnpm` jako menedżer pakietów

## Komendy

```bash
pnpm dev              # serwer deweloperski
pnpm build            # build produkcyjny — musi przechodzić przed każdym commitem
pnpm lint             # eslint
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest
pnpm test:e2e         # playwright
pnpm db:migrate       # supabase db push
pnpm db:seed          # dane testowe: 3 klienci, po jednym z każdej kategorii
pnpm db:types         # regeneracja typów z bazy do src/lib/db-types.ts
```

**Po każdej zmianie schematu bazy uruchom `pnpm db:types`.** Typy generowane, nie pisane ręcznie.

## Struktura katalogów

```
src/
  app/
    p/[token]/            # panel klienta — WSZYSTKO tu wymaga sesji klienta
    zespol/               # panel zespołu — wymaga Supabase Auth + roli
    api/
      ingest/report/      # webhook do rejestrowania raportów
      cron/               # auto-akceptacja, statusy faktur, outbox, retencja
  components/
    podglad/              # podglądy 1:1 — post/relacja/reels na FB, reklama w 6 placementach
    ui/                   # shadcn
  lib/
    auth-klient.ts        # sesja klienta, PIN, token linku
    auth-zespol.ts        # Supabase Auth + role
    dostep.ts             # assertClientAccess() — JEDYNE miejsce sprawdzania izolacji
    kontekst-klienta.ts   # kontekst strony klienta (sesja klienta albo podgląd zespołu)
    krypto.ts             # sha256, HMAC, AES-GCM, HKDF z SESSION_SECRET
    limity.ts             # blokady linku i limit na IP (tabela rate_limits)
    uprawnienia.ts        # macierz zasób × rola z SPEC rozdz. 2
    dto/                  # kształty danych dla stron klienta (nigdy surowe wiersze z bazy)
    copy.ts               # WSZYSTKIE teksty interfejsu (polski)
    db-types.ts           # generowane
supabase/migrations/
supabase/seed/            # seed 3 klientów + zespół + usługi; grafiki zastępcze z sharp
docs/SPEC.md              # źródło prawdy
docs/PLAN-SESJA-STARTOWA.md  # plan faz 0 i 1, krytyka spec-u, decyzje (2026-09-02)
docs/POSTEP.md            # stan kryteriów odbioru z rozdz. 18
tests/unit/
tests/e2e/
```

## Zasady, od których nie ma odstępstw

1. **Izolacja klientów przez jedną funkcję.** Każdy odczyt i zapis danych klienta przechodzi
   przez `assertClientAccess(sessionClientId, resourceClientId)`. Nie pisz tej logiki drugi raz
   w handlerze. Brak dostępu → **404**, nigdy 403 (nie potwierdzamy istnienia zasobu).
2. **Klucz `sb_secret_…` tylko po stronie serwera.** Nigdy `NEXT_PUBLIC_`. Panel klienta
   nie rozmawia z Supabase z przeglądarki. Używamy nowych kluczy Supabase
   (`publishable` / `secret`), nie wycofywanych `anon` / `service_role`.
3. **RLS włączone na każdej nowej tabeli**, w tej samej migracji, w której ją tworzysz.
4. **Pliki tylko przez signed URL** ważny 10 minut, generowany po sprawdzeniu dostępu.
5. **Tokeny i PIN-y z `crypto.randomBytes`.** Nigdy nie wymyślaj wartości tokenu ani PIN-u —
   ani w kodzie, ani w seedzie, ani w testach (w testach użyj generatora z ustalonym ziarnem).
   PIN hashowany argon2id.
6. **Żadnego `dangerouslySetInnerHTML`** dla treści pochodzącej od użytkownika.
7. **Teksty interfejsu wyłącznie z `lib/copy.ts`.** Zero polskich stringów wklejonych w JSX.
8. **Migracje tylko w `supabase/migrations/`**, nigdy `ALTER TABLE` z ręki w panelu Supabase.
9. **Zmiana statusu pakietu zawsze przez `lib/pakiety/przejscia.ts`** — jedna maszyna stanów,
   która zapisuje `package_events` i wrzuca zdarzenie do `outbox`. Nie ustawiaj `status`
   bezpośrednio `update`em w handlerze.
10. **Webhook nigdy nie blokuje odpowiedzi.** Zapis do `outbox`, wysyłka cronem.
11. **Materiały wchodzą wyłącznie z wklejonego linku do folderu albo z ręcznego uploadu.**
    Panel nigdy sam nie wylicza ścieżki na Dysku i nigdy nie importuje bez potwierdzenia
    karty weryfikacyjnej przez człowieka. To zabezpieczenie przed materiałami z innego miesiąca.
12. **Podmiana pliku nie kasuje starego** — stary dostaje `superseded_at` i `superseded_by`.
13. **Strony klienta dostają wyłącznie DTO z `lib/dto/`**, nigdy surowe wiersze z bazy. Pola
    zespołu (`internal_note`, `created_by`, hashe) nie mogą wyciec przez przypadkowy `select *`.

## Język i ton

- Cały interfejs po polsku. Zwracamy się do klienta **na Ty**.
- Bez żargonu („asset", „item", „deploy") w tekstach widocznych dla klienta.
- Komunikaty błędów mówią, **co zrobić**, nie co się zepsuło.
- W kodzie: nazwy tabel i kolumn po polsku tam, gdzie już są w `SPEC.md`; nazwy zmiennych
  i funkcji po polsku, gdy dotyczą domeny (`pakiet`, `akceptacja`, `poprawki`).
- **Bez pauz i półpauz w tekstach dla klienta** — wyłącznie zwykły myślnik. To zasada z reszty
  materiałów agencji.

## Marka

```
czerń  #1B1B1B   fiolet #7600F4   biel #FFFFFF
zielony #12855C (zaakceptowany) · bursztyn #B45309 (poprawki) · czerwony #B42318 (po terminie)
```
Nagłówki: **Cal Sans** (self-hosted w `public/fonts/`, dwa ręczne `@font-face` z `unicode-range`
w `globals.css`; `next/font/local` nie obsługuje dwóch podzbiorów jednej rodziny). Tekst: **Inter**
z `@fontsource-variable/inter` (bez pobierania z Google).

Pliki marki leżały w katalogu `brand/`; od fazy 0 są w `public/fonts/` i `public/`:
- `cal-sans-latin-400-normal.woff2` i `cal-sans-latin-ext-400-normal.woff2` — **oba są
  potrzebne**: podzbiór `latin-ext` niesie polskie znaki (ą, ć, ę, ł, ń, ó, ś, ź, ż).
  Zadeklaruj dwa `@font-face` z odpowiednimi `unicode-range`, nie jeden.
- `cal-sans-LICENSE.txt` — licencja OFL, zostaje w repozytorium.
- `sygnet-fiolet.svg` (na jasne tła) i `sygnet-bialy.svg` (na ciemne).
Kolory terminów w panelu zespołu **muszą** odpowiadać kodowi z Bazy Klientów:
niebieski 6–7 dni, żółty 4–5, pomarańczowy 1–3, czerwony dziś, szary po terminie.

## Jak pracujemy w tym repo

- **Gałąź na fazę**: `faza/0-fundament`, `faza/1-dostep`, … Merge do `main` po przejściu testów.
- **Commit po każdym działającym kawałku**, nie na koniec dnia. Wiadomości po polsku,
  w trybie rozkazującym: „Dodaj maszynę stanów pakietu".
- **Przed commitem**: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Przed zmianą czegokolwiek w podglądach 1:1 uruchom `pnpm test:e2e -- podglady`
  i zaktualizuj wzorce świadomie, nigdy `--update-snapshots` w ciemno.
- Gdy kryterium odbioru z `SPEC.md` rozdz. 18 przechodzi, **zaznacz je w `docs/POSTEP.md`**.

## Czego nie robimy

- Nie publikujemy na Facebooku ani Instagramie z panelu. Publikuje człowiek w Meta Business Suite.
- Nie integrujemy ClickUpa.
- **Nie pokazujemy logo ani kolorów klienta w interfejsie panelu** — nagłówek, karty,
  nawigacja, faktury. Panel jest w brandingu Foodie Media. Jedyny wyjątek: zdjęcie profilowe
  strony **wewnątrz ramki podglądu**, bo bez niego symulacja przestaje być symulacją.
- **Nie budujemy podglądów contentu na Instagramie** — tylko reklamowe placementy IG.
- Nie układamy wiadomości na WhatsAppa. Panel pokazuje link i PIN z przyciskiem kopiowania,
  resztę pisze człowiek.
- Nie przepisujemy systemu raportów (`raporty.foodiemedia.pl`). Panel tylko linkuje.
- Nie budujemy trybu ciemnego w MVP.
- Nie dodajemy analityki zewnętrznej (żeby nie mieć banera zgody).

## Sekrety

W `.env.local` (nigdy w repo), na produkcji w zmiennych Vercela. `.env.example` z pustymi
wartościami jest w repo i **musi być aktualizowany razem z każdą nową zmienną**.

**Nigdy nie proś użytkownika o wklejenie wartości sekretu do rozmowy.** Utwórz `.env.local`
z pustymi polami i poproś, żeby uzupełnił je w edytorze. Jeśli zobaczysz w kodzie albo
w rozmowie prawdziwy klucz, powiedz o tym i zaproponuj rotację, zamiast go używać.

```
NEXT_PUBLIC_APP_URL
SUPABASE_URL
SUPABASE_SECRET_KEY             # sb_secret_… — NIGDY z przedrostkiem NEXT_PUBLIC_
SUPABASE_PUBLISHABLE_KEY        # sb_publishable_…
SESSION_SECRET                  # podpis cookie sesji klienta
GOOGLE_SERVICE_ACCOUNT_JSON     # import z Dysku (base64)
GOOGLE_DRIVE_ROOT_FOLDER_ID
ZAPIER_WEBHOOK_URL
INGEST_TOKEN                    # webhook rejestrujący raporty
CRON_SECRET
TEAM_EMAIL_ALLOWLIST            # domeny lub adresy (po przecinku) jako filtr wstępny logowania zespołu;
                                # prawdziwa lista dopuszczonych to team_members.active
```

Tokeny narzędziowe (tylko w `.env.local`, nigdy w aplikacji): `SUPABASE_ACCESS_TOKEN` (CLI:
`link`, `db push`, `gen types`), `VERCEL_TOKEN` (CLI: zmienne środowiskowe, wdrożenia).

## Gdy utkniesz

Zatrzymaj się i zapytaj, zamiast zgadywać, w trzech sytuacjach:
zmiana schematu bazy dotykająca `packages`/`package_items`/`ad_variants`;
cokolwiek, co dotyka izolacji klientów lub sesji;
rezygnacja z któregokolwiek kryterium odbioru z rozdz. 18.
