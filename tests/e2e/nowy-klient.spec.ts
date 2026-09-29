import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { copy } from "../../src/lib/copy";
import { usunKlientaTestowego } from "./pomocnicze/klienci";
import { PLIK_SESJI_ZESPOLU } from "./pomocnicze/zespol";

/**
 * Faza 6: „Nowy klient" w panelu zespołu (admin i csm). Csm (Gosia) zakłada klienta z dwoma lokalami i jedną osobą
 * kontaktową, ląduje na karcie klienta i jest jego opiekunem. Zajęty slug daje komunikat, nie 500.
 */
test.use({ storageState: PLIK_SESJI_ZESPOLU });

type Klient = { id: string; slug: string; category: string; tier: string; monthly_amount_net: string | null; extra_locations_count: number; opiekun_email: string | null; lokale: number; kontakty: number; glowny: string | null };

async function klientPoSlugu(slug: string): Promise<Klient | null> {
  const s = postgres(process.env.E2E_DB_URL!, { max: 1 });
  try {
    const [w] = await s<Klient[]>`
      select c.id, c.slug, c.category::text as category, c.tier::text as tier, c.monthly_amount_net::text as monthly_amount_net, c.extra_locations_count,
        (select email from public.team_members t where t.id = c.opiekun_id) as opiekun_email,
        (select count(*)::int from public.locations l where l.client_id = c.id) as lokale,
        (select count(*)::int from public.client_contacts k where k.client_id = c.id) as kontakty,
        (select name from public.client_contacts k where k.client_id = c.id and k.is_primary) as glowny
      from public.clients c where c.slug = ${slug}`;
    return w ?? null;
  } finally {
    await s.end();
  }
}

test("csm zakłada klienta z formularza i trafia na jego kartę; zajęty slug daje komunikat", async ({ page }) => {
  const slug = `e2e-nowy-${test.info().project.name}`;
  const nazwa = `Nowy Klient ${test.info().project.name === "mobile-390" ? "Mobile" : "Desktop"} E2E`;
  const t = copy.zespol.nowyKlient;
  try {
    await page.goto("/zespol");
    await page.locator("[data-link-klientow]").click();
    await expect(page).toHaveURL("/zespol/klienci");
    await page.locator("[data-nowy-klient-link]").click();
    await expect(page.getByRole("heading", { level: 1, name: t.tytul })).toBeVisible();

    await page.locator("#name").fill(nazwa);
    await expect(page.locator("#slug")).toHaveValue(/^nowy-klient-/);
    await page.locator("#slug").fill(slug);
    await page.locator("#category").selectOption("kat2");
    await page.locator("#tier").selectOption("foodie_360");
    await page.locator("#monthly_amount_net").fill("3 800,00");
    await page.locator("#slack_channel").fill(`#${slug}`);
    await page.locator("#cooperation_started_on").fill("2026-09-20");
    // csm jest domyślnym opiekunem
    await expect(page.locator("#opiekun_id option:checked")).toHaveText("Gosia");

    await page.locator('[data-lokal="0"] input[name="lokal_name"]').fill(`${nazwa} Piotrkowska`);
    await page.locator('[data-lokal="0"] input[name="lokal_city"]').fill("Łódź");
    await page.locator('[data-lokal="0"] input[name="lokal_fb"]').fill(nazwa);
    await page.locator('[data-lokal="0"] input[name="lokal_ig"]').fill("@nowyklient");
    await page.locator("[data-dodaj-lokal]").click();
    await page.locator('[data-lokal="1"] input[name="lokal_name"]').fill(`${nazwa} Manufaktura`);
    await page.locator('[data-lokal="1"] input[name="lokal_fb"]').fill(nazwa);
    await page.locator('[data-kontakt="0"] input[name="kontakt_name"]').fill("Marek Testowy");
    await page.locator('[data-kontakt="0"] input[name="kontakt_rola"]').fill("właściciel");
    await page.locator('[data-kontakt="0"] input[name="kontakt_email"]').fill("marek@example.com");

    await page.locator("[data-utworz-klienta]").click();
    await expect(page).toHaveURL(`/zespol/klienci/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(nazwa);
    await expect(page.getByText(`${nazwa} Piotrkowska`).first()).toBeVisible();
    await expect(page.getByText("Marek Testowy")).toBeVisible();

    const klient = await klientPoSlugu(slug);
    expect(klient).toMatchObject({ category: "kat2", tier: "foodie_360", monthly_amount_net: "3800.00", extra_locations_count: 1, opiekun_email: "gosia@foodiemedia.pl", lokale: 2, kontakty: 1, glowny: "Marek Testowy" });

    // Dostęp od razu pozwala utworzyć link dla nowej osoby kontaktowej
    await page.goto(`/zespol/klienci/${slug}/dostep`);
    await expect(page.getByRole("button", { name: copy.zespol.dostep.utworz })).toBeVisible();

    // zajęty slug: komunikat zamiast błędu serwera
    await page.goto("/zespol/klienci/nowy");
    await page.locator("#name").fill("Duplikat");
    await page.locator("#slug").fill(slug);
    await page.locator('input[name="lokal_name"]').fill("Lokal");
    await page.locator('input[name="lokal_fb"]').fill("Lokal");
    await page.locator('input[name="kontakt_name"]').fill("Ktoś");
    await page.locator("[data-utworz-klienta]").click();
    await expect(page.getByRole("alert").filter({ hasText: t.bledy.slugZajety })).toBeVisible();
    await expect(page).toHaveURL("/zespol/klienci/nowy");
  } finally {
    await usunKlientaTestowego(slug);
  }
});
