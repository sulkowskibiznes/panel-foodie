/**
 * Dane seedu: 3 klientów (po jednym z każdej kategorii) + klient demonstracyjny dla roli sales,
 * zespół, usługi. Żadnych tokenów ani PIN-ów: te generuje seed.ts przez crypto.randomBytes.
 */
export const ROK: number = 2026;
export const MIESIAC: number = 9;

export const ZESPOL = [
  { name: "Szymon", email: "kontakt@foodiemedia.pl", role: "admin" },
  { name: "Gosia", email: "gosia@foodiemedia.pl", role: "csm" },
  { name: "Stanisław", email: "stan.morawski88@gmail.com", role: "media_buyer" },
  { name: "Ania", email: "annaocicka@o2.pl", role: "content_creator" },
  { name: "Michał", email: "michalbigos15@gmail.com", role: "content_creator" },
] as const;

export type RolaZespolu = (typeof ZESPOL)[number]["role"];

export const USLUGI = [
  { slug: "sesja-zdjeciowa", name: "Sesja zdjęciowa", short_desc: "Profesjonalne zdjęcia dań i wnętrza do postów, reklam i menu.", icon: "camera", position: 1 },
  { slug: "foodieqr", name: "FoodieQR", short_desc: "Kod QR na stolikach, który zbiera opinie w Google i obserwujących na Instagramie.", icon: "qr-code", position: 2 },
  { slug: "strona-www", name: "Strona WWW i branding", short_desc: "Strona restauracji z menu i rezerwacjami oraz spójna identyfikacja wizualna.", icon: "globe", position: 3 },
  { slug: "restaumatic", name: "Restaumatic", short_desc: "Zamówienia online bez prowizji i system POS w jednym.", icon: "shopping-bag", position: 4 },
  { slug: "google-ads", name: "Google Ads", short_desc: "Reklamy w wyszukiwarce i na mapach dla osób, które szukają miejsca na obiad w Twojej okolicy.", icon: "search", position: 5 },
  { slug: "sms-email", name: "SMS i e-mail marketing", short_desc: "Wiadomości do stałych gości o nowościach, promocjach i wydarzeniach.", icon: "mail", position: 6 },
  { slug: "dodatkowe-lokale", name: "Dodatkowe lokale", short_desc: "Rozszerzenie współpracy na kolejne lokale w tej samej cenie za lokal.", icon: "map-pin", position: 7 },
] as const;

export type Lokal = {
  name: string;
  city: string;
  address: string;
  fb_page_name: string;
  ig_handle: string | null;
  separate_materials: boolean;
};

export type Kontakt = { name: string; role_label: string; phone: string; email: string; is_primary: boolean };

export type Kampania = {
  name: string;
  goal: "sprzedaz" | "ruch" | "polubienia" | "leady" | "zasieg" | "inne";
  note: string;
  teksty: string[];
  naglowki: string[];
  opis: string;
  cta: string;
  link: string;
  /** kat2/kat3: link per lokal (indeks lokalu → link) */
  linkiPerLokal?: string[];
};

export type PakietSeed = {
  /** indeks lokalu dla kat1; null = wspólny */
  lokal: number | null;
  status: "szkic" | "do_akceptacji" | "poprawki" | "zaakceptowany" | "zaplanowany";
  /** godziny temu, gdy pakiet wysłano do akceptacji */
  wyslanoGodzinTemu?: number;
  kolor: string;
  posty: Array<{ title: string; caption: string; dzien: number; godzina: number; slajdy?: number; proporcja?: "1:1" | "4:5" }>;
  relacje: Array<{ title: string; dzien: number; godzina: number }>;
  kampanie: Kampania[];
};

export type KlientSeed = {
  slug: string;
  name: string;
  category: "kat1" | "kat2" | "kat3";
  tier: "foodie_one" | "foodie_360" | "siec";
  monthly_amount_net: number;
  slack_channel: string;
  cooperation_started_on: string;
  lokale: Lokal[];
  kontakty: Kontakt[];
  pakiety: PakietSeed[];
  /** e-maile członków zespołu przypisanych poza opiekunem */
  przypisani: string[];
  faktury: Array<{ number: string; issue_date: string; due_date: string; amount_net: number; status: "do_zaplaty" | "oplacona"; paid_at?: string }>;
};

