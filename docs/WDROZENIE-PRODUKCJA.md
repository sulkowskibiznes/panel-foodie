# Wdrożenie produkcyjne - projekt Supabase, domena, PITR, raporty

Stan wyjściowy (2026-09-30): `main` jest wdrożony na Vercelu (`panel-foodie.vercel.app`, plan Pro, 4 crony), ale
wszystkie środowiska (Production, Preview i lokalny `pnpm dev`) pracują na **projekcie testowym** Supabase
`fdpbpnenqrrjtorexbnx`. Przed pierwszym prawdziwym linkiem dla klienta produkcja musi dostać osobny projekt,
własne sekrety i domenę. PIN-y i sesje zahashowane na projekcie testowym nie przenoszą się, więc kolejność:
projekt → sekrety → domena → dopiero linki dla klientów.

Kroki są w kolejności wykonania. Wartości sekretów wpisuj w edytorze albo w panelach usług, nigdy do rozmowy
z asystentem. Każdy krok ma na końcu kontrolę.

---

## Krok 1 - nowy projekt Supabase (ok. 20 min)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**:
   - organizacja: ta sama co projekt testowy,
   - **Name**: `panel-foodie-prod`,
   - **Database Password**: wygeneruj w menedżerze haseł i **zapisz** (potrzebne do `supabase link`),
   - **Region**: **Central EU (Frankfurt)** = `eu-central-1` (dane w UE, Vercel działa w `fra1`),
   - **Compute**: jeśli od razu chcesz PITR (krok 4), wybierz **Small**; inaczej Micro (zmiana później = restart bazy).
2. Poczekaj, aż projekt się uruchomi (1-2 min). Z paska adresu zapisz **project ref** (ciąg po `/project/`).
3. **Project Settings → API Keys** → zakładka **API Keys** (nowe klucze, nie „Legacy anon/service_role"):
   - skopiuj **Publishable key** (`sb_publishable_…`),
   - **Create new secret key** → nazwa `panel-foodie-vercel` → skopiuj `sb_secret_…` (widać raz).
   - Jeśli zakładki nowych kluczy nie ma, panel pokazuje przycisk włączenia nowych kluczy; włącz.
4. **Project Settings → Data API**: zapisz **Project URL** (`https://<ref>.supabase.co`).

Kontrola: masz zapisane ref, URL, klucz publishable, klucz secret i hasło bazy.

## Krok 2 - schemat bazy (migracje) i buckety

W terminalu, w katalogu repo, na gałęzi `main`:

```bash
set -a; source .env.local; set +a; pnpm exec supabase link --project-ref <REF_PROD>
```

Poda hasło bazy z kroku 1 (można też `--password '<hasło>'`; wtedy wyczyść historię powłoki). Następnie:

```bash
pnpm db:migrate
```

Odpowiedz `Y`. Na świeżym projekcie wchodzą wszystkie 22 migracje (od `20260902120001` do `20261002100001`).

Kontrola:

```bash
pnpm exec supabase migration list
```

Każdy wiersz ma wypełnioną kolumnę `remote`. W panelu Supabase → **Storage** są cztery buckety: `materialy`,
`awatary`, `faktury`, `dokumenty` (tworzy je migracja `20260902120010`; niczego nie dodawaj ręcznie).

**Uwaga:** od tej chwili CLI jest podpięte pod produkcję: `pnpm db:migrate` idzie na produkcję. Żeby wypchnąć
migrację na projekt testowy (Preview, `pnpm dev`), przełącz tymczasowo:
`pnpm exec supabase link --project-ref fdpbpnenqrrjtorexbnx` → `pnpm db:migrate` → wróć na produkcję. Zasada po
wdrożeniu: najpierw projekt testowy i Preview, potem produkcja i merge do `main`.

## Krok 3 - Auth i maile logowania zespołu

Powtórz `docs/KONFIGURACJA-MAILI.md` kroki 3-6 dla nowego projektu (domena `powiadomienia.foodiemedia.pl` w Resend
jest już zweryfikowana, nie ruszaj DNS):

1. Resend → **API Keys → Create API Key**: nazwa `panel-foodie-prod-smtp`, **Sending access**, tylko domena
   `powiadomienia.foodiemedia.pl`. Klucz do menedżera haseł.
2. Supabase (projekt prod) → **Authentication → Emails → SMTP Settings → Enable Custom SMTP**:
   host `smtp.resend.com`, port `587`, username dosłownie `resend`, password = klucz z pkt 1,
   sender `no-reply@powiadomienia.foodiemedia.pl`, nazwa `Foodie Media`.
3. **Authentication → Emails → Templates → Magic Link**: wklej całą treść `supabase/templates/kod-logowania.html`
   (musi zawierać `{{ .Token }}`; bez tego mail przyjdzie bez kodu).
4. **Authentication → Sign In / Providers → Email**: **Email OTP expiration** `600`; **Email OTP length** `8`
   (tak jak lokalnie i na projekcie testowym; formularz przyjmuje 6-10 cyfr).
5. **Authentication → URL Configuration**: **Site URL** `https://panel.foodiemedia.pl` (po kroku 7 domena już
   działa; jeśli robisz ten krok wcześniej, wpisz `https://panel-foodie.vercel.app` i popraw po domenie).
   Redirect URLs nie są potrzebne: logowanie kodem nie używa linków.
6. **Authentication → Rate Limits**: „Rate limit for sending emails" podnieś do co najmniej 30/h (domyślne 2-4/h
   blokuje logowanie kilku osób naraz).
