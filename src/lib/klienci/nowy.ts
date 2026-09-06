/**
 * Formularz „Nowy klient" (panel zespołu), czysta walidacja: z FormData do gotowych wierszy albo lista błędów.
 * Bez Next i bez bazy, żeby test jednostkowy sprawdził każdą regułę.
 */
import { z } from "zod";
import { czyEmail } from "@/lib/walidacja";

export const KATEGORIE = ["kat1", "kat2", "kat3"] as const;
export const TIERY = ["foodie_one", "foodie_360", "siec"] as const;

export type Kategoria = (typeof KATEGORIE)[number];
export type Tier = (typeof TIERY)[number];

export type DaneNowegoKlienta = {
  name: string;
  slug: string;
  category: Kategoria;
  tier: Tier;
  monthly_amount_net: number | null;
  slack_channel: string | null;
  cooperation_started_on: string | null;
  opiekun_id: string | null;
  lokale: Array<{ name: string; city: string | null; fb_page_name: string; ig_handle: string | null }>;
  kontakty: Array<{ name: string; role_label: string | null; phone: string | null; email: string | null }>;
};

export type BladNowegoKlienta = "nazwa" | "slug" | "kwota" | "lokal" | "kontakt" | "email" | "data";

export type WynikWalidacji = { ok: true; dane: DaneNowegoKlienta } | { ok: false; blad: BladNowegoKlienta };

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

export function waliduj(fd: FormData, opiekunowie: ReadonlySet<string>): WynikWalidacji {
  const name = pusty(fd.get("name"));
  if (!name || name.length > 120) return { ok: false, blad: "nazwa" };
  const slug = pusty(fd.get("slug")) || slugZNazwy(name);
  if (!SLUG.test(slug) || slug.length < 2) return { ok: false, blad: "slug" };
  const category = z.enum(KATEGORIE).safeParse(pusty(fd.get("category")));
  const tier = z.enum(TIERY).safeParse(pusty(fd.get("tier")));
  if (!category.success || !tier.success) return { ok: false, blad: "nazwa" };
  const kwotaTekst = pusty(fd.get("monthly_amount_net")).replace(",", ".").replace(/\s/g, "");
  const kwota = kwotaTekst === "" ? null : Number(kwotaTekst);
  if (kwota !== null && (!Number.isFinite(kwota) || kwota < 0)) return { ok: false, blad: "kwota" };
  const start = pusty(fd.get("cooperation_started_on"));
  if (start && !DATA.test(start)) return { ok: false, blad: "data" };
  const opiekun = pusty(fd.get("opiekun_id"));

  const nazwyLokali = lista(fd, "lokal_name");
  const miasta = lista(fd, "lokal_city");
  const fb = lista(fd, "lokal_fb");
  const ig = lista(fd, "lokal_ig");
  const lokale: DaneNowegoKlienta["lokale"] = [];
  for (let i = 0; i < nazwyLokali.length; i++) {
    const nazwa = nazwyLokali[i] ?? "";
    const strona = fb[i] ?? "";
    if (!nazwa && !strona && !(miasta[i] ?? "") && !(ig[i] ?? "")) continue; // pusty wiersz
    if (!nazwa || !strona) return { ok: false, blad: "lokal" };
    lokale.push({ name: nazwa, city: lubNull(miasta[i] ?? ""), fb_page_name: strona, ig_handle: lubNull((ig[i] ?? "").replace(/^@/, "")) });
  }
  if (lokale.length === 0) return { ok: false, blad: "lokal" };

  const imiona = lista(fd, "kontakt_name");
  const role = lista(fd, "kontakt_rola");
  const telefony = lista(fd, "kontakt_telefon");
  const maile = lista(fd, "kontakt_email");
  const kontakty: DaneNowegoKlienta["kontakty"] = [];
  for (let i = 0; i < imiona.length; i++) {
    const imie = imiona[i] ?? "";
    const email = maile[i] ?? "";
    if (!imie && !email && !(role[i] ?? "") && !(telefony[i] ?? "")) continue;
    if (!imie) return { ok: false, blad: "kontakt" };
    if (email && !czyEmail(email)) return { ok: false, blad: "email" };
    kontakty.push({ name: imie, role_label: lubNull(role[i] ?? ""), phone: lubNull(telefony[i] ?? ""), email: lubNull(email) });
  }
  if (kontakty.length === 0) return { ok: false, blad: "kontakt" };

  return {
    ok: true,
    dane: {
      name,
      slug,
      category: category.data,
      tier: tier.data,
      monthly_amount_net: kwota,
      slack_channel: lubNull(pusty(fd.get("slack_channel"))),
      cooperation_started_on: lubNull(start),
      opiekun_id: opiekun && opiekunowie.has(opiekun) ? opiekun : null,
      lokale,
      kontakty,
    },
  };
}
