# Prompty do kolejnych faz

Jeden prompt na fazę. Wklejasz na początku sesji, po tym jak Claude Code przeczyta
`CLAUDE.md`. Nie wklejaj kilku naraz — każda faza ma się skończyć wdrożeniem i testami.

---

## Faza 0 — Fundament

```
Robimy fazę 0 z docs/SPEC.md rozdz. 19: fundament.

Zakres:
- Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, pnpm
- Supabase: projekt w regionie eu-central-1, migracje z pełnym schematem z rozdz. 3,
  RLS włączone na każdej tabeli w tej samej migracji
- Seed: 3 klientów, po jednym z każdej kategorii (kat1 z dwoma różnymi restauracjami,
  kat2 z pięcioma lokalami na jednym profilu, kat3 z trzema lokalami na osobnych profilach),
  do każdego komplet materiałów na jeden miesiąc; u jednego klienta DWIE kampanie w miesiącu
  (standardowa + na imprezy okolicznościowe), żeby ten przypadek był testowany od początku
- Design system z rozdz. 14: kolory jako zmienne CSS, Cal Sans + Inter, komponenty bazowe
- Strony /regulamin i /prywatnosc jako miejsca do wypełnienia treścią
- .env.example ze wszystkimi zmiennymi z CLAUDE.md
- Vitest i Playwright skonfigurowane, jeden test dymny każdego rodzaju
- Wdrożenie na Vercel, region funkcji fra1, domena testowa

Zanim zaczniesz pisać migracje, pokaż mi schemat, który zamierzasz utworzyć, i powiedz,
gdzie odchodzisz od SPEC.md i dlaczego.

Ukończone, gdy: pnpm build przechodzi, seed wchodzi bez błędu, strona startowa
w brandzie Foodie widoczna pod adresem testowym.
```

---

## Faza 1 — Dostęp

```
Faza 1 z SPEC.md: logowanie klienta magic linkiem z PIN-em oraz logowanie zespołu.

Wymogi z rozdz. 4 i 16 są twarde — przeczytaj je jeszcze raz przed pisaniem kodu.
Krytyczne:
- token 128-bitowy z crypto.randomBytes, w bazie token_lookup + sha256; PIN argon2id
- zły token i zły PIN dają IDENTYCZNĄ odpowiedź, także pod względem czasu
- 5 prób → 15 min blokady, 10 prób w godzinę → 24 h + zdarzenie do outbox
- sesja 30 dni, cookie __Host-, httpOnly, Secure, SameSite=Lax, rotacja tokenu
- assertClientAccess() jako JEDYNE miejsce sprawdzania izolacji; brak dostępu = 404
- panel zespołu: Supabase Auth e-mail OTP + allowlista domen, role z rozdz. 2
- audit_log zapisuje logowania udane i nieudane, wygenerowanie linku, reset PIN-u

Zbuduj też w panelu zespołu zakładkę „Dostęp" na karcie klienta: lista linków, tworzenie,
jednorazowe pokazanie PIN-u, wygaszenie, wylogowanie wszystkich urządzeń, historia logowań.
Przekazanie dostępu to DWA POLA Z PRZYCISKIEM KOPIOWANIA — link i PIN. Panel nie układa
wiadomości na WhatsAppa i nie otwiera WhatsAppa. Rozdz. 12.4.

Napisz testy E2E 1–6 z rozdz. 18 i pokaż mi ich wynik.
```

---

## Faza 2 — Serce systemu: akceptacja materiałów

