/**
 * Cron auto-akceptacji (SPEC rozdz. 6.4, 15; kryterium 11). Biegnie co godzinę o pełnej godzinie.
 * Czysta logika z wstrzykiwanymi zależnościami; trasa /api/cron/auto-akceptacja tylko ją woła.
 *
 * Dla każdego pakietu w `do_akceptacji`:
 * 1. termin minął → przejście `auto_akceptuj` przez maszynę stanów; gdy maszyna odmawia z powodu
 *    nierozwiązanych uwag klienta, raz na rundę zapisuje `auto_wstrzymana` i `pakiet.auto_wstrzymana_uwagi`
 *    (pulpit pokazuje ten stan osobno, 1.4 poz. 26),
 * 2. do terminu zostały 24 h albo mniej → raz na rundę `pakiet.auto_za_24h`,
 * 3. 24 h od wysyłki bez otwarcia → raz na rundę `pakiet.nieotwarty_po_24h`.
 * Deduplikacja po tabeli `outbox` (event + package_id + round), bez dodatkowych kolumn.
 */
import { czyOstatnieDobra, MS_24H } from "@/lib/pakiety/auto-akceptacja";
import { zbudujPayloadOutbox, type Aktor, type NoweZdarzenie, type PakietDoPrzejscia, type WynikPrzejscia } from "@/lib/pakiety/przejscia";
import type { ZdarzenieOutbox } from "@/lib/zdarzenia";

export type PakietWCronie = PakietDoPrzejscia & { firstOpenedAt: string | null };

export type ZaleznosciCrona = {
  pobierzDoAkceptacji(): Promise<PakietWCronie[]>;
  /** Przejście `auto_akceptuj` przez maszynę stanów (lib/pakiety/przejscia.ts). */
  autoAkceptuj(pakietId: string, aktor: Aktor): Promise<WynikPrzejscia>;
  /** Czy zdarzenie dla (pakiet, runda) już trafiło do outbox. */
  czyWyslano(event: ZdarzenieOutbox, pakietId: string, runda: number): Promise<boolean>;
  dodajDoOutbox(event: ZdarzenieOutbox, payload: Record<string, unknown>): Promise<void>;
  dodajZdarzenie(zdarzenie: NoweZdarzenie): Promise<void>;
  adresPakietu(pakiet: PakietDoPrzejscia): string;
  teraz(): Date;
};

export type WynikCrona = {
  sprawdzone: number;
  zaakceptowane: string[];
  wstrzymane: string[];
  za24h: string[];
  nieotwarte: string[];
  bledy: Array<{ pakietId: string; powod: string }>;
};

const SYSTEM: Aktor = { rodzaj: "system" };

async function razNaRunde(d: ZaleznosciCrona, event: ZdarzenieOutbox, p: PakietWCronie, dodatkowe: Record<string, unknown> = {}): Promise<boolean> {
  if (await d.czyWyslano(event, p.id, p.round)) return false;
  await d.dodajDoOutbox(event, zbudujPayloadOutbox(event, p, SYSTEM, p.round, d.adresPakietu(p), dodatkowe));
  return true;
}

export async function uruchomCronAutoAkceptacji(d: ZaleznosciCrona): Promise<WynikCrona> {
  const teraz = d.teraz();
  const pakiety = await d.pobierzDoAkceptacji();
  const wynik: WynikCrona = { sprawdzone: pakiety.length, zaakceptowane: [], wstrzymane: [], za24h: [], nieotwarte: [], bledy: [] };

  for (const p of pakiety) {
    try {
      if (p.submittedAt && p.firstOpenedAt === null && teraz.getTime() - new Date(p.submittedAt).getTime() >= MS_24H) {
        if (await razNaRunde(d, "pakiet.nieotwarty_po_24h", p)) wynik.nieotwarte.push(p.id);
      }

      if (!p.autoApproveEnabled || !p.autoApproveAt) continue;
      const termin = new Date(p.autoApproveAt);

      if (termin.getTime() <= teraz.getTime()) {
        const r = await d.autoAkceptuj(p.id, SYSTEM);
        if (r.ok) {
          wynik.zaakceptowane.push(p.id);
        } else if (r.powod === "nierozwiazane_uwagi") {
          const uwagi = r.uwagi ?? 0;
          if (!(await d.czyWyslano("pakiet.auto_wstrzymana_uwagi", p.id, p.round))) {
            await d.dodajZdarzenie({ package_id: p.id, kind: "auto_wstrzymana", actor_kind: "system", actor_id: null, payload: { round: p.round, uwagi, termin: p.autoApproveAt } });
            await d.dodajDoOutbox("pakiet.auto_wstrzymana_uwagi", zbudujPayloadOutbox("pakiet.auto_wstrzymana_uwagi", p, SYSTEM, p.round, d.adresPakietu(p), { uwagi }));
          }
          wynik.wstrzymane.push(p.id);
        } else {
          wynik.bledy.push({ pakietId: p.id, powod: r.powod });
        }
        continue;
      }

      if (czyOstatnieDobra(termin, teraz)) {
        if (await razNaRunde(d, "pakiet.auto_za_24h", p, { auto_approve_at: p.autoApproveAt })) wynik.za24h.push(p.id);
      }
    } catch (blad) {
      wynik.bledy.push({ pakietId: p.id, powod: blad instanceof Error ? blad.message : String(blad) });
    }
  }
  return wynik;
}
