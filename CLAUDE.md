# CLAUDE.md — Panel Klienta Foodie Media

Ten plik czytasz na starcie każdej sesji. `SPEC.md` w katalogu `docs/` jest źródłem prawdy
o zakresie — gdy coś tu i tam się rozjeżdża, wygrywa `SPEC.md`, a ten plik poprawiasz.

## Czym jest ten projekt

Panel dla ok. 80 restauracji-klientów agencji Foodie Media, pod `panel.foodiemedia.pl`.
Klient akceptuje w nim pakiet materiałów na okres od-do (6 postów, 10 relacji i **co najmniej
jedna kampania reklamowa** — bywa ich w pakiecie kilka), ogląda harmonogram publikacji,
raporty, faktury i dokumenty. Zespół zarządza tym wszystkim z części administracyjnej.
**Okres pakietu to dowolny zakres dat** (`period_from`, `period_to`, np. 20.09 do 19.10), nie miesiąc
kalendarzowy: każdy klient zaczyna miesiąc innego dnia, a po wstrzymaniu wraca od innego dnia.

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
pnpm dev              # serwer deweloperski (projekt z .env.local, czyli chmura)
pnpm dev:lokalny      # serwer na porcie 3100 podpięty pod lokalny Supabase z Dockera (ten sam co E2E); Dysk = atrapa w pamięci
pnpm dev:lokalny:dysk # to samo, ale z prawdziwym kontem usługi Google z .env.local (sprawdzanie importu bez produkcji)
pnpm build            # build produkcyjny — musi przechodzić przed każdym commitem
pnpm lint             # eslint
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest
pnpm test:e2e         # playwright (wymaga pnpm db:start; sam podnosi next dev na porcie 3100)
pnpm db:start         # lokalny Supabase w Dockerze (testy E2E, db:types)
pnpm db:migrate       # supabase db push
pnpm db:seed          # dane testowe: 3 klienci, po jednym z każdej kategorii, plus klient demo
pnpm db:seed:demo     # tylko klient demonstracyjny (także na produkcji); zespół i usługi bez zmian
pnpm db:types         # regeneracja typów z bazy do src/lib/db-types.ts
```

**Po każdej zmianie schematu bazy uruchom `pnpm db:types`.** Typy generowane, nie pisane ręcznie.

## Struktura katalogów

```
src/
  app/
    p/[token]/            # panel klienta — WSZYSTKO tu wymaga sesji klienta
      (panel)/materialy/[pakietId]/   # ekran akceptacji (page + akcje.ts: akceptuj, uwagi, komentarz, obejrzenie)
      (panel)/plik/, awatar/          # pliki i zdjęcia profilowe przez signed URL po assertClientAccess
    p/[token]/            # token linku ALBO token podglądu „podglad.…" (impersonacja zespołu, tryb tylko do odczytu)
      ustaw-pin/                      # własny PIN po kodzie startowym: bez sesji, tylko z pozwoleniem z cookie (lib/pin-klienta.ts)
      (panel)/pin/                    # „Zmień PIN" (obecny + nowy); podgląd zespołu = 404
      (panel)/harmonogram/            # kalendarz klienta tylko do odczytu (kryterium 22)
      (panel)/raporty/, faktury/      # raporty (link do raporty.foodiemedia.pl w nowej karcie), faktury i dokumenty (rozdz. 5.5, 5.6)
      (panel)/faktura/[id], dokument/[id]   # PDF przez signed URL (10 min) po assertClientAccess; cudzy = 404
      (panel)/pakiet/, uslugi/        # „Twój pakiet" (5.7), „Co jeszcze możemy zrobić" (5.8, akcje.ts: zainteresowanie + outbox)
      (panel)/wdrozenie/              # 404 przy onboarding_enabled = false; kroki tylko do odczytu po włączeniu (rozdz. 11)
      podglad/wyjdz/                  # wyjście z podglądu (audyt)
    zespol/               # panel zespołu — wymaga Supabase Auth + roli
      (panel)/uwagi/                  # skrzynka uwag (rozdz. 12.5)
      (panel)/page.tsx                # pulpit według pilności: kafelki, „Moja praca", klienci bez następnego pakietu (lib/pakiety/pilnosc.ts)
      (panel)/klienci/page.tsx        # lista klientów z wyszukiwarką i filtrami (lib/klienci/lista.ts); „Przejdź do klienta" (idz=1)
      (panel)/klienci/nowy/           # formularz nowego klienta (admin, csm): dane, lokale, osoby kontaktowe (lib/klienci/nowy.ts)
      (panel)/klienci/[slug]/ustawienia/  # zakładka „Dane i współpraca": dane-akcje.ts (dane, lokale ze zdjęciem, osoby,
                                          # zespół klienta, akceptacja), akcje.ts (przerwa, zakończ/wznów, „Usuń dane klienta")
      (panel)/klienci/[slug]/pakiety/nowy/        # kreator pakietu na wklejanych linkach (rozdz. 12.3)
      (panel)/klienci/[slug]/pakiety/[pakietId]/  # ten sam ekran pakietu + akcje zespołu (akcje.ts: przejścia, odpowiedzi;
                                                  # materialy-akcje.ts: upload, plik z Dysku, dodaj/podmień/edytuj materiał, kampanie)
      (panel)/klienci/[slug]/pakiety/[pakietId]/import/   # import z Dysku: karta weryfikacyjna, mapowanie, postęp (akcje.ts),
                                                          # miniatura/[fileId] przez podpisany token
      (panel)/klienci/[slug]/harmonogram/         # kalendarz zespołu z przeciąganiem (dnd-kit) + akcje.ts
      (panel)/klienci/[slug]/raporty/, faktury/, dokumenty/   # zakładki z akcjami (akcje.ts); pliki-akcje.ts = upload PDF (lib/pliki/pdf.ts)
      (panel)/klienci/[slug]/page.tsx             # podsumowanie + zgłoszenia „Chcę wiedzieć więcej" (akcje.ts: załatwione)
      (panel)/faktura/[id], dokument/[id]         # PDF dla zespołu (uprawnienie + assertTeamClientAccess)
      (panel)/ustawienia/layout.tsx               # jedno „Ustawienia" z zakładkami (admin); ogolne/ = podgląd ustawień i integracji
      (panel)/ustawienia/powiadomienia/           # kolejka outbox do Zapiera, „Ponów" (admin)
      (panel)/ustawienia/retencja/                # zgłoszenia retencyjne: „Zachowaj 12 miesięcy", „Usuń materiały", „Sprawdź teraz" (admin)
      (panel)/plik/, awatar/          # pliki dla zespołu (assertTeamClientAccess)
    api/
      ingest/report/      # webhook do rejestrowania raportów: Bearer INGEST_TOKEN, host tylko raporty.foodiemedia.pl (rozdz. 9)
      cron/auto-akceptacja/  # co godzinę (vercel.json), Bearer CRON_SECRET; logika w lib/pakiety/cron-auto-akceptacji.ts
      cron/outbox/        # co minutę: wysyłka kolejki do Zapiera, 5 prób z narastającym odstępem (lib/outbox/wysylka.ts)
      cron/faktury/       # codziennie 04:00 UTC (6:00 latem): do_zaplaty -> po_terminie (lib/faktury/status.ts)
      cron/retencja/      # 1. dnia miesiąca: zgłasza pakiety starsze niż retention_months do decyzji admina, NICZEGO z materiałów
                          # nie kasuje; sprząta sesje po 90 dniach i audyt po 12 miesiącach (lib/retencja/przeglad.ts)
  components/
    podglad/              # podglądy 1:1 — post/relacja/reels na FB, reklama/ w 6 placementach; czyste, bez danych
    pakiet/               # ekran pakietu wspólny dla klienta i zespołu: pasek decyzji, banery, wątki, sekcje
    harmonogram/          # kalendarz zespołu (dnd-kit) i klienta (tylko odczyt), wspólna siatka miesiąca
    zespol/pakiety/       # akcje zespołu nad pakietem (wyślij, wycofaj, v2, cofnij, zaplanowano)
    zespol/materialy/     # narzędzia nad materiałem: upload (use-upload-pliku), dodaj, pliki/podmiana, edycja, reklama, kampania
    zespol/kreator/       # kreator pakietu (z linkami prowadzi do /import)
    zespol/import/        # karta weryfikacyjna, mapowanie (grafika ↔ opis), postęp importu
    zespol/pulpit/, zespol/skrzynka/  # „Pokaż link" i LinkiDoWyslania (pulpit, okno po wysyłce), karta uwagi w skrzynce
    zespol/potwierdzenie.tsx          # usePotwierdzenie: okno potwierdzenia panelu zamiast window.confirm
    zespol/raporty/, faktury/, dokumenty/  # dialogi i listy zakładek (faza 5)
    zespol/pliki/         # upload PDF: use-upload-pdf (3 kroki jak materiały), pole-pdf
    zespol/powiadomienia/, zespol/uslugi/  # kolejka outbox (admin), zgłoszenia usług na karcie klienta
    zespol/retencja/, zespol/ustawienia-klienta/, zespol/klienci/  # lista retencji, współpraca i usunięcie danych, formularz klienta
    zespol/dane-klienta/  # sekcje zakładki „Dane i współpraca" (useZapis: onSubmit bez resetu formularza)
    klient/pasek-podgladu.tsx         # stały pasek impersonacji
    klient/wiecej-mobile.tsx          # arkusz „Więcej" w dolnej nawigacji (ikony po kluczu, nie funkcje)
    klient/uslugi/        # karta usługi z modalem jednego pola
    ui/                   # shadcn
  lib/
    auth-klient.ts        # token linku, kod startowy, PIN z pieprzem, argon2id, hash-atrapa, polityka walidujPinKlienta
                          # (czysty Node, używa go też seed)
    logowanie-klienta.ts  # czysta logika logowania z wstrzykiwanymi zależnościami (test liczy wywołania argon2)
    sesja-klienta.ts      # cookie sesji, rotacja co 24 h, wygaszanie sesji linku; „Zapamiętaj mnie" 90 dni (maks. 180) albo 12 h,
                          # wersja PIN-u w sesji (reset, ustawienie i zmiana PIN-u unieważniają stare sesje)
    pin-klienta.ts        # kod startowy → pozwolenie w cookie (15 min) → własny PIN; zapis CAS, alarmy blokady i zamrożenia
    kontekst-klienta.ts   # kontekst strony klienta: tryb 'klient' (sesja) albo 'podglad' (token podpisany + sesja zespołu)
    podglad-zespolu.ts, podpis.ts  # token impersonacji i podpisane, wygasające ładunki (także pozwolenie na upload)
    auth-zespol.ts        # Supabase Auth OTP + członek zespołu + assertTeamClientAccess
    dostep.ts             # assertClientAccess() — JEDYNE miejsce sprawdzania izolacji
    uprawnienia.ts        # macierz zasób × rola z SPEC rozdz. 2
    allowlista.ts         # filtr domen/adresów z TEAM_EMAIL_ALLOWLIST (czysty)
    krypto.ts             # sha256, HMAC, AES-GCM, HKDF z SESSION_SECRET
    limity.ts             # blokady linku i limit na IP (funkcje SQL zwieksz_limit, odnotuj_nieudane_logowanie)
    audyt.ts, outbox.ts   # zapiszAudyt(), dodajDoOutbox()
    cron.ts               # czyAutoryzowanyCron(): Bearer CRON_SECRET w stałym czasie, wspólne dla czterech cronów
    csp.ts                # Content-Security-Policy z nonce (czysty); nagłówek ustawia proxy.ts, root layout renderuje dynamicznie
    retencja/przeglad.ts  # retencja (rozdz. 17): próg, podział na nowe/ponowne zgłoszenia, sprzątanie sesji i audytu (czyste)
    klienci/nowy.ts       # walidacja formularza nowego klienta z FormData (czysta)
    outbox/               # wysylka.ts (czysta: zajęcie wiersza, próby, odstępy 1/5/15/60 min, failed po 5.), baza.ts (Zapier przez fetch)
    raporty/walidacja.ts  # host raportów, okres YYYY-MM, ciało webhooka (zod), lokal dla kat1 (czyste)
    faktury/status.ts     # po_terminie z daty w Europe/Warsaw, brutto z netto, cron statusów (czyste)
    wdrozenie/postep.ts   # pasek postępu kroków (czyste)
    zadanie.ts            # IP (hash), UA, ścieżka z nagłówka x-pathname
    dane/                 # zapytania do bazy: materialy.ts (pakiet → DTO), komentarze.ts, pliki.ts, ustawienia.ts,
                          # pakiety-klienta.ts, klienci-zespolu.ts, linki.ts, materialy-zespol.ts (mutacje materiałów,
                          # plików, kampanii, kreator), harmonogram.ts, skrzynka.ts, import.ts (zadania, poprzednie użycia folderu),
                          # raporty.ts (jeden na klient+lokal+miesiąc, nadpisanie), faktury.ts, dokumenty.ts, uslugi.ts,
                          # twoj-pakiet.ts (opiekun bez danych prywatnych), powiadomienia.ts (kolejka outbox dla admina),
                          # retencja.ts (przeglądy, usunięcie pakietu z plikami, zależności crona), offboarding.ts (zakończ, wznów,
                          # usuń dane klienta), klienci-nowi.ts (utworzenie klienta funkcją SQL utworz_klienta),
                          # dane-klienta.ts (edycja danych, lokali, osób, zespołu i akceptacji; „Pierwsze kroki")
    dto/                  # kształty danych dla stron (materialy.ts, klient.ts, wynik.ts); nigdy surowe wiersze z bazy
    pakiety/              # przejscia.ts (maszyna stanów, czysta), baza.ts (zmienStatusPakietu, JEDYNA droga zmiany statusu),
                          # auto-akceptacja.ts (72 h / pon-sob), cron-auto-akceptacji.ts, otwarcie.ts,
                          # zmiana-materialu.ts (skutki dodania/podmiany/edycji wg tabeli 12.6, czyste), terminy.ts (kolory terminów)
    pliki/                # magia.ts (magic bytes, limity; czyste), przetwarzanie.ts (EXIF, warianty, Storage: wspólne dla uploadu
                          # i importu), upload.ts (pozwolenie, PUT do Storage z przeglądarki, podpisany opis pliku; także zdjęcie profilowe lokalu),
                          # pdf.ts (ta sama droga dla PDF faktur i dokumentów: buckety faktury/dokumenty, magic bytes %PDF-),
                          # sprzatanie.ts (usunięcie całego prefiksu klienta w buckecie: offboarding)
    drive/                # linki.ts (wklejone linki), nazwy.ts (sortowanie naturalne, numer i slajd z nazwy), opisy.ts (podział
                          # dokumentów, dokument reklam), docx.ts (tekst z Worda), parowanie.ts (grafika ↔ opis): wszystko czyste;
                          # api.ts (kontrakt), google.ts (konto usługi, JWT z google-jwt.ts), atrapa.ts (DRIVE_ATRAPA=1), klient.ts (wybór)
    import/               # ocena.ts (ostrzeżenia i blokada karty, czyste), plan.ts (plan po mapowaniu, limity, zod), weryfikacja.ts
                          # (karta: ścieżka do korzenia, listowanie), mapowanie.ts (propozycja + miniatury), zadania.ts (import_jobs,
                          # worker w after(), wznowienie), pojedynczy.ts (plik z Dysku dla Dodaj/Podmień)
    harmonogram/kalendarz.ts  # siatka okresu od-do, zachodzenie okresów, numer miesiąca współpracy, daty lokalne Europe/Warsaw (czyste)
    reklamy/warianty.ts   # składanie wariantu reklamy dla lokalu (czyste, testowane)
    podglad/tekst.ts      # hashtagi i linki w tekście posta
    format.ts, walidacja.ts
    copy.ts               # WSZYSTKIE teksty interfejsu (polski)
    db-types.ts           # generowane
  proxy.ts                # nagłówek x-pathname, nonce + Content-Security-Policy (lib/csp.ts) i odświeżanie cookies Auth zespołu;
                          # zero decyzji o dostępie
