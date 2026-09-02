"use server";

import { revalidatePath } from "next/cache";
import { czyDozwolonyAdres } from "@/lib/allowlista";
import { zapiszAudyt } from "@/lib/audyt";
import { wymagajCzlonka, wymagajUprawnienia } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import type { Database } from "@/lib/db-types";
import { env } from "@/lib/env";
import { supabaseSerwer } from "@/lib/supabase/server";
import { czyEmail, czyUuid } from "@/lib/walidacja";

export type StanCzlonka = { blad?: string; ok?: boolean };

const ROLE: Database["public"]["Enums"]["team_role"][] = ["admin", "csm", "content_creator", "media_buyer", "sales"];

async function zapewnijUzytkownikaAuth(email: string, name: string): Promise<string> {
  const db = supabaseSerwer();
  const utworzony = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } });
  if (!utworzony.error && utworzony.data.user) return utworzony.data.user.id;
  const lista = await db.auth.admin.listUsers({ perPage: 1000 });
  const istniejacy = lista.data?.users.find((u) => u.email?.toLowerCase() === email);
  if (!istniejacy) throw new Error(utworzony.error?.message ?? "auth createUser");
  return istniejacy.id;
}

/** Dodanie osoby do zespołu = wpis na allowliście + konto w Supabase Auth (rejestracja publiczna jest wyłączona). */
export async function dodajCzlonka(_poprzedni: StanCzlonka, formData: FormData): Promise<StanCzlonka> {
  const admin = await wymagajCzlonka();
  wymagajUprawnienia(admin, "ustawienia", "pelne");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Database["public"]["Enums"]["team_role"];
  const b = copy.zespol.ustawienia.zespol.bledy;
  if (!name || !czyEmail(email) || !ROLE.includes(role)) return { blad: b.dane };
  if (!czyDozwolonyAdres(email, env().TEAM_EMAIL_ALLOWLIST)) return { blad: b.allowlista };
  const db = supabaseSerwer();
  const { data: istnieje } = await db.from("team_members").select("id").eq("email", email).maybeSingle();
  if (istnieje) return { blad: b.istnieje };
  try {
    const authId = await zapewnijUzytkownikaAuth(email, name);
    const { data, error } = await db.from("team_members").insert({ name, email, role, active: true, auth_user_id: authId }).select("id").single();
    if (error || !data) return { blad: b.ogolny };
    await zapiszAudyt({ actor_kind: "zespol", actor_id: admin.id, actor_label: admin.name, action: "zespol.czlonek_dodany", entity: "team_member", entity_id: data.id, meta: { email, role } });
  } catch (e) {
    console.error("[zespol] dodajCzlonka", e instanceof Error ? e.message : e);
    return { blad: b.ogolny };
  }
  revalidatePath("/zespol/ustawienia/zespol");
  return { ok: true };
}

export async function przelaczAktywnosc(id: string, active: boolean): Promise<void> {
  const admin = await wymagajCzlonka();
  wymagajUprawnienia(admin, "ustawienia", "pelne");
  if (!czyUuid(id) || id === admin.id) return;
  await supabaseSerwer().from("team_members").update({ active }).eq("id", id);
  await zapiszAudyt({ actor_kind: "zespol", actor_id: admin.id, actor_label: admin.name, action: "zespol.czlonek_zmieniony", entity: "team_member", entity_id: id, meta: { active } });
  revalidatePath("/zespol/ustawienia/zespol");
}
