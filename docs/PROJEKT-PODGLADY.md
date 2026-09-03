# Projekt komponentów podglądów 1:1 (faza 2, przed napisaniem kodu)

Odpowiedź na prośbę z `docs/PROMPT-FAZA-2.md`, rozdz. 3: jakie pliki, co jest wspólne między
placementami, gdzie siedzi przełącznik wariantów, jak wchodzi przełącznik lokalu (SPEC 1.4, poz. 15).
Źródło wymagań: SPEC rozdz. 3.1, 6.2, 6.7, 7, 18 (kryteria 7, 14, 15, 16, 26).

## 1. Zasady, które wynikają z SPEC i CLAUDE.md

1. **Jeden komplet komponentów.** `components/podglad/` nie wie, czy renderuje go panel klienta,
   czy podgląd zespołu. Dostaje gotowe DTO i adresy plików; nie czyta bazy, nie zna sesji, nie importuje
   `server-only`. Różnice między kontekstami (adres pliku, tekst podpowiedzi o braku nicka IG,
   czy komentowanie jest włączone) wchodzą propsami.
2. **Zero danych surowych.** Strony budują `MaterialDto` z `lib/dto/materialy.ts` (nowy plik).
   `internal_note`, `created_by`, `storage_path` nigdy nie trafiają do komponentu.
3. **Pliki tylko przez trasę z `assertClientAccess()`.** DTO niesie już gotowe adresy
   (`/p/[token]/plik/[assetId]/preview` u klienta, `/zespol/plik/[assetId]/preview` u zespołu,
   nowa trasa z `assertTeamClientAccess`). Komponent renderuje zwykły `<img>` / `<video>` z wymiarami
   (decyzja D3 z planu: bez `next/image` dla materiałów).
4. **Awatar w ramce = zdjęcie profilowe strony** (`locations.avatar_path` przez bucket `awatary`,
   ta sama trasa plików z wariantem `awatar`), a gdy go brak: neutralne kółko z pierwszą literą
   `fb_page_name`. Poza ramką logo klienta nie występuje.
5. **Mobile first**: ramka telefonu ma szerokość 100 % do 390 px, na desktopie stałe 375 px
   (FB kanał na komputerze: 500 px). Wszystkie ramki to CSS, bez grafik i logotypów Meta.
6. **Teksty ramek** („Sponsorowane", „Zobacz więcej", „Lubię to!", „Odpowiedz", lista CTA) w `copy.podglad`.

## 2. Pliki

```
src/lib/dto/materialy.ts          # DTO: PakietSzczegoly, MaterialDto, PlikDto, KampaniaDto, WariantDto, LokalDto, KomentarzDto
src/lib/reklamy/warianty.ts       # czysta logika: opcje list i złożenie wariantu dla wybranego lokalu (testy jednostkowe)
src/lib/dane/materialy-klienta.ts # zapytania + mapowanie na DTO (jedno dla klienta i zespołu, różni się budowaniem adresów)

src/components/podglad/
  typy.ts                 # StronaDto (nazwa, avatarUrl, igHandle), proporcje, typ Placement
  awatar-strony.tsx       # zdjęcie profilowe albo kółko z literą; jedyne miejsce, gdzie awatar wchodzi do ramki
  ikony-meta.tsx          # neutralne ikony SVG: kciuk, dymek, strzałka, kropki, kula ziemska, serce, samolocik, zakładka, nuta
  tekst-skracany.tsx      # „use client": skracanie po ~3 linijkach z „Zobacz więcej", hashtagi i linki w kolorze odnośnika
  media.tsx               # <img>/<video muted playsinline> w zadanej proporcji; wideo domyślnie wyciszone z kontrolką
  karuzela.tsx            # „use client": slajdy, strzałki, kropki (post z kilkoma grafikami)
  ramka-9-16.tsx          # wspólna ramka pionowa: tło z rozmytej kopii grafiki, grafika 1:1/4:5 wyśrodkowana, warstwy góra/dół
  przelacznik-lokalu.tsx  # „use client": lista „Wszystkie lokale (wersja wspólna)" + po jednej pozycji na lokal
  post-fb.tsx             # 7.1: nagłówek strony, tekst nad grafiką, grafika (1:1 / 4:5 / 1.91:1), reakcje, Lubię to! Komentarz Udostępnij
  relacja-fb.tsx          # 7.2: seria relacji 9:16, pasek segmentów, awatar + „2 godz.", „Odpowiedz", nawigacja („use client")
  reels-fb.tsx            # 7.3: 9:16, opis na dole po lewej, kolumna ikon po prawej, pasek audio
  reklama/
    placementy.ts         # 6 placementów: id, etykieta, grupa (facebook | instagram), czy wymaga ig_handle, szerokość ramki
    element-reklamy.tsx   # wspólny „element reklamowy": nagłówek strony + Sponsorowane, tekst główny, media, pasek z domeną/nagłówkiem/opisem/CTA
    fb-kanal.tsx          # kanał na telefonie i na komputerze (prop uklad: telefon | komputer, inna szerokość i układ paska CTA)
    fb-relacja.tsx        # relacje FB: ramka-9-16 + CTA na dole
    fb-reels.tsx          # Reels FB: ramka-9-16 + opis i CTA jak w Reels
    ig-kanal.tsx          # kanał IG: nick, Sponsorowane, grafika, przycisk CTA nad opisem, tekst pod grafiką
    ig-relacja.tsx        # relacje i Reels IG: jedna ramka 9:16 z interfejsem IG
    wybor-wariantow.tsx   # „use client": trzy listy (Grafika / Tekst / Nagłówek) + czwarta Lokal; stan wyboru w jednym miejscu
    przelacznik-placementu.tsx  # dwie grupy przycisków; placementy IG bez ig_handle wyszarzone z podpowiedzią (nie znikają)
    wszystkie-warianty.tsx      # siatka miniatur wszystkich grafik + listy tekstów i nagłówków; przy wariantach z location_id nazwa lokalu
    podglad-reklamy.tsx   # „use client": orkiestrator ekranu reklamy; jedyne miejsce, które składa wariant i wybiera ramkę
```