supabase/migrations/
supabase/seed/            # seed 3 klientów + zespół + usługi; grafiki zastępcze z sharp, PDF-y z pdf.ts (umowy, faktury)
supabase/templates/       # szablon maila z kodem OTP (lokalnie; w chmurze wklejany ręcznie)
docs/SPEC.md              # źródło prawdy
docs/PLAN-SESJA-STARTOWA.md  # plan faz 0 i 1, krytyka spec-u, decyzje (2026-09-02)
docs/POSTEP.md            # stan kryteriów odbioru z rozdz. 18
docs/OBSLUGA.md           # instrukcja obsługi dla zespołu: nowy klient, wysyłka materiałów, faktury, „link nie działa"
docs/KOPIE-ZAPASOWE.md    # kopie zapasowe Supabase (PITR) i procedura odtworzenia
docs/instrukcja/          # dwustronicowa instrukcja dla Gosi i content creatorów (markdown, zrzuty, PDF)
tests/unit/
tests/e2e/                # Playwright na lokalnym Supabase, port 3100; zespół logowany raz w projekcie „przygotowanie";
                          # testy zmieniające status pracują na KLONACH pakietów (pomocnicze/pakiety.ts), seed zostaje nietknięty
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
5. **Tokeny i kody startowe z `crypto.randomBytes`.** Nigdy nie wymyślaj wartości tokenu, kodu ani PIN-u —
   ani w kodzie, ani w seedzie, ani w testach (w testach użyj generatora z ustalonym ziarnem). Własny PIN
   klienta wpisuje klient: przechodzi wyłącznie przez `walidujPinKlienta` i od razu trafia do `hashujPin`
   (argon2id z pieprzem `PIN_PEPPER`), zapis tylko funkcją SQL `ustaw_pin_klienta` (porównanie wersji).
   Literały PIN-ów w testach wolno pisać wyłącznie jako wartości, które mają zostać odrzucone.
