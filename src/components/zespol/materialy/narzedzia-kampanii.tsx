"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DialogKampanii } from "@/components/zespol/materialy/dialog-kampanii";
import { NarzedziaMaterialu } from "@/components/zespol/materialy/narzedzia-materialu";
import type { AkcjeMaterialow, UprawnieniaMaterialow } from "@/components/zespol/materialy/typy";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { KampaniaDto, PakietSzczegoly } from "@/lib/dto/materialy";

/** Narzędzia nad kampanią: edycja nazwy, celu, zdania i folderu; narzędzia reklamy; usunięcie w szkicu. */
export function NarzedziaKampanii({ kampania, pakiet, akcje, uprawnienia }: { kampania: KampaniaDto; pakiet: PakietSzczegoly; akcje: AkcjeMaterialow; uprawnienia: UprawnieniaMaterialow }) {
  const router = useRouter();
  const t = copy.zespol.materialy;
  const [edycja, setEdycja] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  if (!uprawnienia.kampanie) return null;

  function usun() {
    if (!window.confirm(t.usunKampaniePotwierdz)) return;
    setBlad(null);
    startTransition(async () => {
      const w = await akcje.usunKampanie(kampania.id);
      if (w.ok) router.refresh();
      else setBlad(w.blad);
    });
  }

  return (
    <div className="space-y-2" data-narzedzia-kampanii={kampania.id}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setEdycja(true)} data-edytuj-kampanie>{t.kampania.tytulEdycja}: {t.edytuj.toLowerCase()}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={trwa || pakiet.status !== "szkic"} title={pakiet.status !== "szkic" ? t.tylkoSzkic : undefined} onClick={usun} data-usun-kampanie>
          {copy.zespol.kreator.usunKampanie}
        </Button>
        {kampania.folderReklamUrl ? (
          <a href={kampania.folderReklamUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-foodie-fiolet hover:underline">{t.kampania.folder}</a>
        ) : null}
        {blad ? <span role="alert" className="text-xs text-czerwony">{blad}</span> : null}
      </div>
      {kampania.reklama ? <NarzedziaMaterialu material={kampania.reklama} pakiet={pakiet} akcje={akcje} uprawnienia={uprawnienia} /> : null}
      {edycja ? <DialogKampanii open onClose={() => setEdycja(false)} status={pakiet.status} kampania={kampania} onZapisz={(d) => akcje.edytujKampanie(kampania.id, d)} /> : null}
    </div>
  );
}