const RELACJE_10 = (prefix: string): PakietSeed["relacje"] =>
  Array.from({ length: 10 }, (_, i) => ({
    title: `${prefix} - relacja ${i + 1}`,
    dzien: 2 + i * 3,
    godzina: i % 2 === 0 ? 12 : 18,
  }));

const KAMPANIA_STANDARD = (lokal: string, link: string): Kampania => ({
  name: "Kampania standardowa",
  goal: "sprzedaz",
  note: `Chcemy dowozić rezerwacje i zamówienia do ${lokal} od osób w promieniu 5 km.`,
  teksty: [
    "Świeże składniki, sprawdzone przepisy i kuchnia, która pachnie już od progu. Sprawdź, co dziś przygotowaliśmy.",
    "Masz ochotę na coś dobrego bez gotowania? Zamów online albo wpadnij do nas. Czekamy z gorącym talerzem.",
    "Rodzinny obiad, spotkanie ze znajomymi albo szybki lunch w tygodniu. U nas każda okazja smakuje tak samo dobrze.",
  ],
  naglowki: ["Zarezerwuj stolik na dziś", "Zamów online w 3 minuty", "Nowe menu na jesień"],
  opis: "Rezerwacja i zamówienia online",
  cta: "Zarezerwuj",
  link,
});

