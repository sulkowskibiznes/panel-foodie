import type { CelKampanii, StatusPakietu, TypMaterialu } from "@/lib/dto/materialy";
import type { Okres } from "@/lib/harmonogram/kalendarz";

/** Harmonogram okresu pakietu (SPEC rozdz. 8) dla zespołu (przeciąganie) i klienta (tylko odczyt). Nigdy surowe wiersze. */
export type MaterialWKalendarzu = {
  id: string;
  pakietId: string;
  typ: TypMaterialu;
  tytul: string;
  pozycja: number;
  publikacjaO: string | null;
  /** Dzień publikacji w Europe/Warsaw (YYYY-MM-DD) albo null. */
  data: string | null;
  /** Godzina publikacji (HH:MM) albo null. */
  godzina: string | null;
  thumbUrl: string | null;
  statusPakietu: StatusPakietu;
  nazwaLokalu: string | null;
};

export type KampaniaWKalendarzu = { id: string; pakietId: string; nazwa: string; cel: CelKampanii | null; notatka: string | null; statusPakietu: StatusPakietu };

export type PakietWKalendarzu = { id: string; tytul: string; status: StatusPakietu; runda: number; nazwaLokalu: string | null; /** Okres od-do (YYYY-MM-DD). */ okres: Okres };

/** Harmonogram okresu pakietu: pakiet ogniskowy, pakiety klienta zachodzące na jego okres (kat1: po jednym na lokal), ich materiały i kampanie. */
export type HarmonogramOkresu = {
  pakiet: PakietWKalendarzu;
  pakiety: PakietWKalendarzu[];
  materialy: MaterialWKalendarzu[];
  kampanie: KampaniaWKalendarzu[];
  /** Domyślne godziny publikacji klienta (clients.default_publish_hours). */
  domyslneGodziny: number[];
  /** Poprzedni i następny pakiet klienta po dacie startu (nawigacja). */
  nawigacja: { poprzedniId: string | null; nastepnyId: string | null };
};