```
Faza 2 z SPEC.md — najważniejsza. Pakiety, kampanie, podglądy Facebooka, akceptacja,
komentarze, rundy, auto-akceptacja.

Kolejność, o którą proszę:
1. Maszyna stanów pakietu w lib/pakiety/przejscia.ts — jedno miejsce, które zmienia status,
   zapisuje package_events i wrzuca zdarzenie do outbox. Testy jednostkowe na wszystkie
   przejścia z rozdz. 6.8, w tym te niedozwolone.
2. Podglądy 1:1 (rozdz. 7) jako komponenty w components/podglad/, używane IDENTYCZNIE
   w panelu klienta i w podglądzie zespołu. Nie dwie wersje.
   Content wyłącznie na Facebooku: post na stronie, relacja 9:16, Reels.
   Reklama w SZEŚCIU placementach: FB kanał na telefonie, FB kanał na komputerze,
   FB relacje, FB Reels, IG kanał, IG relacje i Reels.
   Wewnątrz ramki używamy zdjęcia profilowego strony klienta (locations.avatar_path) —
   poza ramką logo klienta nie pojawia się nigdzie w panelu. Brak zdjęcia = neutralne kółko
   z pierwszą literą. Brak ig_handle = placementy IG wyszarzone z podpowiedzią, nie ukryte.
3. Ekran pakietu dla klienta: zakładki Posty / Relacje / Kampanie / Wszystko, pasek decyzji,
   licznik auto-akceptacji. Kampanii w miesiącu może być kilka — każda jako osobna sekcja
   z nazwą, celem i zdaniem wyjaśniającym dla klienta.
4. Akceptacja i zgłaszanie uwag z rozdz. 6.3, komentarze z rozdz. 6.7.
5. Rundy poprawek: round, plakietki „Poprawione" i „Nowe", historia uwag z poprzednich rund.
6. Cron auto-akceptacji: 3 dni KALENDARZOWE, czyli 72 godziny. Ustawienie
   auto_approve_business_days w settings przełącza na dni robocze — zbuduj obie ścieżki,
   domyślnie kalendarzowe. Cron pomija pakiety z wyłączoną flagą i w statusie poprawki.

Ekran reklamy jest najtrudniejszy: trzy listy rozwijane (grafika, tekst, nagłówek),
do 54 kombinacji, przerysowanie bez przeładowania, komentarz przypinany do konkretnego
wariantu. Zrób go ostatni, ale nie po łebkach.

Zacznij od pokazania mi, jak zamierzasz rozłożyć komponenty podglądów, zanim je napiszesz.
Testy E2E 7–16 z rozdz. 18.
```

---

## Faza 3 — Panel zespołu

```
Faza 3 z SPEC.md rozdz. 12: pulpit, kreator pakietu, dodawanie i podmiana materiałów,
harmonogram, skrzynka uwag, impersonacja.

Szczegóły, które łatwo zgubić:
- kolory terminów na pulpicie MUSZĄ odpowiadać kodowi z Bazy Klientów agencji:
  niebieski 6-7 dni, żółty 4-5, pomarańczowy 1-3, czerwony dziś, szary po terminie
- kreator pakietu działa na WKLEJANYCH LINKACH: jeden link do folderu z contentem,
  osobny link do folderu z reklamami dla KAŻDEJ kampanii. Kampanii bywa kilka w miesiącu.
- „Dodaj materiał" i „Podmień materiał" są dostępne w każdej chwili, nie tylko przy
  tworzeniu pakietu. Podmiana zachowuje stary plik (superseded_at) oraz komentarze.
  Zachowanie zależy od statusu pakietu — tabela w rozdz. 12.6. Podmiana w pakiecie
  zaakceptowanym wymaga potwierdzenia i pokazuje klientowi baner.
- harmonogram: przeciąganie materiałów po kalendarzu (dnd-kit), panel „Niezaplanowane",
  kampanie reklamowe poza kalendarzem
- walidacja przed wysyłką: każdy post i każda relacja musi mieć datę publikacji; brak daty
  blokuje wysyłkę i wypisuje konkretnie, czego brakuje
- impersonacja: tryb wyłącznie do odczytu, stały pasek u góry, wejście i wyjście w audit_log

Testy E2E 19-25 z rozdz. 18.
```

---

## Faza 4 — Import z Google Drive

```
Faza 4 z SPEC.md rozdz. 13.

Import działa na WKLEJANYCH LINKACH do folderów, nie na wyliczanych ścieżkach.
Content creator wkleja link do folderu z contentem (w środku „1. Posty" i „2. Relacje")
oraz osobny link do folderu z reklamami dla każdej kampanii. To jest zabezpieczenie
przed zaimportowaniem materiałów z innego miesiąca i nie wolno tego „ulepszyć"
automatycznym szukaniem folderów.

Wymogi:
- konto usługi Google, klucz w GOOGLE_SERVICE_ACCOUNT_JSON, nigdy w repo
- rozpoznawanie wszystkich formatów adresu Dysku: /drive/folders/<id>, /drive/u/0/folders/<id>,
  ?id=<id>, /file/d/<id>
- KARTA WERYFIKACYJNA przed importem (rozdz. 13.2): pełna ścieżka folderu, liczba plików,
  data modyfikacji, nazwy pierwszych plików. Ostrzeżenia gdy nazwa klienta lub numer miesiąca
  się nie zgadza, oraz gdy ten folder był już importowany do innego pakietu (z linkiem do
  tamtego pakietu). Folder spoza „Materiałów klientów" — import ZABLOKOWANY, bez obejścia.
- sortowanie naturalne nazw plików (1, 2, ..., 10 — nie 1, 10, 2)
- Google Docs eksportowane jako text/plain; gdy jeden dokument zawiera wszystkie opisy,
  dzielony po nagłówkach z podglądem podziału
- EKRAN MAPOWANIA JEST OBOWIĄZKOWY. Nigdy nie tworzymy pakietu bez potwierdzenia
  przez człowieka, która grafika ma który opis.
- pliki kopiowane do Supabase Storage: oryginał + preview 1080px webp + thumb 400px webp
- limity: obraz 25 MB, wideo 300 MB (ostrzeżenie od 150 MB); przekroczenie przerywa import
  z komunikatem, który plik i ile waży
- import w tle przez import_jobs, pasek postępu, lista ostrzeżeń, ponowienie po błędzie
- strip EXIF, sprawdzanie magic bytes

Testy E2E 17-18 z rozdz. 18.
Ukończone, gdy: zaimportujesz realny miesiąc dla jednego klienta, z dwiema kampaniami,
i nie trzeba niczego poprawiać ręcznie.
```

