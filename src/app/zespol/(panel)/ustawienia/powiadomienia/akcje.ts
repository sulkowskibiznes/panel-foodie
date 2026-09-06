"use server";

import { revalidatePath } from "next/cache";
import { zapiszAudyt } from "@/lib/audyt";
import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { ponowPowiadomienie as ponowWBazie } from "@/lib/dane/powiadomienia";

/** „Ponów" (SPEC rozdz. 15): nieudane zdarzenie wraca do kolejki; tylko admin. */
export async function ponowPowiadomienie(id: number): Promise<{ ok: boolean }> {
  const admin = await wymagajCzlonka();
  wymagajUprawnienia(admin, "ustawienia", "pelne");
  if (!Number.isInteger(id) || id <= 0) return { ok: false };
  const ok = await ponowWBazie(id);
  if (ok) await zapiszAudyt({ actor_kind: "zespol", actor_id: admin.id, actor_label: admin.name, action: "zespol.powiadomienie_ponowione", entity: "outbox", meta: { outbox_id: id } });
  revalidatePath("/zespol/ustawienia/powiadomienia");
  return { ok };
}
