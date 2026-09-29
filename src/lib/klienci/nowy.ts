/**
 * Walidacja danych klienta w panelu zespołu: formularz „Nowy klient" i zakładka „Dane i współpraca".
 * Czysta logika z FormData do gotowych wierszy albo kod błędu, bez Next i bez bazy (testy jednostkowe).
 */
import { z } from "zod";
import { czyEmail } from "@/lib/walidacja";

export const KATEGORIE = ["kat1", "kat2", "kat3"] as const;
export const TIERY = ["foodie_one", "foodie_360", "siec"] as const;

export type Kategoria = (typeof KATEGORIE)[number];
export type Tier = (typeof TIERY)[number];

/** Regulamin § 5: automatyczną akceptację wolno tylko wydłużyć (72 h to minimum), najwyżej do 30 dni. */
export const GODZINY_AUTO_MIN = 72;
export const GODZINY_AUTO_MAX = 720;

export type DaneKlienta = {
  name: string;
  category: Kategoria;
  tier: Tier;
  monthly_amount_net: number | null;
  slack_channel: string | null;
  cooperation_started_on: string | null;
};

export type Lokal = { name: string; city: string | null; fb_page_name: string; ig_handle: string | null; address: string | null };
export type Kontakt = { name: string; role_label: string | null; phone: string | null; email: string | null };

export type DaneNowegoKlienta = DaneKlienta & {
  slug: string;
  opiekun_id: string | null;
  lokale: Array<Omit<Lokal, "address">>;
  kontakty: Kontakt[];
  /** Content creatorzy, media buyerzy i inni przypisani przy zakładaniu (client_assignments). */
  przypisani: string[];
};

export type Akceptacja = { auto_approve_default: boolean; auto_approve_hours: number | null; default_publish_hours: number[] };

export type BladKlienta = "nazwa" | "slug" | "kwota" | "lokal" | "kontakt" | "email" | "data" | "godzinyAuto" | "godzinyPublikacji";

export type Wynik<T> = { ok: true; dane: T } | { ok: false; blad: BladKlienta };

/** Slug z nazwy: polskie znaki na łacińskie, reszta na myślniki. */
export function slugZNazwy(nazwa: string): string {
  const mapa: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
  return nazwa
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (z) => mapa[z] ?? z)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

const pusty = (w: FormDataEntryValue | null | undefined) => (typeof w === "string" ? w.trim() : "");
const lubNull = (w: string) => (w === "" ? null : w);

function lista(fd: FormData, klucz: string): string[] {
  return fd.getAll(klucz).map((w) => (typeof w === "string" ? w.trim() : ""));
}

/** Pola wspólne dla nowego klienta i edycji: nazwa, kategoria, pakiet, kwota, Slack, data startu. */
export function walidujDaneKlienta(fd: FormData): Wynik<DaneKlienta> {
  const name = pusty(fd.get("name"));
  if (!name || name.length > 120) return { ok: false, blad: "nazwa" };
  const category = z.enum(KATEGORIE).safeParse(pusty(fd.get("category")));
  const tier = z.enum(TIERY).safeParse(pusty(fd.get("tier")));
  if (!category.success || !tier.success) return { ok: false, blad: "nazwa" };
  const kwotaTekst = pusty(fd.get("monthly_amount_net")).replace(",", ".").replace(/\s/g, "");
  const kwota = kwotaTekst === "" ? null : Number(kwotaTekst);
  if (kwota !== null && (!Number.isFinite(kwota) || kwota < 0 || kwota > 1_000_000)) return { ok: false, blad: "kwota" };
  const start = pusty(fd.get("cooperation_started_on"));
  if (start && !DATA.test(start)) return { ok: false, blad: "data" };
  const slack = pusty(fd.get("slack_channel"));
  return { ok: true, dane: { name, category: category.data, tier: tier.data, monthly_amount_net: kwota, slack_channel: lubNull(slack.slice(0, 80)), cooperation_started_on: lubNull(start) } };
}

/** Jeden lokal: nazwa i nazwa strony na Facebooku obowiązkowe (podglądy 1:1), nick IG bez @. */
export function walidujLokal(p: { name: string; city: string; fb_page_name: string; ig_handle: string; address?: string }): Wynik<Lokal> {
  const name = p.name.trim();
  const fb = p.fb_page_name.trim();
  if (!name || !fb || name.length > 120 || fb.length > 120) return { ok: false, blad: "lokal" };
  const ig = p.ig_handle.trim().replace(/^@/, "");
  if (ig.length > 60 || /\s/.test(ig)) return { ok: false, blad: "lokal" };
  return { ok: true, dane: { name, city: lubNull(p.city.trim().slice(0, 80)), fb_page_name: fb, ig_handle: lubNull(ig), address: lubNull((p.address ?? "").trim().slice(0, 200)) } };
}

