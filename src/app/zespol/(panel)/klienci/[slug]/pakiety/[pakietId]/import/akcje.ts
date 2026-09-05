"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia, type CzlonekZespolu } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { ostatniaSeria, pobierzPakietDoImportu, stanImportuPakietu, type PakietDoImportuDto } from "@/lib/dane/import";
import { pobierzKlientaPoSlugu, type KartaKlienta } from "@/lib/dane/klienci-zespolu";
import { edytujKampanie, edytujPakiet, type AktorZespolu } from "@/lib/dane/materialy-zespol";
import { konfiguracjaDysku } from "@/lib/drive/klient";
import { czyLinkDoFolderu, rozpoznajLinkDysku } from "@/lib/drive/linki";
import type { KartaWeryfikacyjna, Propozycja, StanImportu } from "@/lib/dto/import";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { zbudujPropozycje } from "@/lib/import/mapowanie";
import { planSchemat } from "@/lib/import/plan";
import { zbudujKartyPakietu } from "@/lib/import/weryfikacja";
import { przygotujWznowienie, rozpocznijImport, uruchomImportPakietu, type PowodOdmowy } from "@/lib/import/zadania";
import { pobierzPakietDoPrzejscia } from "@/lib/pakiety/baza";
import { supabaseSerwer } from "@/lib/supabase/server";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

/**
 * Akcje ekranu importu (SPEC rozdz. 13): zapis linku, karta weryfikacyjna, propozycja mapowania, start importu
 * w tle (`after`), odczyt stanu i wznowienie. Wszystko dla `materialy: pelne` i tylko dla widocznego klienta.
 */
type Kontekst = { czlonek: CzlonekZespolu; klient: KartaKlienta; pakiet: PakietDoImportuDto };

async function autoryzuj(slug: string, pakietId: string): Promise<Kontekst> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "materialy", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient || !czyUuid(pakietId)) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const pakiet = await pobierzPakietDoImportu(pakietId);
  if (!pakiet || pakiet.clientId !== klient.id) notFound();
  return { czlonek, klient, pakiet };
}

function aktor(c: CzlonekZespolu): AktorZespolu {
  return { rodzaj: "zespol", memberId: c.id, name: c.name };
}

function odswiez(slug: string, pakietId: string) {
  revalidatePath(`/zespol/klienci/${slug}/pakiety/${pakietId}/import`);
  revalidatePath(`/zespol/klienci/${slug}/pakiety/${pakietId}`);
  revalidatePath(`/zespol/klienci/${slug}/materialy`);
}

const schematCelu = z.discriminatedUnion("rodzaj", [z.object({ rodzaj: z.literal("content") }), z.object({ rodzaj: z.literal("reklamy"), kampaniaId: z.string().uuid() })]);

/** Zmiana linku do folderu wprost z karty weryfikacyjnej (content albo reklamy kampanii); pusty = bez folderu. */
export async function zapiszLinkAkcja(slug: string, pakietId: string, cel: z.input<typeof schematCelu>, url: string | null): Promise<WynikAkcji> {
  const k = await autoryzuj(slug, pakietId);
  const parsed = schematCelu.safeParse(cel);
  if (!parsed.success) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const tekst = (url ?? "").trim().slice(0, 500) || null;
  const link = tekst ? rozpoznajLinkDysku(tekst) : null;
  if (tekst && !czyLinkDoFolderu(link)) return { ok: false, blad: copy.zespol.kreator.bledy.zlyLink };
  const cel2 = parsed.data;
  if (cel2.rodzaj === "content") {
    await edytujPakiet(pakietId, { folderContentuUrl: link?.url ?? null, folderContentuId: link?.id ?? null });
  } else {
    const kampaniaId = cel2.kampaniaId;
    const kampania = k.pakiet.kampanie.find((x) => x.id === kampaniaId);
    if (!kampania) return { ok: false, blad: copy.zespol.import.bledy.brak_kampanii };
    const pakiet = await pobierzPakietDoPrzejscia(pakietId);
    if (!pakiet) notFound();
    const { data } = await supabaseSerwer().from("campaigns").select("name, goal, note").eq("id", kampania.id).single();
    const w = await edytujKampanie(pakiet, kampania.id, { nazwa: data?.name ?? kampania.nazwa, cel: data?.goal ?? null, notatka: data?.note ?? null, folderReklamUrl: link?.url ?? null, folderReklamId: link?.id ?? null }, aktor(k.czlonek), true);
    if (!w.ok) return { ok: false, blad: copy.zespol.materialy.bledy[w.powod] };
  }
  odswiez(slug, pakietId);
  return { ok: true };
}

