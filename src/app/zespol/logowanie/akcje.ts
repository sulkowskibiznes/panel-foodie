"use server";

import { redirect } from "next/navigation";
import { zapiszAudyt } from "@/lib/audyt";
import { czyMozeSieZalogowac, klientAuthZespolu, znajdzCzlonka } from "@/lib/auth-zespol";
import { copy } from "@/lib/copy";
import { zwiekszLicznik } from "@/lib/limity";
import { czyEmail } from "@/lib/walidacja";
import { infoZadania } from "@/lib/zadanie";

export type StanLogowania = { etap: "email" | "kod"; email?: string; blad?: string; info?: string };

const LIMIT_OTP_IP = { max: 10, oknoSekund: 600 };

/** Krok 1: e-mail. Odpowiedź jest taka sama niezależnie od tego, czy adres jest na liście. */
export async function wyslijKod(_poprzedni: StanLogowania, formData: FormData): Promise<StanLogowania> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!czyEmail(email)) return { etap: "email", blad: copy.zespol.logowanie.zlyKod };
  const { ipHash, ua } = await infoZadania();
  if ((await zwiekszLicznik(`otp:ip:${ipHash}`, LIMIT_OTP_IP.oknoSekund)) > LIMIT_OTP_IP.max) {
    return { etap: "email", blad: copy.zespol.logowanie.zbytWiele };
  }
  if (await czyMozeSieZalogowac(email)) {
    const auth = await klientAuthZespolu();
    const { error } = await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) console.error("[zespol] signInWithOtp", error.message);
  } else {
    await zapiszAudyt({ actor_kind: "zespol", actor_label: email, action: "zespol.logowanie_blad", ip_hash: ipHash, ua, meta: { powod: "niedozwolony_adres" } });
  }
  return { etap: "kod", email, info: copy.zespol.logowanie.kodWyslany };
}

/** Krok 2: kod z e-maila. Sesję Supabase ustawia klient SSR w cookies. */
export async function zweryfikujKod(_poprzedni: StanLogowania, formData: FormData): Promise<StanLogowania> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const kod = String(formData.get("kod") ?? "").replace(/\s/g, "");
  const { ipHash, ua } = await infoZadania();
  if (!czyEmail(email) || !/^\d{6}$/.test(kod)) return { etap: "kod", email, blad: copy.zespol.logowanie.zlyKod };

  const auth = await klientAuthZespolu();
  const { data, error } = await auth.auth.verifyOtp({ email, token: kod, type: "email" });
  if (error || !data.user) {
    await zapiszAudyt({ actor_kind: "zespol", actor_label: email, action: "zespol.logowanie_blad", ip_hash: ipHash, ua, meta: { powod: "zly_kod" } });
    return { etap: "kod", email, blad: copy.zespol.logowanie.zlyKod };
  }
  const czlonek = await znajdzCzlonka(data.user);
  if (!czlonek) {
    await auth.auth.signOut();
    await zapiszAudyt({ actor_kind: "zespol", actor_label: email, action: "zespol.logowanie_blad", ip_hash: ipHash, ua, meta: { powod: "brak_na_liscie" } });
    return { etap: "email", blad: copy.zespol.logowanie.zlyKod };
  }
  await zapiszAudyt({ actor_kind: "zespol", actor_id: czlonek.id, actor_label: czlonek.name, action: "zespol.logowanie_ok", ip_hash: ipHash, ua });
  redirect("/zespol");
}
