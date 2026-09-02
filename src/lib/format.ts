/** Formatowanie dat i odliczania po polsku, zawsze w strefie Europe/Warsaw. */
const STREFA = "Europe/Warsaw";

export function formatujDate(iso: string | Date, opcje: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  return new Intl.DateTimeFormat("pl-PL", { timeZone: STREFA, ...opcje }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatujDateCzas(iso: string | Date): string {
  return formatujDate(iso, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export const NAZWY_MIESIECY = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"] as const;

export function etykietaOkresu(rok: number, miesiac: number): string {
  return `${NAZWY_MIESIECY[miesiac - 1] ?? ""} ${rok}`;
}

function odmien(n: number, jeden: string, kilka: string, wiele: string): string {
  const r10 = n % 10;
  const r100 = n % 100;
  if (n === 1) return jeden;
  if (r10 >= 2 && r10 <= 4 && (r100 < 12 || r100 > 14)) return kilka;
  return wiele;
}

export function liczebnik(n: number, jeden: string, kilka: string, wiele: string): string {
  return `${n} ${odmien(n, jeden, kilka, wiele)}`;
}

/** „za 2 dni 4 godz.", „za 5 godz.", „za 30 min", „minął termin". */
export function tekstOdliczania(do_: string | Date, teraz: Date = new Date()): string {
  const ms = (typeof do_ === "string" ? new Date(do_) : do_).getTime() - teraz.getTime();
  if (ms <= 0) return "minął termin";
  const minuty = Math.ceil(ms / 60_000);
  if (minuty < 60) return `za ${minuty} min`;
  const godziny = Math.floor(minuty / 60);
  if (godziny < 24) return `za ${liczebnik(godziny, "godz.", "godz.", "godz.")}`;
  const dni = Math.floor(godziny / 24);
  const reszta = godziny % 24;
  const dniTekst = liczebnik(dni, "dzień", "dni", "dni");
  return reszta > 0 ? `za ${dniTekst} ${reszta} godz.` : `za ${dniTekst}`;
}

export function formatujKwote(kwota: number | null | undefined): string {
  if (kwota === null || kwota === undefined) return "";
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(kwota);
}
