# Konfiguracja maili logowania — Resend + Supabase Auth

Panel wysyła jeden rodzaj maila: **kod logowania (OTP) dla zespołu**. Klienci nie dostają
maili z panelu — do nich idzie WhatsApp od opiekuna.

Ta instrukcja przyda się drugi raz, przy zakładaniu projektu produkcyjnego przed pilotażem.

**Domena wysyłkowa: `powiadomienia.foodiemedia.pl`** — osobna subdomena, żeby nie mieszać
się z GetResponse ani z pocztą firmową na `foodiemedia.pl`.

---

## Dlaczego osobna subdomena

- Rekordy powstają pod nowymi nazwami. **Żaden istniejący rekord nie jest zmieniany.**
- SPF w korzeniu domeny (GetResponse, Google) zostaje nietknięty.
- Poczta przychodząca na `foodiemedia.pl` zostaje nietknięta.
- Reputacja maili systemowych jest oddzielona od reputacji wysyłek marketingowych.

**Nie używaj do tego `panel.foodiemedia.pl`** — ta nazwa będzie rekordem CNAME na Vercela,
a CNAME nie powinien współistnieć z rekordami pocztowymi pod tą samą nazwą.

---

## Krok 1 — domena w Resend

1. [resend.com](https://resend.com) → konto → **Domains → Add Domain**
2. Nazwa domeny: **`powiadomienia.foodiemedia.pl`** (całość, z subdomeną)
3. Region wysyłki: **Europa (Irlandia)** — dane trzymamy w UE, niech maile też
4. Resend pokaże trzy rekordy do dodania

## Krok 2 — rekordy DNS

Resend wyświetli pełne nazwy, na przykład `send.powiadomienia.foodiemedia.pl`.
**W Cloudflare wpisujesz nazwę bez `.foodiemedia.pl`** — Cloudflare dokleja ją sam.

| Typ | Nazwa w Cloudflare | Wartość | Ustawienia |
|---|---|---|---|
| MX | `send.powiadomienia` | z Resenda, np. `feedback-smtp.eu-west-1.amazonses.com` | priorytet 10 |
| TXT | `send.powiadomienia` | z Resenda, `v=spf1 include:amazonses.com ~all` | — |
| TXT | `resend._domainkey.powiadomienia` | długi klucz z Resenda | **Proxy: DNS only** |

**Kontrola poprawności:** po dodaniu Cloudflare pokazuje pełną nazwę rekordu. Ma tam być
`send.powiadomienia.foodiemedia.pl`. Jeśli widzisz
`send.powiadomienia.foodiemedia.pl.foodiemedia.pl`, wkleiłeś pełną nazwę zamiast skróconej
— popraw, inaczej weryfikacja nigdy nie przejdzie. To najczęstszy błąd przy tej konfiguracji.

**Inny dostawca DNS niż Cloudflare:** część paneli chce nazwy względnej (`send.powiadomienia`),
część pełnej. Zasada jest jedna — po zapisaniu rekord ma się nazywać dokładnie tak, jak
pokazuje Resend, ani znaku więcej.

Weryfikacja: od kilku minut do kilku godzin. Status domeny w Resend zmieni się na **Verified**.

**DMARC:** jeśli masz rekord DMARC na `foodiemedia.pl`, subdomena go dziedziczy. Nie trzeba
nic robić — SPF i DKIM Resenda są zgodne z domeną nadawcy, więc DMARC przejdzie.

## Krok 3 — klucz API

**API Keys → Create API Key**:

- nazwa: `panel-foodie-smtp`
- uprawnienie: **Sending access** (nie Full access)
- ogranicz do domeny `powiadomienia.foodiemedia.pl`

Klucz widać **tylko raz**. Od razu do menedżera haseł.

## Krok 4 — SMTP w Supabase

Authentication → ustawienia projektu → **SMTP Settings** → **Enable Custom SMTP**:

```
Host:          smtp.resend.com
Port:          587
Username:      resend
Password:      <klucz API z kroku 3>
Sender email:  no-reply@powiadomienia.foodiemedia.pl
Sender name:   Foodie Media
```

**Username to dosłownie słowo `resend`** — nie e-mail, nie nazwa domeny. Drugi
najczęstszy błąd.

## Krok 5 — pozostałe ustawienia Auth

- Authentication → **Emails** → szablon **Magic Link** → wklej treść
  `supabase/templates/kod-logowania.html`. Sprawdź, czy zawiera `{{ .Token }}`.
- Authentication → **Sign In / Providers** → **Email** → **Email OTP expiration**: `600`
- Authentication → **Sign In / Providers** → wyłącz **Allow new users to sign up**
  (dopiero po dodaniu kont zespołu w Authentication → Users)
- Authentication → **Rate Limits** → podnieś limit wysyłki maili; domyślny bywa za niski,
  gdy kilka osób loguje się w tym samym czasie

## Krok 6 — test

Zaloguj się na swój adres i sprawdź:

- czy mail przyszedł w kilkanaście sekund,
- czy nie wpadł do spamu,
- czy **w treści jest kod**, a nie link — brak kodu oznacza brak `{{ .Token }}`
  albo wklejenie szablonu w niewłaściwe miejsce.

W Resend zakładka **Logs** pokazuje każdą wysyłkę i jej status. To pierwsze miejsce do
sprawdzenia, gdy coś nie dochodzi.

---

## Limity i koszty

Darmowy plan Resend: 3000 maili miesięcznie, 100 dziennie, 3 domeny. Przy pięciu osobach
logujących się kodem to kilkadziesiąt maili w miesiącu.

## Co zostaje nietknięte

- SPF w korzeniu `foodiemedia.pl` (GetResponse, Google)
- DKIM GetResponse — ma własny, unikalny selektor
- Rekordy MX poczty przychodzącej
- Wszystkie dotychczasowe wysyłki marketingowe
