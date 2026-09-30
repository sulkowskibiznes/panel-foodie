# Obsługa panelu — instrukcja dla zespołu Foodie Media

Panel: `https://panel.foodiemedia.pl/zespol`. Logowanie adresem e-mail i kodem z maila (bez hasła).
Ta instrukcja opisuje codzienne czynności. Krótsza wersja dla Gosi i content creatorów, ze zrzutami,
leży w `docs/instrukcja/`. Sprawy techniczne (zmienne środowiskowe, migracje, kopie zapasowe) są
w `CLAUDE.md`, `docs/KOPIE-ZAPASOWE.md` i `docs/KONFIGURACJA-MAILI.md`.

## Kto co może

| Rola | Klienci | Może |
|---|---|---|
| admin (Szymon) | wszyscy | wszystko, w tym Ustawienia (zespół, ogólne, powiadomienia, retencja) i „Usuń dane klienta" |
| csm (Gosia) | przypisani | nowy klient, pakiety, wysyłka, linki dostępu, faktury, dokumenty, zakończenie współpracy |
| content_creator | przypisani | pakiety i materiały, harmonogram, podgląd raportów; bez faktur i dostępu |
| media_buyer | przypisani | kampanie i warianty reklam, raporty |
| sales | wszyscy (podgląd) | klient demonstracyjny przez „Zobacz jak klient" |

Osobę do zespołu dodaje admin w **Ustawienia → Zespół** (adres musi przejść filtr domen). Nowa osoba
loguje się kodem z maila przy pierwszym wejściu.

**Jak poruszać się po panelu (od Etapu 3):**
- **Pulpit** (content creator: **„Moja praca"**): kafelki na górze mówią, co jest pilne (wstrzymana auto-akceptacja,
  auto-akceptacja w 24 h, nowe uwagi, poprawki, do zaplanowania w Meta, szkice). Kliknięcie kafelka filtruje tabelę,
  drugie kliknięcie zdejmuje filtr. Tabela jest od najpilniejszego. Pod nią „Klienci bez pakietu na następny okres".
- **Klienci**: lista z wyszukiwarką i filtrami (opiekun, kategoria, współpraca). Pole **„Przejdź do klienta"**
  w nagłówku: wpisz fragment nazwy i Enter; jedno trafienie otwiera kartę od razu.
- Karta klienta ma na górze **szybkie akcje**: „Nowy pakiet", „Utwórz link", „Zobacz jak klient".
- Każda nieodwracalna akcja pyta w okienku panelu (nazwa przycisku mówi, co się stanie); wynik pokazuje krótki
  komunikat u góry ekranu.

## 1. Nowy klient

1. **Klienci → „Nowy klient"** (przycisk nad listą klientów; widzą admin i csm).
2. Wpisz dane z umowy: nazwę, kategorię (1: osobne restauracje, 2: sieć z jednym profilem, 3: sieć
   z osobnymi profilami), pakiet, kwotę netto, kanał Slack, datę startu, opiekuna.
   Slug (adres w panelu) podpowiada się z nazwy; zmieniaj tylko, gdy koliduje.
3. **Lokale**: każdy z nazwą i **dokładną nazwą strony na Facebooku** (pojawia się w podglądach 1:1).
   Nick na Instagramie bez `@`; bez niego placementy IG w podglądach reklam są wyszarzone.
4. **Osoby kontaktowe**: każda dostanie potem własny link i kod startowy. Pierwsza jest główna.
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

1. Karta klienta → **„Nowy pakiet"** (szybka akcja u góry karty albo w zakładce Materiały).
2. **Klient i okres**: wpisz datę początku i końca (np. 20.09 do 19.10; okres nie musi być miesiącem
   kalendarzowym). Pod polami widać, kiedy kończył się poprzedni pakiet. Numer miesiąca współpracy podpowiada się
   jako „ostatni + 1"; po przerwie popraw ręcznie.
   Klient kategorii 1 ma osobny pakiet na każdy lokal (wybierz lokal).
