# Obsługa panelu — instrukcja dla zespołu Foodie Media

Panel: `https://panel.foodiemedia.pl/zespol`. Logowanie adresem e-mail i kodem z maila (bez hasła).
Ta instrukcja opisuje codzienne czynności. Krótsza wersja dla Gosi i content creatorów, ze zrzutami,
leży w `docs/instrukcja/`. Sprawy techniczne (zmienne środowiskowe, migracje, kopie zapasowe) są
w `CLAUDE.md`, `docs/KOPIE-ZAPASOWE.md` i `docs/KONFIGURACJA-MAILI.md`.

## Kto co może

| Rola | Klienci | Może |
|---|---|---|
| admin (Szymon) | wszyscy | wszystko, w tym Ustawienia (zespół, powiadomienia, retencja) i „Usuń dane klienta" |
| csm (Gosia) | przypisani | nowy klient, pakiety, wysyłka, linki dostępu, faktury, dokumenty, zakończenie współpracy |
| content_creator | przypisani | pakiety i materiały, harmonogram, podgląd raportów; bez faktur i dostępu |
| media_buyer | przypisani | kampanie i warianty reklam, raporty |
| sales | wszyscy (podgląd) | klient demonstracyjny przez „Zobacz jak klient" |

Osobę do zespołu dodaje admin w **Ustawienia → Zespół** (adres musi przejść filtr domen). Nowa osoba
loguje się kodem z maila przy pierwszym wejściu.

## 1. Nowy klient

1. **Pulpit → „Nowy klient"** (przycisk nad listą klientów; widzą admin i csm).
2. Wpisz dane z umowy: nazwę, kategorię (1: osobne restauracje, 2: sieć z jednym profilem, 3: sieć
   z osobnymi profilami), pakiet, kwotę netto, kanał Slack, datę startu, opiekuna.
   Slug (adres w panelu) podpowiada się z nazwy; zmieniaj tylko, gdy koliduje.
3. **Lokale**: każdy z nazwą i **dokładną nazwą strony na Facebooku** (pojawia się w podglądach 1:1).
   Nick na Instagramie bez `@`; bez niego placementy IG w podglądach reklam są wyszarzone.
4. **Osoby kontaktowe**: każda dostanie potem własny link i PIN. Pierwsza jest główna.
5. **Zespół klienta** (opcjonalnie): zaznacz content creatora i media buyera. Bez przypisania content creator
   nie zobaczy klienta.
6. „Utwórz klienta" → karta klienta. Błąd (np. zajęty slug) nie czyści formularza.

Na karcie nowego klienta czeka lista **„Pierwsze kroki"** (linki dla osób, zdjęcia profilowe lokali, przypisany
content creator, umowa i umowa powierzenia w Dokumentach, pierwszy pakiet). Kroki odhaczają się same.

### 1.1 Poprawki po utworzeniu: zakładka „Dane i współpraca"

Karta klienta → **Dane i współpraca** (admin i csm). Wszystko, co wcześniej wymagało bazy:

- **Dane**: nazwa, pakiet, kwota, Slack, data startu. Slugu nie zmienisz; kategorię tylko, dopóki klient nie ma
  pakietów ani raportów.
- **Lokale**: nazwa, miasto, strona FB, nick IG, adres, nowy lokal. **Zdjęcie profilowe strony** (JPG, PNG albo
  WebP do 5 MB) trafia tylko do ramki podglądu 1:1. Zmieniając nazwę lokalu w kategorii 1, pamiętaj, że raporty
  dopasowują lokal po nazwie.
- **Osoby kontaktowe**: edycja, nowa osoba, „Ustaw jako główną", „Zakończ współpracę z osobą" (dane kontaktowe
  znikają, domyślnie wygasają też jej linki).
- **Zespół klienta**: opiekun i przypisani. Kto nie jest przypisany (a nie jest adminem ani sales), nie widzi klienta.
- **Akceptacja i publikacja**: czy przy wysyłce domyślnie włączać auto-akceptację, ile godzin (72-720; puste = 72)
  i domyślne godziny publikacji w harmonogramie.

## 2. Wysyłka materiałów do akceptacji

### 2.1 Content creator: pakiet i import z Dysku