6. **Żadnego `dangerouslySetInnerHTML`** dla treści pochodzącej od użytkownika.
7. **Teksty interfejsu wyłącznie z `lib/copy.ts`.** Zero polskich stringów wklejonych w JSX.
8. **Migracje tylko w `supabase/migrations/`**, nigdy `ALTER TABLE` z ręki w panelu Supabase.
9. **Zmiana statusu pakietu zawsze przez `lib/pakiety/przejscia.ts`** — jedna maszyna stanów,
   która zapisuje `package_events` i wrzuca zdarzenie do `outbox`. Nie ustawiaj `status`
   bezpośrednio `update`em w handlerze.
10. **Webhook nigdy nie blokuje odpowiedzi.** Zapis do `outbox`, wysyłka cronem co minutę
    (`lib/outbox/wysylka.ts`): 5 prób z odstępami 1, 5, 15, 60 min, potem `failed` i „Ponów" w Ustawieniach.
    Adres raportu w `reports` musi wskazywać `raporty.foodiemedia.pl` (kod i CHECK w bazie).
11. **Materiały wchodzą wyłącznie z wklejonego linku do folderu albo z ręcznego uploadu.**
    Panel nigdy sam nie wylicza ścieżki na Dysku i nigdy nie importuje bez potwierdzenia
    karty weryfikacyjnej przez człowieka. To zabezpieczenie przed materiałami z innego miesiąca.
    Ekran mapowania (grafika ↔ opis) jest obowiązkowy; folder spoza „Materiałów klientów" jest
    zablokowany bez obejścia, także dla podrobionego planu (serwer weryfikuje ponownie w `lib/import/zadania.ts`).