/** Jedna osoba kontaktowa: imię obowiązkowe, e-mail sprawdzany, telefon dowolny tekst do 40 znaków. */
export function walidujKontakt(p: { name: string; role_label: string; phone: string; email: string }): Wynik<Kontakt> {
  const name = p.name.trim();
  if (!name || name.length > 120) return { ok: false, blad: "kontakt" };
  const email = p.email.trim();
  if (email && !czyEmail(email)) return { ok: false, blad: "email" };
  return { ok: true, dane: { name, role_label: lubNull(p.role_label.trim().slice(0, 60)), phone: lubNull(p.phone.trim().slice(0, 40)), email: lubNull(email) } };
}

/** Pole liczbowe godzin auto-akceptacji: puste = ustawienie globalne (72 h). */
export function walidujAkceptacje(fd: FormData): Wynik<Akceptacja> {
  const auto = fd.get("auto_approve_default") === "on";
  const godzinyTekst = pusty(fd.get("auto_approve_hours"));
  const godziny = godzinyTekst === "" ? null : Number(godzinyTekst);
  if (godziny !== null && (!Number.isInteger(godziny) || godziny < GODZINY_AUTO_MIN || godziny > GODZINY_AUTO_MAX)) return { ok: false, blad: "godzinyAuto" };
  const publikacja = pusty(fd.get("default_publish_hours"))
    .split(/[,\s;]+/)
    .filter(Boolean)
    .map(Number);
  if (publikacja.length < 1 || publikacja.length > 6 || publikacja.some((g) => !Number.isInteger(g) || g < 0 || g > 23)) return { ok: false, blad: "godzinyPublikacji" };
  return { ok: true, dane: { auto_approve_default: auto, auto_approve_hours: godziny, default_publish_hours: [...new Set(publikacja)].sort((a, b) => a - b) } };
}

/** Formularz „Nowy klient": dane, slug, opiekun, lokale i osoby w dynamicznych wierszach, przypisania zespołu. */
export function waliduj(fd: FormData, opiekunowie: ReadonlySet<string>, doPrzypisania: ReadonlySet<string> = new Set()): Wynik<DaneNowegoKlienta> {
  const dane = walidujDaneKlienta(fd);
  if (!dane.ok) return dane;
  const slug = pusty(fd.get("slug")) || slugZNazwy(dane.dane.name);
  if (!SLUG.test(slug) || slug.length < 2) return { ok: false, blad: "slug" };
  const opiekun = pusty(fd.get("opiekun_id"));

  const nazwyLokali = lista(fd, "lokal_name");
  const miasta = lista(fd, "lokal_city");
  const fb = lista(fd, "lokal_fb");
  const ig = lista(fd, "lokal_ig");
  const lokale: DaneNowegoKlienta["lokale"] = [];
  for (let i = 0; i < nazwyLokali.length; i++) {
    const pola = { name: nazwyLokali[i] ?? "", city: miasta[i] ?? "", fb_page_name: fb[i] ?? "", ig_handle: ig[i] ?? "" };
    if (!pola.name && !pola.fb_page_name && !pola.city && !pola.ig_handle) continue; // pusty wiersz
    const lokal = walidujLokal(pola);
    if (!lokal.ok) return lokal;
    lokale.push({ name: lokal.dane.name, city: lokal.dane.city, fb_page_name: lokal.dane.fb_page_name, ig_handle: lokal.dane.ig_handle });
  }
  if (lokale.length === 0) return { ok: false, blad: "lokal" };

  const imiona = lista(fd, "kontakt_name");
  const role = lista(fd, "kontakt_rola");
  const telefony = lista(fd, "kontakt_telefon");
  const maile = lista(fd, "kontakt_email");
  const kontakty: Kontakt[] = [];
  for (let i = 0; i < imiona.length; i++) {
    const pola = { name: imiona[i] ?? "", role_label: role[i] ?? "", phone: telefony[i] ?? "", email: maile[i] ?? "" };
    if (!pola.name && !pola.email && !pola.role_label && !pola.phone) continue;
    const kontakt = walidujKontakt(pola);
    if (!kontakt.ok) return kontakt;
    kontakty.push(kontakt.dane);
  }
  if (kontakty.length === 0) return { ok: false, blad: "kontakt" };

  const przypisani = [...new Set(lista(fd, "przypisany").filter((id) => doPrzypisania.has(id)))];

  return {
    ok: true,
    dane: { ...dane.dane, slug, opiekun_id: opiekun && opiekunowie.has(opiekun) ? opiekun : null, lokale, kontakty, przypisani },
  };
}

/**
 * Zmiana kategorii zmienia sens pakietów per lokal (kat1), `location_ids` postów (kat3) i wariantów reklam per lokal
 * (kat2 i kat3), a kat1 ma raporty per lokal. Dlatego wolno ją zmienić tylko klientowi bez pakietów i raportów.
 */
export function czyMoznaZmienicKategorie(p: { pakiety: number; raporty: number }): boolean {
  return p.pakiety === 0 && p.raporty === 0;
}