1. Karta klienta → **Materiały → „Nowy pakiet"**.
2. **Klient i okres**: wpisz datę początku i końca (np. 20.09 do 19.10; okres nie musi być miesiącem
   kalendarzowym). Numer miesiąca współpracy podpowiada się jako „ostatni + 1"; po przerwie popraw ręcznie.
   Klient kategorii 1 ma osobny pakiet na każdy lokal (wybierz lokal).
3. **Folder z contentem**: wklej link do folderu `content {N} mies` z Dysku (ten z podfolderami „1. Posty"
   i „2. Relacje"). Panel nie zgaduje ścieżek: importuje tylko to, co wkleisz.
4. **Kampanie**: „Dodaj kampanię" dla każdej (standardowa, imprezy, polubienia): nazwa, cel, notatka dla
   klienta i link do folderu z reklamami tej kampanii. Pakiet bez kampanii da się wysłać, ale z ostrzeżeniem.
5. „Utwórz pakiet" → **karta weryfikacyjna** każdego folderu: ścieżka na Dysku, liczba plików, ostrzeżenia
   (inny klient w nazwie folderu, inny miesiąc, folder użyty już w innym pakiecie). Folder spoza „Materiałów
   klientów" jest zablokowany bez obejścia. Czytaj ostrzeżenia: to jedyne zabezpieczenie przed materiałami
   z innego miesiąca.
6. **Mapowanie**: potwierdź, która grafika ma który opis (panel paruje po numerach w nazwach plików
   i dokumentów „tekst N"). Popraw, gdzie zgadł źle. Potem kopiowanie w tle z paskiem postępu.
7. W pakiecie uzupełnij **daty publikacji** (bez daty przy poście albo relacji wysyłka jest zablokowana),
   złóż warianty reklam (grafiki, teksty, nagłówki; media buyer może to zrobić sam) i obejrzyj podgląd oczami
   klienta (te same komponenty, które zobaczy klient).
8. Pojedynczy plik z komputera albo z Dysku: **„Dodaj materiał"** w pakiecie; podmiana pliku: narzędzia
   przy materiale. Stary plik nigdy nie znika, dostaje tylko znacznik podmiany.

### 2.2 Opiekun: wysyłka i co dalej

1. W pakiecie **„Wyślij do akceptacji"**. Panel pokazuje listę braków (daty, puste opisy) i ostrzeżenia
   (brak kampanii). Po wysyłce rusza licznik **72 godzin** do automatycznej akceptacji (poniedziałek–sobota,
   gdy admin przełączył tryb dni roboczych).
2. Klient dostaje od Ciebie wiadomość na WhatsAppie z linkiem i PIN-em (sekcja 4). Panel nie wysyła nic sam.
3. **Pulpit** pokazuje: ile klient czeka, ile zostało do auto-akceptacji (kolory jak w Bazie Klientów:
   niebieski 6–7 dni, żółty 4–5, pomarańczowy 1–3, czerwony dziś, szary po terminie), nieprzeczytane uwagi.
   Bursztynowy wiersz **„Auto-akceptacja wstrzymana"** = termin minął, ale klient ma nierozwiązane uwagi;
   odpowiedz na nie i oznacz „Załatwione", inaczej pakiet nie zostanie zatwierdzony.
4. **Uwagi klienta** czytasz w pakiecie (wątek przy materiale) albo zbiorczo w **Skrzynce uwag**. Odpowiadasz
   tam samo; „Załatwione" zamyka wątek (admin, csm i content creator; sales i media buyer tylko odpowiadają).
   Uwaga jest „nowa", dopóki ktoś na nią nie odpowie, nie kliknie „Oznacz jako przeczytaną" albo nie otworzy
   pakietu osoba, która może go zmieniać. Samo zajrzenie do skrzynki licznika nie gasi.
5. Po uwagach poprawiasz materiały i klikasz **„Wyślij wersję 2"**: numer rundy rośnie, licznik startuje od nowa,
   klient widzi plakietki „Poprawione".
6. Po akceptacji (ręcznej albo automatycznej) ustawiasz publikacje w Meta Business Suite i klikasz
   **„Zaplanowano"**. Zmiana materiału w zaakceptowanym pakiecie wymaga potwierdzenia i pokazuje klientowi baner.
7. Cofnięcia: **„Wycofaj do szkicu"** (przed decyzją klienta) i cofnięcie do poprawek (po akceptacji, z powodem;
   klient dostaje bursztynowy baner). Wiadomość do klienta piszesz sam.

Powiadomienia na Slacka idą przez Zapiera (wysyłka, otwarcie, akceptacja, uwagi, 24 h bez otwarcia,
24 h do auto-akceptacji, wstrzymana auto-akceptacja, zainteresowanie usługą, 10 nieudanych PIN-ów).
Gdy coś nie doszło: admin sprawdza **Ustawienia → Powiadomienia** i klika „Ponów" przy nieudanym zdarzeniu.

## 3. Faktury i dokumenty

Zakładki **Faktury** i **Dokumenty** widzą admin i csm. Klient widzi obie sekcje w „Faktury i dokumenty".

1. **„Dodaj fakturę"**: numer z Fakturowo, data wystawienia, termin płatności, netto (brutto podpowiada się
   z 23 %, popraw przy innej stawce), notatka wewnętrzna (klient jej nie widzi), opcjonalnie PDF.