12. **Podmiana pliku nie kasuje starego** — stary dostaje `superseded_at` i `superseded_by`.
    Każda zmiana materiału (dodanie, podmiana, edycja treści, data) przechodzi przez skutki
    z `lib/pakiety/zmiana-materialu.ts` i zapis w `lib/dane/materialy-zespol.ts`: plakietki, przesunięcie
    auto-akceptacji, `changed_after_approval`, zdarzenie i outbox biorą się stamtąd, nie z handlera.
13. **Strony klienta dostają wyłącznie DTO z `lib/dto/`**, nigdy surowe wiersze z bazy. Pola
    zespołu (`internal_note`, `created_by`, hashe) nie mogą wyciec przez przypadkowy `select *`.
14. **Pliki wchodzą tylko przez `lib/pliki/upload.ts`** (materiały i zdjęcia profilowe lokali) **albo `lib/pliki/pdf.ts`** (PDF faktur
    i dokumentów): przeglądarka dostaje jednorazowy podpisany adres do Storage, serwer sprawdza magic bytes
    (i zdejmuje EXIF z obrazów), a mutacja przyjmuje wyłącznie podpisany opis pliku. Nigdy ścieżki w Storage
    podane przez klienta akcji.
15. **Impersonacja wyłącznie do odczytu.** Kontekst `podglad` (token `podglad.…` plus sesja zespołu)
    nie zostawia śladów po stronie klienta: żadnych `first_opened_at`, `item_views`, komentarzy, decyzji.
