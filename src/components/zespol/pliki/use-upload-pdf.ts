"use client";

import { useCallback, useState } from "react";
import { wyslijDoStorage } from "@/components/zespol/materialy/use-upload-pliku";
import { copy } from "@/lib/copy";
import { formatujMB, MAKS_BAJTOW_PDF } from "@/lib/pliki/magia";
import type { WynikPrzygotowaniaPdf, WynikZakonczeniaPdf } from "@/lib/pliki/pdf";

export type StanUploaduPdf =
  | { faza: "brak" }
  | { faza: "wysylanie"; procent: number; nazwa: string }
  | { faza: "sprawdzanie"; nazwa: string }
  | { faza: "gotowy"; nazwa: string; opis: string }
  | { faza: "blad"; komunikat: string };

export type AkcjeUploaduPdf = {
  przygotuj: (plik: { nazwa: string; mime: string; bytes: number }) => Promise<WynikPrzygotowaniaPdf>;
  zakoncz: (pozwolenie: string) => Promise<WynikZakonczeniaPdf>;
};

/** Trzy kroki uploadu PDF (lib/pliki/pdf.ts): pozwolenie, PUT do Storage, sprawdzenie i podpisany opis. */
export function useUploadPdf(akcje: AkcjeUploaduPdf) {
  const [stan, setStan] = useState<StanUploaduPdf>({ faza: "brak" });
  const u = copy.zespol.pdf;

  const wyslij = useCallback(
    async (plik: File): Promise<string | null> => {
      const mime = plik.type.toLowerCase() || "application/pdf";
      if (mime !== "application/pdf") {
        setStan({ faza: "blad", komunikat: u.bledy.nieobslugiwany });
        return null;
      }
      if (plik.size > MAKS_BAJTOW_PDF) {
        setStan({ faza: "blad", komunikat: u.bledy.zaDuzy.replace("{limit}", formatujMB(MAKS_BAJTOW_PDF)) });
        return null;
      }
      setStan({ faza: "wysylanie", procent: 0, nazwa: plik.name });
      const przygotowanie = await akcje.przygotuj({ nazwa: plik.name, mime, bytes: plik.size });
      if (!przygotowanie.ok) {
        setStan({ faza: "blad", komunikat: przygotowanie.powod === "zaDuzy" ? u.bledy.zaDuzy.replace("{limit}", przygotowanie.limit ?? "") : u.bledy.nieobslugiwany });
        return null;
      }
      const wyslano = await wyslijDoStorage(przygotowanie.signedUrl, plik, (procent) => setStan({ faza: "wysylanie", procent, nazwa: plik.name }));
      if (!wyslano) {
        setStan({ faza: "blad", komunikat: u.bledy.wysylka });
        return null;
      }
      setStan({ faza: "sprawdzanie", nazwa: plik.name });
      const koniec = await akcje.zakoncz(przygotowanie.pozwolenie);
      if (!koniec.ok) {
        setStan({ faza: "blad", komunikat: koniec.powod === "zaDuzy" ? u.bledy.zaDuzy.replace("{limit}", koniec.limit ?? "") : u.bledy[koniec.powod] });
        return null;
      }
      setStan({ faza: "gotowy", nazwa: koniec.nazwa, opis: koniec.opis });
      return koniec.opis;
    },
    [akcje, u],
  );

  const wyczysc = useCallback(() => setStan({ faza: "brak" }), []);
  return { stan, wyslij, wyczysc };
}