2. PDF dołożysz później: **„Dodaj / Podmień PDF"** (tylko PDF, do 25 MB; plik idzie prosto do magazynu,
   panel sprawdza, że to naprawdę PDF).
3. Status **„Po terminie"** ustawia się sam rano po terminie płatności (cron); klient widzi go na czerwono
   z liczbą dni i na Starcie. Ręcznie ustawiasz tylko **„Oznacz jako opłaconą"** z datą wpłaty; pomyłkę cofa
   „Cofnij opłacenie".
4. Pomyłka w numerze albo kwocie: „Usuń" i dodaj fakturę od nowa (edycji na razie nie ma).
5. **Dokumenty**: rodzaj (umowa, aneks, umowa powierzenia, inny), tytuł, „obowiązuje od", PDF obowiązkowy.
   Umowa powierzenia przetwarzania danych powinna być u każdego klienta.

Klient demonstracyjny nie ma faktur ani linków (baza to blokuje).

## 4. Linki dostępu i PIN-y

Karta klienta → **Dostęp** (admin i csm).

- **„Utwórz link"**: wybierz osobę kontaktową (albo wpisz opis), rodzaj PIN-u (4 cyfry domyślnie), czy osoba
  może akceptować (bez zaznaczenia: tylko podgląd i komentarze). **PIN widzisz tylko raz.** Skopiuj „Link i PIN"
  i wyślij klientowi tak jak zwykle (WhatsApp). Wiadomość piszesz sam.
- Każda osoba po stronie klienta dostaje **własny link**, żeby było wiadomo, kto zaakceptował.
- **„Pokaż link"** (także na pulpicie przy pakiecie do akceptacji) odsłania adres bez PIN-u; każde kliknięcie
  jest w audycie. Do ponownego wysłania linku osobie, która go zgubiła.
- **„Zresetuj PIN"**: stary przestaje działać, wszystkie urządzenia wylogowane, nowy PIN widzisz raz.
- **„Wyloguj wszystkie urządzenia"**: sesje znikają, link i PIN zostają.
- **„Wygaś link"**: nieodwracalne; osoba traci dostęp przy następnym wejściu. Potem tworzysz nowy link.
- **Historia logowań** pod listą: udane i nieudane próby, blokady, z których urządzeń.

## 5. Klient mówi, że link nie działa

Sprawdź po kolei, od najczęstszych przyczyn:

