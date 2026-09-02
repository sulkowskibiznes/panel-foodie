import { test as setup } from "@playwright/test";
import { OPIEKUN_E2E, PLIK_SESJI_ZESPOLU, zalogujZespol } from "./pomocnicze/zespol";

/** Jedno logowanie zespołu (OTP z Mailpita) na cały przebieg; testy dostają gotowy stan sesji. */
setup("logowanie zespołu", async ({ page }) => {
  await zalogujZespol(page, OPIEKUN_E2E);
  await page.context().storageState({ path: PLIK_SESJI_ZESPOLU });
});