Strony, które tego używają (faza 2):
- `src/app/p/[token]/(panel)/materialy/[pakietId]/page.tsx` (klient) i nowa
  `src/app/zespol/(panel)/klienci/[slug]/pakiety/[pakietId]/page.tsx` (zespół) renderują **ten sam**
  `components/pakiet/ekran-pakietu.tsx`, który układa zakładki, sekcje kampanii i wątki komentarzy.
  Różnią się tylko `tryb: "klient" | "zespol"` (pasek decyzji vs przyciski zespołu) i adresami plików.

## 3. Co jest wspólne, a co różne między placementami

| Element | Skąd | Gdzie użyty |
|---|---|---|
| Awatar strony i nazwa / nick | `awatar-strony.tsx` + `StronaDto` | wszystkie 9 ramek (3 content + 6 reklam) |
| Tekst z „Zobacz więcej" | `tekst-skracany.tsx` | post FB, reklama FB kanał (telefon, komputer), IG kanał |
| Media w proporcji | `media.tsx` | wszystkie |
| Ramka 9:16 z rozmytym tłem | `ramka-9-16.tsx` | relacja FB, Reels FB, reklama FB relacje, FB Reels, IG relacje i Reels |
| Element reklamowy (Sponsorowane + pasek CTA) | `element-reklamy.tsx` | FB kanał telefon, FB kanał komputer; ramki 9:16 biorą z niego tylko CTA i nagłówek |
| Lista CTA | `copy.podglad.cta` (zamknięta) | pasek CTA we wszystkich reklamach |
| Przełącznik lokalu | `przelacznik-lokalu.tsx` | reklama (kat2/kat3) **i post w kat3** (przełącznik profilu z 7.1) |

Różnice zamykają się w sześciu małych plikach `reklama/*.tsx`: układ nagłówka, miejsce CTA, kolor tła,
kolumna ikon. Każdy dostaje ten sam `ZlozonyWariant` (patrz niżej) i `StronaDto`.

## 4. Gdzie siedzi przełącznik wariantów i jak wchodzi lokal

Stan ekranu reklamy żyje w jednym komponencie klienckim `podglad-reklamy.tsx`:

```
{ placement, grafikaId, tekstId, naglowekId, lokalId | null }
```

Zmiana dowolnej listy zmienia stan i przerysowuje ramkę (React, bez przeładowania; kryterium 14).
Logika wyboru jest czysta i testowana jednostkowo w `lib/reklamy/warianty.ts`:

```ts
opcjeWariantow(warianty, lokalId): { grafiki, teksty, naglowki }   // listy do rozwijanych
zlozWariant(warianty, wybor): ZlozonyWariant                        // { grafika, tekst, naglowek, opis, cta, link, zrodla }
```

