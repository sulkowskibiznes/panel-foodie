"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DialogEdycjiMaterialu } from "@/components/zespol/materialy/dialog-edycji-materialu";
import { DialogPlikow } from "@/components/zespol/materialy/dialog-plikow";
import { DialogReklamy } from "@/components/zespol/materialy/dialog-reklamy";
import type { AkcjeMaterialow, UprawnieniaMaterialow } from "@/components/zespol/materialy/typy";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { MaterialDto, PakietSzczegoly } from "@/lib/dto/materialy";

type Dialogowe = "edycja" | "pliki" | "reklama" | null;

/** Przyciski zespołu nad materiałem (SPEC rozdz. 12.6): Edytuj, Pliki (podmiana), teksty reklamy, Usuń (szkic). */
export function NarzedziaMaterialu({ material, pakiet, akcje, uprawnienia }: { material: MaterialDto; pakiet: PakietSzczegoly; akcje: AkcjeMaterialow; uprawnienia: UprawnieniaMaterialow }) {
  const router = useRouter();
  const t = copy.zespol.materialy;
  const [dialog, setDialog] = useState<Dialogowe>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const reklama = material.typ === "reklama";
  const moze = reklama ? uprawnienia.kampanie : uprawnienia.content;
  if (!moze) return null;

  function usun() {
    if (!window.confirm(t.usunPotwierdz)) return;
    setBlad(null);
    startTransition(async () => {
      const w = await akcje.usunMaterial(material.id);
      if (w.ok) router.refresh();
      else setBlad(w.blad);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-narzedzia-materialu={material.id}>
      <Button type="button" variant="outline" size="sm" onClick={() => setDialog("edycja")} data-edytuj-material>{t.edytuj}</Button>
      {reklama ? <Button type="button" variant="outline" size="sm" onClick={() => setDialog("reklama")} data-edytuj-reklame>{t.reklama.tytul}</Button> : null}
      <Button type="button" variant="outline" size="sm" onClick={() => setDialog("pliki")} data-pliki-materialu>{t.pliki}</Button>
      {!reklama ? (
        <Button type="button" variant="ghost" size="sm" disabled={trwa || pakiet.status !== "szkic"} title={pakiet.status !== "szkic" ? t.tylkoSzkic : undefined} onClick={usun} data-usun-material>
          {t.usun}
        </Button>
      ) : null}
      {blad ? <span role="alert" className="text-xs text-czerwony">{blad}</span> : null}
      {dialog === "edycja" ? <DialogEdycjiMaterialu open onClose={() => setDialog(null)} material={material} status={pakiet.status} kategoria={pakiet.kategoria} lokale={pakiet.lokale} akcje={akcje} /> : null}
      {dialog === "pliki" ? <DialogPlikow open onClose={() => setDialog(null)} material={material} status={pakiet.status} akcje={akcje} /> : null}
      {dialog === "reklama" ? <DialogReklamy open onClose={() => setDialog(null)} material={material} status={pakiet.status} kategoria={pakiet.kategoria} lokale={pakiet.lokale} akcje={akcje} /> : null}
    </div>
  );
}