export type WynikMapowania = { ok: true; karty: KartaWeryfikacyjna[]; propozycje: Propozycja[] } | { ok: false; blad: string };

/** Krok 2: ponowna weryfikacja wybranych folderów i propozycja „grafika ↔ opis" dla każdego z nich. */
export async function przygotujMapowanieAkcja(slug: string, pakietId: string, folderIds: string[]): Promise<WynikMapowania> {
  const k = await autoryzuj(slug, pakietId);
  const konf = konfiguracjaDysku();
  if (!konf) return { ok: false, blad: copy.zespol.import.bledy.nie_skonfigurowany };
  if (k.pakiet.status !== "szkic") return { ok: false, blad: copy.zespol.import.bledy.tylko_szkic };
  const wybrane = new Set(Array.isArray(folderIds) ? folderIds.filter((x): x is string => typeof x === "string") : []);
  const karty = (await zbudujKartyPakietu(konf, k.klient, k.pakiet)).filter((c) => c.folderId && wybrane.has(c.folderId));
  const propozycje: Propozycja[] = [];
  for (const karta of karty) {
    if (karta.stan !== "ok" || karta.blad) continue;
    const p = await zbudujPropozycje(konf, karta, { slug, pakietId });
    if (p) propozycje.push(p);
  }
  if (propozycje.length === 0) return { ok: false, blad: copy.zespol.import.dalejBrak };
  return { ok: true, karty, propozycje };
}

const schematStartu = z.object({ plany: z.array(planSchemat).min(1).max(20), zignorowane: z.array(z.string().max(200)).max(20) });

const KOMUNIKATY_ODMOWY: Record<PowodOdmowy, string> = {
  tylko_szkic: copy.zespol.import.bledy.tylko_szkic,
  zablokowany: copy.zespol.import.bledy.zablokowany,
  zle_dane: copy.zespol.import.bledy.zle_dane,
  nic_do_importu: copy.zespol.import.bledy.nic_do_importu,
  w_toku: copy.zespol.import.bledy.w_toku,
  nie_skonfigurowany: copy.zespol.import.bledy.nie_skonfigurowany,
  brak_kampanii: copy.zespol.import.bledy.brak_kampanii,
};

/** Krok 3: zadania z potwierdzonym planem i worker w tle po odesłaniu odpowiedzi. */
export async function rozpocznijImportAkcja(slug: string, pakietId: string, dane: z.input<typeof schematStartu>): Promise<WynikAkcji> {
  const k = await autoryzuj(slug, pakietId);
  const konf = konfiguracjaDysku();
  if (!konf) return { ok: false, blad: copy.zespol.import.bledy.nie_skonfigurowany };
  const parsed = schematStartu.safeParse(dane);
  if (!parsed.success) return { ok: false, blad: copy.zespol.import.bledy.zle_dane };
  const foldery = new Set(parsed.data.plany.map((p) => p.folderId));
  const karty = (await zbudujKartyPakietu(konf, k.klient, k.pakiet)).filter((c) => c.folderId && foldery.has(c.folderId));
  const { ipHash, ua } = await infoZadania();
  const w = await rozpocznijImport({ id: k.pakiet.id, clientId: k.klient.id, slug, status: k.pakiet.status }, { plany: parsed.data.plany, karty, zignorowane: parsed.data.zignorowane, aktor: aktor(k.czlonek), ipHash, ua });
  if (!w.ok) return { ok: false, blad: KOMUNIKATY_ODMOWY[w.powod] };
  after(() => uruchomImportPakietu(pakietId));
  odswiez(slug, pakietId);
  return { ok: true };
}

/** Odczyt stanu do paska postępu. Zadanie „oczekuje" starsze niż pół minuty nie ma workera: dokładamy go. */
export async function stanImportuAkcja(slug: string, pakietId: string): Promise<StanImportu> {
  await autoryzuj(slug, pakietId);
  const stan = ostatniaSeria(await stanImportuPakietu(pakietId));
  const osierocone = stan.zadania.some((z) => z.status === "oczekuje" && Date.now() - new Date(z.utworzonoO).getTime() > 30_000);
  if (osierocone) after(() => uruchomImportPakietu(pakietId));
  return stan;
}

export async function wznowImportAkcja(slug: string, pakietId: string, jobId: string): Promise<WynikAkcji> {
  const k = await autoryzuj(slug, pakietId);
  if (!czyUuid(jobId)) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const ok = await przygotujWznowienie(jobId, pakietId, aktor(k.czlonek));
  if (!ok) return { ok: false, blad: copy.zespol.materialy.bledy.ogolny };
  after(() => uruchomImportPakietu(pakietId));
  odswiez(slug, pakietId);
  return { ok: true };
}