Reguła z SPEC 7.4: dla wybranego lokalu każdy rodzaj (grafika, tekst, nagłówek, opis, CTA, link) bierze
warianty z `location_id = lokal`, a **gdy dla danego rodzaju ich nie ma**, warianty wspólne
(`location_id = null`). Pozycja „Wszystkie lokale (wersja wspólna)" pokazuje wyłącznie warianty wspólne.
Przy zmianie lokalu wybór (np. tekst B) zostaje, jeśli istnieje w nowych opcjach, inaczej wraca do pierwszej.
`zrodla` mówi, który element pochodzi z wersji lokalu, a który ze wspólnej: podpis pod ramką
„Link i przycisk: wersja dla Burger Brothers Widzew; grafika, tekst, nagłówek: wspólne".
To jest odpowiedź na „klient musi widzieć, która wersja idzie na który lokal".

Przełącznik lokalu jest widoczny **zawsze, gdy materiał ma więcej niż jeden lokal** (`location_ids`),
także gdy nie ma jeszcze wariantów per lokal (wtedy zmienia tylko nazwę strony w kat3). Wybór lokalu
zmienia też `StronaDto` (nazwa strony, nick IG, awatar tego lokalu), więc kat3 widzi swoją stronę.
Domyślnie wybrany jest pierwszy lokal, nie „wersja wspólna": klient ma zobaczyć realną wersję.

W widoku „Zobacz wszystkie warianty" każdy wariant z `location_id` ma plakietkę z `locations.name`,
wspólne mają podpis „wszystkie lokale" (SPEC 7.4).

## 5. Komentarz przypięty do wariantu (kryterium 15)

Pod ramką reklamy formularz uwagi ma wybór „Do czego": *cała reklama* / *ta grafika* / *ten tekst* /
*ten nagłówek*, gdzie trzy ostatnie biorą id z bieżącego stanu. Zapis: `comments.item_id` + `comments.variant_id`.
Lista wątków pod reklamą grupuje po wariancie z etykietą („Grafika 3", „Tekst B", z nazwą lokalu, gdy wariant
jest per lokal). W panelu zespołu ten sam wątek pojawia się w „Zobacz wszystkie warianty" przy tym wariancie.

## 6. Placementy instagramowe bez nicka

`przelacznik-placementu.tsx` dostaje `igHandle: string | null`. Bez nicka dwa przyciski IG są wyszarzone
(`aria-disabled`), a pod nimi stoi podpowiedź z propsa: u zespołu „uzupełnij nick na Instagramie w karcie
klienta" (SPEC), u klienta „podgląd na Instagramie pojawi się, gdy Twój opiekun uzupełni nick". Nigdy nie znikają.

## 7. Testy

- Jednostkowe: `warianty.ts` (opcje i złożenie dla lokalu, brak wariantu per lokal, 54 kombinacje),
  `placementy.ts` (dokładnie sześć, dwa wymagają nicka).
- E2E kryterium 14: w każdym z sześciu placementów pętla po 6 × 3 × 3 sprawdza, że ramka pokazuje wybraną
  grafikę, tekst i nagłówek bez nawigacji; brak `ig_handle` (Ramen Ichi, Pierogarnia Kraków w seedzie) wyszarza IG.
- E2E kryterium 26: zrzuty każdej z 9 ramek na 390 px i 1440 px, wzorce w `tests/e2e/podglady.spec.ts-snapshots/`.
  Skrypt `pnpm test:e2e -- podglady` z CLAUDE.md.

## 8. Do potwierdzenia przez Szymona

1. **Domyślny lokal w reklamie kat2/kat3**: pierwszy lokal (propozycja) czy „wersja wspólna"?
2. **Wideo w seedzie**: bez `ffmpeg` na tej maszynie nie wygeneruję placeholdera mp4. Komponenty obsłużą
   `kind = 'video'` (odtwarzacz wyciszony, plakat z miniatury), a pierwsze prawdziwe wideo przyjdzie
   z materiałami jednego realnego miesiąca (plan sesji startowej, pkt 11). Zgoda?
3. **Przełącznik proporcji posta (1:1 / 4:5 / 1.91:1)**: proponuję, żeby domyślna proporcja wynikała
   z wymiarów pliku, a przełącznik pokazywał, jak Facebook przytnie grafikę w pozostałych. Zgoda?
