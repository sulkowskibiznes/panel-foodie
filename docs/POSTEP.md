# Postęp: kryteria odbioru z SPEC rozdz. 18

Zaznaczamy kryterium, gdy przechodzi jako test E2E (CLAUDE.md, „Jak pracujemy").

| # | Kryterium | Faza | Status |
|---|---|---|---|
| 1 | Zły token daje ten sam ekran co zły PIN | 1 | ✅ 2026-09-03 |
| 2 | 5 złych PIN-ów blokuje na 15 min, 6. próba z dobrym PIN-em też odrzucona | 1 | ✅ 2026-09-03 |
| 3 | Sesja żyje po odświeżeniu i po 24 h | 1 | ✅ 2026-09-03 |
| 4 | Klient A nie otwiera zasobów klienta B (404), także plik | 1 | ✅ 2026-09-03 |
| 5 | Wygaszenie linku wylogowuje sesję przy następnym żądaniu | 1 | ✅ 2026-09-03 |
| 6 | Reset PIN-u wylogowuje wszystkie urządzenia linku | 1 | ✅ 2026-09-03 |
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
| 23 | content_creator dostaje 404 na trasie faktur | 3 | ☐ (trasa i 404 już działają, test E2E dojdzie w fazie 3) |
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
- Vercel: Deployment Protection = Standard (podglądy chronione, produkcja publiczna; „All Deployments" płatne). Repo podpięte w panelu Vercela 2026-09-03 (Settings → Git), gałąź produkcyjna `main`; push na `main` wdraża produkcję. Wdrożenie z CLI (`pnpm exec vercel deploy --prod --yes --scope foodie-panel`) zostaje jako droga awaryjna.

**Odłożone:**
- Pełne CSP z nonce: faza 6 (SPEC rozdz. 16.6).
- Placeholdery wideo w seedzie (relacje wideo, Reels): faza 2, razem z podglądami.

**Wymaga decyzji Szymona:**
- Treść regulaminu i polityki prywatności: dostarczona 2026-09-03 w `docs/TRESCI-PRAWNE.md`, wpisana do stron (patrz domknięcie fazy 1). § 5 regulaminu i klauzula do umowy (część C) nadal do przejrzenia z prawnikiem.

## Faza 1: Dostęp

Ukończona 2026-09-03, gałąź `faza/1-dostep`. Kryteria 1-6 zielone w Playwright na 390 px i 1440 px.

**Co działa:**
- Logowanie klienta linkiem i PIN-em: `src/lib/logowanie-klienta.ts` (czysta logika, jedno wywołanie argon2 w każdej ścieżce, test jednostkowy liczy wywołania), akcja `src/app/p/[token]/akcje.ts`, ekran PIN identyczny dla istniejącego i nieistniejącego tokenu.
- Blokady liczone atomowo w bazie (`odnotuj_nieudane_logowanie`: 5 → 15 min, 10 w godzinę → 24 h + `outbox` `bezpieczenstwo.blokada`), limit 20 prób / 10 min na IP (`zwieksz_limit`).
- Sesje: cookie `__Host-fm_sesja` (w dev `fm_sesja`), httpOnly, Secure, SameSite=Lax, 30 dni przesuwnie, rotacja tokenu raz na 24 h przez trasę `/p/[token]/rotacja` z 2-minutową łaską (`src/lib/sesja-klienta.ts`).
- `assertClientAccess()` w `src/lib/dostep.ts` jako jedyne miejsce izolacji; trasa pliku `/p/[token]/plik/[assetId]/[wariant]` (signed URL 10 min) i szkielet ekranu pakietu zwracają 404 dla cudzych zasobów.
- Panel zespołu: Supabase Auth e-mail OTP (`@supabase/ssr`, odświeżanie cookies w `src/proxy.ts`), allowlista = `team_members.active` + filtr `TEAM_EMAIL_ALLOWLIST` (domeny lub adresy), macierz ról w `src/lib/uprawnienia.ts`, pulpit z klientami wg roli, karta klienta z zakładkami, zakładka Dostęp (lista linków, tworzenie z jednorazowym PIN-em, dwa pola z kopiowaniem, wygaszenie, wylogowanie urządzeń, reset PIN-u, historia logowań), Ustawienia → Zespół (admin: dodawanie osób tworzy konto Auth).
- Audyt: logowania udane i nieudane (klient i zespół), blokady, wylogowania, utworzenie linku, wygaszenie, reset PIN-u, wylogowanie urządzeń, skopiowanie dostępu, pobranie oryginału pliku.
- Testy: 45 jednostkowych (w tym RLS na lokalnej bazie), E2E: 8 dymnych + 6 kryteriów × 2 szerokości, logowanie zespołu w projekcie przygotowawczym Playwrighta (kod OTP z Mailpita, zapisany stan sesji).
- Lokalny Supabase: szablon maila z kodem `supabase/templates/kod-logowania.html`, limit wysyłek 200/h na potrzeby testów, rejestracja publiczna wyłączona (`[auth] enable_signup = false`), dostawca e-mail włączony.

**Domknięcie fazy 1 (2026-09-03, wieczór):**
- Regulamin i polityka prywatności: treść z `docs/TRESCI-PRAWNE.md` (części A i B) wpisana do `src/lib/copy.ts` i renderowana przez `DokumentPrawny` (akapity, punkty, listy, tabele, pogrubienia bez `dangerouslySetInnerHTML`). Część C (klauzula do umowy) nie występuje w aplikacji. Test dymny sprawdza wszystkie nagłówki sekcji i obie tabele na 390 px i 1440 px.
- Powiązanie `auth.users` z `team_members` w projekcie chmurowym sprawdzone skryptem po `auth_user_id` i e-mailu: 5 kont, 5 wierszy, wszystkie zgodne, brak kont bez wiersza. Nikt z zespołu jeszcze nie logował się na produkcji.
- Konto Auth bez aktywnego wiersza w `team_members` (osoba dezaktywowana albo konto założone poza panelem) nie widzi pustego panelu: `wymagajCzlonka()` kieruje na trasę `/zespol/odmowa`, która kasuje sesję Auth, zapisuje `zespol.logowanie_blad` (`brak_na_liscie`) i pokazuje odmowę na ekranie logowania. `znajdzCzlonka()` szuka najpierw po `auth_user_id`, potem po zweryfikowanym e-mailu, i naprawia brakujące albo nieaktualne powiązanie. Test E2E `tests/e2e/zespol.spec.ts` (członek tworzony na czas testu, dezaktywacja w trakcie sesji, ponowne logowanie po aktywacji).
- Testy: jednostkowe 45 zielonych (42 + 3 RLS na lokalnej bazie), E2E 23 zielone: kryteria 1-6 na 390 px i 1440 px, strony publiczne, odmowa zespołu. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.
- Konfiguracja w chmurze zrobiona przez Szymona: repo podpięte w Vercelu (gałąź produkcyjna `main`, region `fra1`, Deployment Protection), szablon „Magic Link" z `supabase/templates/kod-logowania.html`, OTP 600 s, rejestracja wyłączona, SMTP przez Resend na `powiadomienia.foodiemedia.pl` (instrukcja: `docs/KONFIGURACJA-MAILI.md`).
- `main` = `faza/1-dostep`, wdrożenie produkcyjne z GitHuba.

**Do sprawdzenia przez Szymona (jedyna rzecz, której Claude nie może zrobić sam):** realne logowanie na produkcji kodem z Resenda i sesja po odświeżeniu; kroki w rozmowie z 2026-09-03. Po logowaniu w `audit_log` powinien pojawić się wpis `zespol.logowanie_ok`.

**Odłożone:**
- Pasek „PODGLĄD KLIENTA" i impersonacja: faza 3 (kontekst klienta ma już miejsce na tryb `podglad`).
- Odliczanie auto-akceptacji na żywo w przeglądarce: faza 2 (teraz liczone przy renderze).
- Sprzątanie wygasłych sesji po 90 dniach: faza 6 (cron).