3. **Folder z contentem**: wklej link do folderu `content {N} mies` z Dysku (ten z podfolderami „1. Posty"
   i „2. Relacje"). Panel nie zgaduje ścieżek: importuje tylko to, co wkleisz.
4. **Kampanie**: „Dodaj kampanię" dla każdej (standardowa, imprezy, polubienia): nazwa, cel, notatka dla
   klienta i link do folderu z reklamami tej kampanii. „Skopiuj kampanie z poprzedniego pakietu" przenosi nazwy,
   cele i notatki (linki do folderów wklej nowe). Pakiet bez kampanii da się wysłać, ale z ostrzeżeniem.
5. „Utwórz pakiet" → **karta weryfikacyjna** każdego folderu: ścieżka na Dysku, liczba plików, ostrzeżenia
   (inny klient w nazwie folderu, inny miesiąc, folder użyty już w innym pakiecie). Folder spoza „Materiałów
   klientów" jest zablokowany bez obejścia. Czytaj ostrzeżenia: to jedyne zabezpieczenie przed materiałami
   z innego miesiąca.
6. **Mapowanie**: potwierdź, która grafika ma który opis (panel paruje po numerach w nazwach plików
   i dokumentów „tekst N"). Popraw, gdzie zgadł źle. Potem kopiowanie w tle z paskiem postępu; na końcu przycisk
   „Ustaw daty w harmonogramie".
   Link do folderu wkleisz albo poprawisz też później: **„Ustawienia pakietu"** w szkicu (tam też tytuł);
   „Importuj z Dysku" jest w każdym szkicu, a bez linku otwiera właśnie te ustawienia.
7. W pakiecie uzupełnij **daty publikacji** (bez daty przy poście albo relacji wysyłka jest zablokowana),
   złóż warianty reklam (grafiki, teksty, nagłówki; media buyer może to zrobić sam) i obejrzyj podgląd oczami
   klienta (te same komponenty, które zobaczy klient).
8. Pojedynczy plik z komputera albo z Dysku: **„Dodaj materiał"** w pakiecie; podmiana pliku: narzędzia
   przy materiale. Stary plik nigdy nie znika, dostaje tylko znacznik podmiany.

### 2.2 Opiekun: wysyłka i co dalej

1. W pakiecie **„Wyślij do akceptacji"**. Okno wysyłki od razu pokazuje listę kontrolną: braki (daty, puste opisy)
   blokują wysyłkę i mają link „Ustaw daty w harmonogramie", ostrzeżenia (brak kampanii) tylko informują.
   Po wysyłce rusza licznik **72 godzin** do automatycznej akceptacji (poniedziałek-sobota, gdy admin przełączył
   tryb dni roboczych).
2. Zaraz po wysyłce okno pokazuje **„link dla klienta"**: „Pokaż link" przy osobie, która akceptuje, i „Kopiuj".
   Wyślij go klientowi na WhatsAppie (nowej osobie osobno też kod startowy, sekcja 4). Panel nie wysyła nic sam.
   Później ten sam link jest pod przyciskiem „Link dla klienta" w pakiecie i „Pokaż link" na pulpicie.
3. **Pulpit** pokazuje: ile klient czeka, ile zostało do auto-akceptacji (kolory jak w Bazie Klientów:
   niebieski 6–7 dni, żółty 4–5, pomarańczowy 1–3, czerwony dziś, szary po terminie), czy klient otworzył pakiet
   („Otwarty przez klienta") i nieprzeczytane uwagi.
   Bursztynowy wiersz **„Auto-akceptacja wstrzymana"** = termin minął, ale klient ma nierozwiązane uwagi;
   odpowiedz na nie i oznacz „Załatwione", inaczej pakiet nie zostanie zatwierdzony. „Odpowiedz na uwagi" prowadzi
   prosto do wątku z pierwszą nierozwiązaną uwagą; w pakiecie pasek „Nierozwiązane uwagi klienta: N" ma przycisk
   „Przejdź do pierwszej".
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

Karta klienta → **Dostęp** (admin i csm). Od Etapu 2 (2026-09-29) **klient sam ustawia swój PIN**; zespół
wydaje tylko jednorazowy kod startowy i nigdy nie zna PIN-u klienta.

- **„Utwórz link"**: wybierz osobę kontaktową (albo wpisz opis) i czy osoba może akceptować (bez zaznaczenia:
  tylko podgląd i komentarze). Dostajesz **link i 6-cyfrowy kod startowy**. Kod widzisz tylko raz, działa raz
  i przez 7 dni. Skopiuj link i kod **osobnymi przyciskami** i wyślij **dwiema osobnymi wiadomościami** (WhatsApp).
  Wiadomość piszesz sam. Okno nie zamknie się bez pytania, dopóki nie skopiujesz kodu.
- Klient otwiera link, wpisuje kod w polu „PIN albo kod startowy", a panel od razu prosi o **własny PIN**
  (4 do 6 cyfr; daty, lata, 1234 i podobne są odrzucane). Od tej chwili wchodzi swoim PIN-em. PIN zmieni sam
  w panelu: „Zmień PIN" w stopce (telefon: „Więcej").
- Stan przy każdym linku: „Czeka na PIN klienta, kod ważny do…", „Kod startowy wygasł, wydaj nowy",
  „PIN ustawiony przez klienta {data}", „Zamrożony po próbach zgadnięcia PIN-u".
- Każda osoba po stronie klienta dostaje **własny link**, żeby było wiadomo, kto zaakceptował.
- **„Pokaż link"** (także na pulpicie przy pakiecie do akceptacji) odsłania adres bez kodu; każde kliknięcie
  jest w audycie. Do ponownego wysłania linku osobie, która go zgubiła.
- **„Wydaj nowy kod"** (dawniej „Zresetuj PIN"): obecny PIN przestaje działać, wszystkie urządzenia są
  wylogowane, blokada i zamrożenie znikają, a klient po nowym kodzie ustawi nowy PIN. Kod widzisz raz.
