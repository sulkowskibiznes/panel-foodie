/**
 * Filtr wstępny logowania zespołu (SPEC rozdz. 2): wpisy z „@" to dokładne adresy,
 * pozostałe to domeny. Prawdziwą listą dopuszczonych jest team_members.active.
 */
export function czyDozwolonyAdres(email: string, allowlist: string | undefined): boolean {
  const adres = email.trim().toLowerCase();
  const at = adres.lastIndexOf("@");
  if (at <= 0 || at === adres.length - 1) return false;
  const wpisy = (allowlist ?? "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  if (wpisy.length === 0) return true; // brak filtra = decyduje wyłącznie team_members.active
  const domena = adres.slice(at + 1);
  return wpisy.some((w) => (w.includes("@") ? w === adres : w === domena));
}
