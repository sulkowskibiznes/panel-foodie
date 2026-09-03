/**
 * Seed: 3 klientów (kat1, kat2, kat3) + klient demonstracyjny, zespół, usługi.
 * Uruchomienie: pnpm db:seed (cel z SUPABASE_URL / SUPABASE_SECRET_KEY; zmienne procesu
 * mają pierwszeństwo przed .env.local, więc lokalny stack podajesz w linii poleceń).
 *
 * Idempotentny: usuwa klientów seedu (kaskada + pliki w Storage) i tworzy ich od nowa.
 * Tokeny i PIN-y WYŁĄCZNIE z generatorów w src/lib/auth-klient.ts (crypto.randomBytes);
 * wypisywane raz na stdout, nigdzie nie zapisywane.
 *
 * `--tylko=<slug>` (skrypt `pnpm db:seed:demo` = `--tylko=demo-bistro`): seed JEDNEGO klienta bez
 * ruszania zespołu i usług. Tak klient demonstracyjny trafia na produkcję (SPEC 1.4, poz. 21):
 * opiekun i przypisania biorą się z istniejących wierszy team_members, nic nie jest nadpisywane.
 */
import { randomUUID } from "node:crypto";
import { config as wczytajEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { generujPin, generujToken, hashujPin, hashujToken, tokenLookup } from "../../src/lib/auth-klient";
import { wyprowadzKlucz, zaszyfruj } from "../../src/lib/krypto";
import { KLIENCI, MIESIAC, ROK, USLUGI, ZESPOL, type KlientSeed, type PakietSeed } from "./dane";

wczytajEnv({ path: ".env.local" });

function wymagane(nazwa: string): string {
  const wartosc = process.env[nazwa];
  if (!wartosc) throw new Error(`Brak zmiennej ${nazwa}. Sprawdź .env.local wg .env.example.`);
  return wartosc;
}

const TYLKO_KLIENT = process.argv.find((a) => a.startsWith("--tylko="))?.slice("--tylko=".length) ?? null;
const SUPABASE_URL = wymagane("SUPABASE_URL");
const SUPABASE_SECRET_KEY = wymagane("SUPABASE_SECRET_KEY");
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const KLUCZ_TOKENU = wyprowadzKlucz(wymagane("SESSION_SECRET"), "token");

const db: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const GODZINA = 3_600_000;
const TERAZ = Date.now();
const AUTO_AKCEPTACJA_GODZIN = 72;

type Wiersz = Record<string, unknown>;

function sprawdz<T>(wynik: { data: T | null; error: { message: string } | null }, kontekst: string): T {
  if (wynik.error) throw new Error(`${kontekst}: ${wynik.error.message}`);
  if (wynik.data === null) throw new Error(`${kontekst}: brak danych`);
  return wynik.data;
}

async function wstaw<T extends Wiersz = Wiersz>(tabela: string, dane: Wiersz | Wiersz[]): Promise<T[]> {
  const wynik = await db.from(tabela).insert(dane).select();
  return sprawdz(wynik, `insert ${tabela}`) as T[];
}

async function wstawJeden<T extends Wiersz = Wiersz>(tabela: string, dane: Wiersz): Promise<T> {
  const [wiersz] = await wstaw<T>(tabela, dane);
  if (!wiersz) throw new Error(`insert ${tabela}: brak wiersza`);
  return wiersz;
}

// ---------- Storage ----------

async function usunFolder(bucket: string, prefix: string): Promise<void> {
  const lista = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  if (lista.error) throw new Error(`list ${bucket}/${prefix}: ${lista.error.message}`);
  const pliki: string[] = [];
  for (const wpis of lista.data ?? []) {
    if (wpis.id === null) await usunFolder(bucket, `${prefix}/${wpis.name}`);
    else pliki.push(`${prefix}/${wpis.name}`);
  }
  for (let i = 0; i < pliki.length; i += 100) {
    const wynik = await db.storage.from(bucket).remove(pliki.slice(i, i + 100));
    if (wynik.error) throw new Error(`remove ${bucket}: ${wynik.error.message}`);
  }
}

async function wgraj(bucket: string, sciezka: string, dane: Buffer, contentType: string): Promise<void> {
  const wynik = await db.storage.from(bucket).upload(sciezka, dane, { contentType, upsert: true });
  if (wynik.error) throw new Error(`upload ${bucket}/${sciezka}: ${wynik.error.message}`);
}

type Grafika = { original: Buffer; preview: Buffer; thumb: Buffer; width: number; height: number };

/** Grafika zastępcza: kolor tła i duży napis, w trzech wariantach jak przy imporcie z Dysku. */
async function grafika(tekst: string, kolor: string, width: number, height: number): Promise<Grafika> {
  const rozmiarCzcionki = Math.round(Math.min(width, height) / 9);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${kolor}"/>
    <text x="50%" y="50%" fill="#ffffff" font-family="Helvetica, Arial, sans-serif" font-size="${rozmiarCzcionki}"
      font-weight="bold" text-anchor="middle" dominant-baseline="middle">${tekst.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>
  </svg>`;
  const zrodlo = sharp(Buffer.from(svg));
  const original = await zrodlo.clone().png().toBuffer();
  const preview = await zrodlo.clone().resize({ width: Math.min(1080, width) }).webp({ quality: 80 }).toBuffer();
  const thumb = await zrodlo.clone().resize({ width: 400 }).webp({ quality: 70 }).toBuffer();
  return { original, preview, thumb, width, height };
}

async function dodajZasob(clientId: string, itemId: string, position: number, g: Grafika, nazwa: string): Promise<string> {
  const assetId = randomUUID();
  const baza = `${clientId}/${assetId}`;
  await Promise.all([
    wgraj("materialy", `${baza}/original.png`, g.original, "image/png"),
    wgraj("materialy", `${baza}/preview.webp`, g.preview, "image/webp"),
    wgraj("materialy", `${baza}/thumb.webp`, g.thumb, "image/webp"),
  ]);
  await wstawJeden("item_assets", {
    id: assetId,
    item_id: itemId,
    kind: "image",
    storage_path: `${baza}/original.png`,
    preview_path: `${baza}/preview.webp`,
    thumb_path: `${baza}/thumb.webp`,
    original_name: nazwa,
    mime: "image/png",
    bytes: g.original.length,
    width: g.width,
    height: g.height,
    position,
  });
  return assetId;
}

// ---------- Pomocnicze ----------

function dataPublikacji(dzien: number, godzina: number): string {
  // Europe/Warsaw we wrześniu = UTC+2
  return new Date(Date.UTC(ROK, MIESIAC - 1, dzien, godzina - 2, 0, 0)).toISOString();
}

function zaokraglijWGoreDoGodziny(ms: number): number {
  return Math.ceil(ms / GODZINA) * GODZINA;
}

function miesiacWspolpracy(start: string): number {
  const [rok, miesiac] = start.split("-").map(Number);
  if (!rok || !miesiac) return 1;
  return (ROK - rok) * 12 + (MIESIAC - miesiac) + 1;
}

function nazwaMiesiaca(miesiac: number): string {
  return ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"][miesiac - 1] ?? "";
}

// ---------- Zespół ----------

async function zapewnijUzytkownikaAuth(email: string, name: string): Promise<string> {
  const utworzony = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } });
  if (!utworzony.error && utworzony.data.user) return utworzony.data.user.id;
  const lista = await db.auth.admin.listUsers({ perPage: 1000 });
  if (lista.error) throw new Error(`auth listUsers: ${lista.error.message}`);
  const istniejacy = lista.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!istniejacy) throw new Error(`auth createUser ${email}: ${utworzony.error?.message ?? "nieznany błąd"}`);
  return istniejacy.id;
}

async function seedZespolu(): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  for (const osoba of ZESPOL) {
    const authId = await zapewnijUzytkownikaAuth(osoba.email, osoba.name);
    const wynik = await db
      .from("team_members")
      .upsert(
        { auth_user_id: authId, name: osoba.name, email: osoba.email.toLowerCase(), role: osoba.role, active: true },
        { onConflict: "email" },
      )
      .select("id")
      .single();
    const wiersz = sprawdz(wynik, `upsert team_members ${osoba.email}`) as { id: string };
    mapa.set(osoba.email.toLowerCase(), wiersz.id);
  }
  return mapa;
}

/** Tryb `--tylko`: istniejący zespół po e-mailu, bez tworzenia kont i bez nadpisywania ról. */
async function istniejacyZespol(): Promise<Map<string, string>> {
  const wynik = await db.from("team_members").select("id, email");
  const wiersze = sprawdz(wynik, "select team_members") as Array<{ id: string; email: string }>;
  return new Map(wiersze.map((w) => [w.email.toLowerCase(), w.id]));
}

async function seedUslug(): Promise<void> {
  const wynik = await db.from("services").upsert(
    USLUGI.map((u) => ({ ...u, active: true })),
    { onConflict: "slug" },
  );
  if (wynik.error) throw new Error(`upsert services: ${wynik.error.message}`);
}

// ---------- Klienci ----------

async function sprzatajKlienta(slug: string): Promise<void> {
  const wynik = await db.from("clients").select("id").eq("slug", slug).maybeSingle();
  if (wynik.error) throw new Error(`select clients ${slug}: ${wynik.error.message}`);
  if (!wynik.data) return;
  const id = (wynik.data as { id: string }).id;
  await usunFolder("materialy", id);
  await usunFolder("awatary", id);
  // Komentarze wskazują osoby kontaktowe bez kaskady (comments.author_contact_id), więc idą pierwsze.
  const pakiety = await db.from("packages").select("id").eq("client_id", id);
  if (pakiety.error) throw new Error(`select packages ${slug}: ${pakiety.error.message}`);
  const idsPakietow = (pakiety.data ?? []).map((p) => p.id);
  if (idsPakietow.length > 0) {
    const komentarze = await db.from("comments").delete().in("package_id", idsPakietow);
    if (komentarze.error) throw new Error(`delete comments ${slug}: ${komentarze.error.message}`);
  }
  const usun = await db.from("clients").delete().eq("id", id);
  if (usun.error) throw new Error(`delete clients ${slug}: ${usun.error.message}`);
}

type Dostep = { klient: string; label: string; link: string; pin: string };

async function seedKlienta(k: KlientSeed, zespol: Map<string, string>, dostepy: Dostep[]): Promise<void> {
  const opiekunId = zespol.get("gosia@foodiemedia.pl");
  const adminId = zespol.get("kontakt@foodiemedia.pl");
  const klient = await wstawJeden<{ id: string }>("clients", {
    demo: k.demo ?? false,
    name: k.name,
    slug: k.slug,
    category: k.category,
    tier: k.tier,
    monthly_amount_net: k.monthly_amount_net,
    extra_locations_count: Math.max(0, k.lokale.length - 1),
    slack_channel: k.slack_channel,
    cooperation_started_on: k.cooperation_started_on,
    opiekun_id: opiekunId ?? null,
  });
  const clientId = klient.id;

  // Lokale + awatary (używane wyłącznie wewnątrz ramki podglądu)
  const lokale: Array<{ id: string; name: string }> = [];
  for (const [i, l] of k.lokale.entries()) {
    const lokal = await wstawJeden<{ id: string }>("locations", { ...l, client_id: clientId, position: i });
    const inicjal = l.fb_page_name.trim().charAt(0).toUpperCase();
    const awatar = await grafika(inicjal, "#1B1B1B", 256, 256);
    const sciezka = `${clientId}/${lokal.id}.png`;
    await wgraj("awatary", sciezka, awatar.original, "image/png");
    const upd = await db.from("locations").update({ avatar_path: sciezka }).eq("id", lokal.id);
    if (upd.error) throw new Error(`update locations: ${upd.error.message}`);
    lokale.push({ id: lokal.id, name: l.name });
  }

  const kontakty = await wstaw<{ id: string; name: string; role_label: string | null; is_primary: boolean }>(
    "client_contacts",
    k.kontakty.map((c) => ({ ...c, client_id: clientId })),
  );
  const glownyKontakt = kontakty.find((c) => c.is_primary) ?? kontakty[0];

  const przypisani = new Set<string>();
  if (opiekunId) przypisani.add(opiekunId);
  for (const email of k.przypisani) {
    const id = zespol.get(email.toLowerCase());
    if (id) przypisani.add(id);
  }
  if (przypisani.size > 0) {
    await wstaw("client_assignments", [...przypisani].map((team_member_id) => ({ client_id: clientId, team_member_id })));
  }

  const tworca = k.przypisani.map((e) => zespol.get(e.toLowerCase())).find(Boolean) ?? adminId ?? null;
  const idLokali = lokale.map((l) => l.id);

  for (const p of k.pakiety) {
    await seedPakietu(k, p, clientId, idLokali, tworca, glownyKontakt?.id ?? null);
  }

  // Linki dostępu: osobny link i PIN na każdą osobę kontaktową (SPEC rozdz. 4). Klient demo bez linków (trigger w bazie).
  for (const kontakt of k.demo ? [] : kontakty) {
    const token = generujToken();
    const pin = generujPin("pin4");
    const label = `${kontakt.name} - ${kontakt.role_label ?? "kontakt"}`;
    await wstawJeden("access_links", {
      client_id: clientId,
      contact_id: kontakt.id,
      label,
      token_lookup: tokenLookup(token),
      token_hash: hashujToken(token),
      token_enc: zaszyfruj(KLUCZ_TOKENU, token),
      pin_hash: await hashujPin(pin),
      pin_kind: "pin4",
      can_approve: kontakt.role_label !== "manager",
      created_by: opiekunId ?? null,
    });
    dostepy.push({ klient: k.name, label, link: `${APP_URL}/p/${token}`, pin });
  }

  await wstaw(
    "invoices",
    (k.demo ? [] : k.faktury).map((f) => ({
      client_id: clientId,
      number: f.number,
      issue_date: f.issue_date,
      due_date: f.due_date,
      amount_net: f.amount_net,
      amount_gross: Math.round(f.amount_net * 1.23 * 100) / 100,
      status: f.status,
      paid_at: f.paid_at ?? null,
    })),
  );

  // Raport za poprzedni miesiąc: kat1 per lokal, reszta per klient
  const poprzedni = MIESIAC === 1 ? { rok: ROK - 1, miesiac: 12 } : { rok: ROK, miesiac: MIESIAC - 1 };
  const raporty = k.category === "kat1" ? lokale.map((l) => ({ location_id: l.id, nazwa: l.name })) : [{ location_id: null, nazwa: k.name }];
  await wstaw(
    "reports",
    raporty.map((r, i) => ({
      client_id: clientId,
      location_id: r.location_id,
      period_year: poprzedni.rok,
      period_month: poprzedni.miesiac,
      title: `Raport miesięczny - ${nazwaMiesiaca(poprzedni.miesiac)} ${poprzedni.rok}`,
      url: `https://raporty.foodiemedia.pl/r/seed-${k.slug}-${i + 1}`,
      cooperation_month: miesiacWspolpracy(k.cooperation_started_on) - 1,
      source: "reczne",
    })),
  );
}

