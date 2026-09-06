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
| 7 | Pakiet 6 postów + 10 relacji + 2 kampanie renderuje się na 390 px i 1440 px | 2 | ✅ 2026-09-04 |
| 8 | „Akceptuję wszystko" ustawia status, datę, osobę i zdarzenie w outbox | 2 | ✅ 2026-09-04 |
| 9 | „Zgłaszam uwagi" bez komentarza zablokowane z podpowiedzią | 2 | ✅ 2026-09-04 |
| 10 | Zgłoszenie uwag zatrzymuje licznik auto-akceptacji | 2 | ✅ 2026-09-04 |
| 11 | Cron auto-akceptacji po 72 h; pomija wyłączone i w poprawkach; dni robocze po przełączeniu | 2 | ✅ 2026-09-04 |
| 12 | Wysłanie v2 podbija rundę, restartuje licznik, plakietki „Poprawione" | 2 | ✅ 2026-09-04 |
| 13 | Komentarz po akceptacji nie zmienia statusu, ale wysyła zdarzenie | 2 | ✅ 2026-09-04 |
| 14 | 54 kombinacje wariantów w 6 placementach; brak ig_handle wyszarza IG | 2 | ✅ 2026-09-04 |
| 15 | Komentarz przypięty do wariantu wraca w panelu zespołu | 2 | ✅ 2026-09-04 |
| 16 | Dwie kampanie w miesiącu jako osobne sekcje, akceptowane razem | 2 | ✅ 2026-09-04 |
| 17 | Folder spoza „Materiałów klientów" blokuje import | 4 | ✅ 2026-09-05 |
| 18 | Folder użyty w innym pakiecie pokazuje ostrzeżenie z linkiem | 4 | ✅ 2026-09-05 |
| 19 | Podmiana w pakiecie zaakceptowanym: potwierdzenie, zdarzenie, plakietka, baner | 3 | ✅ 2026-09-05 |
| 20 | Stary plik po podmianie istnieje z superseded_at | 3 | ✅ 2026-09-05 |
| 21 | Wysyłka z postem bez daty zablokowana z listą braków | 3 | ✅ 2026-09-05 |
| 22 | Klient nie przesuwa materiału w kalendarzu | 3 | ✅ 2026-09-05 |
| 23 | content_creator dostaje 404 na trasie faktur | 3 | ✅ 2026-09-05 |
| 24 | csm widzi tylko przypisanych klientów | 3 | ✅ 2026-09-05 |
| 25 | Impersonacja blokuje decyzje i zapisuje wejście do audit_log | 3 | ✅ 2026-09-05 |
| 26 | Zrzuty podglądów zgodne ze wzorcami w obu szerokościach | 2 | ✅ 2026-09-04 |
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

## Faza 2: Serce

Gałąź `faza/2-serce`, 2026-09-03 (noc) do 2026-09-04. Faza 1 sprawdzona przed startem: `main` = `faza/1-dostep`
(52cbab3), 29 testów E2E zielonych na lokalnym Supabase. Realne logowanie Szymona na produkcji się powiodło,
regulamin i klauzula zatwierdzone przez prawnika (2026-09-04).

**Sześć poprawek z przeglądu rozdz. 20 (SPEC 1.4):**
- Poz. 30 (dni robocze pon-sob): `src/lib/pakiety/auto-akceptacja.ts` liczy termin w obu trybach (sobota liczy się,
  niedziela nie), przełącznik `settings.auto_approve_business_days` sprawdzony E2E (kryterium 11). Domyślne 72 h kalendarzowe.
- Poz. 16 (`token_enc`): zrobione w fazie 1 (kryterium 27), sprawdzone ponownie.
- Poz. 26 (wstrzymana auto-akceptacja): `comments.seen_by_team_at`, cron zapisuje `auto_wstrzymana` raz na rundę,
  pulpit zespołu pokazuje osobny bursztynowy wiersz „Auto-akceptacja wstrzymana" z liczbą nieprzeczytanych uwag
  i akcją „Odpowiedz na uwagi"; ekran pakietu zespołu ma ten sam baner. E2E w `tests/e2e/cron.spec.ts`.
- Poz. 15 (przełącznik lokalu): czwarta lista „Lokal" w podglądzie reklamy kat2/kat3, wersja per lokal z podpisem,
  które elementy są z lokalu, a które wspólne; nazwy lokali w „Zobacz wszystkie warianty". E2E w `tests/e2e/reklamy.spec.ts`.
- Poz. 21 (klient demo na produkcji): `pnpm db:seed:demo` tworzy tylko klienta demo, bez ruszania zespołu i usług.
- Poz. 31 (cofnięcie po akceptacji): przejścia `zaakceptowany → poprawki` i `zaplanowany → poprawki` z obowiązkowym
  powodem, `pakiet.cofniety_do_poprawek` w outbox, bursztynowy baner u klienta w miejsce zielonego.

**Decyzje Szymona z 2026-09-04 (rozdz. 8 `docs/PROJEKT-PODGLADY.md`):** domyślny lokal w reklamie = pierwszy lokal;
wideo bez placeholdera w seedzie (komponenty obsługują `kind = 'video'`, plik dojdzie z realnymi materiałami);
brak przełącznika proporcji posta, proporcja z pliku, bo Facebook nie przycina (99 % postów 4:5).

**Co działa:**
- Maszyna stanów `src/lib/pakiety/przejscia.ts` (czysta) + `baza.ts` (`zmienStatusPakietu`): 9 przejść z rozdz. 6.8,
  `package_events` z migawką przy akceptacji, outbox z ciałem webhooka z rozdz. 15. 120 kombinacji w teście jednostkowym.
- Cron `GET /api/cron/auto-akceptacja` (Bearer `CRON_SECRET`, co pełną godzinę w `vercel.json`): auto-akceptacja po
  terminie, `auto_wstrzymana` przy nierozwiązanych uwagach, `pakiet.auto_za_24h`, `pakiet.nieotwarty_po_24h`,
  deduplikacja po `outbox`. Wysyłka i v2 zerują `first_opened_at`, więc „nieotwarty" liczy się per runda.
