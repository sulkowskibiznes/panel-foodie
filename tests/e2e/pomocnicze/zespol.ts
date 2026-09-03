import { expect, type Page } from "@playwright/test";
import { copy } from "../../../src/lib/copy";

/** Stan sesji zespołu zapisany przez projekt przygotowawczy (jedno logowanie OTP na przebieg). */
export const PLIK_SESJI_ZESPOLU = "tests/e2e/.auth/zespol.json";
export const OPIEKUN_E2E = "gosia@foodiemedia.pl";

type Wiadomosc = { ID: string; Created: string; To: { Address: string }[] };

function mailpit(): string {
  return process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
}

/** Kod OTP z Mailpita (lokalny SMTP Supabase). Czeka do 20 s na wiadomość wysłaną po `od`. */
export async function pobierzKodZMailpita(email: string, od: number): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < 20_000) {
    const odp = await fetch(`${mailpit()}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=5`);
    if (odp.ok) {
      const dane = (await odp.json()) as { messages?: Wiadomosc[] };
      const swieze = (dane.messages ?? []).filter((m) => new Date(m.Created).getTime() >= od - 5_000).sort((a, b) => b.Created.localeCompare(a.Created));
      const pierwsza = swieze[0];
      if (pierwsza) {
        const tresc = (await (await fetch(`${mailpit()}/api/v1/message/${pierwsza.ID}`)).json()) as { Text?: string; HTML?: string };
        const kod = /\b(\d{6,10})\b/.exec(tresc.Text ?? tresc.HTML ?? "")?.[1];
        if (kod) {
          await fetch(`${mailpit()}/api/v1/messages`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ IDs: [pierwsza.ID] }) }).catch(() => undefined);
          return kod;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Nie dotarł kod OTP dla ${email} (Mailpit ${mailpit()})`);
}

/** Logowanie członka zespołu przez UI: e-mail → kod z Mailpita → pulpit. */
export async function zalogujZespol(page: Page, email: string): Promise<void> {
  const l = copy.zespol.logowanie;
  const od = Date.now();
  await page.goto("/zespol/logowanie");
  // Klik przed hydracją Reacta wysyła formularz dwa razy (natywnie i po odtworzeniu), a GoTrue odrzuca drugi kod limitem częstotliwości.
  await page.waitForLoadState("networkidle");
  await page.getByLabel(l.email).fill(email);
  await page.getByRole("button", { name: l.wyslijKod }).click();
  await expect(page.getByLabel(l.kod)).toBeVisible();
  const kod = await pobierzKodZMailpita(email, od);
  await page.getByLabel(l.kod).fill(kod);
  await page.getByRole("button", { name: l.zaloguj }).click();
  await page.waitForURL(/\/zespol$/);
  await expect(page.getByRole("heading", { level: 1, name: copy.zespol.pulpit.tytul })).toBeVisible();
}
