# Postęp: kryteria odbioru z SPEC rozdz. 18

Zaznaczamy kryterium, gdy przechodzi jako test E2E (CLAUDE.md, „Jak pracujemy").

| # | Kryterium | Faza | Status |
|---|---|---|---|
| 1 | Zły token daje ten sam ekran co zły PIN | 1 | ☐ |
| 2 | 5 złych PIN-ów blokuje na 15 min, 6. próba z dobrym PIN-em też odrzucona | 1 | ☐ |
| 3 | Sesja żyje po odświeżeniu i po 24 h | 1 | ☐ |
| 4 | Klient A nie otwiera zasobów klienta B (404), także plik | 1 | ☐ |
| 5 | Wygaszenie linku wylogowuje sesję przy następnym żądaniu | 1 | ☐ |
| 6 | Reset PIN-u wylogowuje wszystkie urządzenia linku | 1 | ☐ |
| 7 | Pakiet 6 postów + 10 relacji + 2 kampanie renderuje się na 390 px i 1440 px | 2 | ☐ |
| 8 | „Akceptuję wszystko" ustawia status, datę, osobę i zdarzenie w outbox | 2 | ☐ |
| 9 | „Zgłaszam uwagi" bez komentarza zablokowane z podpowiedzią | 2 | ☐ |
| 10 | Zgłoszenie uwag zatrzymuje licznik auto-akceptacji | 2 | ☐ |
| 11 | Cron auto-akceptacji po 72 h; pomija wyłączone i w poprawkach; dni robocze po przełączeniu | 2 | ☐ |
| 12 | Wysłanie v2 podbija rundę, restartuje licznik, plakietki „Poprawione" | 2 | ☐ |
| 13 | Komentarz po akceptacji nie zmienia statusu, ale wysyła zdarzenie | 2 | ☐ |
| 14 | 54 kombinacje wariantów w 6 placementach; brak ig_handle wyszarza IG | 2 | ☐ |
| 15 | Komentarz przypięty do wariantu wraca w panelu zespołu | 2 | ☐ |
| 16 | Dwie kampanie w miesiącu jako osobne sekcje, akceptowane razem | 2 | ☐ |
| 17 | Folder spoza „Materiałów klientów" blokuje import | 4 | ☐ |
| 18 | Folder użyty w innym pakiecie pokazuje ostrzeżenie z linkiem | 4 | ☐ |
| 19 | Podmiana w pakiecie zaakceptowanym: potwierdzenie, zdarzenie, plakietka, baner | 3 | ☐ |
| 20 | Stary plik po podmianie istnieje z superseded_at | 3 | ☐ |
| 21 | Wysyłka z postem bez daty zablokowana z listą braków | 3 | ☐ |
| 22 | Klient nie przesuwa materiału w kalendarzu | 3 | ☐ |
| 23 | content_creator dostaje 404 na trasie faktur | 3 | ☐ |
| 24 | csm widzi tylko przypisanych klientów | 3 | ☐ |
| 25 | Impersonacja blokuje decyzje i zapisuje wejście do audit_log | 3 | ☐ |
| 26 | Zrzuty podglądów zgodne ze wzorcami w obu szerokościach | 2 | ☐ |

## Faza 0: Fundament

W toku (2026-09-02).

**Co działa:**
- (uzupełniane na bieżąco)

**Odłożone:**
- Pełne CSP z nonce: faza 6 (SPEC rozdz. 16.6); w fazie 0 są HSTS, nosniff, Referrer-Policy, X-Frame-Options, X-Robots-Tag.
- Placeholdery wideo w seedzie (relacje wideo, Reels): faza 2, razem z podglądami.

**Wymaga decyzji Szymona:**
- Treść regulaminu (w tym sekcja o automatycznej akceptacji) i polityki prywatności: strony istnieją jako szkielet.
