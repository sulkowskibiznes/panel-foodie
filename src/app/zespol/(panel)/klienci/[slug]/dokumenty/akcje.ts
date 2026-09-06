"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { zapiszAudyt } from "@/lib/audyt";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia, type CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { dodajDokument as dodajDokumentDoBazy, pobierzDokument, usunDokument as usunDokumentZBazy } from "@/lib/dane/dokumenty";
import { pobierzKlientaPoSlugu, type KartaKlienta } from "@/lib/dane/klienci-zespolu";
import type { RodzajDokumentu } from "@/lib/dto/klient";
import { czyPoprawnaDataLokalna } from "@/lib/harmonogram/kalendarz";
import { odczytajOpisPdf } from "@/lib/pliki/pdf";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

const RODZAJE: RodzajDokumentu[] = ["umowa", "aneks", "powierzenie", "inne"];

async function autoryzuj(slug: string): Promise<{ czlonek: CzlonekZespolu; klient: KartaKlienta }> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "dokumenty", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  return { czlonek, klient };
}

export type DaneDokumentu = { rodzaj: string; tytul: string; obowiazujeOd: string; opisPdf: string | null };
export type WynikDokumentu = { ok: true } | { ok: false; blad: string };

/** „Dodaj dokument" (SPEC rozdz. 10, 17): rodzaj, tytuł, data, PDF wyłącznie z podpisanego opisu. */
export async function dodajDokument(slug: string, dane: DaneDokumentu): Promise<WynikDokumentu> {
  const { czlonek, klient } = await autoryzuj(slug);
  const b = copy.zespol.dokumenty.bledy;
  const rodzaj = RODZAJE.includes(dane.rodzaj as RodzajDokumentu) ? (dane.rodzaj as RodzajDokumentu) : "inne";
  const tytul = String(dane.tytul ?? "").trim().slice(0, 200);
  if (!tytul) return { ok: false, blad: b.tytul };
  const obowiazujeOd = String(dane.obowiazujeOd ?? "").trim();
  if (obowiazujeOd && !czyPoprawnaDataLokalna(obowiazujeOd)) return { ok: false, blad: b.ogolny };
  const opis = dane.opisPdf ? odczytajOpisPdf("dokumenty", klient.id, String(dane.opisPdf)) : null;
  if (!opis) return { ok: false, blad: b.plik };
  try {
    const id = await dodajDokumentDoBazy({ clientId: klient.id, rodzaj, tytul, obowiazujeOd: obowiazujeOd || null, filePath: opis.sciezka, uploadedBy: czlonek.id });
    const { ipHash } = await infoZadania();
    await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.dokument_dodany", entity: "document", entity_id: id, client_id: klient.id, ip_hash: ipHash, meta: { kind: rodzaj, tytul, nazwa: opis.nazwa } });
  } catch (blad) {
    console.error("[dokumenty] dodajDokument", blad instanceof Error ? blad.message : blad);
    return { ok: false, blad: b.ogolny };
  }
  revalidatePath(`/zespol/klienci/${slug}/dokumenty`);
  return { ok: true };
}

export async function usunDokument(slug: string, dokumentId: string): Promise<WynikDokumentu> {
  const { czlonek, klient } = await autoryzuj(slug);
  const b = copy.zespol.dokumenty.bledy;
  if (!czyUuid(dokumentId)) return { ok: false, blad: b.ogolny };
  const dokument = await pobierzDokument(dokumentId);
  if (!dokument || dokument.clientId !== klient.id || !(await usunDokumentZBazy(dokumentId, klient.id))) return { ok: false, blad: b.ogolny };
  const { ipHash } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.dokument_usuniety", entity: "document", entity_id: dokumentId, client_id: klient.id, ip_hash: ipHash, meta: { tytul: dokument.tytul } });
  revalidatePath(`/zespol/klienci/${slug}/dokumenty`);
  return { ok: true };
}
