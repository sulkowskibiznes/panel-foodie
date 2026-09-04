"use client";

import Link from "next/link";
import { useState } from "react";
import { EkranPakietu, type AkcjeEkranu } from "@/components/pakiet/ekran-pakietu";
import { DialogKampanii } from "@/components/zespol/materialy/dialog-kampanii";
import { DialogNowegoMaterialu } from "@/components/zespol/materialy/dialog-nowego-materialu";
import { NarzedziaKampanii } from "@/components/zespol/materialy/narzedzia-kampanii";
import { NarzedziaMaterialu } from "@/components/zespol/materialy/narzedzia-materialu";
import type { AkcjeMaterialow, UprawnieniaMaterialow } from "@/components/zespol/materialy/typy";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { PakietSzczegoly } from "@/lib/dto/materialy";

/**
 * Ekran pakietu w panelu zespołu: te same komponenty co u klienta (SPEC rozdz. 12.3 pkt 6) plus narzędzia
 * zespołu nad każdym materiałem i kampanią oraz „Dodaj materiał" i „Dodaj kampanię" dostępne w każdej chwili (12.6).
 */
export function EkranPakietuZespolu({ pakiet, teraz, akcje, akcjeMaterialow, uprawnienia, adresHarmonogramu }: { pakiet: PakietSzczegoly; teraz: string; akcje: AkcjeEkranu; akcjeMaterialow: AkcjeMaterialow; uprawnienia: UprawnieniaMaterialow; adresHarmonogramu: string }) {
  const [dialog, setDialog] = useState<"material" | "kampania" | null>(null);
  const t = copy.zespol.materialy;
  const cokolwiek = uprawnienia.content || uprawnienia.kampanie;

  return (
    <div className="space-y-4">
      {cokolwiek ? (
        <div className="flex flex-wrap items-center gap-2" data-narzedzia-pakietu>
          {uprawnienia.content || (uprawnienia.kampanie && pakiet.kampanie.length > 0) ? (
            <Button type="button" size="lg" onClick={() => setDialog("material")} data-dodaj-material>{t.dodajMaterial}</Button>
          ) : null}
          {uprawnienia.kampanie ? (
            <Button type="button" variant="outline" size="lg" onClick={() => setDialog("kampania")} data-dodaj-kampanie>{t.dodajKampanie}</Button>
          ) : null}
          <Link href={adresHarmonogramu} className="text-sm font-medium text-foodie-fiolet hover:underline">{copy.zespol.harmonogram.tytul}</Link>
          {pakiet.folderContentuUrl ? (
            <a href={pakiet.folderContentuUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-foodie-fiolet hover:underline">{copy.zespol.kreator.folderContentu}</a>
          ) : null}
        </div>
      ) : null}
      <EkranPakietu
        tryb="zespol"
        pakiet={pakiet}
        teraz={teraz}
        mozeAkceptowac={false}
        akcje={akcje}
        narzedzia={cokolwiek ? { material: (m) => <NarzedziaMaterialu material={m} pakiet={pakiet} akcje={akcjeMaterialow} uprawnienia={uprawnienia} />, kampania: (k) => <NarzedziaKampanii kampania={k} pakiet={pakiet} akcje={akcjeMaterialow} uprawnienia={uprawnienia} /> } : undefined}
      />
      {dialog === "material" ? <DialogNowegoMaterialu open onClose={() => setDialog(null)} pakiet={pakiet} akcje={akcjeMaterialow} uprawnienia={uprawnienia} /> : null}
      {dialog === "kampania" ? <DialogKampanii open onClose={() => setDialog(null)} status={pakiet.status} kampania={null} onZapisz={(d) => akcjeMaterialow.dodajKampanie(d)} /> : null}
    </div>
  );
}