1. **Wpisuje zły PIN.** Ekran PIN nie mówi, co jest nie tak (celowo). 5 błędnych PIN-ów blokuje link
   na 15 minut; **6. próba z dobrym PIN-em też odpada**, więc każ odczekać kwadrans. 10 błędnych w godzinę
   blokuje na 24 h i wysyła powiadomienie na Slacka. Stan blokady widać w Dostępie („Zablokowany do")
   i w historii logowań. Najszybsze wyjście: **„Zresetuj PIN"** (czyści blokadę i liczniki) i wyślij nowy PIN.
2. **Otwiera stary link.** Po wygaszeniu albo po zakończeniu współpracy link prowadzi na ekran PIN, a PIN
   nigdy nie przechodzi. W Dostępie zobaczysz status „Wygaszony". Utwórz nowy link.
3. **Obcięty link w wiadomości.** Token ma 32 znaki; WhatsApp czasem łamie długi adres. Poproś o zrzut ekranu
   albo wyślij „Pokaż link" jeszcze raz, najlepiej osobno od PIN-u.
4. **Otwiera link w przeglądarce w aplikacji** (np. w Messengerze) z zablokowanymi ciasteczkami: po PIN-ie
   wraca na ekran PIN. Niech otworzy link w Safari albo Chrome. Panel używa wyłącznie technicznego ciasteczka
   sesji (bez banera zgody), ale przeglądarki wbudowane bywają dziwne.
5. **Był zalogowany, a teraz prosi o PIN.** To normalne po 30 dniach bez wejścia, po resecie PIN-u, po
   „Wyloguj wszystkie urządzenia" i po zakończeniu współpracy. Wpisuje PIN ponownie.
6. **Widzi „Nie znaleziono" po zalogowaniu.** Otworzył adres innego klienta albo pakiet, którego już nie ma
   (szkic, usunięty przez retencję). Wyślij mu link prosto z „Pokaż link"; trafi na Start.
7. Gdy nic z powyższego nie pasuje: przekaż Szymonowi **godzinę próby i etykietę osoby**. W audycie widać
   każdą próbę logowania (udaną i nie) z powodem.

## 6. Podgląd oczami klienta

„Zobacz jak klient" na karcie klienta (admin i csm; sales tylko klient demo). Widzisz dokładnie to, co klient,
w trybie tylko do odczytu: przyciski decyzji i pole komentarza są wyłączone, nic nie zapisuje się jako
„otwarte" po stronie klienta. Wyjście: pasek u góry ekranu. Wejście i wyjście są w audycie.

## 7. Zakończenie współpracy i usuwanie danych

Karta klienta → **Dane i współpraca** (admin i csm), sekcja „Współpraca".

1. **„Przerwa we współpracy"**: klient znika z pulpitu i skrzynki, cron go nie akceptuje, wysyłka pakietów jest
   wstrzymana; linki działają, klient może zajrzeć do panelu. Pakiety czekające na akceptację wracają do szkicu.
2. **„Zakończ współpracę"**: wygasza wszystkie linki, wylogowuje urządzenia klienta, wycofuje pakiety czekające
   na akceptację, zdejmuje klienta z pulpitu (lista „Przerwy i zakończone współprace" pod klientami). Dane zostają.
3. **„Wznów współpracę"**: klient wraca na pulpit; po zakończeniu linki trzeba utworzyć od nowa, pakiety wysłać ponownie.
4. **„Usuń dane klienta"** (tylko admin, tylko po zakończeniu): przepisz nazwę klienta i potwierdź. Znikają
   lokale, osoby, linki, pakiety z plikami, komentarze, faktury, dokumenty, raporty i kolejka powiadomień klienta.
   Audyt zostaje na 12 miesięcy, ale bez danych osobowych.
   Przed tym warto zrobić zrzut bazy (`docs/KOPIE-ZAPASOWE.md`, sekcja 5).

## 8. Retencja materiałów (admin)

Pierwszego dnia miesiąca cron zgłasza pakiety, których okres skończył się ponad 24 miesiące temu.
**Nic nie kasuje się samo.** Admin w **Ustawienia → Retencja** decyduje: „Zachowaj 12 miesięcy" (pakiet wróci
na listę po roku) albo „Usuń materiały" (pakiet, pliki, komentarze i historia znikają; faktury, dokumenty
i raporty zostają). „Sprawdź teraz" uruchamia zgłaszanie ręcznie. Zgłoszenie idzie też na Slacka.

## 9. Gdy coś się psuje

- **Import z Dysku „nie widzi folderu"**: folder musi leżeć w „Materiałach klientów" udostępnionych kontu
  usługi; sprawdź, czy link jest do folderu (nie do pliku) i czy nie został przeniesiony.
- **Powiadomienie nie doszło na Slacka**: Ustawienia → Powiadomienia (admin), „Ponów". Gdy wszystko jest
  „nieudane", Zapier ma problem albo zmienił adres webhooka.
- **Klient twierdzi, że zaakceptował, a panel mówi inaczej**: w pakiecie jest historia (kto, kiedy, z jakiego
  urządzenia), a admin ma pełny audyt. Zdarzenia nie giną.
- **Strona nie ładuje obrazów**: podpisane adresy plików ważne są 10 minut; odśwież stronę.
- Reszta: Szymon. Podaj klienta, godzinę i co dokładnie kliknięto.
