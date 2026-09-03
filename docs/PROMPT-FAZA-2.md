# Prompt startowy fazy 2 — akceptacja materiałów

Wklej w **nowej sesji** Claude Code, na folderze `panel-foodie`:

> Przeczytaj docs/PROMPT-FAZA-2.md i zrób to, o co tam proszę.

---

Zaczynamy fazę 2 — najważniejszą część całego panelu. To jest nowa sesja, więc najpierw
się zorientuj, potem poprawiaj, dopiero na końcu buduj.

## 1. Zorientuj się

Przeczytaj w tej kolejności:

- `CLAUDE.md` — zasady pracy w tym repo
- `docs/POSTEP.md` — gdzie jesteśmy
- `docs/SPEC.md`, rozdziały **3** (model danych), **6** (mechanika akceptacji),
  **7** (podglądy), **12.6** (dodawanie i podmiana materiałów), **18** (kryteria odbioru)
- `docs/PROMPTY-FAZ.md`, sekcja **Faza 2**

Potem powiedz mi w kilku zdaniach, co zastałeś: na jakiej gałęzi jesteśmy, czy faza 1 jest
zmergowana do `main`, czy testy 1–6 przechodzą i czy jest cokolwiek niedokończonego.
**Jeśli faza 1 nie jest domknięta — zatrzymaj się i powiedz, czego brakuje.** Nie zaczynaj
fazy 2 na niesprawdzonym logowaniu.

## 2. Sześć poprawek przed fazą 2

Przejrzeliśmy pozycje 15–34 z rozdziału 20 SPEC. Większość zostaje. Sześć wymaga zmiany —
wprowadź je i zaktualizuj SPEC, zanim ruszysz z resztą.

**Dwie z nich dotyczą fazy 1, zrób je pierwsze:**

1. **Poz. 30 — dni robocze to poniedziałek–SOBOTA, nie poniedziałek–piątek.**
   Agencja pracuje od poniedziałku do soboty (tak jest w naszym Procesie Obsługi Klienta,
   tak chodzi zadanie generujące raporty), restauracje też. Popraw w SPEC i w kodzie
   liczącym `auto_approve_at`. Dotyczy trybu `auto_approve_business_days`; domyślne 72 h
   kalendarzowe zostają bez zmian.

2. **Poz. 16 — `token_enc` zostaje, ale z zabezpieczeniami.**
   Odszyfrowanie tokenu dostępne wyłącznie dla ról `admin` i `csm`. Każde odszyfrowanie
   zapisywane w `audit_log` jako osobna akcja. Token nigdy nie pojawia się w widoku listy
   linków — tylko po świadomym kliknięciu „Pokaż link". Dopisz to do SPEC rozdz. 16 jako
   wymóg twardy i dodaj test.

**Cztery pozostałe wchodzą w zakres fazy 2:**

3. **Poz. 26 — wstrzymana auto-akceptacja musi być widoczna, nie tylko wysłana.**
   Samo zdarzenie `auto_wstrzymana_uwagi` na Slacku utonie. Pakiet z wstrzymaną
   auto-akceptacją ma się pokazywać na pulpicie zespołu jako **osobny, wyróżniony stan**
   z liczbą nieprzeczytanych uwag i akcją obok — widoczny bez wchodzenia w pakiet.
   To jest dokładnie ta ścieżka, którą pakiet może zawisnąć na tydzień, a cały panel
   powstaje po to, żeby pakiety nie wisiały.

4. **Poz. 15 — przełącznik lokalu w podglądzie reklamy.**
   Model z wariantami per lokal (`ad_variants.location_id`) jest dobry, ale klient z pięcioma
   lokalami musi widzieć, **która wersja idzie na który lokal**. W podglądzie reklamy dla
   kat2 i kat3 dodaj przełącznik lokalu. W widoku „Zobacz wszystkie warianty" przy wariantach
   z `location_id` pokaż nazwę lokalu. Uwzględnij to w projekcie komponentów, zanim je napiszesz.