- Podglądy 1:1 w `src/components/podglad/`: post FB (tekst z „Zobacz więcej", karuzela, przełącznik profilu w kat3),
  relacja 9:16 (seria z paskiem segmentów i miniaturami), Reels, reklama w sześciu placementach na wspólnej ramce
  9:16 i wspólnym elemencie reklamowym. Awatar tylko w ramce (`/p/[token]/awatar/[lokalId]`, `/zespol/awatar/...`).
  Placementy IG bez nicka wyszarzone z podpowiedzią.
- Ekran pakietu `src/components/pakiet/ekran-pakietu.tsx` wspólny dla klienta (`/p/[token]/materialy/[pakietId]`)
  i zespołu (`/zespol/klienci/[slug]/pakiety/[pakietId]`): przyklejony pasek z licznikiem odświeżanym co 30 s,
  zakładki Posty / Relacje / Kampanie / Wszystko z plakietkami nieprzeczytanych odpowiedzi, „Obejrzano x z y"
  (2 s w polu widzenia, `item_views`), banery stanu, wątki uwag z historią rund, komentarz do całego miesiąca,
  komentarz przypięty do wariantu reklamy („Do czego": cała reklama / ta grafika / ten tekst / ten nagłówek).
- Decyzje klienta: modal akceptacji z podsumowaniem, checkboxem dat i ostrzeżeniem o nierozwiązanych uwagach;
  „Zgłaszam uwagi" tylko z komentarzem, z podpowiedzią. Otwarcie pakietu = `first_opened_at`, `otwarty`,
  `pakiet.otwarty`, audyt; odpowiedzi zespołu oznaczane jako przeczytane po otwarciu (`after()`).
- Zespół: pasek akcji nad pakietem (wyślij z checkboxem auto-akceptacji i listą braków, wycofaj, wyślij v2,
  cofnij do poprawek z powodem, zaplanowano), odpowiedzi w wątkach, „Oznacz jako załatwione", zakładka Materiały
  z listą pakietów, pulpit z tabelą pakietów w toku (kolory terminów jak w Bazie Klientów).
- Lista `/p/[token]/materialy` (kat1: kilka pakietów), nawigacja klienta z aktywną pozycją.
- `pnpm dev:lokalny` (`scripts/dev-lokalny.mjs`): serwer na 3100 podpięty pod lokalny Supabase, ten sam co E2E.
- Migracje `20260904100001` (`seen_by_team_at`) i `20260904100002` (`comments.author_label`), wypchnięte do projektu
  chmurowego 2026-09-04 (`pnpm db:migrate`). `main` = `faza/2-serce`, wdrożenie produkcyjne z GitHuba.
- Testy: 100 jednostkowych (+ 6 na bazie), E2E kryteria 7-16 i 26 (`akceptacja`, `reklamy`, `cron`, `podglady`;
  18 wzorców zrzutów: 9 ramek × 2 szerokości), testy zmieniające status pracują na klonach pakietów
  (`tests/e2e/pomocnicze/pakiety.ts`). Test 14 przełącza 54 kombinacje w każdym z 6 placementów i sprawdza
  grafikę, tekst i nagłówek w ramce bez przeładowania.

**Odłożone:**
- Wideo w seedzie (brak ffmpeg): komponenty gotowe, pierwszy plik z realnymi materiałami (plan sesji startowej, pkt 11).
- Kreator pakietu, dodawanie i podmiana materiałów (plakietki „Poprawione" i „Nowe" mają już miejsce w DTO): faza 3.
- „Pokaż link" w kolumnie Akcja pulpitu, filtry pulpitu, impersonacja: faza 3.
- Wysyłka outboxu do Zapiera (cron co minutę): faza 5. Zdarzenia już się zapisują.

**Wymaga decyzji Szymona:** nic nowego. Do zrobienia po jego stronie: dopisanie zasady auto-akceptacji do
regulaminu i umowy (SPEC rozdz. 20) jest już zatwierdzone przez prawnika.

## Faza 3: Zespół

Gałąź `faza/3-zespol` (od `main` = 9f784cc), 2026-09-05. Kryteria 19-25 zielone w Playwright na 390 px i 1440 px.

**Co działa:**
- **Impersonacja „Zobacz jak klient"** (SPEC rozdz. 2, kryterium 25): przycisk na karcie klienta dla `admin` i `csm`
  (`sales` wyłącznie dla klienta demonstracyjnego, `mozeImpersonowac()`), podpisany token `podglad.…` w adresie
  `/p/[token]/...` ważny 4 h i działający wyłącznie z sesją Auth tego samego członka (`lib/podglad-zespolu.ts`,
  `lib/podpis.ts`, klucz HKDF „podglad"). `pobierzKontekstKlienta()` zwraca tryb `podglad`: te same strony klienta,
  stały czarny pasek „PODGLĄD KLIENTA - {nazwa}. Wyjdź", przyciski decyzji wyszarzone z podpowiedzią „niedostępne
  w podglądzie", formularze uwag zastąpione notką, żadnych śladów po stronie klienta (`first_opened_at`, `item_views`,
  „przeczytane"), akcje klienta odrzucają zapis. Wejście `zespol.podglad_klienta_start` i wyjście
  `zespol.podglad_klienta_koniec` w `audit_log`. `proxy.ts` odświeża cookies Auth także dla `/p/podglad.…`.
- **Upload plików z komputera** (rozdz. 12.6, 13.4, 16 pkt 11) w trzech krokach (`lib/pliki/upload.ts`): podpisane
  pozwolenie i jednorazowy adres do bucketu `materialy` (przeglądarka wysyła PUT-em prosto do Storage, bez klucza
  Supabase, obsługuje 300 MB wideo mimo limitu funkcji na Vercelu), potem po stronie serwera magic bytes
  (`lib/pliki/magia.ts`), rzeczywista waga, dla obrazów EXIF zdjęty przez sharp i warianty preview 1080 px / thumb
  400 px webp, na końcu podpisany OPIS pliku, jedyna rzecz, jaką przyjmują mutacje. Limity: obraz 25 MB, wideo 300 MB
  z ostrzeżeniem od 150 MB. HEIC bez dekodera zostaje w oryginale bez podglądu (ostrzeżenie).
- **Dodaj materiał i Podmień materiał w każdej chwili** (`lib/dane/materialy-zespol.ts`, dialogi w
  `components/zespol/materialy/`): nowy post/relacja/Reels z `origin = 'dodatkowy'` (reklama = nowa grafika kampanii),
  podmiana pliku na tej samej pozycji ze starym plikiem oznaczonym `superseded_at` i `superseded_by`
  (komentarze i pozycja zostają), dodatkowy slajd/grafika, usunięcie pliku (supersede), edycja tytułu, opisu, daty
  publikacji i lokali, edytor tekstów, nagłówków, opisu, przycisku i linku reklamy z wersjami per lokal (wiersze
  zachowują id, bo komentarze wskazują `variant_id`), dodanie, edycja i usunięcie kampanii, usunięcie materiału
  (tylko szkic). Skutki wg statusu z tabeli 12.6 liczy czysta funkcja `lib/pakiety/zmiana-materialu.ts`
  (testowana): szkic bez plakietek; `do_akceptacji`/`poprawki` plakietka „Nowe" albo „Poprawione", zdarzenie
  `material_dodany`/`material_podmieniony`, w `do_akceptacji` termin auto-akceptacji na co najmniej 24 h od zmiany
  (`auto_przesunieta`); `zaakceptowany`/`zaplanowany` checkbox potwierdzenia, `changed_after_approval`, baner
  u klienta, `material.podmieniony_po_akceptacji` w outbox. Edycja treści po akceptacji idzie tą samą ścieżką (T6).
- **Kreator pakietu na wklejanych linkach** (rozdz. 12.3): `/zespol/klienci/[slug]/pakiety/nowy`: miesiąc i rok,
  lokal dla kat1 (pakiet per lokal, kat2/kat3 jeden pakiet), tytuł, link do folderu z contentem rozpoznawany
  w `lib/drive/linki.ts` (formaty `/drive/folders/<id>`, `/drive/u/0/folders/<id>`, `?id=`, `/file/d/<id>`; zły link
  blokuje), kampanie z osobnym folderem reklam każda (bywa ich kilka), zajęty okres ostrzega przed unique. Pakiet
  powstaje w szkicu z jednym materiałem `reklama` na kampanię i zdarzeniem `utworzony`.
- **Harmonogram** (rozdz. 8): zakładka Harmonogram na karcie klienta z kalendarzem miesiąca (`@dnd-kit/core`):
  przeciąganie materiałów między dniami i do panelu „Niezaplanowane", pole daty i godziny w każdym kafelku
  (dostępność, telefon, testy), domyślne godziny publikacji klienta (`clients.default_publish_hours`, migracja
  `20260905100001`, pierwsza wolna z listy przy upuszczeniu), „Dzień zakończenia" (`period_to`), kampanie poza
  kalendarzem, „Poza tym miesiącem" dla dat spoza okresu. Zmiana daty w wysłanym pakiecie idzie ścieżką edycji
  materiału (plakietka, termin, potwierdzenie po akceptacji). Klient: `/p/[token]/harmonogram` z tym samym
  kalendarzem tylko do odczytu, listą publikacji, „Skomentuj" do wątku materiału i sekcją kampanii; zero uchwytów,
  pól daty i endpointu (kryterium 22). Kolory statusów z rozdz. 5.3. Czysta logika kalendarza (Europe/Warsaw,
  zmiana czasu) w `lib/harmonogram/kalendarz.ts` z testami.
- **Pulpit** (rozdz. 12.1): filtry moi klienci / wszyscy (tylko role widzące wszystkich), status (w tym
  „Auto-akceptacja wstrzymana") i miesiąc; kolory terminów liczone dniami kalendarzowymi w Europe/Warsaw
  (`lib/pakiety/terminy.ts`, test: niebieski 6-7, żółty 4-5, pomarańczowy 1-3, czerwony dziś, szary po terminie);
  kolumna Akcja: „Odpowiedz na uwagi", „Zobacz uwagi" (poprawki), „Otwórz pakiet" i „Pokaż link" dla
  `do_akceptacji` (admin i csm, ten sam mechanizm co w zakładce Dostęp: wybór osoby, każde pokazanie
  `link.odszyfrowany` w audycie).
- **Skrzynka uwag** (rozdz. 12.5): `/zespol/uwagi` z plakietką nieprzeczytanych w nawigacji, filtry po kliencie
  i rodzaju (post, relacja, Reels, reklama, cały miesiąc), odpowiedź w tym samym wątku co u klienta i „Załatwione"
  bez wchodzenia w pakiet; otwarcie skrzynki oznacza uwagi jako przeczytane przez zespół.
- Walidacja przed wysyłką (rozdz. 8, kryterium 21) bez zmian z fazy 2: lista braków w dialogu wysyłki; test E2E
  uzupełnia daty w edycji materiału i wysyła.
- Testy: jednostkowe 128 (linki Dysku, magic bytes, skutki zmiany, kolory terminów, kalendarz, podpisy),
  E2E nowe pliki `zespol-materialy` (19, 20, 21, 25), `harmonogram` (22 + przeciąganie dnd-kit myszą), `role`
  (23, 24), `kreator`, `skrzynka`; klony pakietów w latach 2030-2033 (`PlikTestow`). Testy z uploadem wysyłają
  PNG generowany sharp-em (`tests/e2e/pomocnicze/pliki.ts`) prosto do lokalnego Storage.

**Odłożone:**
- Karta weryfikacyjna, import z folderu, mapowanie grafika-opis (kreator kroki 2, 4 i 5 z importem): faza 4. Kreator
  zapisuje już `content_folder_id` i `ads_folder_id`.
- Edycja `internal_note` w panelu zespołu i zakładka Ustawienia karty klienta (w tym domyślne godziny poza
  harmonogramem): faza 5.
- Placeholder dla wideo bez miniatury (kind `video` ma `thumb_path = null`, podgląd gra z oryginału): faza 4 razem
  z wariantami z importu.
- Powiadomienia toast (sonner) zamiast komunikatów w dialogach: nie w MVP.

**Wymaga decyzji Szymona:** nic nowego. Migracja `20260905100001_domyslne_godziny_publikacji.sql` wypchnięta do projektu
chmurowego 2026-09-05 (`pnpm db:migrate`). `main` = `faza/3-zespol`, wdrożenie produkcyjne z GitHuba. Do sprawdzenia
przez Szymona na produkcji: upload pliku z komputera (PUT z przeglądarki do Storage w chmurze) i „Zobacz jak klient".

## Faza 4: Import z Dysku

Gałąź `faza/4-import` (od `main` = ff9a9a1), 2026-09-05. Kryteria 17 i 18 zielone w Playwright na 390 px i 1440 px.
Import działa wyłącznie na WKLEJANYCH linkach (CLAUDE.md, zasada 11): panel nigdy nie szuka folderów sam.

**Co działa:**
- **Dysk przez konto usługi** (`lib/drive/google.ts`): JWT RS256 z `node:crypto` (bez googleapis), token w pamięci procesu,
  Drive API v3 przez fetch (metadane, listowanie z `name_natural`, pobranie, eksport Dokumentu Google do text/plain,
  miniatura), ponawianie 429/5xx, dyski współdzielone (`supportsAllDrives`). Klucz z `GOOGLE_SERVICE_ACCOUNT_JSON`
  (surowy JSON albo base64), korzeń z `GOOGLE_DRIVE_ROOT_FOLDER_ID`. Wąski kontrakt `lib/drive/api.ts`.
- **Atrapa Dysku** (`lib/drive/atrapa.ts`, `DRIVE_ATRAPA=1`): drzewo w pamięci odwzorowujące strukturę z SPEC 13.1 dla
  klientów z seedu, folder poza „Materiałami klientów", plik ponad limit, dokumenty z opisami; grafiki generuje sharp.
  Używają jej testy E2E (`playwright.config.ts`) i `pnpm dev:lokalny`. `pnpm dev:lokalny:dysk` podpina prawdziwe
  konto usługi z `.env.local` do lokalnej bazy: tak sprawdzono realny miesiąc (niżej). Na produkcji atrapa odmawia startu.
- **Karta weryfikacyjna** (rozdz. 13.2, `lib/import/weryfikacja.ts` + czysta ocena w `lib/import/ocena.ts`): wspinaczka
  po rodzicach do korzenia (pełna ścieżka „Materiały klientów / Klient / content / content 5 mies"), liczba plików
  i rodzaje, ostatnia zmiana, pierwsze nazwy (folder, potem „1. Posty", potem „2. Relacje"), podfoldery. Ostrzeżenia:
  inna nazwa klienta, inny numer miesiąca współpracy albo okres `RR-MM` w nazwie, folder użyty w innym pakiecie
  (zakończone importy, `packages.content_folder_id`, `campaigns.ads_folder_id`) z linkiem i datą importu, brak
  podfolderów, pusty folder, pliki w nieobsługiwanym formacie, wideo ponad 150 MB. Folder spoza „Materiałów klientów"
  = blokada bez obejścia (kryterium 17); plik ponad 25 MB / 300 MB z metadanych = import przerwany z nazwą i wagą.
  Ostrzeżenia ignoruje się jednym checkboxem, każde zignorowanie to wpis `zespol.import_ostrzezenie_zignorowane` w audycie.
  Link da się poprawić na karcie (zapis do pakietu albo kampanii i ponowna weryfikacja).
- **Ekran mapowania, obowiązkowy** (rozdz. 13.3, `lib/import/mapowanie.ts` + czyste `lib/drive/parowanie.ts`,
  `opisy.ts`, `nazwy.ts`, `docx.ts`): grafiki w kolejności naturalnej (1, 2, ..., 10), karuzela z „3a/3b" albo „3-1/3-2",
  wideo w postach jako Reels, relacje po jednej na plik. Opisy z dokumentów: Dokument Google (eksport) albo **.docx**
  (rozpakowanie `word/document.xml` przez fflate; content creatorzy trzymają opisy w Wordzie), podział po nagłówkach
  „Post 1", „tekst 2", „TEKST 3:", „1." z podglądem podziału; dopasowanie po numerze, po numerze w nazwie dokumentu
  albo po kolejności (oznaczone). Dokument reklam: sekcje „Teksty"/„Nagłówki"/„Opis"/„Przycisk"/„Link" albo pozycje
  „tekst N" / „nagłówek N" bez sekcji. Człowiek poprawia tytuł, rodzaj, opis (lista sekcji), pomija materiały i grafiki,
  edytuje teksty, nagłówki, opis, przycisk i link. Miniatury z Dysku przez podpisany adres w panelu
  (`/import/miniatura/[fileId]?t=…`, klucz HKDF „import"), nigdy prosto z Google.
- **Kopiowanie w tle** (rozdz. 13.4, `lib/import/zadania.ts`): jedno zadanie `import_jobs` na folder z planem
  potwierdzonym na mapowaniu (`plan jsonb`), migawką karty (`verification`), biciem serca i licznikiem prób (migracja
  `20260906100001`). Serwer waliduje plan ponownie (folder względem korzenia, identyfikatory plików z listowania,
  limity), a worker rusza w `after()` po odesłaniu odpowiedzi (`maxDuration = 300` na stronie importu). Każdy plik:
  pobranie, magic bytes, limit rzeczywistej wagi, EXIF zdjęty, preview 1080 px i thumb 400 px, `item_assets` z
  `drive_file_id`; po każdym pliku postęp w planie (`assetId`), więc „Ponów" po błędzie i „Wznów" po zawieszeniu
  (brak bicia serca 3 min) zaczynają od miejsca, w którym import stanął. Plik z Dysku już obecny w pakiecie jest
  pomijany z ostrzeżeniem. Materiały contentu z `origin = 'import'`; reklamy jako grafiki i warianty
  tekst/nagłówek/opis/cta/link na istniejącym materiale `reklama` kampanii (bez duplikatów). Zakończenie: zdarzenie
  `zaimportowany`, audyt `zespol.import_zakonczony`; błąd: `import_blad` z czytelnym komunikatem, który plik.
  Pasek postępu odpytuje stan co 2 s; zadanie „oczekuje" bez workera dostaje go przy odczycie stanu.
- **Kreator prowadzi do importu**: z wklejonymi linkami po utworzeniu pakietu od razu karta weryfikacyjna
  (`/zespol/klienci/[slug]/pakiety/[pakietId]/import`); przycisk „Importuj z Dysku" na ekranie pakietu w szkicu.
  Import działa w szkicu; po wysyłce materiały dochodzą pojedynczo.
- **„Dodaj materiał" i „Podmień" linkiem do pliku na Dysku** (rozdz. 12.6): pole linku obok pliku z komputera; serwer
  sprawdza plik względem „Materiałów klientów", pobiera go tą samą ścieżką (magic bytes, limit, EXIF, warianty) i oddaje
  podpisany opis pliku, więc skutki z tabeli 12.6 zostają bez zmian. `import_jobs` z `kind` `dodatkowy`/`podmiana`,
  audyt `zespol.import_pliku_z_dysku`. Plik spoza „Materiałów klientów" odpada.
- Wspólne przetwarzanie plików (`lib/pliki/przetwarzanie.ts`) wydzielone z uploadu z komputera; `OpisPliku` niesie `driveFileId`.
- Testy: jednostkowe 159 (+ 6 na bazie; nazwy i sortowanie naturalne, podział opisów, dokument reklam, .docx, parowanie, ocena karty,
  plan i limity, JWT konta usługi), E2E `import.spec.ts` (pełny przebieg na atrapie: karty, mapowanie, kopiowanie,
  „Dodaj materiał" linkiem, kryteria 17 i 18) plus dostosowany `kreator.spec.ts`; łącznie 77 E2E zielonych.

**Realny miesiąc (definicja ukończenia fazy):** 2026-09-05 na lokalnym Supabase z prawdziwym kontem usługi
(`pnpm dev:lokalny:dysk`) zaimportowano dla klienta z seedu folder „Bafra Kebab / Content / Content 9 mies"
(6 postów PNG + `opisy ... 9mies.docx`, 10 relacji) i dwie kampanie z folderów „Reklamy 9 mies" i „Reklamy 8 mies"
(po 3 grafiki + `teksty reklamowe ... .docx`). Karty pokazały pełne ścieżki i spodziewane ostrzeżenia (inny klient,
inny numer miesiąca), mapowanie dopasowało wszystkie sześć opisów po numerze i rozłożyło teksty reklam na trzy
pozycje w każdej kampanii; nic nie trzeba było poprawiać ręcznie. Nagłówków w dokumentach nie ma, więc zostają
do uzupełnienia w edycji reklamy, jak dotąd. Sondowanie realnej struktury ujawniło trzy rzeczy spoza SPEC-u, które
dodano: dokumenty `.docx` zamiast Dokumentów Google, foldery nazywane `Content 26-09` (rok-miesiąc) i podfolder
„0. Plan" (pomijany).

**Odłożone:**
- Kolejka niezależna od żądania (cron co minutę) zamiast `after()`: gdyby import przekraczał limit funkcji na Vercelu
  przy bardzo dużych wideo; dziś ratuje „Wznów". Wysyłka outboxu do Zapiera: faza 5.
- Kroki 5-7 kreatora z SPEC 12.3 (daty publikacji, złożenie wariantów, podgląd, wysyłka) to istniejące ekrany pakietu
  i harmonogramu; po imporcie link „Otwórz pakiet".
- Wideo bez miniatury (kind `video`, `thumb_path = null`): jak w fazie 3.

**Wymaga decyzji Szymona:** nic nowego. Migracja `20260906100001_import_plan_i_wznowienie.sql` wypchnięta do projektu
chmurowego 2026-09-05 (`pnpm db:migrate`). `main` = `faza/4-import`, wdrożenie produkcyjne z GitHuba. Do zrobienia po
jego stronie: na Vercelu ustawić `GOOGLE_SERVICE_ACCOUNT_JSON` i `GOOGLE_DRIVE_ROOT_FOLDER_ID` dla production i preview
(`DRIVE_ATRAPA` puste); bez nich strona importu pokazuje notkę „nie skonfigurowany", a reszta panelu działa jak dotąd.
Udostępnienie „Materiałów klientów" dla konta usługi już działa (sprawdzone tylko do odczytu).

## Zmiana 1.5: okres pakietu od-do (2026-09-06)

Gałąź `zmiana/okres-pakietu` (od `main` = 4479036). Decyzje Szymona z 2026-09-05 (SPEC rozdz. 20 poz. 35):
okres pakietu to dowolny zakres dat (np. 20.09.2026 do 19.10.2026), bo każdy klient zaczyna miesiąc innego dnia,
a po wstrzymaniu współpraca wraca od innego dnia; nakładające się okresy tylko ostrzegają; kalendarz to widok
okresu pakietu; daty zawsze wpisywane ręcznie; numer miesiąca współpracy podpowiadany („ostatni + 1") i edytowalny.

**Co się zmieniło:**
- Migracja `20260907100001_okres_pakietu.sql`: `period_from`/`period_to` NOT NULL z `check (period_to >= period_from)`
  i zakresem lat 2024-2100, `period_year`/`period_month` oraz unikalność po miesiącu usunięte, indeks
  `(client_id, period_from desc)`. Backfill z miesiąca dla starych wierszy. `reports` bez zmian (miesięczne).
- Czysta logika: `siatkaOkresu(od, do)` (tygodnie od poniedziałku przed startem do niedzieli po końcu; cały wrzesień
  daje dawną siatkę miesiąca), `czyOkresyZachodza`, `dlugoscOkresuDni`, `miesiacZDaty`, `kolejnyMiesiacWspolpracy`;
  `etykietaOkresu(od, do)` = „20.09 - 19.10.2026" (przez lata „20.12.2026 - 19.01.2027"), `etykietaMiesiaca` dla
  filtra pulpitu. `DzienSiatki.wOkresie` i `nowyMiesiac` (podpis „1 paź" na styku miesięcy).
- Kreator: pola Od i Do (puste, wymagane, `min` dla Do), numer miesiąca współpracy podpowiedziany i edytowalny,
  tytuł domyślny „Materiały 20.09 - 19.10.2026", ostrzeżenie `data-okres-nachodzi` przy zachodzeniu (przycisk aktywny),
  blokada tylko dla końca przed początkiem i okresu ponad rok. Serwer sprawdza to samo.
- Harmonogram zespołu i klienta: `?p=<id pakietu>` (brak = pakiet w toku, inaczej najnowszy), `NawigacjaOkresu`
  (poprzedni/następny pakiet po dacie startu), `SiatkaOkresu` z zaznaczonym początkiem i końcem każdego pakietu
  w widoku, pakiety klienta zachodzące na okres w tym samym widoku (kat1: lokale), „Poza tym okresem" zamiast
  „Poza tym miesiącem", lista publikacji klienta bez filtra po miesiącu, ustawienia z polami Od i Do per pakiet.
  Szkic albo cudzy pakiet u klienta = 404.
- Pulpit: kolumna „Okres", filtr „Miesiąc startu"; lista pakietów, skrzynka, karta weryfikacyjna importu z etykietą okresu.
- Webhook (SPEC rozdz. 15): `period` = miesiąc startu (`YYYY-MM`, zgodność), dodane `period_from`, `period_to`;
  podsumowania z etykietą okresu. Karta weryfikacyjna importu uznaje miesiąc startu albo końca w nazwie folderu.
- Teksty: „cały pakiet" zamiast „cały miesiąc", „Poprzedni/Następny pakiet", „w tym okresie", „Okres pakietu".
- Seed: okres = cały wrzesień 2026 (ostatni dzień liczony). E2E: `okresDlaProjektu` zwraca `{ rok, miesiac, od, do }`
  (nadal osobny rok na plik i półrocze na projekt, sprzątanie po `period_from`); kreator, harmonogram i import
  na nowych polach; nowe asercje: ostrzeżenie o zachodzeniu, numer miesiąca, siatka okresu, 404 szkicu u klienta.

Migracja `20260907100001_okres_pakietu.sql` wypchnięta do projektu chmurowego 2026-09-06 (`pnpm db:migrate`, po pushu `main`).
`main` = `zmiana/okres-pakietu`, wdrożenie produkcyjne z GitHuba. Sprawdzone lokalnie w przeglądarce: siatka okresu
20.10 do 19.11 (6 tygodni, granice zaznaczone, podpis „1 lis"), ustawienia okresu, kreator z datami i ostrzeżeniem.
Testy: 163 jednostkowe, 77 E2E, build zielone.

## Faza 5: Reszta panelu klienta

Gałąź `faza/5-reszta-panelu` (od `main` = 0016207), 2026-09-06. Zakres z SPEC rozdz. 5.5-5.8, 9, 10, 11, 15: raporty,
faktury i dokumenty, „Twój pakiet", usługi dodatkowe, webhook do Zapiera z kolejki outbox, cron statusów faktur,
wdrożenie za flagą. Po tej fazie pilotaż z jednym klientem.

**Co działa:**
- **Raporty** (rozdz. 9): `POST /api/ingest/report` z `Authorization: Bearer INGEST_TOKEN`, ciało z rozdz. 9 plus opcjonalne
  `location` (kat1 z kilkoma restauracjami: raport per lokal, bez nazwy lokalu 422 z listą lokali; kat2/kat3 lokal ignorowany).
  Host adresu wyłącznie `raporty.foodiemedia.pl` (walidacja w `lib/raporty/walidacja.ts` i CHECK w bazie: wyciek tokenu nie
  podstawi obcego adresu). Ten sam miesiąc i lokal nadpisuje link (Zapier bywa wysyłany więcej niż raz), tytuł i numer miesiąca
  współpracy zostają, gdy nowe wywołanie ich nie niesie. Zakładka Raporty w karcie klienta: lista ze źródłem (ręcznie / webhook),
  „Dodaj raport" (link, miesiąc, lokal dla kat1, tytuł i numer miesiąca opcjonalne; podpowiedź numeru z ostatniego raportu),
  „Usuń". Klient: karty z miesiącem, „X. miesiąc współpracy", nazwą lokalu i „Otwórz raport" w nowej karcie (bez iframe).
- **Faktury** (rozdz. 10): zakładka Faktury z „Dodaj fakturę" (numer, daty, netto z podpowiedzią brutto 23 %, notatka
  wewnętrzna, opcjonalny PDF), „Oznacz jako opłaconą" z datą wpłaty, „Cofnij opłacenie" (status z terminu, jak zrobiłby cron),
  „Dodaj / Podmień PDF", „Usuń" (PDF zostaje w Storage). `po_terminie` wyłącznie z crona `GET /api/cron/faktury`
  (04:00 UTC = 6:00 czasu letniego, 5:00 zimowego; `lib/faktury/status.ts`, dzień liczony w Europe/Warsaw). Klient demo bez
  faktur (trigger + notka). Klient: tabela z numerem, terminem, netto/brutto, statusem („Po terminie" na czerwono z liczbą dni,
  „Opłacona" z datą) i „Pobierz PDF"; na Starcie czerwony kafel z najstarszą fakturą po terminie.
- **Dokumenty** (rozdz. 10, 17): zakładka Dokumenty tylko dla `admin` i `csm` (reszta 404, `content_creator` sprawdzony
  w kryterium 23): rodzaj (umowa, aneks, powierzenie, inne), tytuł, „obowiązuje od", obowiązkowy PDF. Klient pobiera je
  w sekcji Dokumenty pod fakturami.
- **PDF tą samą drogą co materiały** (`lib/pliki/pdf.ts`, zasada 14): podpisane pozwolenie, PUT z przeglądarki do bucketu
  `faktury` albo `dokumenty` (ścieżka `{client_id}/{uuid}.pdf`), magic bytes `%PDF-` i limit 25 MB po stronie serwera,
  podpisany opis jako jedyne wejście mutacji. Pobieranie: `/p/[token]/faktura/[id]`, `/p/[token]/dokument/[id]`
  (assertClientAccess, signed URL 10 min, audyt `klient.plik_pobrany`), dla zespołu `/zespol/faktura/[id]`, `/zespol/dokument/[id]`
  (uprawnienie i assertTeamClientAccess). Cudza faktura i cudzy dokument = 404, także bez sesji.
- **„Twój pakiet"** (rozdz. 5.7): nazwa pakietu, kwota netto miesięcznie, zakres z `copy.twojPakiet.zakresPakietow` per tier,
  lokale, opiekun (`clients.opiekun_id`: imię plus nowe pole `team_members.client_contact`, wpisywane przez admina
  w Ustawienia -> Zespół; puste = `kontakt@foodiemedia.pl`; nigdy e-mail ani telefon z `team_members`), data startu
  współpracy. Zero brandingu klienta.
- **„Co jeszcze możemy zrobić"** (rozdz. 5.8): karty z `services` (aktywne, `visible_for_tiers` z pakietem klienta), modal
  z jednym polem (do 1000 znaków), zapis `service_interests` (z osobą kontaktową) i zdarzenie `usluga.zainteresowanie`
  w outbox z ciałem z rozdz. 15 (bez okresu; `service`, `service_name`, `note`, link do karty klienta), potwierdzenie
  „Odezwiemy się w ciągu jednego dnia roboczego", plakietka „Zgłoszone {data}" na karcie. W podglądzie zespołu przycisk
  wyszarzony (zasada 15). Karta klienta w panelu zespołu: sekcja „Zainteresowanie usługami" z „Oznacz jako załatwione"
  (`handled_at`, `handled_by`).
- **Outbox do Zapiera** (rozdz. 15): `GET /api/cron/outbox` co minutę (`vercel.json`), czysta logika w `lib/outbox/wysylka.ts`
  (testowana): wiersz zajmowany warunkowym UPDATE-em (dwa nakładające się przebiegi nie wyślą go dwa razy), POST JSON
  (payload z bazy plus `event` z kolumny) z limitem 10 s, sukces = `sent`, porażka przesuwa `next_attempt_at` o 1, 5, 15,
  60 min, piąta nieudana = `failed`. Bez `ZAPIER_WEBHOOK_URL` cron nie rusza kolejki. Ustawienia -> Powiadomienia (admin):
  ostatnie 100 zdarzeń ze statusem, próbami, błędem i „Ponów"; ekran mówi tylko, CZY adres jest skonfigurowany.
- **Wdrożenie** (rozdz. 11): `/p/[token]/wdrozenie` w układzie panelu, 404 przy `onboarding_enabled = false`, po włączeniu
  kroki z `onboarding_steps` z paskiem postępu (tylko odczyt, linki do formularza i instrukcji); brak pozycji w nawigacji
  klienta; w karcie klienta nieaktywna zakładka „Wdrożenie (wkrótce)".
- **Start klienta** (rozdz. 5.1) dopełniony: pod kaflem pakietu najnowszy raport, najbliższa publikacja (post albo relacja
  z datą w przyszłości w pakiecie zaakceptowanym lub zaplanowanym) i faktura po terminie.
- **Nawigacja klienta**: Raporty, Faktury i dokumenty, Twój pakiet, Co jeszcze możemy zrobić aktywne; na telefonie dolny pasek
  ma Start, Materiały, Harmonogram i „Więcej" (arkusz z resztą sekcji i wylogowaniem). Archiwum nadal „wkrótce".
- Migracja `20260908100001_faza5_raporty_faktury_outbox.sql`: `outbox.next_attempt_at` z indeksem, CHECK hosta w `reports`,
  `team_members.client_contact`, `service_interests.handled_by`. Seed: PDF-y faktur i dwa dokumenty (umowa, umowa powierzenia)
  z generatora `supabase/seed/pdf.ts` (jednostronicowy PDF bez zależności), jedno nieobsłużone zgłoszenie usługi u Burger Brothers.
- Testy: jednostkowe walidacja raportów, status faktur i cron, wysyłka outboxu (odstępy, failed, zajęty wiersz, wyjątek),
  magic bytes PDF, postęp wdrożenia. E2E nowe pliki `raporty`, `faktury`, `pakiet-uslugi`, `outbox` (atrapa Zapiera jako serwer
  HTTP w teście; `playwright.config.ts` wymusza `ZAPIER_WEBHOOK_URL` na atrapę, żeby testy nigdy nie strzelały w prawdziwego
  Zapiera, i podstawia `INGEST_TOKEN`, gdy brak go w `.env.local`), kryterium 23 rozszerzone o Dokumenty i Raporty.

**Odłożone:**
- Archiwum materiałów (rozdz. 5.4) i zakładka Ustawienia karty klienta (w tym `internal_note`, domyślne godziny poza
  harmonogramem): nie ma ich w zakresie fazy 5 z SPEC rozdz. 19; w nawigacji klienta Archiwum zostaje „wkrótce".
- Sprzątanie PDF-ów po usuniętej fakturze i dokumencie ze Storage: faza 6 (retencja).
- Edycja istniejącej faktury (numer, daty, kwoty): teraz „Usuń" i dodanie na nowo; jeśli w pilotażu okaże się potrzebna, to mały dialog.

**Wymaga decyzji Szymona:**
- Zakres pakietów w „Twój pakiet" (`copy.twojPakiet.zakresPakietow`: Foodie One, Foodie 360°, Sieć) to robocza treść
  do przejrzenia; SPEC mówi tylko „stała w copy.ts per package_tier".
- Godzina crona faktur: Vercel liczy w UTC, więc `0 4 * * *` daje 6:00 latem i 5:00 zimą. Alternatywa `0 5 * * *` (7:00 / 6:00).
- Kontakt opiekuna dla klienta: wpisać w Ustawienia -> Zespół (np. służbowy WhatsApp Gosi); do tego czasu klient widzi
  `kontakt@foodiemedia.pl`.
- Przed pilotażem w Vercelu: `INGEST_TOKEN` (`openssl rand -hex 32`, ten sam w Zapierze) i `ZAPIER_WEBHOOK_URL` (Catch Hook).

Stan na 2026-09-06 (wieczór): `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone, 188 testów jednostkowych,
94 E2E (5 pominiętych to testy jednego projektu Playwrighta). Migracja `20260908100001` jest na razie tylko w lokalnej bazie;
wypchnięcie do chmury (`pnpm db:migrate`), merge do `main` i zmienne `INGEST_TOKEN` / `ZAPIER_WEBHOOK_URL` w Vercelu czekają
na decyzję Szymona.

## Faza 6: Utwardzenie i przekazanie

Gałąź `faza/5-reszta-panelu` (kontynuacja, od 22bf888), 2026-09-06. Zakres z SPEC rozdz. 16, 17, 19: CSP, testy
bezpieczeństwa, retencja, offboarding, kopie zapasowe, dokumentacja obsługi, instrukcja dla zespołu.

**Audyt kryteriów odbioru (rozdz. 18), pełny przebieg `pnpm test:e2e` 2026-09-06 wieczorem: 120 testów zielonych,
5 pominiętych (test outboxu w jednym projekcie Playwrighta, zgodnie z konfiguracją), 0 błędów, w obu szerokościach
(390 px i 1440 px), pod nowym CSP.**

| # | Kryterium | Test | Wynik |
|---|---|---|---|
| 1 | Zły token = ekran złego PIN-u | `dostep.spec.ts` | ✅ |
| 2 | 5 złych PIN-ów blokuje na 15 min, 6. z dobrym odpada | `dostep.spec.ts` | ✅ |
| 3 | Sesja po odświeżeniu i po 24 h (rotacja) | `dostep.spec.ts` | ✅ |
| 4 | Klient A nie otwiera zasobów klienta B (404), także plik | `dostep.spec.ts`, rozszerzone w `izolacja.spec.ts` (pakiet, harmonogram, plik w 3 wariantach, podpisany adres z podmienioną ścieżką, awatar, faktura, dokument, raport, komentarz z podmianą materiału/wariantu/pakietu/tokenu) | ✅ |
| 5 | Wygaszenie linku wylogowuje sesję | `dostep.spec.ts` | ✅ |
| 6 | Reset PIN-u wylogowuje wszystkie urządzenia | `dostep.spec.ts` | ✅ |
| 7 | 6 postów + 10 relacji + 2 kampanie na 390 i 1440 px | `akceptacja.spec.ts` | ✅ |
| 8 | „Akceptuję wszystko": status, data, osoba, outbox | `akceptacja.spec.ts` | ✅ |
| 9 | „Zgłaszam uwagi" bez komentarza zablokowane | `akceptacja.spec.ts` | ✅ |
| 10 | Uwagi zatrzymują licznik | `akceptacja.spec.ts` | ✅ |
| 11 | Cron auto-akceptacji: 72 h, pomija wyłączone i poprawki, dni robocze | `cron.spec.ts` | ✅ |
| 12 | v2 podbija rundę, restartuje licznik, plakietki | `akceptacja.spec.ts` | ✅ |
| 13 | Komentarz po akceptacji: bez zmiany statusu, ze zdarzeniem | `akceptacja.spec.ts` | ✅ |
| 14 | 54 kombinacje w 6 placementach, brak IG wyszarza | `reklamy.spec.ts` | ✅ |
| 15 | Komentarz do wariantu wraca u zespołu | `reklamy.spec.ts` | ✅ |
| 16 | Dwie kampanie jako osobne sekcje, akceptowane razem | `akceptacja.spec.ts` | ✅ |
| 17 | Folder spoza „Materiałów klientów" blokuje import | `import.spec.ts` | ✅ |
| 18 | Folder użyty w innym pakiecie: ostrzeżenie z linkiem | `import.spec.ts` | ✅ |
| 19 | Podmiana w zaakceptowanym: potwierdzenie, zdarzenie, plakietka, baner | `zespol-materialy.spec.ts` | ✅ |
| 20 | Stary plik z `superseded_at` | `zespol-materialy.spec.ts` | ✅ |
| 21 | Wysyłka bez daty publikacji zablokowana | `zespol-materialy.spec.ts` | ✅ |
| 22 | Klient nie przesuwa materiału | `harmonogram.spec.ts` | ✅ |
| 23 | `content_creator` 404 na fakturach (i dokumentach) | `role.spec.ts` | ✅ |
| 24 | `csm` widzi tylko przypisanych | `role.spec.ts` | ✅ |
| 25 | Impersonacja blokuje decyzje, wpis w audycie | `zespol-materialy.spec.ts` | ✅ |
| 26 | Zrzuty podglądów zgodne ze wzorcami | `podglady.spec.ts` | ✅ |
| 27 | Lista linków bez tokenu, „Pokaż link" w audycie, cc bez Dostępu | `dostep-zespol.spec.ts` | ✅ |
| 28 | Klient demo bez linku i faktury | `dostep-zespol.spec.ts`, `faktury.spec.ts` | ✅ |

Poza kryteriami, nowe w tej fazie: `bezpieczenstwo.spec.ts` (CSP), `izolacja.spec.ts`, `retencja.spec.ts`,
`offboarding.spec.ts`, `nowy-klient.spec.ts`.

**Co działa:**
- **CSP z nonce** (SPEC rozdz. 16.6): `src/proxy.ts` generuje nonce na każde żądanie i ustawia `Content-Security-Policy`
  po stronie żądania (stąd Next bierze nonce do własnych skryptów) i odpowiedzi. Budowniczy nagłówka `lib/csp.ts` jest
  czysty i testowany: `script-src 'self' 'nonce-…' 'strict-dynamic'` (w dev dodatkowo `unsafe-eval`, którego wymaga
  React do stosów błędów), `style-src 'self' 'unsafe-inline'` (SPEC zakazuje `unsafe-inline` tylko dla skryptów;
  podglądy ustawiają proporcje atrybutem `style`), `img-src`/`media-src`/`connect-src` własne plus origin Supabase
  (signed URL i PUT uploadu), `frame-ancestors 'none'`, `frame-src 'none'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`, na produkcji `upgrade-insecure-requests`. Root layout ma `force-dynamic`, bo strona zbudowana
  statycznie nie zna nonce. HSTS, nosniff, Referrer-Policy, X-Frame-Options i noindex bez zmian z fazy 0. Test E2E:
  nagłówki na stronach publicznych, klienta i zespołu, każdy `<script>` w HTML z serwera ma nonce, zero naruszeń
  w konsoli na ekranach klienta (PIN, start, pakiet z obrazami przez signed URL, harmonogram, faktury, raporty, pakiet,
  usługi) i zespołu (logowanie, pulpit, karta, pakiet, harmonogram, dostęp, faktury, skrzynka), a skrypt bez nonce
  dopisany do HTML jest odrzucany przez przeglądarkę. Sprawdzone też w buildzie produkcyjnym (`next start` na lokalnym
  stacku): nagłówki bez `unsafe-eval`, zero naruszeń, obrazy przez signed URL ładują się. Po drodze poprawka:
  `upgrade-insecure-requests` tylko, gdy `NEXT_PUBLIC_APP_URL` jest pod https (na `http://localhost` z lokalnym
  Supabase dyrektywa podnosiła adres Storage do https i blokowała obrazy; na produkcji Supabase i tak jest https).
- **Test izolacji** (`izolacja.spec.ts`): klient A vs. każdy rodzaj zasobu klienta B. Odkrycie po drodze: Next NIE
  szyfruje argumentów związanych `.bind()` po stronie serwera (token i id pakietu idą jawnie w ciele akcji), więc test
  podmienia w locie materiał, wariant, pakiet i token na cudze; wszystko odbija się o ponowną autoryzację w akcji
  (`assertClientAccess`, `sprawdzMaterialWPakiecie`). Podpisany adres Storage z podmienioną ścieżką dostaje odmowę.
- **Retencja** (SPEC rozdz. 17): migracja `20260909100001_retencja_i_offboarding.sql` (`retention_reviews`,
  `retention_decision`, `clients.ended_at`). `GET /api/cron/retencja` pierwszego dnia miesiąca 05:00 UTC
  (`vercel.json`): pakiety z `period_to` starszym niż `retention_months` (ustawienia, 24) dostają wiersz przeglądu bez
  decyzji, jedno zdarzenie `retencja.do_przegladu` w outbox, audyt `system.retencja_zgloszona`; zgłoszenie jest
  idempotentne (równoległy przebieg nie dubluje). **Nic nie kasuje się samo.** Ustawienia -> Retencja (admin):
  „Zachowaj 12 miesięcy" (`keep_until`, cron zgłosi ponownie), „Usuń materiały" (po potwierdzeniu: pakiet z kaskadą
  i obiekty z bucketu `materialy`; wiersz zostaje z `deleted_at` i migawką tytułu), „Sprawdź teraz", historia decyzji.
  Ten sam cron kasuje sesje 90 dni po wygaśnięciu i audyt starszy niż 12 miesięcy (`system.retencja_sprzatanie`).
  Czysta logika w `lib/retencja/przeglad.ts` z testami; E2E na klonie z 2024 roku z przepiętymi plikami.
- **Offboarding** (SPEC rozdz. 17): zakładka Ustawienia karty klienta (admin i csm). „Zakończ współpracę" wygasza
  wszystkie linki, unieważnia sesje, ustawia `status = zakonczony` i `ended_at` (audyt `zespol.klient_zakonczony`);
  klient przy następnym żądaniu ląduje na ekranie PIN, a PIN nie przechodzi. „Wznów współpracę" cofa status (linki
  od nowa). „Usuń dane klienta" wyłącznie admin, wyłącznie dla `zakonczony`, nigdy dla demo, po przepisaniu nazwy
  (sprawdzanej także na serwerze): prefiks klienta we wszystkich czterech bucketach i wiersz `clients` z kaskadą;
  audyt zostaje (`zespol.klient_usuniety` z liczbami obiektów). Pulpit: lista „Współprace wstrzymane i zakończone",
  Dostęp nie tworzy linków zakończonemu, plakietka statusu w nagłówku karty, baner po usunięciu.
- **Nowy klient** (`/zespol/klienci/nowy`, admin i csm): bez tego zespół nie miał jak założyć klienta z panelu,
  a `docs/OBSLUGA.md` ma to opisywać. Dane z umowy, slug z nazwy (polskie znaki), lokale i osoby kontaktowe
  w dynamicznych wierszach, walidacja w czystym `lib/klienci/nowy.ts` (test jednostkowy), csm domyślnym opiekunem,
  twórca spoza ról „wszyscy" dostaje przypisanie. Zajęty slug daje komunikat.
- **Kopie zapasowe** (`docs/KOPIE-ZAPASOWE.md`): sprawdzone przez Management API (tylko odczyt): codzienne kopie
  fizyczne działają, **PITR wyłączone** (`pitr_enabled: false`), compute Micro. Procedura odtworzenia krok po kroku
  (zatrzymanie ruchu, zrzut, restore z PITR albo z kopii dziennej, `db push`, przywrócenie ruchu, ręczne odtworzenie
  zdarzeń po punkcie przywracania), osobno Storage bez PITR (źródła: Dysk, Fakturowo, archiwum umów).
- **Dokumentacja**: `docs/OBSLUGA.md` (role, nowy klient, wysyłka materiałów krok po kroku dla content creatora
  i opiekuna, faktury i dokumenty, linki i PIN-y, „link nie działa" w siedmiu punktach, podgląd, offboarding,
  retencja, gdy coś się psuje); `docs/instrukcja/` z dwustronicową ściągą dla Gosi i content creatorów (markdown,
  zrzuty z lokalnego stacku, PDF z `pnpm instrukcja`). SPEC rozdz. 3, 12.2, 15, 17 i CLAUDE.md (zasady 16 i 17)
  uzupełnione.

**Odłożone:**
- Edycja lokali, osób kontaktowych i danych klienta po utworzeniu (dziś przez bazę). Zdjęcie profilowe strony
  do ramki podglądu też przez bazę (`locations.avatar_path`).
- Retencja faktur i dokumentów: SPEC mówi o materiałach; PDF-y zostają do „Usuń dane klienta".
- Anonimizacja `audit_log` po usunięciu klienta: wpisy zostają 12 miesięcy (`actor_label` to etykieta linku).

**Wymaga decyzji Szymona:**
- **PITR w Supabase** (koszt: dodatek plus compute Small; włącza się w panelu Supabase, kroki w `docs/KOPIE-ZAPASOWE.md`).
  Kod ani dokumentacja nie zakładają, że jest włączone; sekcja 1 tego dokumentu mówi wprost, że nie jest.
- Godzina crona retencji: `0 5 1 * *` (7:00 latem, 6:00 zimą pierwszego dnia miesiąca).
- Migracja `20260909100001` jest tylko w lokalnej bazie; wypchnięcie do chmury (`pnpm db:migrate`) i merge do `main`
  razem z migracją fazy 5 (`20260908100001`).
