import type { Database } from "@/lib/db-types";

/** Kształty danych dla stron klienta. Nigdy surowe wiersze z bazy (CLAUDE.md, zasada 13). */
export type StatusPakietu = Database["public"]["Enums"]["package_status"];

export type PakietDlaKlienta = {
  id: string;
  tytul: string;
  status: StatusPakietu;
  runda: number;
  liczbaPostow: number;
  liczbaRelacji: number;
  liczbaKampanii: number;
  wyslanoO: string | null;
  autoAkceptacjaO: string | null;
};

export type KlientDlaKlienta = { id: string; nazwa: string };