---

## Faza 5 — Reszta panelu klienta

```
Faza 5 z SPEC.md: raporty, faktury, dokumenty, sekcja „Twój pakiet", usługi dodatkowe,
webhook do Zapiera.

- raporty: ręczne dodawanie linku przez opiekuna + endpoint POST /api/ingest/report
  z bearerem INGEST_TOKEN (rozdz. 9)
- faktury: wystawiane w Fakturowo, do panelu wpisywane ręcznie, PDF w Storage, status
  po_terminie wyliczany cronem o 6:00, ręcznie ustawiamy tylko „opłacona";
  pole fakturowo_id zostaje puste, ale w schemacie — integracji nie robimy w MVP
- dokumenty: umowa, aneksy, umowa powierzenia
- usługi dodatkowe: karty z tabeli services, modal z jednym polem, zapis service_interests
  i zdarzenie do outbox
- outbox: cron co minutę, 5 prób z narastającym odstępem, jeden generyczny webhook do Zapiera
  z payloadem z rozdz. 15; panel nie zna Slacka
- wdrożenie klienta: trasa i tabela istnieją, flaga onboarding_enabled = false, 404 przy
  wyłączonej fladze, w panelu zespołu zakładka nieaktywna

Po tej fazie idziemy na pilotaż z jednym klientem.
```

---

## Faza 6 — Utwardzenie i przekazanie

```
Faza 6 z SPEC.md: bezpieczeństwo, retencja, offboarding, dokumentacja.

- CSP bez unsafe-inline dla skryptów, frame-ancestors 'none', HSTS, nosniff,
  Referrer-Policy strict-origin-when-cross-origin
- przejdź wszystkie 20 kryteriów z rozdz. 18 i pokaż raport: co przechodzi, co nie
- napisz i uruchom test, który jako klient A próbuje sięgnąć po każdy typ zasobu klienta B:
  pakiet, plik przez signed URL, fakturę, komentarz, raport
- retencja: cron miesięczny oznacza pakiety starsze niż 24 miesiące i ZGŁASZA je do
  akceptacji admina; nic nie kasuje się samo
- offboarding klienta jednym przyciskiem: wygaszenie linków, wylogowanie sesji,
  status zakonczony; osobno „Usuń dane klienta" z potwierdzeniem przez wpisanie nazwy
- kopie zapasowe Supabase: point-in-time recovery włączone, opisz procedurę odtworzenia
- docs/OBSLUGA.md: jak zespół dodaje klienta, wysyła materiały, wgrywa fakturę, co robić
  gdy klient zgłasza, że link nie działa

Na koniec przygotuj krótką instrukcję dla Gosi i content creatorów — po polsku, ze zrzutami,
maksymalnie dwie strony.
```

---

## Prompty pomocnicze

**Gdy coś nie działa u klienta:**
```
Klient {nazwa} zgłasza: {opis}. Sprawdź w audit_log i package_events, co się wydarzyło
w jego panelu w ostatnich 48 godzinach. Nie zgaduj — pokaż mi zdarzenia i dopiero
na tej podstawie postaw hipotezę.
```

**Przed każdym wdrożeniem na produkcję:**
```
Przejdź listę kontrolną przed wdrożeniem: pnpm typecheck, lint, test, test:e2e, build.
Sprawdź, czy .env.example zawiera wszystkie zmienne używane w kodzie. Sprawdź, czy żadna
nowa tabela nie została dodana bez RLS. Pokaż wynik jako listę, nie jako opowieść.
```

**Gdy dokładamy funkcję po wdrożeniu:**
```
Dokładamy {funkcja}. Zanim napiszesz kod: zaktualizuj docs/SPEC.md, pokaż mi zmianę,
poczekaj na moje potwierdzenie. Spec ma zostać źródłem prawdy, a nie zdezaktualizować się
w drugim miesiącu.
```
