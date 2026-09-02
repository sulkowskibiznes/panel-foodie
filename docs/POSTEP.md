# Postęp: kryteria odbioru z SPEC rozdz. 18

Zaznaczamy kryterium, gdy przechodzi jako test E2E (CLAUDE.md, „Jak pracujemy").

| # | Kryterium | Faza | Status |
|---|---|---|---|
| 1 | Zły token daje ten sam ekran co zły PIN | 1 | ☐ |
| 2 | 5 złych PIN-ów blokuje na 15 min, 6. próba z dobrym PIN-em też odrzucona | 1 | ☐ |
| 3 | Sesja żyje po odświeżeniu i po 24 h | 1 | ☐ |
| 4 | Klient A nie otwiera zasobów klienta B (404), także plik | 1 | ☐ |
| 5 | Wygaszenie linku wylogowuje sesję przy następnym żądaniu | 1 | ☐ |
| 6 | Reset PIN-u wylogowuje wszystkie urządzenia linku | 1 | ☐ |
| 7 | Pakiet 6 postów + 10 relacji + 2 kampanie renderuje się na 390 px i 1440 px | 2 | ☐ |
| 8 | „Akceptuję wszystko" ustawia status, datę, osobę i zdarzenie w outbox | 2 | ☐ |
| 9 | „Zgłaszam uwagi" bez komentarza zablokowane z podpowiedzią | 2 | ☐ |
| 10 | Zgłoszenie uwag zatrzymuje licznik auto-akceptacji | 2 | ☐ |
| 11 | Cron auto-akceptacji po 72 h; pomija wyłączone i w poprawkach; dni robocze po przełączeniu | 2 | ☐ |
| 12 | Wysłanie v2 podbija rundę, restartuje licznik, plakietki „Poprawione" | 2 | ☐ |
| 13 | Komentarz po akceptacji nie zmienia statusu, ale wysyła zdarzenie | 2 | ☐ |
| 14 | 54 kombinacje wariantów w 6 placementach; brak ig_handle wyszarza IG | 2 | ☐ |
| 15 | Komentarz przypięty do wariantu wraca w panelu zespołu | 2 | ☐ |
| 16 | Dwie kampanie w miesiącu jako osobne sekcje, akceptowane razem | 2 | ☐ |
| 17 | Folder spoza „Materiałów klientów" blokuje import | 4 | ☐ |
| 18 | Folder użyty w innym pakiecie pokazuje ostrzeżenie z linkiem | 4 | ☐ |
| 19 | Podmiana w pakiecie zaakceptowanym: potwierdzenie, zdarzenie, plakietka, baner | 3 | ☐ |
| 20 | Stary plik po podmianie istnieje z superseded_at | 3 | ☐ |
| 21 | Wysyłka z postem bez daty zablokowana z listą braków | 3 | ☐ |
| 22 | Klient nie przesuwa materiału w kalendarzu | 3 | ☐ |
| 23 | content_creator dostaje 404 na trasie faktur | 3 | ☐ |
| 24 | csm widzi tylko przypisanych klientów | 3 | ☐ |
| 25 | Impersonacja blokuje decyzje i zapisuje wejście do audit_log | 3 | ☐ |
| 26 | Zrzuty podglądów zgodne ze wzorcami w obu szerokościach | 2 | ☐ |

## Faza 0: Fundament

Stan na 2026-09-02, gałąź `faza/0-fundament`.

**Co działa:**
- Next.js 16.3 (App Router, TS strict z `noUncheckedIndexedAccess`), Tailwind 4, shadcn (`base-nova`) z tokenami marki: fiolet jako `primary`, promień 12 px, cień `shadow-miekki`, brak trybu ciemnego.
- Cal Sans z dwoma `@font-face` (`latin` + `latin-ext`, polskie znaki potwierdzone na zrzucie), Inter z `@fontsource-variable/inter`. Sygnety w `public/`.
- Strony `/`, `/regulamin`, `/prywatnosc`, 404 w brandzie; wszystkie teksty w `src/lib/copy.ts` (test pilnuje braku pauz i żargonu).
- Nagłówki bezpieczeństwa (HSTS, nosniff, Referrer-Policy, X-Frame-Options, X-Robots-Tag noindex), `robots.txt` z `Disallow: /p/` i `/zespol/`, neutralne OG.
- 10 migracji Supabase ze schematem SPEC 1.3: enumy, `CHECK`, `unique nulls not distinct`, indeksy, triggery `updated_at`, RLS na każdej tabeli, odcięte role `anon`/`authenticated`, cztery prywatne buckety. `supabase/config.toml` z wyłączoną rejestracją publiczną i OTP 10 min.
- `src/lib/krypto.ts` (HKDF z `SESSION_SECRET`, AES-256-GCM, HMAC, porównanie w stałym czasie), `src/lib/auth-klient.ts` (token 128 bit, PIN bez błędu modulo, argon2id), `src/lib/env.ts` (walidacja zod, leniwa).
- Seed `supabase/seed/`: 3 klientów (kat1 z dwiema restauracjami, kat2 z pięcioma lokalami, kat3 z trzema lokalami i DWIEMA kampaniami) + klient demonstracyjny dla `sales`, zespół 5 osób z kontami Auth, 7 usług, faktury, raporty, grafiki zastępcze z `sharp` w trzech wariantach.
- Testy: Vitest 18 zielonych (copy, krypto, auth-klient) + test RLS gotowy na lokalną bazę; Playwright 8 zielonych na 390 px i 1440 px ze wzorcami zrzutów strony startowej. CI w GitHub Actions.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

**Sprawdzone później tego samego dnia:**
- Lokalny stack Supabase (Docker) wstaje, migracje wchodzą, `pnpm db:types` generuje `src/lib/db-types.ts`, test RLS zielony (każda tabela z RLS, `anon`/`authenticated` bez uprawnień), seed lokalny przechodzi.
- Projekt testowy w chmurze (`eu-central-1`, PG 17): 10 migracji wypchniętych przez `pnpm db:migrate`, seed przeszedł (4 klientów, 5 osób zespołu z kontami Auth, 7 usług, pliki w Storage).
- Wdrożenie produkcyjne z CLI na Vercelu (team `foodie-panel`, projekt `panel-foodie`, region `fra1`, Node 24): https://panel-foodie.vercel.app odpowiada 200 ze wszystkimi nagłówkami bezpieczeństwa; zmienne środowiskowe ustawione dla production i preview.

**Repo i wdrożenia:**
- GitHub: `main` i `faza/0-fundament` wypchnięte (klucz SSH jako Deploy key z zapisem). CI w GitHub Actions uruchamia się na push.
- Vercel: Deployment Protection = Standard (podglądy chronione, produkcja publiczna; „All Deployments" płatne). Repo trzeba jeszcze podpiąć w panelu Vercela (Settings → Git → Connect), bo team `foodie-panel` nie ma autoryzowanej aplikacji GitHub dla organizacji `sulkowskibiznes`; do tego czasu wdrożenia idą z CLI (`pnpm exec vercel deploy --prod --yes --scope foodie-panel`).

**Odłożone:**
- Pełne CSP z nonce: faza 6 (SPEC rozdz. 16.6).
- Placeholdery wideo w seedzie (relacje wideo, Reels): faza 2, razem z podglądami.

**Wymaga decyzji Szymona:**
- Treść regulaminu (w tym sekcja o automatycznej akceptacji) i polityki prywatności: strony istnieją jako szkielet.