7. **Wyłączenie rejestracji** (`Allow new users to sign up` w Sign In / Providers) - dopiero **po kroku 5**
   (seed tworzy konta zespołu przez klucz serwera; wyłączona rejestracja nie zaszkodzi, ale kolejność jest
   bezpieczniejsza).

Kontrola: po kroku 5 i wdrożeniu (krok 6) zaloguj się swoim adresem; mail z 8-cyfrowym kodem przychodzi
w kilkanaście sekund (Resend → Logs pokazuje wysyłkę).

## Krok 4 - plik `.env.produkcja` i seed startowy

Seed produkcyjny dopisuje zespół (5 osób z `supabase/seed/dane.ts`, sekcja `ZESPOL`; **sprawdź tam adresy
e-mail i role przed uruchomieniem**), usługi z „Co jeszcze możemy zrobić" i klienta demonstracyjnego. Żadnych
klientów testowych, żadnych linków.

1. Skopiuj `.env.example` do **`.env.produkcja`** (plik jest w `.gitignore` przez wzorzec `.env.*`) i wypełnij
   w edytorze:

   | Zmienna | Wartość |
   |---|---|
   | `NEXT_PUBLIC_APP_URL` | `https://panel.foodiemedia.pl` |
   | `SUPABASE_URL` | Project URL z kroku 1 |
   | `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` z kroku 1 |
   | `SUPABASE_SECRET_KEY` | `sb_secret_…` z kroku 1 |
   | `SESSION_SECRET` | **nowy**: `openssl rand -hex 32` |
   | `PIN_PEPPER` | **nowy, inny niż SESSION_SECRET**: `openssl rand -hex 32`; ustawiany raz na zawsze |
   | `CRON_SECRET` | nowy `openssl rand -hex 32` (albo ten sam co dziś w Vercelu) |
   | `TEAM_EMAIL_ALLOWLIST` | jak dziś w Vercelu; musi obejmować **wszystkie** adresy zespołu, także gmail/o2 |
   | `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`, `ZAPIER_WEBHOOK_URL` | jak w `.env.local` |
   | `DRIVE_ATRAPA` | puste |
   | `INGEST_TOKEN` | nowy `openssl rand -hex 32` (krok 9) |
   | `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN` | puste (tokeny narzędziowe zostają tylko w `.env.local`) |

   Ten plik jest jednocześnie ściągą do wpisania zmiennych w Vercelu (krok 5). Trzymaj go jak hasło.

2. Seed:

   ```bash
   pnpm db:seed:produkcja --env=.env.produkcja
   ```

   Skrypt wypisuje `Seed → https://<ref>.supabase.co` i `Tryb --produkcja: zespół 5 osób…`. Odmawia pracy na
   lokalnym stacku. Jest idempotentny dla zespołu (istniejące osoby zostają z obecną rolą).

Kontrola: Supabase → **Authentication → Users** ma 5 kont; **Table Editor → team_members** 5 wierszy,
`services` 6, `clients` 1 (`demo-bistro`, `demo = true`). Teraz wyłącz rejestrację (krok 3 pkt 7).

## Krok 5 - zmienne Vercela dla Production

