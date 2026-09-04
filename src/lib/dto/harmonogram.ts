import type { CelKampanii, StatusPakietu, TypMaterialu } from "@/lib/dto/materialy";

/** Harmonogram miesiąca (SPEC rozdz. 8) dla zespołu (przeciąganie) i klienta (tylko odczyt). Nigdy surowe wiersze. */
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

export type PakietWKalendarzu = { id: string; tytul: string; status: StatusPakietu; runda: number; nazwaLokalu: string | null; koniecOkresu: string | null };

export type HarmonogramMiesiaca = {
  rok: number;
  miesiac: number;
  pakiety: PakietWKalendarzu[];
  materialy: MaterialWKalendarzu[];
  kampanie: KampaniaWKalendarzu[];
  /** Domyślne godziny publikacji klienta (clients.default_publish_hours). */
  domyslneGodziny: number[];
  /** Miesiące, w których klient ma pakiety (nawigacja). */
  miesiaceZPakietami: string[];
};