async function seedPakietu(
  k: KlientSeed,
  p: PakietSeed,
  clientId: string,
  idLokali: string[],
  tworcaId: string | null,
  glownyKontaktId: string | null,
): Promise<void> {
  const lokalizacjaId = p.lokal === null ? null : (idLokali[p.lokal] ?? null);
  const lokaleMaterialu = k.category === "kat1" ? [] : idLokali;
  const wyslano = p.wyslanoGodzinTemu !== undefined ? TERAZ - p.wyslanoGodzinTemu * GODZINA : null;
  const autoAkceptacja = wyslano !== null ? zaokraglijWGoreDoGodziny(wyslano + AUTO_AKCEPTACJA_GODZIN * GODZINA) : null;
  const zaakceptowano = p.status === "zaakceptowany" && wyslano !== null ? wyslano + 30 * GODZINA : null;

  const pakiet = await wstawJeden<{ id: string }>("packages", {
    client_id: clientId,
    location_id: lokalizacjaId,
    period_year: ROK,
    period_month: MIESIAC,
    cooperation_month: miesiacWspolpracy(k.cooperation_started_on),
    title: `Materiały - ${nazwaMiesiaca(MIESIAC)} ${ROK}`,
    status: p.status,
    round: 1,
    submitted_at: wyslano !== null ? new Date(wyslano).toISOString() : null,
    first_opened_at: zaakceptowano !== null ? new Date(wyslano! + 2 * GODZINA).toISOString() : null,
    auto_approve_enabled: true,
    auto_approve_at: autoAkceptacja !== null && p.status === "do_akceptacji" ? new Date(autoAkceptacja).toISOString() : null,
    approved_at: zaakceptowano !== null ? new Date(zaakceptowano).toISOString() : null,
    approved_by_contact_id: zaakceptowano !== null ? glownyKontaktId : null,
    approval_kind: zaakceptowano !== null ? "reczna" : null,
    period_from: `${ROK}-${String(MIESIAC).padStart(2, "0")}-01`,
    period_to: `${ROK}-${String(MIESIAC).padStart(2, "0")}-30`,
    created_by: tworcaId,
  });
  const pakietId = pakiet.id;

  // Posty (w tym karuzele i 4:5)
  const itemyPostow: string[] = [];
  for (const [i, post] of p.posty.entries()) {
    const item = await wstawJeden<{ id: string }>("package_items", {
      package_id: pakietId,
      type: "post",
      position: i + 1,
      title: post.title,
      caption: post.caption,
      publish_at: dataPublikacji(post.dzien, post.godzina),
      location_ids: lokaleMaterialu,
      origin: "import",
    });
    itemyPostow.push(item.id);
    const [w, h] = post.proporcja === "4:5" ? [1080, 1350] : [1080, 1080];
    const slajdy = post.slajdy ?? 1;
    for (let s = 0; s < slajdy; s++) {
      const g = await grafika(slajdy > 1 ? `Post ${i + 1} / ${s + 1}` : `Post ${i + 1}`, p.kolor, w, h);
      await dodajZasob(clientId, item.id, s, g, `post-${i + 1}-${s + 1}.png`);
    }
  }

  // Relacje 9:16
  for (const [i, relacja] of p.relacje.entries()) {
    const item = await wstawJeden<{ id: string }>("package_items", {
      package_id: pakietId,
      type: "relacja",
      position: i + 1,
      title: relacja.title,
      publish_at: dataPublikacji(relacja.dzien, relacja.godzina),
      location_ids: lokaleMaterialu,
      origin: "import",
    });
    const g = await grafika(`Relacja ${i + 1}`, p.kolor, 1080, 1920);
    await dodajZasob(clientId, item.id, 0, g, `relacja-${i + 1}.png`);
  }

  // Kampanie: jeden materiał 'reklama' na kampanię, warianty wspólne + per lokal
  for (const [ci, kampania] of p.kampanie.entries()) {
    const wierszKampanii = await wstawJeden<{ id: string }>("campaigns", {
      package_id: pakietId,
      name: kampania.name,
      goal: kampania.goal,
      position: ci,
      note: kampania.note,
    });
    const reklama = await wstawJeden<{ id: string }>("package_items", {
      package_id: pakietId,
      campaign_id: wierszKampanii.id,
      type: "reklama",
      position: ci + 1,
      title: kampania.name,
      location_ids: lokaleMaterialu,
      origin: "import",
    });
    const warianty: Wiersz[] = [];
    for (let g = 0; g < 6; g++) {
      const obraz = await grafika(`${kampania.name.slice(0, 18)} ${g + 1}`, p.kolor, 1080, 1080);
      const assetId = await dodajZasob(clientId, reklama.id, g, obraz, `reklama-${ci + 1}-${g + 1}.png`);
      warianty.push({ item_id: reklama.id, kind: "grafika", position: g, label: `Grafika ${g + 1}`, asset_id: assetId });
    }
    kampania.teksty.forEach((t, i) =>
      warianty.push({ item_id: reklama.id, kind: "tekst", position: i, label: `Tekst ${"ABC"[i] ?? i + 1}`, value_text: t }),
    );
    kampania.naglowki.forEach((n, i) =>
      warianty.push({ item_id: reklama.id, kind: "naglowek", position: i, label: `Nagłówek ${i + 1}`, value_text: n }),
    );
    warianty.push({ item_id: reklama.id, kind: "opis", position: 0, value_text: kampania.opis });
    warianty.push({ item_id: reklama.id, kind: "cta", position: 0, value_text: kampania.cta });
    if (kampania.linkiPerLokal && k.category !== "kat1") {
      kampania.linkiPerLokal.forEach((link, i) => {
        const locationId = idLokali[i];
        if (locationId) warianty.push({ item_id: reklama.id, kind: "link", position: 0, value_text: link, location_id: locationId });
      });
    } else {
      warianty.push({ item_id: reklama.id, kind: "link", position: 0, value_text: kampania.link });
    }
    await wstaw("ad_variants", warianty);
  }

  // Zdarzenia pakietu
  const zdarzenia: Wiersz[] = [
    { package_id: pakietId, kind: "utworzony", actor_kind: "zespol", actor_id: tworcaId, created_at: new Date((wyslano ?? TERAZ) - 4 * GODZINA).toISOString() },
    { package_id: pakietId, kind: "zaimportowany", actor_kind: "zespol", actor_id: tworcaId, created_at: new Date((wyslano ?? TERAZ) - 3 * GODZINA).toISOString() },
  ];
  if (wyslano !== null) {
    zdarzenia.push({ package_id: pakietId, kind: "wyslany", actor_kind: "zespol", actor_id: tworcaId, payload: { round: 1 }, created_at: new Date(wyslano).toISOString() });
  }
  if (zaakceptowano !== null) {
    zdarzenia.push(
      { package_id: pakietId, kind: "otwarty", actor_kind: "klient", actor_id: glownyKontaktId, created_at: new Date(wyslano! + 2 * GODZINA).toISOString() },
      { package_id: pakietId, kind: "zaakceptowany", actor_kind: "klient", actor_id: glownyKontaktId, payload: { items: itemyPostow.length + p.relacje.length + p.kampanie.length }, created_at: new Date(zaakceptowano).toISOString() },
    );
  }
  // Wstawianie wielu wierszy naraz: PostgREST wpisuje null w brakujące klucze zamiast DEFAULT, więc payload zawsze jawnie.
  await wstaw("package_events", zdarzenia.map((z) => ({ payload: {}, ...z })));

  // Przykładowa uwaga klienta z odpowiedzią zespołu (do pulpitu i skrzynki uwag)
  if (k.slug === "burger-brothers" && itemyPostow[1] && glownyKontaktId) {
    const uwaga = await wstawJeden<{ id: string }>("comments", {
      package_id: pakietId,
      item_id: itemyPostow[1],
      author_kind: "klient",
      author_contact_id: glownyKontaktId,
      body: "Frytki z batatów mamy tylko w Manufakturze i na Piotrkowskiej. Możemy to dopisać w tekście?",
      round: 1,
      created_at: new Date(TERAZ - 5 * GODZINA).toISOString(),
    });
    await wstawJeden("comments", {
      package_id: pakietId,
      item_id: itemyPostow[1],
      author_kind: "zespol",
      author_member_id: tworcaId,
      body: `Jasne, dopiszemy listę lokali w drugim zdaniu. Poprawiony tekst wyślemy dziś. (odpowiedź na uwagę ${uwaga.id.slice(0, 8)})`,
      round: 1,
      created_at: new Date(TERAZ - 4 * GODZINA).toISOString(),
    });
    await wstawJeden("package_events", { package_id: pakietId, kind: "komentarz", actor_kind: "klient", actor_id: glownyKontaktId, created_at: new Date(TERAZ - 5 * GODZINA).toISOString() });
  }
}