export const KLIENCI: KlientSeed[] = [
  {
    slug: "grupa-smakosz",
    name: "Grupa Smakosz",
    category: "kat1",
    tier: "foodie_360",
    monthly_amount_net: 3800,
    slack_channel: "#grupa-smakosz",
    cooperation_started_on: "2026-04-01",
    lokale: [
      { name: "Trattoria Bella", city: "Łódź", address: "ul. Piotrkowska 120", fb_page_name: "Trattoria Bella Łódź", ig_handle: "trattoriabella.lodz", separate_materials: true },
      { name: "Ramen Ichi", city: "Łódź", address: "ul. Nawrot 8", fb_page_name: "Ramen Ichi", ig_handle: null, separate_materials: true },
    ],
    kontakty: [
      { name: "Marek Kowalczyk", role_label: "właściciel", phone: "+48 600 100 200", email: "marek@grupasmakosz.pl", is_primary: true },
      { name: "Ola Nowak", role_label: "manager", phone: "+48 600 100 201", email: "ola@grupasmakosz.pl", is_primary: false },
    ],
    przypisani: ["annaocicka@o2.pl", "stan.morawski88@gmail.com"],
    pakiety: [
      {
        lokal: 0,
        status: "szkic",
        kolor: "#7600F4",
        posty: [
          { title: "Post 1 - nowa pizza", caption: "Nowość w karcie: pizza z burratą, prosciutto i figami. Ciasto dojrzewa 48 godzin, a piec rozgrzewamy do 450 stopni. Przyjdź, zanim skończy się sezon na figi.\n\n#trattoriabella #pizza #lodz", dzien: 3, godzina: 18, slajdy: 3 },
          { title: "Post 2 - lunch", caption: "Lunch od poniedziałku do piątku w godzinach 12:00-15:00: zupa i danie główne za 39 zł. Menu zmieniamy codziennie.", dzien: 6, godzina: 12 },
          { title: "Post 3 - tiramisu", caption: "Tiramisu robimy od 2019 roku według przepisu babci Giulii. Bez zmian, bo nie ma czego poprawiać.", dzien: 10, godzina: 18, proporcja: "4:5" },
          { title: "Post 4 - kuchnia", caption: "Za kulisami: tak wygląda nasza kuchnia o 10 rano, godzinę przed otwarciem.", dzien: 14, godzina: 12, slajdy: 2 },
          { title: "Post 5 - wino", caption: "Do jesiennej karty dobraliśmy pięć nowych win z Toskanii. Kelner podpowie, które pasuje do Twojego dania.", dzien: 20, godzina: 18 },
          { title: "Post 6 - rezerwacje", caption: "Weekendy są pełne, więc zarezerwuj stolik z wyprzedzeniem. Link w bio albo telefon.", dzien: 26, godzina: 12 },
        ],
        relacje: RELACJE_10("Trattoria Bella"),
        kampanie: [KAMPANIA_STANDARD("Trattorii Bella", "https://trattoriabella.pl/rezerwacja")],
      },
      {
        lokal: 1,
        status: "zaakceptowany",
        wyslanoGodzinTemu: 120,
        kolor: "#B42318",
        posty: [
          { title: "Post 1 - tonkotsu", caption: "Bulion tonkotsu gotujemy 18 godzin. Dlatego jest taki gęsty. Dlatego wracacie.", dzien: 4, godzina: 18 },
          { title: "Post 2 - gyoza", caption: "Gyoza z wieprzowiną i kapustą, lepione rano, smażone na zamówienie. Sześć sztuk za 24 zł.", dzien: 8, godzina: 12, slajdy: 2 },
          { title: "Post 3 - miso", caption: "Ramen miso z kukurydzą i masłem: wersja z Sapporo, którą lubimy najbardziej.", dzien: 12, godzina: 18, proporcja: "4:5" },
          { title: "Post 4 - wege", caption: "Ramen wegański na bulionie z grzybów shiitake i kombu. Tak, jest równie sycący.", dzien: 16, godzina: 12 },
          { title: "Post 5 - godziny", caption: "Od października otwieramy też w poniedziałki. Wasze prośby zadziałały.", dzien: 22, godzina: 18 },
          { title: "Post 6 - ekipa", caption: "Poznajcie Kenjiego, który od trzech lat odpowiada za każdy bulion w Ramen Ichi.", dzien: 28, godzina: 12 },
        ],
        relacje: RELACJE_10("Ramen Ichi"),
        kampanie: [KAMPANIA_STANDARD("Ramen Ichi", "https://ramenichi.pl/zamow")],
      },
    ],
    faktury: [
      { number: "FV/2026/08/031", issue_date: "2026-08-01", due_date: "2026-08-15", amount_net: 3800, status: "oplacona", paid_at: "2026-08-12" },
      { number: "FV/2026/09/031", issue_date: "2026-09-01", due_date: "2026-09-15", amount_net: 3800, status: "do_zaplaty" },
    ],
  },
  {
    slug: "burger-brothers",
    name: "Burger Brothers",
    category: "kat2",
    tier: "siec",
    monthly_amount_net: 5200,
    slack_channel: "#burger-brothers",
    cooperation_started_on: "2025-11-01",
    lokale: [
      { name: "Burger Brothers Manufaktura", city: "Łódź", address: "ul. Drewnowska 58", fb_page_name: "Burger Brothers", ig_handle: "burgerbrothers.pl", separate_materials: false },
      { name: "Burger Brothers Piotrkowska", city: "Łódź", address: "ul. Piotrkowska 89", fb_page_name: "Burger Brothers", ig_handle: "burgerbrothers.pl", separate_materials: false },
      { name: "Burger Brothers Widzew", city: "Łódź", address: "al. Piłsudskiego 94", fb_page_name: "Burger Brothers", ig_handle: "burgerbrothers.pl", separate_materials: false },
      { name: "Burger Brothers Pabianice", city: "Pabianice", address: "ul. Zamkowa 3", fb_page_name: "Burger Brothers", ig_handle: "burgerbrothers.pl", separate_materials: false },
      { name: "Burger Brothers Zgierz", city: "Zgierz", address: "pl. Kilińskiego 12", fb_page_name: "Burger Brothers", ig_handle: "burgerbrothers.pl", separate_materials: false },
    ],
    kontakty: [
      { name: "Tomasz Wiśniewski", role_label: "właściciel", phone: "+48 601 200 300", email: "tomasz@burgerbrothers.pl", is_primary: true },
    ],
    przypisani: ["michalbigos15@gmail.com", "stan.morawski88@gmail.com"],
    pakiety: [
      {
        lokal: null,
        status: "do_akceptacji",
        wyslanoGodzinTemu: 24,
        kolor: "#B45309",
        posty: [
          { title: "Post 1 - burger miesiąca", caption: "Burger miesiąca: wołowina, ser cheddar, karmelizowana cebula i sos BBQ na maślanej bułce. Dostępny we wszystkich pięciu lokalach do końca września.", dzien: 2, godzina: 12, slajdy: 3 },
          { title: "Post 2 - frytki", caption: "Frytki z batatów wracają do karty. Tym razem na stałe.", dzien: 5, godzina: 18 },
          { title: "Post 3 - dzieci", caption: "Zestaw dla dzieci z mini burgerem, frytkami i sokiem za 19 zł. W weekendy kolorowanki na stolikach.", dzien: 9, godzina: 12, proporcja: "4:5" },
          { title: "Post 4 - dostawa", caption: "Dowozimy z każdego lokalu w promieniu 6 km. Zamów przez naszą stronę i odbierz 10% zniżki na pierwsze zamówienie.", dzien: 13, godzina: 18 },
          { title: "Post 5 - wege", caption: "Burger z kotletem z ciecierzycy i awokado. Wegetarianie, to dla Was.", dzien: 19, godzina: 12 },
          { title: "Post 6 - konkurs", caption: "Konkurs: pokaż nam swojego ulubionego burgera i wygraj kolację dla dwojga. Szczegóły w komentarzu.", dzien: 25, godzina: 18, slajdy: 2 },
        ],
        relacje: RELACJE_10("Burger Brothers"),
        kampanie: [
          {
            ...KAMPANIA_STANDARD("Burger Brothers", "https://burgerbrothers.pl/zamow"),
            note: "Jedna kampania dla wszystkich pięciu lokali: te same grafiki, osobny link do zamówień w każdym lokalu.",
            cta: "Zamów teraz",
            linkiPerLokal: [
              "https://burgerbrothers.pl/manufaktura",
              "https://burgerbrothers.pl/piotrkowska",
              "https://burgerbrothers.pl/widzew",
              "https://burgerbrothers.pl/pabianice",
              "https://burgerbrothers.pl/zgierz",
            ],
          },
        ],
      },
    ],
    faktury: [
      { number: "FV/2026/08/012", issue_date: "2026-08-01", due_date: "2026-08-15", amount_net: 5200, status: "do_zaplaty" },
      { number: "FV/2026/09/012", issue_date: "2026-09-01", due_date: "2026-09-15", amount_net: 5200, status: "do_zaplaty" },
    ],
  },
  {
    slug: "pierogarnia-babci",
    name: "Pierogarnia Babci",
    category: "kat3",
    tier: "siec",
    monthly_amount_net: 4400,
    slack_channel: "#pierogarnia-babci",
    cooperation_started_on: "2026-01-01",
    lokale: [
      { name: "Pierogarnia Babci Łódź", city: "Łódź", address: "ul. Narutowicza 20", fb_page_name: "Pierogarnia Babci Łódź", ig_handle: "pierogarniababci.lodz", separate_materials: false },
      { name: "Pierogarnia Babci Warszawa", city: "Warszawa", address: "ul. Chmielna 15", fb_page_name: "Pierogarnia Babci Warszawa", ig_handle: "pierogarniababci.wawa", separate_materials: false },
      { name: "Pierogarnia Babci Kraków", city: "Kraków", address: "ul. Grodzka 40", fb_page_name: "Pierogarnia Babci Kraków", ig_handle: null, separate_materials: false },
    ],
    kontakty: [
      { name: "Anna Zielińska", role_label: "właścicielka", phone: "+48 602 300 400", email: "anna@pierogarniababci.pl", is_primary: true },
      { name: "Piotr Zieliński", role_label: "wspólnik", phone: "+48 602 300 401", email: "piotr@pierogarniababci.pl", is_primary: false },
    ],
    przypisani: ["michalbigos15@gmail.com", "stan.morawski88@gmail.com"],
    pakiety: [
      {
        lokal: null,
        status: "do_akceptacji",
        wyslanoGodzinTemu: 66,
        kolor: "#12855C",
        posty: [
          { title: "Post 1 - ruskie", caption: "Pierogi ruskie lepimy codziennie od 6 rano. W każdym lokalu, tą samą ręką babci Heleny na zdjęciu z 1987 roku.", dzien: 1, godzina: 12, slajdy: 2 },
          { title: "Post 2 - sezon", caption: "Sezonowe: pierogi z dynią i szałwią. Tylko we wrześniu i październiku.", dzien: 5, godzina: 18, proporcja: "4:5" },
          { title: "Post 3 - imprezy", caption: "Urodziny, komunie, spotkania firmowe: przygotujemy pierogi na 20 albo 200 osób. Napisz do nas.", dzien: 9, godzina: 12 },
          { title: "Post 4 - kompot", caption: "Kompot z jabłek z własnej tłoczni. Do każdego zestawu obiadowego gratis.", dzien: 14, godzina: 18 },
          { title: "Post 5 - warsztaty", caption: "Warsztaty lepienia pierogów dla dzieci w każdą sobotę o 11:00. Zapisy telefonicznie.", dzien: 19, godzina: 12, slajdy: 3 },
          { title: "Post 6 - mrozone", caption: "Nasze pierogi mrożone kupisz na wynos w każdym lokalu. Zapas na cały tydzień w 5 minut.", dzien: 27, godzina: 18 },
        ],
        relacje: RELACJE_10("Pierogarnia Babci"),
        kampanie: [
          {
            ...KAMPANIA_STANDARD("Pierogarni Babci", "https://pierogarniababci.pl/rezerwacja"),
            note: "Kampania standardowa na trzy miasta, każdy lokal na własnej stronie.",
            linkiPerLokal: [
              "https://pierogarniababci.pl/lodz",
              "https://pierogarniababci.pl/warszawa",
              "https://pierogarniababci.pl/krakow",
            ],
          },
          {
            name: "Imprezy okolicznościowe",
            goal: "leady",
            note: "Chcemy dowozić rezerwacje na urodziny, komunie i spotkania firmowe. Osobna kampania, bo inny odbiorca i inny przekaz.",
            teksty: [
              "Urodziny, komunia, jubileusz firmy? Przygotujemy salę i pierogi dla Twoich gości. Ty tylko przyjdź.",
              "Organizujesz imprezę na 30 osób i nie chcesz stać przy garach? Zajmiemy się wszystkim.",
              "Sala dla 60 osób, menu ustalane z Tobą, pierogi lepione tego samego dnia. Zapytaj o wolne terminy.",
            ],
            naglowki: ["Zapytaj o wolny termin", "Impreza bez gotowania", "Sala i menu w jednym miejscu"],
            opis: "Rezerwacje imprez okolicznościowych",
            cta: "Wyślij wiadomość",
            link: "https://pierogarniababci.pl/imprezy",
          },
        ],
      },
    ],
    faktury: [
      { number: "FV/2026/08/044", issue_date: "2026-08-01", due_date: "2026-08-15", amount_net: 4400, status: "oplacona", paid_at: "2026-08-14" },
      { number: "FV/2026/09/044", issue_date: "2026-09-01", due_date: "2026-09-15", amount_net: 4400, status: "do_zaplaty" },
    ],
  },
  {
    slug: "demo-bistro",
    name: "Demo Bistro",
    category: "kat1",
    tier: "foodie_one",
    monthly_amount_net: 2000,
    slack_channel: "#demo",
    cooperation_started_on: "2026-06-01",
    lokale: [
      { name: "Demo Bistro", city: "Łódź", address: "ul. Przykładowa 1", fb_page_name: "Demo Bistro", ig_handle: "demobistro", separate_materials: true },
    ],
    kontakty: [
      { name: "Klient Demonstracyjny", role_label: "właściciel", phone: "+48 600 000 000", email: "demo@foodiemedia.pl", is_primary: true },
    ],
    przypisani: ["annaocicka@o2.pl"],
    pakiety: [
      {
        lokal: 0,
        status: "do_akceptacji",
        wyslanoGodzinTemu: 6,
        kolor: "#6B6B70",
        posty: [
          { title: "Post 1", caption: "Przykładowy post do pokazania panelu potencjalnym klientom. Tekst dłuższy niż trzy linijki, żeby było widać, jak działa skracanie z „Zobacz więcej” dokładnie tak, jak na Facebooku.", dzien: 3, godzina: 12, slajdy: 2 },
          { title: "Post 2", caption: "Krótki post.", dzien: 7, godzina: 18 },
          { title: "Post 3", caption: "Post z grafiką 4:5.", dzien: 11, godzina: 12, proporcja: "4:5" },
          { title: "Post 4", caption: "Czwarty post w pakiecie.", dzien: 15, godzina: 18 },
          { title: "Post 5", caption: "Piąty post w pakiecie.", dzien: 21, godzina: 12 },
          { title: "Post 6", caption: "Szósty post w pakiecie.", dzien: 27, godzina: 18 },
        ],
        relacje: RELACJE_10("Demo Bistro"),
        kampanie: [KAMPANIA_STANDARD("Demo Bistro", "https://example.com/rezerwacja")],
      },
    ],
    faktury: [
      { number: "FV/2026/09/099", issue_date: "2026-09-01", due_date: "2026-09-15", amount_net: 2000, status: "do_zaplaty" },
    ],
  },
];
