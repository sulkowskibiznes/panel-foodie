# Prompt startowy — wklej to jako pierwszą wiadomość w Claude Code

> **Zanim wkleisz:** w pustym katalogu `panel-foodie/` umieść pliki `docs/SPEC.md`
> i `CLAUDE.md` (dostaniesz je razem z tym plikiem), zainicjuj repo (`git init`)
> i włącz tryb planowania (`Shift+Tab` dwa razy, aż zobaczysz „plan mode").
> Potem wklej całość poniżej.

---

Budujemy panel klienta dla agencji marketingowej Foodie Media, pod adresem
`panel.foodiemedia.pl`. To ma być najważniejsze narzędzie operacyjne firmy na najbliższe
lata, a nie prototyp. Pracujemy w tym repo przez wiele sesji.

**Zacznij od przeczytania `CLAUDE.md` i `docs/SPEC.md` w całości.** `SPEC.md` jest źródłem
prawdy o zakresie: ma model danych w SQL, mechanikę akceptacji, wymogi bezpieczeństwa,
kryteria odbioru i podział na fazy. Nie streszczaj mi ich z powrotem.

## Kontekst, którego nie ma w plikach

Agencja obsługuje ok. 80 restauracji. Co miesiąc każdy klient dostaje 6 postów, 10 relacji
i co najmniej jedną kampanię reklamową — bywa ich w miesiącu kilka. Dziś jedzie to linkiem
do Dysku Google, a akcept odbywa się na WhatsAppie.
Z ankiet wśród klientów wyszło, że **52% kampanii mija zaplanowany termin, a 90% tych
opóźnień wynika ze spóźnionej akceptacji klienta.** To jest jedyny problem, dla którego ten
panel powstaje. Każda decyzja projektowa, która skraca drogę od „materiały gotowe" do
„klient kliknął akceptuję", jest ważniejsza od każdej innej.

Klient to restaurator. Otworzy ten panel z linka na WhatsAppie, na telefonie, między jednym
a drugim zamówieniem. Jeśli będzie musiał się zastanawiać, co kliknąć, przegraliśmy.

## Czego oczekuję w tej pierwszej sesji

Nie pisz jeszcze kodu produkcyjnego. Chcę:

1. **Plan wdrożenia fazy 0 i fazy 1** (fundament + dostęp klienta), rozbity na konkretne
   kroki z plikami, które powstaną. Fazy są opisane w `SPEC.md` rozdz. 19.
2. **Listę rzeczy, które w `SPEC.md` są niedookreślone albo wewnętrznie sprzeczne** —
   przeczytaj ją krytycznie, nie grzecznościowo. Interesują mnie zwłaszcza: model
   uprawnień, przejścia statusów pakietu, mechanika auto-akceptacji, relacja pakiet →
   kampanie → materiały oraz sposób trzymania wariantów reklamowych. Jeśli któreś z moich
   rozstrzygnięć uważasz za błędne, powiedz to wprost i uzasadnij.
3. **Trzy decyzje techniczne, które podejmiesz inaczej niż sugeruje spec**, jeśli takie są —
   z uzasadnieniem. Nie szukaj ich na siłę.
4. **Listę rzeczy, które muszę zrobić ja** zanim ruszysz: założone konta, klucze, domeny,
   udostępnienia. Konkretnie, w kolejności, z linkami.

## Jak chcę, żebyś pracował w kolejnych sesjach

- **Fazami.** Każda faza kończy się działającym wdrożeniem na Vercelu i przechodzącymi
  testami z rozdz. 18 spec-u, nie samym kodem. Gałąź na fazę, merge do `main` po testach.
- **Testy piszesz razem z kodem**, nie po. Kryteria odbioru z rozdz. 18 to gotowa lista
  testów E2E — traktuj ją jak zamówienie.
- **Bezpieczeństwo nie jest fazą 6.** Izolacja klientów, signed URL-e i hashowanie PIN-ów
  wchodzą razem z pierwszym kodem, który ich dotyczy. Rozdz. 16 spec-u to wymogi twarde.
- **Nie generuj sam żadnych tokenów ani PIN-ów.** Zawsze `crypto.randomBytes`.
- Gdy natrafisz na decyzję, której nie ma w spec-u, a która wpłynie na model danych albo na
  to, co widzi klient — **zatrzymaj się i zapytaj**. W drobiazgach decyduj sam i idź dalej.
- Gdy skończysz fazę, dopisz do `docs/POSTEP.md`: co działa, co zostało odłożone, co
  wymaga mojej decyzji.
- Mów do mnie po polsku, konkretnie, bez lania wody. Gdy coś jest złym pomysłem, powiedz to.

## Rzeczy, o których łatwo zapomnieć, a mają znaczenie

- **Podglądy 1:1 to nie ozdoba.** Klient ma zobaczyć post dokładnie tak, jak wyjdzie na jego
  stronie na Facebooku — nazwa strony, tekst nad grafiką urwany po trzech linijkach
  z „Zobacz więcej", pasek Lubię to / Komentarz / Udostępnij. To jest powód, dla którego
  w ogóle porzuca Dysk. Content podglądamy wyłącznie na Facebooku (post, relacja, Reels),
  reklamy w sześciu placementach — czterech na Facebooku i dwóch na Instagramie. Rozdz. 7.
- **Logo ani kolorów klienta nie ma nigdzie w interfejsie panelu.** Jedyny wyjątek to
  zdjęcie profilowe strony wewnątrz ramki podglądu — bez niego symulacja przestaje działać.
- **Ekran reklamy ma pokazać każdą kombinację.** Do 6 grafik × 3 teksty × 3 nagłówki.
  Klient przełącza listami i widzi wynik natychmiast.
- **Kampanii w jednym miesiącu bywa kilka** — standardowa plus na przykład na imprezy
  okolicznościowe albo na polubienia strony. Model danych ma to zakładać od początku
  (tabela `campaigns`), a nie traktować jako wyjątek.
- **Materiały wchodzą wyłącznie z wklejonego linku do folderu na Dysku.** Panel nie zgaduje
  ścieżek. To zabezpieczenie przed zaimportowaniem materiałów z innego miesiąca — rozdz. 13.2
  opisuje kartę weryfikacyjną i ostrzeżenia.
- **Auto-akceptacja po 72 godzinach** jest najważniejszą pojedynczą funkcją całego
  panelu, ale musi być uczciwa: widoczny licznik od pierwszego ekranu, ostrzeżenie na 24 h
  przed, zatrzymanie przy zgłoszeniu uwag, możliwość wyłączenia przez opiekuna.
- **Trzy kategorie klientów** (rozdz. 3.1) to nie szczegół — od nich zależy, czy pakiet jest
  jeden na klienta, czy jeden na lokal. Wbuduj to w model danych od początku, bo doklejenie
  tego później oznacza migrację wszystkich pakietów.
- **Mobile first.** Projektuj od 390 px w górę, nie odwrotnie.

Zacznij od przeczytania obu plików i przedstaw plan. Zadaj mi pytania, jeśli coś w spec-u
jest niejasne — wolę odpowiedzieć teraz niż poprawiać model danych w fazie 4.