// ---------- Główny przebieg ----------

async function main(): Promise<void> {
  console.log(`Seed → ${SUPABASE_URL}`);
  const start = Date.now();

  const klienci = TYLKO_KLIENT ? KLIENCI.filter((k) => k.slug === TYLKO_KLIENT) : KLIENCI;
  if (klienci.length === 0) throw new Error(`Nie ma klienta seedu o slugu ${TYLKO_KLIENT}.`);

  let zespol: Map<string, string>;
  if (TYLKO_KLIENT) {
    zespol = await istniejacyZespol();
    console.log(`Tryb --tylko=${TYLKO_KLIENT}: zespół (${zespol.size} osób) i usługi bez zmian`);
  } else {
    zespol = await seedZespolu();
    console.log(`Zespół: ${zespol.size} osób`);
    await seedUslug();
    console.log(`Usługi: ${USLUGI.length}`);
  }

  const dostepy: Dostep[] = [];
  for (const klient of klienci) {
    await sprzatajKlienta(klient.slug);
    await seedKlienta(klient, zespol, dostepy);
    console.log(`Klient: ${klient.name} (${klient.category}, ${klient.lokale.length} lokali, ${klient.pakiety.length} pakiet/y)`);
  }

  console.log(`\nGotowe w ${Math.round((Date.now() - start) / 1000)} s.\n`);
  if (dostepy.length === 0) return;
  console.log("Linki dostępu (pokazane tylko teraz, nigdzie nie zapisane w jawnej postaci):");
  for (const d of dostepy) {
    console.log(`  ${d.klient} · ${d.label}\n    ${d.link}\n    PIN: ${d.pin}`);
  }
}

main().catch((blad: unknown) => {
  console.error(blad instanceof Error ? blad.message : blad);
  process.exit(1);
});