- **„Wyloguj wszystkie urządzenia"**: sesje znikają, link i PIN zostają.
- **„Wygaś link"**: nieodwracalne; osoba traci dostęp przy następnym wejściu. Potem tworzysz nowy link.
- **Historia logowań** pod listą: udane i nieudane próby, kod startowy, ustawienie i zmiana PIN-u, blokady.
- Na Slacka trafiają: ustawienie własnego PIN-u, każda zmiana PIN-u (jeśli to nie był klient, wydaj nowy kod),
  blokada 24 h i zamrożenie linku.

## 5. Klient mówi, że link nie działa

Sprawdź po kolei, od najczęstszych przyczyn:

1. **Zapomniał PIN-u albo wpisuje zły.** Ekran PIN nie mówi, co jest nie tak (celowo). 5 błędnych PIN-ów blokuje
   link na 15 minut; **6. próba z dobrym PIN-em też odpada**, więc każ odczekać kwadrans. 10 błędnych w ciągu doby
   blokuje na 24 h i wysyła powiadomienie na Slacka; druga taka blokada w ciągu 30 dni **zamraża link**. Stan widać
   w Dostępie („Zablokowany do", „Zamrożony") i w historii logowań. Zespół nie zna PIN-u klienta, więc wyjście
   jest jedno: **„Wydaj nowy kod"** (czyści blokadę, odmraża) i wyślij kod; klient ustawi nowy PIN.
2. **Kod startowy wygasł.** Klient widzi „Ten kod startowy już wygasł". Kod działa 7 dni i tylko raz.
   „Wydaj nowy kod" i wyślij go jeszcze raz.
3. **Otwiera stary link.** Po wygaszeniu albo po zakończeniu współpracy link prowadzi na ekran PIN, a PIN
   nigdy nie przechodzi. W Dostępie zobaczysz status „Wygaszony". Utwórz nowy link.
4. **Obcięty link w wiadomości.** Token ma 32 znaki; WhatsApp czasem łamie długi adres. Poproś o zrzut ekranu
   albo wyślij „Pokaż link" jeszcze raz, osobno od kodu.
5. **Otwiera link w przeglądarce w aplikacji** (np. w Messengerze) z zablokowanymi ciasteczkami: po PIN-ie
   wraca na ekran PIN. Niech otworzy link w Safari albo Chrome. Panel używa wyłącznie technicznych ciasteczek
   (bez banera zgody), ale przeglądarki wbudowane bywają dziwne.
6. **Był zalogowany, a teraz prosi o PIN.** To normalne po 90 dniach bez wejścia (z „Zapamiętaj mnie"), po
   12 godzinach bez „Zapamiętaj mnie", po nowym kodzie, po zmianie PIN-u na innym urządzeniu, po „Wyloguj
   wszystkie urządzenia" i po zakończeniu współpracy. Wpisuje PIN ponownie.
7. **Widzi „Nie znaleziono" po zalogowaniu.** Otworzył adres innego klienta albo pakiet, którego już nie ma
   (szkic, usunięty przez retencję). Wyślij mu link prosto z „Pokaż link"; trafi na Start.
8. Gdy nic z powyższego nie pasuje: przekaż Szymonowi **godzinę próby i etykietę osoby**. W audycie widać
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
   na akceptację, zdejmuje klienta z pulpitu. Znajdziesz go w **Klienci** pod filtrem „Współpraca: Przerwy i zakończone"
   (link pod listą). Dane zostają.
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
