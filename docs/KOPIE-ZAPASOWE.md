# Kopie zapasowe i odtwarzanie — Supabase

Stan na 2026-09-30. Od tego dnia produkcja to osobny projekt **`panel-foodie-prod`** (`mcfrdcllddklhcoxamjy`,
`eu-central-1`); projekt testowy `panel-foodie` (`fdpbpnenqrrjtorexbnx`) służy Preview i pracy lokalnej i nie
wymaga PITR.

## 1. Co jest, a czego nie ma (sprawdzone przez Management API)

| Element | Produkcja `mcfrdcllddklhcoxamjy` | Uwagi |
|---|---|---|
| Codzienne kopie bazy (fizyczne) | **włączone** (`walg_enabled: true`) | pierwsza kopia z dnia utworzenia projektu |
| Point-in-time recovery (PITR) | **wyłączone** (`pitr_enabled: false`) | płatny dodatek, patrz niżej; compute już wystarcza |
| Compute | **Small** (~15 USD/mies.) | próg wymagany przez PITR spełniony |
| Storage (pliki) | brak kopii po stronie Supabase | patrz sekcja 4 |

**Włączenie PITR to decyzja Szymona (koszt).** Kroki w panelu Supabase: *Project Settings → Add-ons →
Point in Time Recovery* → wybierz retencję (7 dni to najniższy próg) i potwierdź. Jeśli panel pokaże, że
compute jest za mały, najpierw *Compute Size → Small*. Po włączeniu wróć tutaj i zmień tabelę wyżej.

Sprawdzenie stanu bez klikania (token narzędziowy z `.env.local`, tylko odczyt):

```bash
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" https://api.supabase.com/v1/projects/mcfrdcllddklhcoxamjy/database/backups
```

## 2. Kiedy odtwarzać

- Ktoś skasował dane, których nie da się odtworzyć z panelu (np. „Usuń dane klienta" na złym kliencie,
  ręczny `DELETE` w SQL Editorze). Sam pakiet usunięty przez retencję da się zaimportować ponownie z Dysku.
- Migracja, która zepsuła dane (błędny `UPDATE` na `packages`).
- Awaria projektu Supabase.

Zanim cokolwiek odtworzysz: **ustal godzinę zdarzenia** z `audit_log` (`created_at`, `action`, `actor_label`)
albo z `package_events`. Odtworzenie cofa **całą bazę**, nie jedną tabelę.

## 3. Procedura odtworzenia (baza)

1. **Zatrzymaj ruch**, żeby nikt nie zapisywał do bazy, którą zaraz cofniesz:
   - Vercel → projekt `panel-foodie` → *Settings → Environment Variables*: tymczasowo zmień `SUPABASE_URL`
     na nieistniejący adres i zrób *Redeploy* produkcji, **albo** w Vercelu wstrzymaj crony (*Settings → Cron
     Jobs → Disable*) i wyślij zespołowi wiadomość, żeby nie pracował w panelu przez czas odtwarzania.
   - Klienci zobaczą stronę błędu; to lepsze niż akceptacje zapisane do bazy, która za chwilę zniknie.
2. **Wykonaj kopię stanu obecnego** (nawet zepsutego), żeby dało się porównać:
   `supabase db dump --linked -f kopia-przed-odtworzeniem.sql` (wymaga `SUPABASE_ACCESS_TOKEN` w `.env.local`).
3. **Odtwórz** w panelu Supabase: *Database → Backups*.
   - **Z PITR** (gdy włączone): zakładka *Point in Time* → wybierz datę i godzinę **sprzed** zdarzenia
     (czas w UTC; Warszawa latem = UTC+2, zimą UTC+1) → *Restore*. Baza jest niedostępna przez kilka do
     kilkunastu minut; Supabase wysyła e-mail po zakończeniu.
   - **Bez PITR**: zakładka *Scheduled backups* → najnowsza kopia sprzed zdarzenia → *Restore*. Tracisz
     wszystko od godziny tej kopii (kopie robią się ok. 06:50 UTC).
4. **Po odtworzeniu, przed przywróceniem ruchu:**
   - `pnpm db:migrate` z lokalnego repo na gałęzi `main`: jeśli kopia jest sprzed ostatniej migracji, `db push`
     dołoży brakujące migracje. Nigdy nie poprawiaj schematu ręcznie w panelu.
   - Sprawdź w SQL Editorze: `select max(created_at) from public.audit_log;` (ostatni wpis powinien być sprzed
     zdarzenia) i `select count(*) from public.packages;`.
   - Klucze API i sekrety **nie zmieniają się** przy odtworzeniu; zmienne w Vercelu zostają.
   - Sesje klientów i zespołu z okresu po kopii przestaną działać (ich wiersze zniknęły). Klient wpisze PIN
     ponownie, zespół zaloguje się kodem. To normalne, uprzedź Gosię.
5. **Przywróć ruch** (cofnij zmianę z kroku 1, *Redeploy*), włącz crony.
6. **Odtwórz to, co zdarzyło się po punkcie przywracania**, ręcznie i z audytu z kopii z kroku 2:
   akceptacje klientów (podgląd „Zobacz jak klient" ich nie zapisze; poproś klienta o ponowne kliknięcie albo
   odnotuj akceptację w notatce i potwierdź z nim na WhatsAppie), nowe faktury, komentarze. Materiały wgrane po
   punkcie przywracania trzeba zaimportować ponownie (pliki w Storage zostały, wiersze `item_assets` nie).
7. Wpisz zdarzenie do `docs/POSTEP.md` (sekcja „Incydenty"): kiedy, co, do jakiej godziny cofnięto, co
   odtworzono ręcznie.

## 4. Storage (pliki) nie ma PITR

Pliki w bucketach `materialy`, `awatary`, `faktury`, `dokumenty` nie są objęte kopiami bazy. Skasowany
obiekt jest skasowany. Źródła prawdy leżą poza panelem, więc odtworzenie to ponowny import:

| Bucket | Skąd odtworzyć |
|---|---|
| `materialy` | folder klienta na Dysku Google („Materiały klientów"): kreator pakietu → wklej link → import |
| `awatary` | zdjęcie profilowe strony klienta na Facebooku (wgranie ręczne przez SQL: `locations.avatar_path`) |
| `faktury` | Fakturowo (PDF do pobrania), zakładka Faktury → „Dodaj / Podmień PDF" |
| `dokumenty` | archiwum umów agencji, zakładka Dokumenty |

Kasowanie obiektów w Storage robi wyłącznie: retencja po decyzji admina, „Usuń dane klienta" i (dla
pojedynczego materiału w szkicu) „Usuń materiał". Nie ma automatów kasujących pliki.

Jeśli chcesz mieć niezależną kopię plików (np. raz na kwartał na dysk zewnętrzny), skopiuj buckety kluczem
`sb_secret_` skryptem `supabase storage cp -r ss:///materialy ./kopia/materialy --experimental` (CLI Supabase,
wymaga `supabase link`). Nie trzymaj kopii na dysku synchronizowanym z iCloud.

## 5. Kopia przed każdą ryzykowną operacją

Przed `pnpm db:migrate` na produkcji i przed „Usuń dane klienta" dla klienta z długą historią:

```bash
pnpm exec supabase db dump --linked -f "kopie/$(date +%Y%m%d-%H%M)-przed.sql"
```

Katalog `kopie/` jest w `.gitignore`; plik zawiera dane osobowe, więc po użyciu go skasuj.
