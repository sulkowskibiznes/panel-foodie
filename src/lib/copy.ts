/**
 * WSZYSTKIE teksty interfejsu. Zero polskich stringów w JSX (CLAUDE.md, zasada 7).
 * Bez pauz i półpauz: wyłącznie zwykły myślnik. Pilnuje tego tests/unit/copy.test.ts.
 * Do klienta mówimy na Ty, bez żargonu, komunikaty błędów mówią, co zrobić.
 */
export const copy = {
  marka: {
    nazwa: "Foodie Media",
    panel: "Panel klienta Foodie Media",
    opisOg: "Panel klienta Foodie Media",
    panelZespolu: "Panel zespołu Foodie Media",
  },
  start: {
    tytul: "Panel klienta Foodie Media",
    opis: "Tu akceptujesz materiały na kolejny miesiąc, sprawdzasz harmonogram publikacji, raporty i faktury.",
    jakWejsc: "Wejdź z linku, który dostałeś od swojego opiekuna. Link i PIN są tylko dla Ciebie.",
    pomoc: "Nie masz linku albo nie działa? Napisz do swojego opiekuna w Foodie Media.",
    zespol: "Jesteś z zespołu Foodie Media?",
    zespolLink: "Zaloguj się do panelu zespołu",
  },
  pin: {
    tytul: "Wpisz PIN",
    opis: "PIN dostałeś razem z linkiem od swojego opiekuna w Foodie Media.",
    etykieta: "PIN",
    zapamietaj: "Zapamiętaj mnie na tym urządzeniu",
    przycisk: "Wejdź do panelu",
    trwa: "Sprawdzamy...",
    blad: "Nie udało się wejść. Sprawdź, czy otwierasz właściwy link i wpisujesz właściwy PIN. Jeśli to się powtarza, napisz do swojego opiekuna.",
    limit: "Za dużo prób w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.",
  },
  nawigacja: {
    start: "Start",
    materialy: "Materiały do akceptacji",
    harmonogram: "Harmonogram",
    archiwum: "Archiwum materiałów",
    raporty: "Raporty",
    faktury: "Faktury i dokumenty",
    pakiet: "Twój pakiet",
    uslugi: "Co jeszcze możemy zrobić",
    wdrozenie: "Wdrożenie",
    wkrotce: "wkrótce",
    wyloguj: "Wyloguj",
    zalogowanyJako: "Zalogowano jako",
  },
  klientStart: {
    powitanie: "Cześć",
    doAkceptacji: "Czeka na Twoją akceptację",
    przejrzyj: "Przejrzyj materiały",
    autoAkceptacja: "Automatyczna akceptacja",
    autoWylaczona: "Bez automatycznej akceptacji",
    wersja: "wersja",
    naBiezaco: "Wszystko na bieżąco",
    naBiezacoOpis: "Nie ma materiałów do akceptacji. Gdy przygotujemy kolejny miesiąc, zobaczysz to tutaj i dostaniesz wiadomość od opiekuna.",
    posty: { jeden: "post", kilka: "posty", wiele: "postów" },
    relacje: { jeden: "relacja", kilka: "relacje", wiele: "relacji" },
    kampanie: { jeden: "kampania reklamowa", kilka: "kampanie reklamowe", wiele: "kampanii reklamowych" },
  },
  materialy: {
    wBudowie: "Ekran akceptacji materiałów powstaje w kolejnym etapie. Na razie zobaczysz tu podsumowanie pakietu.",
    wroc: "Wróć na start",
    status: {
      szkic: "Szkic",
      do_akceptacji: "Do akceptacji",
      poprawki: "Poprawki",
      zaakceptowany: "Zaakceptowany",
      zaplanowany: "Zaplanowany",
    },
  },
  stopka: {
    regulamin: "Regulamin",
    prywatnosc: "Polityka prywatności",
    prawa: "Foodie Media",
  },
  nieZnaleziono: {
    tytul: "Nie ma takiej strony",
    opis: "Sprawdź link, który dostałeś od opiekuna, albo wróć na stronę główną.",
    wroc: "Wróć na stronę główną",
  },
  zespol: {
    logowanie: {
      tytul: "Panel zespołu",
      opis: "Zaloguj się adresem e-mail. Wyślemy Ci kod, który wpiszesz poniżej.",
      email: "Adres e-mail",
      wyslijKod: "Wyślij kod",
      wysylanie: "Wysyłamy...",
      kodWyslany: "Jeśli ten adres jest na liście zespołu, wysłaliśmy na niego kod. Sprawdź skrzynkę i wpisz go poniżej.",
      kod: "Kod z e-maila",
      zaloguj: "Zaloguj się",
      sprawdzanie: "Sprawdzamy...",
      zlyKod: "Kod się nie zgadza albo wygasł. Przepisz wszystkie cyfry z maila albo wyślij nowy kod.",
      innyAdres: "Użyj innego adresu",
      zbytWiele: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.",
      brakDostepu: "Ten adres nie ma dostępu do panelu zespołu. Zostałeś wylogowany. Jeśli to pomyłka, poproś admina o dodanie Cię do zespołu.",
    },
    nawigacja: {
      pulpit: "Pulpit",
      klienci: "Klienci",
      ustawienia: "Ustawienia",
      wyloguj: "Wyloguj",
    },
    role: {
      admin: "Admin",
      csm: "Opiekun klienta",
      content_creator: "Content creator",
      media_buyer: "Media buyer",
      sales: "Sprzedaż",
    },
    kategorie: {
      kat1: "Kategoria 1: osobne restauracje",
      kat2: "Kategoria 2: sieć, jeden profil",
      kat3: "Kategoria 3: sieć, osobne profile",
    },
    kategorieKrotko: { kat1: "kat. 1", kat2: "kat. 2", kat3: "kat. 3" },
    pakiety: { foodie_one: "Foodie One", foodie_360: "Foodie 360°", siec: "Sieć" },
    pulpit: {
      tytul: "Pulpit",
      opis: "Klienci, których obsługujesz, i to, co u nich czeka.",
      brakKlientow: "Nie masz jeszcze przypisanych klientów. Poproś admina o przypisanie.",
      kolumny: { klient: "Klient", kategoria: "Kategoria", pakiet: "Pakiet", doAkceptacji: "Do akceptacji", linki: "Aktywne linki" },
      otworz: "Otwórz kartę",
      miesiecznie: "mies. netto",
    },
    karta: {
      lokale: "Lokale",
      kontakty: "Osoby kontaktowe",
      slack: "Slack",
      opiekun: "Opiekun",
      brakOpiekuna: "nie przypisano",
      wspolpracaOd: "Współpraca od",
      zakladki: {
        materialy: "Materiały",
        harmonogram: "Harmonogram",
        raporty: "Raporty",
        faktury: "Faktury",
        dokumenty: "Dokumenty",
        dostep: "Dostęp",
        ustawienia: "Ustawienia",
      },
      wkrotce: "Ta zakładka powstaje w kolejnym etapie.",
      podsumowanie: "Podsumowanie",
    },
    dostep: {
      tytul: "Dostęp klienta",
      opis: "Każda osoba po stronie klienta dostaje własny link i PIN. Dzięki temu widzisz, kto zaakceptował materiały.",
      utworz: "Utwórz link",
      brakLinkow: "Ten klient nie ma jeszcze żadnego linku. Utwórz pierwszy.",
      kolumny: { osoba: "Osoba", utworzono: "Utworzono", ostatnieWejscie: "Ostatnie wejście", status: "Status", urzadzenia: "Urządzenia" },
      status: { aktywny: "Aktywny", wygaszony: "Wygaszony", zablokowany: "Zablokowany do", tylkoPodglad: "tylko podgląd" },
      nigdy: "jeszcze nie",
      akcje: {
        kopiujLink: "Kopiuj link",
        wygas: "Wygaś link",
        wygasPotwierdz: "Wygasić ten link? Osoba straci dostęp przy następnym wejściu. Tego nie da się cofnąć.",
        wylogujUrzadzenia: "Wyloguj wszystkie urządzenia",
        wylogujPotwierdz: "Wylogować wszystkie urządzenia tego linku? Osoba będzie musiała ponownie wpisać PIN.",
        resetujPin: "Zresetuj PIN",
        resetujPotwierdz: "Zresetować PIN? Stary PIN przestanie działać, a wszystkie urządzenia zostaną wylogowane. Nowy PIN zobaczysz tylko raz.",
      },
      nowy: {
        tytul: "Nowy link dostępu",
        osoba: "Osoba kontaktowa",
        innaOsoba: "Inna osoba (wpisz opis)",
        etykieta: "Opis linku",
        etykietaPodpowiedz: "np. Marek - właściciel",
        rodzajPinu: "Rodzaj PIN-u",
        pin4: "4 cyfry (domyślnie)",
        pin6: "6 cyfr",
        haslo: "Proste hasło",
        mozeAkceptowac: "Ta osoba może akceptować materiały",
        tylkoPodgladOpis: "Bez zaznaczenia: link tylko do podglądu i komentarzy, bez przycisków decyzji.",
        utworz: "Utwórz",
        tworzenie: "Tworzymy...",
        anuluj: "Anuluj",
      },
      gotowy: {
        tytul: "Link i PIN gotowe",
        opis: "PIN widzisz tylko teraz. Skopiuj oba pola i przekaż je klientowi tak, jak zwykle (np. na WhatsAppie). Wiadomość piszesz sam.",
        link: "Link",
        pin: "PIN",
        kopiuj: "Kopiuj",
        skopiowano: "Skopiowano",
        kopiujOba: "Kopiuj link i PIN",
        zamknij: "Zamknij",
        nowyPinTytul: "Nowy PIN",
        nowyPinOpis: "Stary PIN przestał działać, urządzenia zostały wylogowane. Nowy PIN widzisz tylko teraz.",
      },
      historia: {
        tytul: "Historia logowań",
        brak: "Jeszcze nic się nie wydarzyło.",
        kolumny: { kiedy: "Kiedy", co: "Zdarzenie", kto: "Link" },
        zdarzenia: {
          "klient.logowanie_ok": "Udane logowanie",
          "klient.logowanie_blad": "Nieudana próba logowania",
          "klient.blokada_24h": "Blokada linku na 24 godziny (10 nieudanych prób)",
          "klient.wylogowanie": "Wylogowanie",
          "klient.plik_pobrany": "Pobranie pliku",
          "link.utworzony": "Utworzono link",
          "link.wygaszony": "Wygaszono link",
          "link.pin_zresetowany": "Zresetowano PIN",
          "link.urzadzenia_wylogowane": "Wylogowano wszystkie urządzenia",
          "link.skopiowany": "Skopiowano dostęp",
        },
      },
      bledy: {
        brakEtykiety: "Wpisz opis linku albo wybierz osobę kontaktową.",
        ogolny: "Nie udało się wykonać tej operacji. Odśwież stronę i spróbuj ponownie.",
      },
    },
    faktury: {
      tytul: "Faktury",
      wkrotce: "Faktury dochodzą w kolejnym etapie.",
    },
    ustawienia: {
      tytul: "Ustawienia",
      zespol: {
        tytul: "Zespół",
        opis: "Tylko osoby z tej listy mogą zalogować się do panelu zespołu. Dodanie osoby tworzy jej konto; kod logowania dostaje na e-mail przy pierwszym wejściu.",
        dodaj: "Dodaj osobę",
        imie: "Imię",
        email: "Adres e-mail",
        rola: "Rola",
        dodawanie: "Dodajemy...",
        kolumny: { osoba: "Osoba", email: "E-mail", rola: "Rola", status: "Status" },
        aktywny: "Aktywny",
        nieaktywny: "Nieaktywny",
        dezaktywuj: "Dezaktywuj",
        aktywuj: "Aktywuj",
        bledy: {
          dane: "Uzupełnij imię, poprawny adres e-mail i rolę.",
          istnieje: "Osoba z tym adresem już jest na liście.",
          ogolny: "Nie udało się dodać osoby. Spróbuj ponownie.",
          allowlista: "Ten adres nie przechodzi filtra domen (TEAM_EMAIL_ALLOWLIST). Dopisz domenę albo adres do zmiennej środowiskowej.",
        },
      },
    },
  },
  regulamin: {
    tytul: "Regulamin panelu klienta Foodie Media",
    obowiazujeOd: "Obowiązuje od 3 września 2026",
    sekcje: [
      {
        naglowek: "§ 1. Kto prowadzi panel",
        tresc: [
          {
            punkty: [
              "Panel dostępny pod adresem panel.foodiemedia.pl prowadzi **Foodie Media Sp. z o.o.** z siedzibą w Łodzi, ul. Henryka Sienkiewicza 85/87 lok. 8, 90-057 Łódź, NIP 7252349929, REGON 540281469, wpisana do rejestru przedsiębiorców Krajowego Rejestru Sądowego pod numerem KRS 0001140926, dalej: **Agencja**.",
              "Kontakt w sprawach panelu: kontakt@foodiemedia.pl.",
            ],
          },
        ],
      },
      {
        naglowek: "§ 2. Co znaczą używane pojęcia",
        tresc: [
          {
            punkty: [
              "**Klient** - przedsiębiorca, z którym Agencja zawarła umowę o świadczenie usług marketingowych.",
              "**Panel** - narzędzie internetowe, w którym Klient przegląda i akceptuje materiały, ogląda harmonogram publikacji, raporty, faktury i dokumenty.",
              "**Osoba upoważniona** - osoba wskazana przez Klienta, która otrzymuje dostęp do Panelu i działa w imieniu Klienta.",
              "**Materiały** - posty, relacje, filmy i kreacje reklamowe wraz z tekstami, przygotowane przez Agencję w ramach umowy.",
              "**Pakiet** - zestaw Materiałów przygotowany na dany miesiąc współpracy, obejmujący treści organiczne i kampanie reklamowe.",
              "**Akceptacja** - zgoda Klienta na publikację Materiałów w kształcie przedstawionym w Panelu.",
            ],
          },
        ],
      },
      {
        naglowek: "§ 3. Do czego służy Panel",
        tresc: [
          {
            punkty: [
              "Panel jest narzędziem roboczym w ramach umowy między Agencją a Klientem. Nie jest odrębną usługą i nie podlega odrębnej opłacie.",
              "Panel służy do: przeglądania i akceptacji Materiałów, zgłaszania uwag, podglądu harmonogramu publikacji, dostępu do raportów miesięcznych, faktur i dokumentów oraz zapoznania się z dodatkowymi usługami Agencji.",
              "Panel nie służy do zawierania umów ani do dokonywania płatności.",
            ],
          },
        ],
      },
      {
        naglowek: "§ 4. Dostęp i bezpieczeństwo",
        tresc: [
          {
            punkty: [
              "Dostęp do Panelu odbywa się przez indywidualny link oraz kod PIN lub hasło, przekazywane Osobie upoważnionej przez opiekuna Klienta.",
              "Link wraz z kodem stanowią dane dostępowe. Klient odpowiada za to, komu je przekazuje, i zobowiązuje się nie udostępniać ich osobom nieuprawnionym.",
              "Klient niezwłocznie informuje Agencję o utracie kontroli nad danymi dostępowymi lub o podejrzeniu dostępu osoby nieuprawnionej. Agencja wygasza wtedy dane dostępowe i wydaje nowe.",
              "Klient może w każdej chwili poprosić o dodanie lub odebranie dostępu konkretnej Osobie upoważnionej.",
              "Agencja odnotowuje w systemie datę i godzinę logowań, akceptacji i zgłoszonych uwag. Zapisy te służą ustaleniu przebiegu współpracy.",
            ],
          },
        ],
      },
      {
        naglowek: "§ 5. Akceptacja Materiałów",
        tresc: [
          {
            punkty: [
              "Agencja udostępnia Pakiet w Panelu i informuje o tym Klienta ustalonym kanałem kontaktu.",
              "Klient akceptuje Pakiet w całości albo zgłasza uwagi do poszczególnych Materiałów.",
              "Klient zgłasza uwagi w terminie 72 godzin od udostępnienia Pakietu w Panelu.",
              "Brak zgłoszenia uwag w tym terminie oznacza akceptację Pakietu i uprawnia Agencję do rozpoczęcia publikacji zgodnie z harmonogramem.",
              "Panel informuje o upływającym terminie w sposób widoczny od chwili udostępnienia Pakietu, w tym o pozostałym czasie i o skutku bezczynności.",
              "Zgłoszenie uwag wstrzymuje bieg terminu. Termin biegnie od nowa od chwili udostępnienia poprawionej wersji Pakietu.",
              "Opiekun Klienta może wydłużyć termin lub wyłączyć automatyczną akceptację dla konkretnego Pakietu, na wniosek Klienta złożony przed jego upływem.",
              "Liczba rund poprawek nie jest ograniczona. Agencja może jednak wskazać, że kolejne poprawki wykraczają poza zakres umowy - wtedy ustala z Klientem odrębne warunki.",
              "Po akceptacji Klient nadal może zgłaszać uwagi. Agencja rozpatruje je i informuje, czy i kiedy jest w stanie je uwzględnić, przy czym Materiały już opublikowane nie podlegają wycofaniu.",
            ],
          },
        ],
      },
      {
        naglowek: "§ 6. Harmonogram publikacji",
        tresc: [
          {
            punkty: [
              "Daty publikacji Materiałów Agencja przedstawia w Panelu. Klient widzi je przy każdym Materiale i w widoku kalendarza.",
              "Harmonogram ma charakter planu. Agencja może przesunąć publikację z przyczyn technicznych lub z powodu ograniczeń platform, informując o tym Klienta.",
              "Kampanie reklamowe nie mają wskazanej daty publikacji - Agencja uruchamia je po akceptacji, w ramach uzgodnionego okresu rozliczeniowego.",
            ],
          },
        ],
      },
      {
        naglowek: "§ 7. Raporty, faktury i dokumenty",
        tresc: [
          {
            punkty: [
              "Raport miesięczny Agencja udostępnia w Panelu jako odnośnik do dokumentu pod indywidualnym adresem.",
              "Faktury w Panelu mają charakter informacyjny. Dokumentem księgowym jest faktura wystawiona i doręczona zgodnie z umową.",
              "Statusy płatności w Panelu Agencja aktualizuje na podstawie własnych zapisów. Rozbieżność Klient zgłasza opiekunowi.",
            ],
          },
        ],
      },
      {
        naglowek: "§ 8. Dostępność Panelu",
        tresc: [
          {
            punkty: [
              "Agencja dokłada starań, aby Panel działał bez przerw, ale nie gwarantuje ciągłej dostępności.",
              "Agencja może wprowadzać przerwy techniczne. O przerwach planowanych informuje z wyprzedzeniem.",
              "Niedostępność Panelu nie wstrzymuje biegu terminu z § 5 ust. 3, jeżeli trwała krócej niż 6 godzin. Przy dłuższej niedostępności termin ulega przedłużeniu o czas jej trwania.",
              "Do korzystania z Panelu potrzebne jest urządzenie z dostępem do internetu i aktualna przeglądarka internetowa.",
            ],
          },
        ],
      },
      {
        naglowek: "§ 9. Prawa do Materiałów",
        tresc: [
          {
            punkty: [
              "Zasady przeniesienia praw do Materiałów oraz zakres licencji określa umowa między Agencją a Klientem. Panel nie zmienia tych zasad.",
              "Klient nie udostępnia Materiałów osobom trzecim przed publikacją, poza Osobami upoważnionymi.",
            ],
          },
        ],
      },
      {
        naglowek: "§ 10. Reklamacje",
        tresc: [
          {
            punkty: [
              "Uwagi dotyczące działania Panelu Klient zgłasza na adres kontakt@foodiemedia.pl.",
              "Agencja odpowiada w terminie 14 dni od otrzymania zgłoszenia.",
              "Zgłoszenia dotyczące treści Materiałów Klient kieruje przez Panel albo do opiekuna.",
            ],
          },
        ],
      },
      {
        naglowek: "§ 11. Zmiany regulaminu",
        tresc: [
          {
            punkty: [
              "Agencja może zmienić regulamin z ważnych przyczyn, w szczególności przy zmianie zakresu funkcji Panelu lub przepisów prawa.",
              "O zmianie Agencja informuje Klienta z co najmniej 14-dniowym wyprzedzeniem, przez Panel lub ustalonym kanałem kontaktu.",
              "Zmiana § 5 wymaga odrębnej zgody Klienta i nie wchodzi w życie w trybie z ust. 2.",
            ],
          },
        ],
      },
      {
        naglowek: "§ 12. Postanowienia końcowe",
        tresc: [
          {
            punkty: [
              "W sprawach nieuregulowanych stosuje się umowę między Agencją a Klientem, a w dalszej kolejności przepisy prawa polskiego.",
              "Regulamin stanowi uzupełnienie umowy. W razie sprzeczności pierwszeństwo ma umowa.",
              "Zasady przetwarzania danych osobowych opisuje Polityka prywatności panelu.",
            ],
          },
        ],
      },
    ],
  },
  prywatnosc: {
    tytul: "Polityka prywatności panelu klienta",
    obowiazujeOd: "Obowiązuje od 3 września 2026",
    sekcje: [
      {
        naglowek: "1. Kto odpowiada za Twoje dane",
        tresc: [
          "Administratorem danych osobowych jest **Foodie Media Sp. z o.o.** z siedzibą w Łodzi, ul. Henryka Sienkiewicza 85/87 lok. 8, 90-057 Łódź, NIP 7252349929, REGON 540281469, wpisana do rejestru przedsiębiorców Krajowego Rejestru Sądowego pod numerem KRS 0001140926.",
          "W sprawach dotyczących danych osobowych napisz na kontakt@foodiemedia.pl.",
          "Nie wyznaczyliśmy inspektora ochrony danych - wszystkie sprawy prowadzimy pod tym adresem.",
        ],
      },
      {
        naglowek: "2. Jakie dane przetwarzamy",
        tresc: [
          { podtytul: "Dane osób, które korzystają z panelu:" },
          { lista: ["imię i nazwisko,", "rola w firmie (np. właściciel, manager),", "numer telefonu,", "adres e-mail, jeśli został podany."] },
          { podtytul: "Dane, które powstają w trakcie korzystania z panelu:" },
          {
            lista: [
              "data i godzina logowania oraz nieudanych prób logowania,",
              "data i godzina otwarcia materiałów, akceptacji i zgłoszonych uwag,",
              "treść uwag zgłoszonych w panelu,",
              "skrócony, nieodwracalnie przekształcony zapis adresu IP i informacji o przeglądarce.",
            ],
          },
          "**Czego nie zbieramy:** nie zbieramy w panelu danych gości restauracji, nie prowadzimy analityki zewnętrznej, nie stosujemy cookies marketingowych ani śledzących.",
        ],
      },
      {
        naglowek: "3. Po co i na jakiej podstawie",
        tresc: [
          {
            tabela: {
              naglowki: ["Cel", "Podstawa prawna"],
              wiersze: [
                ["Udostępnienie panelu i realizacja umowy o usługi marketingowe", "art. 6 ust. 1 lit. b RODO - niezbędność do wykonania umowy; wobec osób działających w imieniu klienta: art. 6 ust. 1 lit. f - nasz uzasadniony interes w kontakcie z klientem"],
                ["Ustalenie, kto i kiedy zaakceptował materiały", "art. 6 ust. 1 lit. f - uzasadniony interes: udokumentowanie przebiegu współpracy"],
                ["Zabezpieczenie panelu przed nieuprawnionym dostępem (logi, ograniczanie prób logowania)", "art. 6 ust. 1 lit. f - uzasadniony interes: bezpieczeństwo danych"],
                ["Wystawianie i przechowywanie faktur", "art. 6 ust. 1 lit. c - obowiązek prawny wynikający z przepisów podatkowych i o rachunkowości"],
                ["Rozpatrywanie reklamacji i obrona przed roszczeniami", "art. 6 ust. 1 lit. f - uzasadniony interes"],
              ],
            },
          },
        ],
      },
      {
        naglowek: "4. Komu powierzamy dane",
        tresc: [
          "Korzystamy z dostawców, którzy przetwarzają dane na nasze zlecenie:",
          {
            lista: [
              "**Supabase** - baza danych i przechowywanie plików; serwery w regionie Europy (Frankfurt, Niemcy),",
              "**Vercel** - hosting aplikacji; funkcje uruchamiane w regionie Frankfurt,",
              "**Resend** - wysyłka wiadomości z kodami logowania,",
              "**Google** - przechowywanie plików źródłowych materiałów na Dysku Google,",
              "**Zapier** - przekazywanie powiadomień o zdarzeniach w panelu do naszego komunikatora wewnętrznego,",
              "**Slack** - komunikacja wewnętrzna zespołu obsługującego klienta.",
            ],
          },
          "Supabase, Vercel i Resend są spółkami z siedzibą w Stanach Zjednoczonych, mimo że dane przechowujemy w Unii Europejskiej. Przekazanie danych poza Europejski Obszar Gospodarczy może więc wystąpić w zakresie obsługi technicznej. Odbywa się ono na podstawie standardowych klauzul umownych zatwierdzonych przez Komisję Europejską.",
          "Danych nie sprzedajemy i nie udostępniamy do celów marketingowych podmiotom trzecim.",
        ],
      },
      {
        naglowek: "5. Jak długo trzymamy dane",
        tresc: [
          {
            tabela: {
              naglowki: ["Rodzaj danych", "Okres"],
              wiersze: [
                ["Materiały i historia akceptacji", "24 miesiące od udostępnienia"],
                ["Zapisy logowań i działań w panelu", "12 miesięcy"],
                ["Dane sesji zalogowanych urządzeń", "30 dni od wygaśnięcia sesji, nie dłużej niż 90 dni"],
                ["Dane kontaktowe osób upoważnionych", "czas trwania umowy, a po jej zakończeniu do upływu terminu przedawnienia roszczeń"],
                ["Faktury i dokumenty księgowe", "okres wymagany przepisami podatkowymi"],
              ],
            },
          },
          "Po zakończeniu współpracy wygaszamy wszystkie dane dostępowe do panelu. Na wniosek Klienta usuwamy materiały wcześniej.",
        ],
      },
      {
        naglowek: "6. Twoje prawa",
        tresc: [
          "Masz prawo do:",
          {
            lista: [
              "dostępu do swoich danych i otrzymania ich kopii,",
              "sprostowania danych nieprawidłowych lub niekompletnych,",
              "usunięcia danych,",
              "ograniczenia przetwarzania,",
              "przenoszenia danych,",
              "sprzeciwu wobec przetwarzania opartego na naszym uzasadnionym interesie.",
            ],
          },
          "Żeby skorzystać z któregokolwiek, napisz na kontakt@foodiemedia.pl. Odpowiadamy w ciągu miesiąca.",
          "Masz też prawo wnieść skargę do **Prezesa Urzędu Ochrony Danych Osobowych**, ul. Stawki 2, 00-193 Warszawa.",
        ],
      },
      {
        naglowek: "7. Czy podanie danych jest obowiązkowe",
        tresc: ["Podanie imienia, nazwiska i numeru telefonu jest dobrowolne, ale bez nich nie jesteśmy w stanie wydać dostępu do panelu ani przekazać danych logowania."],
      },
      {
        naglowek: "8. Automatyczne decyzje i profilowanie",
        tresc: [
          "Nie profilujemy Cię i nie podejmujemy wobec Ciebie decyzji wyłącznie w sposób zautomatyzowany na podstawie analizy Twoich danych.",
          "Panel zawiera mechanizm automatycznej akceptacji materiałów po upływie 72 godzin, opisany w regulaminie. Jest to uzgodniony umownie sposób liczenia terminu, a nie decyzja podejmowana na podstawie analizy danych osobowych.",
        ],
      },
      {
        naglowek: "9. Pliki cookies",
        tresc: [
          "Używamy wyłącznie plików niezbędnych do działania panelu: pliku utrzymującego zalogowanie oraz plików związanych z bezpieczeństwem sesji. Nie stosujemy cookies analitycznych ani marketingowych, dlatego nie prosimy o zgodę na ich użycie.",
        ],
      },
      {
        naglowek: "10. Zmiany polityki",
        tresc: [
          "Politykę możemy zmienić, gdy zmienią się funkcje panelu, dostawcy lub przepisy. O zmianie poinformujemy w panelu z co najmniej 14-dniowym wyprzedzeniem. Data u góry dokumentu zawsze wskazuje aktualną wersję.",
        ],
      },
    ],
  },
  bledy: {
    ogolny: "Coś poszło nie tak. Odśwież stronę, a jeśli to nie pomoże, napisz do swojego opiekuna.",
  },
} as const;

export type Copy = typeof copy;