16. **Nic nie kasuje się samo.** Cron retencji tylko zgłasza pakiety do decyzji admina (`retention_reviews`);
    usunięcie materiałów i „Usuń dane klienta" to zawsze kliknięcie człowieka z potwierdzeniem. Jedyne
    automatyczne kasowanie to wygasłe sesje po 90 dniach i audyt po 12 miesiącach (SPEC rozdz. 17).
17. **Skrypty tylko z nonce.** CSP z `src/proxy.ts` nie ma `unsafe-inline` dla skryptów; nie dodawaj `<script>`
    inline ani zewnętrznych skryptów (analityka i tak jest zakazana). Styl inline (`style={{}}`) jest dozwolony.
    Nowa strona musi renderować się dynamicznie (root layout ma `force-dynamic`, nie wyłączaj tego per trasa).

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
PIN_PEPPER                      # pieprz do hashy PIN-ów klientów (HMAC przed argon2id), osobny od SESSION_SECRET;
                                # ustawiany raz na zawsze: zmiana unieważnia wszystkie PIN-y
GOOGLE_SERVICE_ACCOUNT_JSON     # import z Dysku: JSON klucza konta usługi (surowy albo base64)
GOOGLE_DRIVE_ROOT_FOLDER_ID     # folder „Materiały klientów" udostępniony na adres konta usługi (odczyt)
DRIVE_ATRAPA                    # „1" = atrapa Dysku w pamięci (E2E, dev:lokalny); puste na produkcji
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
