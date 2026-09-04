"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { zapiszAudyt } from "@/lib/audyt";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { pobierzKlientaPoSlugu } from "@/lib/dane/klienci-zespolu";
import { utworzPakiet, type DaneKampanii } from "@/lib/dane/materialy-zespol";
import { czyLinkDoFolderu, rozpoznajLinkDysku } from "@/lib/drive/linki";
import { miesiacWspolpracy } from "@/lib/harmonogram/kalendarz";
import { czyUuid } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

const schemat = z.object({
  rok: z.number().int().min(2024).max(2100),
  miesiac: z.number().int().min(1).max(12),
  lokalId: z.string().nullable(),
  tytul: z.string().trim().min(1).max(160),
  folder: z.string().trim().max(500).nullable(),
  kampanie: z
    .array(z.object({ nazwa: z.string().trim().min(1).max(120), cel: z.enum(["sprzedaz", "ruch", "polubienia", "leady", "zasieg", "inne"]).nullable(), notatka: z.string().trim().max(500).nullable(), folder: z.string().trim().max(500).nullable() }))
    .max(10),
});

export type WynikKreatora = { ok: true; pakietId: string } | { ok: false; blad: string };

/** Kreator pakietu (SPEC rozdz. 12.3): pakiet w szkicu na wklejanych linkach; import z Dysku i karta weryfikacyjna w fazie 4. */
export async function utworzPakietAkcja(slug: string, dane: z.input<typeof schemat>): Promise<WynikKreatora> {
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, "materialy", "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  const parsed = schemat.safeParse(dane);
  if (!parsed.success) return { ok: false, blad: copy.zespol.materialy.bledy.zle_dane };
  const d = parsed.data;
  const k = copy.zespol.kreator;
  if (klient.category === "kat1" && (!d.lokalId || !czyUuid(d.lokalId) || !klient.locations.some((l) => l.id === d.lokalId))) return { ok: false, blad: k.bledy.brakLokalu };
  const folder = d.folder ? rozpoznajLinkDysku(d.folder) : null;
  if (d.folder && !czyLinkDoFolderu(folder)) return { ok: false, blad: k.bledy.zlyLink };
  const kampanie: DaneKampanii[] = [];
  for (const kamp of d.kampanie) {
    const link = kamp.folder ? rozpoznajLinkDysku(kamp.folder) : null;
    if (kamp.folder && !czyLinkDoFolderu(link)) return { ok: false, blad: k.bledy.zlyLink };
    kampanie.push({ nazwa: kamp.nazwa, cel: kamp.cel, notatka: kamp.notatka || null, folderReklamUrl: link?.url ?? null, folderReklamId: link?.id ?? null });
  }
  const w = await utworzPakiet(
    klient.id,
    {
      rok: d.rok,
      miesiac: d.miesiac,
      lokalId: klient.category === "kat1" ? d.lokalId : null,
      tytul: d.tytul,
      miesiacWspolpracy: miesiacWspolpracy(klient.cooperation_started_on, d.rok, d.miesiac),
      folderContentuUrl: folder?.url ?? null,
      folderContentuId: folder?.id ?? null,
      kampanie,
    },
    { rodzaj: "zespol", memberId: czlonek.id, name: czlonek.name },
  );
  if (!w.ok) return { ok: false, blad: copy.zespol.materialy.bledy[w.powod] };
  const { ipHash, ua } = await infoZadania();
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.pakiet_utworzony", entity: "package", entity_id: w.pakietId, client_id: klient.id, ip_hash: ipHash, ua, meta: { okres: `${d.rok}-${String(d.miesiac).padStart(2, "0")}`, kampanie: kampanie.length, folder_contentu: folder?.id ?? null } });
  revalidatePath(`/zespol/klienci/${slug}/materialy`);
  revalidatePath("/zespol");
  return { ok: true, pakietId: w.pakietId };
}
