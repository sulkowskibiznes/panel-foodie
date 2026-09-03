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
| 27 | Lista linków bez tokenu; „Pokaż link" tylko admin/csm, każde kliknięcie w audit_log; content_creator 404 na Dostępie | 1 | ✅ 2026-09-03 |
| 28 | Klient demonstracyjny bez linku dostępu i faktury (trigger + notka w zakładce Dostęp) | 1 | ✅ 2026-09-03 |

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

**Poprawka po pierwszym realnym logowaniu (2026-09-03, późny wieczór):** projekt w chmurze wysyła kod 8-cyfrowy (`mailer_otp_length = 8`), a panel wymagał dokładnie 6 cyfr i ucinał pole na 7 znakach. Panel przyjmuje teraz 6-10 cyfr (długość ustawia Supabase Auth), teksty nie podają liczby cyfr, lokalny `config.toml` ma `otp_length = 8` dla zgodności z chmurą, helper E2E czyta kod 6-10 cyfr. Test logowania zespołu zielony z kodem 8-cyfrowym.

**SPEC 1.4 (2026-09-03, przegląd rozdz. 20 poz. 15-34 przez Szymona):** sześć poprawek wpisanych do SPEC-a (nagłówek „Zmiany w 1.4"). Dwie dotknęły kodu fazy 1:
- Poz. 16: lista linków nie niesie już odszyfrowanego tokenu. Adres pokazuje osobna akcja `pokazLink` („Pokaż link" w wierszu, tylko `admin` i `csm` przez `MOZE_ODSZYFROWAC_TOKEN`), każde odszyfrowanie to wpis `link.odszyfrowany` w `audit_log` (także po resecie PIN-u). Kryterium 27, test `tests/e2e/dostep-zespol.spec.ts`.
- Poz. 21: migracja `20260903210001_klient_demo.sql` dodaje `clients.demo` i triggery odrzucające link dostępu i fakturę dla klienta demo. Seed ustawia flagę dla `demo-bistro` i nie tworzy mu linków ani faktur; zakładka Dostęp pokazuje notkę zamiast „Utwórz link", karta klienta plakietkę. Kryterium 28, test jednostkowy na bazie `tests/unit/klient-demo.test.ts` i E2E. Migracja wypchnięta do projektu chmurowego.
- Poz. 15, 26, 30, 31 (przełącznik lokalu, wstrzymana auto-akceptacja na pulpicie, dni robocze pon-sob, powiadomienie klienta o cofnięciu do poprawek) dotyczą fazy 2 i 3; w kodzie nie ma jeszcze nic, co trzeba by zmienić.
- Przy okazji: seed sprząta komentarze przed usunięciem klienta (klucz `comments.author_contact_id` nie kaskaduje), więc `pnpm db:seed` da się uruchomić ponownie na zapełnionej bazie.

**Do sprawdzenia przez Szymona (jedyna rzecz, której Claude nie może zrobić sam):** realne logowanie na produkcji kodem z Resenda i sesja po odświeżeniu; kroki w rozmowie z 2026-09-03. Po logowaniu w `audit_log` powinien pojawić się wpis `zespol.logowanie_ok`.

**Odłożone:**
- Pasek „PODGLĄD KLIENTA" i impersonacja: faza 3 (kontekst klienta ma już miejsce na tryb `podglad`).
- Odliczanie auto-akceptacji na żywo w przeglądarce: faza 2 (teraz liczone przy renderze).
- Sprzątanie wygasłych sesji po 90 dniach: faza 6 (cron).

## Faza 2: Serce (w toku)

Gałąź `faza/2-serce`, start 2026-09-03 (późny wieczór). Faza 1 sprawdzona przed startem: `main` = `faza/1-dostep`
(52cbab3), 29 testów E2E zielonych na lokalnym Supabase (kryteria 1-6, 27, 28, strony publiczne, odmowa zespołu).

**Sześć poprawek z przeglądu rozdz. 20 (SPEC 1.4):**
- Poz. 30 (dni robocze pon-sob): `src/lib/pakiety/auto-akceptacja.ts` liczy termin w obu trybach, testy z kalendarzem
  września 2026 (sobota liczy się, niedziela nie). Domyślne 72 h kalendarzowe bez zmian.
- Poz. 16 (`token_enc`): zrobione w fazie 1 (kryterium 27, test `tests/e2e/dostep-zespol.spec.ts`), sprawdzone ponownie.
- Poz. 26 (wstrzymana auto-akceptacja na pulpicie): kolumna `comments.seen_by_team_at` (migracja
  `20260904100001`), cron zapisuje `auto_wstrzymana` raz na rundę; osobny wiersz na pulpicie dochodzi razem
  z ekranem pakietu zespołu.
- Poz. 15 (przełącznik lokalu): w projekcie komponentów `docs/PROJEKT-PODGLADY.md`, rozdz. 4.
- Poz. 21 (klient demo na produkcji): `pnpm db:seed:demo` (`--tylko=demo-bistro`) tworzy tylko klienta demo,
  bez ruszania zespołu i usług; sprawdzone na lokalnym stacku.
- Poz. 31 (cofnięcie po akceptacji): przejścia `zaakceptowany → poprawki` i `zaplanowany → poprawki` kasują
  akceptację, zapisują powód i wysyłają `pakiet.cofniety_do_poprawek`; baner dla klienta dochodzi z ekranem pakietu.

**Co działa (krok 1 i 6 z kolejności fazy):**
- Maszyna stanów `src/lib/pakiety/przejscia.ts` (czysta, zależności wstrzykiwane) + `src/lib/pakiety/baza.ts`
  (`zmienStatusPakietu`, jedyna droga zmiany statusu): 9 dozwolonych przejść z rozdz. 6.8, warunki dodatkowe,
  `package_events` z migawką przy akceptacji, ciało webhooka z rozdz. 15. 120 kombinacji w teście jednostkowym.
- Cron `GET /api/cron/auto-akceptacja` (Bearer `CRON_SECRET`, co pełną godzinę w `vercel.json`):
  auto-akceptacja po terminie, `auto_wstrzymana` przy nierozwiązanych uwagach, `pakiet.auto_za_24h`,
  `pakiet.nieotwarty_po_24h`; deduplikacja po `outbox`. Logika czysta w `src/lib/pakiety/cron-auto-akceptacji.ts`.
- Testy jednostkowe: 90 zielonych (+ 6 na bazie po ustawieniu `SUPABASE_DB_URL`).

**Czeka na decyzję Szymona (blokuje krok 2, podglądy):** projekt komponentów w `docs/PROJEKT-PODGLADY.md`
(rozdz. 8: domyślny lokal w reklamie, wideo w seedzie bez ffmpeg, przełącznik proporcji posta).

**Do zrobienia w tej fazie:** podglądy (krok 2), ekran pakietu klienta (3), akceptacja i komentarze (4),
rundy (5), trasa E2E dla crona i kryteria 7-16, 26, wiersz „Auto-akceptacja wstrzymana" na pulpicie,
migracja `seen_by_team_at` do projektu chmurowego (`pnpm db:migrate`) przed merge do `main`.
