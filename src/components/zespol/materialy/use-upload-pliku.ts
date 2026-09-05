"use client";

import { useCallback, useState } from "react";
import { copy } from "@/lib/copy";
import { czyRodzajPliku, formatujMB, limitBajtow } from "@/lib/pliki/magia";
import { rozpoznajLinkDysku } from "@/lib/drive/linki";
import type { WynikPlikuZDysku } from "@/lib/import/pojedynczy";
import type { WynikPrzygotowania, WynikZakonczenia } from "@/lib/pliki/upload";

export type StanUploadu =
  | { faza: "brak" }
  | { faza: "wysylanie"; procent: number; nazwa: string }
  | { faza: "sprawdzanie"; nazwa: string }
  | { faza: "gotowy"; nazwa: string; opis: string; ostrzezenia: string[] }
  | { faza: "blad"; komunikat: string };

export type AkcjeUploadu = {
  przygotuj: (plik: { nazwa: string; mime: string; bytes: number }) => Promise<WynikPrzygotowania>;
  zakoncz: (pozwolenie: string) => Promise<WynikZakonczenia>;
  /** Opcjonalne: link do pliku na Dysku (SPEC rozdz. 12.6). */
  pobierzZDysku?: (url: string) => Promise<WynikPlikuZDysku>;
};

/** PUT prosto do Storage z paskiem postępu (XHR, bo fetch nie raportuje postępu wysyłki). */
function wyslijDoStorage(url: string, plik: File, onPostep: (procent: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", plik.type || "application/octet-stream");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPostep(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(plik);
  });
}

/**
 * Trzy kroki uploadu (lib/pliki/upload.ts): pozwolenie z serwera, PUT do Storage, sprawdzenie i podpisany opis.
 * Zwrócony `opis` to jedyna rzecz, jaką przyjmuje mutacja materiału.
 */
export function useUploadPliku(akcje: AkcjeUploadu) {
  const [stan, setStan] = useState<StanUploadu>({ faza: "brak" });
  const u = copy.zespol.materialy.upload;

  const wyslij = useCallback(
    async (plik: File): Promise<string | null> => {
      const mime = plik.type.toLowerCase();
      if (!czyRodzajPliku(mime)) {
        setStan({ faza: "blad", komunikat: u.bledy.nieobslugiwany });
        return null;
      }
      if (plik.size > limitBajtow(mime)) {
        setStan({ faza: "blad", komunikat: u.bledy.zaDuzy.replace("{limit}", formatujMB(limitBajtow(mime))) });
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
        const tekst = koniec.powod === "zaDuzy" ? u.bledy.zaDuzy.replace("{limit}", koniec.limit ?? "") : u.bledy[koniec.powod];
        setStan({ faza: "blad", komunikat: tekst });
        return null;
      }
      const ostrzezenia = koniec.ostrzezenia.map((o) => (o === "duzeWideo" ? u.duzeWideo : o === "bezPodgladu" ? u.bezPodgladu : o));
      setStan({ faza: "gotowy", nazwa: plik.name, opis: koniec.opis, ostrzezenia });
      return koniec.opis;
    },
    [akcje, u],
  );

  /** Ta sama końcówka co upload z komputera: serwer pobiera plik z Dysku i oddaje podpisany opis. */
  const wyslijZDysku = useCallback(
    async (url: string): Promise<string | null> => {
      const d = copy.zespol.import.plikZDysku;
      const link = rozpoznajLinkDysku(url);
      if (!link || !akcje.pobierzZDysku) {
        setStan({ faza: "blad", komunikat: d.bledy.zlyLink });
        return null;
      }
      if (link.rodzaj === "folder") {
        setStan({ faza: "blad", komunikat: d.bledy.folder });
        return null;
      }
      setStan({ faza: "sprawdzanie", nazwa: link.id });
      const w = await akcje.pobierzZDysku(link.url);
      if (!w.ok) {
        const tekst = w.powod === "zaDuzy" ? u.bledy.zaDuzy.replace("{limit}", w.limit ?? "") : w.powod === "zlyLink" || w.powod === "folder" || w.powod === "nieZnaleziono" || w.powod === "zablokowany" || w.powod === "nieSkonfigurowany" || w.powod === "dysk" ? d.bledy[w.powod] : u.bledy[w.powod];
        setStan({ faza: "blad", komunikat: tekst });
        return null;
      }
      const ostrzezenia = w.ostrzezenia.map((o) => (o === "duzeWideo" ? u.duzeWideo : o === "bezPodgladu" ? u.bezPodgladu : o));
      setStan({ faza: "gotowy", nazwa: w.plik.originalName, opis: w.opis, ostrzezenia });
      return w.opis;
    },
    [akcje, u],
  );

  const wyczysc = useCallback(() => setStan({ faza: "brak" }), []);
  return { stan, wyslij, wyslijZDysku, wyczysc };
}