Vercel → projekt **panel-foodie** → **Settings → Environment Variables**. Dziś każda zmienna ma jeden wpis
dla `Production, Preview`. Preview ma **zostać na projekcie testowym**, więc dla sześciu zmiennych rozdzielasz wpisy:

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `PIN_PEPPER`,
`NEXT_PUBLIC_APP_URL`:

1. kliknij wpis → **Edit** → odznacz **Production** (zostaje Preview) → **Save**,
2. **Add New** → ta sama nazwa → wartość z `.env.produkcja` → zaznacz **tylko Production** → dla kluczy
   (`SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `PIN_PEPPER`) zaznacz **Sensitive** → **Save**.

Do tego **Add New** (Production) dla `INGEST_TOKEN` (Sensitive). Jeśli zmieniłeś `CRON_SECRET`, tak samo
rozdziel wpis. Pozostałe (`TEAM_EMAIL_ALLOWLIST`, Google, Zapier) zostają wspólne.

Kontrola (nazwy i środowiska, bez wartości):

```bash
set -a; source .env.local; set +a; pnpm exec vercel env ls --token "$VERCEL_TOKEN"
```

Sześć zmiennych ma po dwa wpisy (osobno Production i Preview), `INGEST_TOKEN` jeden (Production).

## Krok 6 - wdrożenie z nowymi zmiennymi

Zmiana zmiennych nie uruchamia wdrożenia sama. Vercel → **Deployments** → najnowsze wdrożenie **Production**
→ menu `…` → **Redeploy** (bez „Use existing Build Cache"). Po 2-3 min status **Ready**.

Kontrola: `https://panel-foodie.vercel.app/zespol/logowanie` → zaloguj się kodem z maila → **Ustawienia → Ogólne**:
Zapier, Dysk i raporty „skonfigurowane"; **Ustawienia → Zespół**: 5 osób; **Klienci**: tylko klient demonstracyjny.
Lista pakietów jest pusta, to poprawne.

## Krok 7 - domena `panel.foodiemedia.pl`

1. Vercel → projekt → **Settings → Domains → Add** → `panel.foodiemedia.pl` → środowisko **Production**.
   Vercel pokaże rekord do dodania: **CNAME** `panel` → `cname.vercel-dns.com`.
2. Cloudflare → strefa `foodiemedia.pl` → **DNS → Records → Add record**:
   Type **CNAME**, Name **`panel`** (samo `panel`, Cloudflare dokleja domenę), Target **`cname.vercel-dns.com`**,
   Proxy status **DNS only** (szara chmurka: Vercel sam wystawia certyfikat i cache; pomarańczowa chmurka daje
   podwójne proxy i błędy certyfikatu), TTL Auto.
3. Wróć do Vercela: po kilku minutach domena ma status **Valid Configuration** i certyfikat.
4. Tam samo, przy `panel-foodie.vercel.app` → **Edit** → **Redirect to** `panel.foodiemedia.pl` (308). Adresy
   podglądów (`*-foodie-panel.vercel.app`) zostają bez przekierowania.
5. Jeśli w kroku 3 pkt 5 wpisałeś adres tymczasowy, popraw **Site URL** w Supabase na `https://panel.foodiemedia.pl`.

`NEXT_PUBLIC_APP_URL` w Production już wskazuje domenę (krok 5). Jeśli domenę robisz przed krokiem 5, po
zmianie zmiennej zrób Redeploy (krok 6).

Kontrola:

```bash
curl -sI https://panel.foodiemedia.pl/zespol/logowanie | head -1
```

`HTTP/2 200`. W przeglądarce: kłódka bez ostrzeżeń, `panel-foodie.vercel.app` przekierowuje na domenę.

## Krok 8 - PITR (kopie punkt-w-czasie)

Projekt prod → **Project Settings → Compute and Disk** (starsze panele: **Add-ons**):

1. Jeśli compute to Micro: **Compute Size → Small** → potwierdź. Restart bazy, ok. 2 min niedostępności,
   dlatego przed pierwszymi klientami.
2. **Point in Time Recovery → Enable** → retencja **7 dni** (najniższy próg) → potwierdź. Panel pokazuje kwotę
   przed potwierdzeniem (orientacyjnie: PITR ok. 100 USD/mies., Small kilkanaście USD/mies.; to decyzja kosztowa).

Kontrola (tylko odczyt, token z `.env.local`):

```bash
set -a; source .env.local; set +a; curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" https://api.supabase.com/v1/projects/<REF_PROD>/database/backups
```

W odpowiedzi `"pitr_enabled":true`. Potem zaktualizuj tabelę w `docs/KOPIE-ZAPASOWE.md` (ref projektu, PITR
włączone, compute Small).

## Krok 9 - webhook raportów (`INGEST_TOKEN`)

Panel nie generuje raportów; dostaje je webhookiem i tylko linkuje do `raporty.foodiemedia.pl` (SPEC rozdz. 9).

1. Token z `.env.produkcja` jest już w Vercelu (krok 5) i wdrożony (krok 6).
2. Po stronie systemu raportów (albo Zapa, który wysyła powiadomienie o gotowym raporcie) dodaj wywołanie:

   ```
   POST https://panel.foodiemedia.pl/api/ingest/report
   Authorization: Bearer <INGEST_TOKEN>
   Content-Type: application/json

   { "client_slug": "pierogarnia-babci", "period": "2026-09",
     "url": "https://raporty.foodiemedia.pl/<ścieżka-raportu>",
     "title": "Raport wrzesień 2026", "cooperation_month": 4, "location": "Rynek" }
   ```

   `title`, `cooperation_month` i `location` są opcjonalne; `location` (nazwa restauracji dokładnie jak w panelu)
   jest wymagane tylko dla klienta kat1 z kilkoma restauracjami. `url` musi być pod `https://raporty.foodiemedia.pl/`,
   inaczej 400. Ten sam klient + okres (+ restauracja) drugi raz = nadpisanie raportu.
3. Odpowiedzi: `200 {"ok":true,…}` zapisano; `401` zły token; `404 nieznany_klient` zły slug (slug jest na karcie
   klienta w adresie `/zespol/klienci/<slug>`); `422` zła nazwa restauracji (odpowiedź wymienia poprawne);
   `503 ingest_wylaczony` brak `INGEST_TOKEN` w Vercelu.

Kontrola: wywołanie z tokenem dla klienta demonstracyjnego (`demo-bistro`) daje `200`, a raport pojawia się na
karcie klienta demo w zakładce **Raporty**. Bez nagłówka `Authorization` odpowiedź to `401`.

## Krok 10 - kontrola końcowa przed pierwszym klientem

- Zapier: Zap z Catch Hook **włączony**, routing po polu `slack_channel`. Pierwsze zdarzenie z produkcji widać
  w **Ustawienia → Powiadomienia** (status wysłane / próby).
- Dysk: folder „Materiały klientów" udostępniony na adres konta usługi (odczyt); w **Ustawienia → Ogólne** Dysk
  „skonfigurowany". Pierwszy import zrób na kliencie demonstracyjnym.
- Crony: po kwadransie od wdrożenia **Pulpit** admina nie pokazuje banera o cronach (baner = outbox bez przebiegu
  od 15 min, auto-akceptacja od 2 h, faktury od 26 h, błędy w przebiegu albo wpisy `failed` w outboxie).
- Zespół: **Ustawienia → Zespół** → każdemu opiekunowi wpisz „Kontakt dla klienta" (widoczny w „Twój pakiet").
- `.env.local` zostaje na projekcie testowym: `pnpm dev` i Preview nigdy nie dotykają produkcji.
- Pierwszy prawdziwy klient: `docs/OBSLUGA.md` rozdz. 1 („Nowy klient") i 4 („Linki dostępu i PIN-y").

## Co się zmienia w codziennej pracy po wdrożeniu

- Nowa migracja: lokalnie `pnpm db:reset` + testy → `link` na projekt testowy → `pnpm db:migrate` → Preview →
  `link` na produkcję → `pnpm db:migrate` → merge do `main`. Kod czytający nowe kolumny wdraża się dopiero po
  migracji produkcji (tak jak przy planie domknięcia).
- Rotacja `SESSION_SECRET` wylogowuje wszystkich klientów i unieważnia zaszyfrowane tokeny linków (trzeba
  wydać nowe linki). Rotacja `PIN_PEPPER` unieważnia wszystkie PIN-y (klienci dostają nowe kody startowe).
  Obu nie zmieniaj bez powodu.
- Odtwarzanie z kopii: `docs/KOPIE-ZAPASOWE.md` rozdz. 3.
