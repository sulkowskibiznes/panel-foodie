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
  },
  start: {
    tytul: "Panel klienta Foodie Media",
    opis: "Tu akceptujesz materiały na kolejny miesiąc, sprawdzasz harmonogram publikacji, raporty i faktury.",
    jakWejsc: "Wejdź z linku, który dostałeś od swojego opiekuna. Link i PIN są tylko dla Ciebie.",
    pomoc: "Nie masz linku albo nie działa? Napisz do swojego opiekuna w Foodie Media.",
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
  regulamin: {
    tytul: "Regulamin panelu klienta",
    wstep: "Ten regulamin opisuje zasady korzystania z panelu klienta Foodie Media pod adresem panel.foodiemedia.pl.",
    doUzupelnienia: "Treść tej sekcji uzupełni Foodie Media przed uruchomieniem panelu dla klientów.",
    sekcje: [
      { naglowek: "1. Postanowienia ogólne", tresc: [] },
      { naglowek: "2. Dostęp do panelu", tresc: ["Dostęp do panelu odbywa się przez indywidualny link i PIN przekazane przez opiekuna. Link i PIN są przeznaczone dla osoby, której zostały przekazane."] },
      { naglowek: "3. Akceptacja materiałów", tresc: ["Klient akceptuje pakiet materiałów na dany miesiąc jednym przyciskiem albo zgłasza uwagi do poszczególnych materiałów."] },
      { naglowek: "4. Automatyczna akceptacja", tresc: ["Jeżeli w ciągu 72 godzin od wysłania materiałów do akceptacji klient nie zaakceptuje ich ani nie zgłosi uwag, materiały uznaje się za zaakceptowane automatycznie. Licznik jest widoczny w panelu od chwili wysłania materiałów, a na 24 godziny przed terminem panel wyświetla ostrzeżenie. Zgłoszenie uwag zatrzymuje licznik."] },
      { naglowek: "5. Komentarze i uwagi", tresc: [] },
      { naglowek: "6. Dane osobowe", tresc: [] },
      { naglowek: "7. Postanowienia końcowe", tresc: [] },
    ],
  },
  prywatnosc: {
    tytul: "Polityka prywatności",
    wstep: "Panel przetwarza wyłącznie dane osób kontaktowych po stronie klienta: imię i nazwisko, telefon i adres e-mail. Nie zbieramy danych gości restauracji.",
    doUzupelnienia: "Treść tej sekcji uzupełni Foodie Media przed uruchomieniem panelu dla klientów.",
    sekcje: [
      { naglowek: "1. Administrator danych", tresc: [] },
      { naglowek: "2. Jakie dane przetwarzamy i po co", tresc: [] },
      { naglowek: "3. Gdzie przechowujemy dane", tresc: ["Dane są przechowywane na serwerach w Unii Europejskiej (Frankfurt)."] },
      { naglowek: "4. Jak długo przechowujemy dane", tresc: ["Materiały przechowujemy przez 24 miesiące, dziennik zdarzeń przez 12 miesięcy."] },
      { naglowek: "5. Pliki cookies", tresc: ["Panel używa wyłącznie technicznych plików cookies niezbędnych do utrzymania sesji. Nie używamy analityki zewnętrznej ani cookies marketingowych."] },
      { naglowek: "6. Twoje prawa", tresc: [] },
    ],
  },
  bledy: {
    ogolny: "Coś poszło nie tak. Odśwież stronę, a jeśli to nie pomoże, napisz do swojego opiekuna.",
  },
} as const;

export type Copy = typeof copy;