5. **Poz. 21 — klient demonstracyjny także na produkcji.**
   Musi powstać poza seedem bazy testowej i mieć flagę, która uniemożliwia wystawienie mu
   linku dostępowego i faktury.

6. **Poz. 31 — cofnięcie po akceptacji musi dotrzeć do klienta.**
   Przejścia `zaakceptowany → poprawki` i `zaplanowany → poprawki` mają powiadamiać klienta:
   baner w panelu i zdarzenie do `outbox`. Klient widział zielony baner „zaakceptowano",
   więc musi się dowiedzieć, że cofnęliśmy.

Pozycje 19, 25 i 32 zostaw dokładnie tak, jak są. Wyprzedzenie o 24 godziny przy zmianie
materiałów i zdarzenie `nieotwarty_po_24h` realnie pracują na problem, dla którego budujemy
ten panel.

## 3. Faza 2 — kolejność pracy

Gałąź `faza/2-serce`. Kolejność z `docs/PROMPTY-FAZ.md`:

1. **Maszyna stanów** w `lib/pakiety/przejscia.ts` — jedno miejsce, które zmienia status,
   zapisuje `package_events` i wrzuca zdarzenie do `outbox`. Testy jednostkowe na wszystkie
   przejścia z rozdz. 6.8, w tym te niedozwolone.
2. **Podglądy 1:1** w `components/podglad/` — content wyłącznie na Facebooku (post, relacja
   9:16, Reels), reklama w sześciu placementach: FB kanał na telefonie, FB kanał na
   komputerze, FB relacje, FB Reels, IG kanał, IG relacje i Reels.
3. **Ekran pakietu dla klienta** — zakładki Posty / Relacje / Kampanie / Wszystko, pasek
   decyzji, licznik auto-akceptacji.
4. **Akceptacja i zgłaszanie uwag** (rozdz. 6.3), komentarze (rozdz. 6.7).
5. **Rundy poprawek** — `round`, plakietki „Poprawione" i „Nowe", historia uwag.
6. **Cron auto-akceptacji** — 72 godziny kalendarzowe domyślnie, przełącznik na dni robocze
   (pon.–sob.) w ustawieniach. Obie ścieżki zbudowane, domyślna kalendarzowa.

**Zanim napiszesz pierwszą linię kodu podglądów, pokaż mi projekt komponentów:** jakie pliki,
co jest wspólne między placementami, gdzie siedzi przełącznik wariantów, jak wchodzi
przełącznik lokalu z punktu 4 powyżej. Tego fragmentu nie da się tanio przepisać.

## 4. Czego pilnujemy w tej fazie

**Jeden komplet komponentów podglądu, nie dwa.** Ten sam kod renderuje materiał w panelu
klienta i w podglądzie zespołu. Dwie wersje rozjadą się w trzecim tygodniu.

**Awatar w ramce podglądu to zdjęcie profilowe strony klienta** (`locations.avatar_path`),
a gdy go brak — neutralne kółko z pierwszą literą. Poza ramką podglądu logo klienta nie
pojawia się nigdzie w panelu.

**Ekran reklamy jest najtrudniejszy.** Sześć placementów, do 6 grafik × 3 teksty × 3 nagłówki,
przerysowanie bez przeładowania, komentarz przypinany do konkretnego wariantu. Zrób go
ostatni, ale nie po łebkach — po tym ekranie klient pozna, że to jest lepsze od linku do Dysku.

**Mobile first.** Klient otwiera panel z WhatsAppa, na telefonie. Projektuj od 390 px w górę.

**Testy piszesz razem z kodem.** Kryteria 7–16 i 26 z rozdz. 18 to gotowa lista zamówienia.

## 5. Na koniec

Zaktualizuj `docs/POSTEP.md`: co działa, co odłożone, co wymaga mojej decyzji. Zmerguj do
`main` dopiero, gdy testy przechodzą.

Gdy natrafisz na decyzję, której nie ma w SPEC, a która wpłynie na model danych albo na to,
co widzi klient — zatrzymaj się i zapytaj. W drobiazgach decyduj sam i idź dalej.
