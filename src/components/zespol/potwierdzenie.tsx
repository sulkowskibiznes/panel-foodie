"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";

export type OpcjePotwierdzenia = { tresc: string; tytul?: string; przycisk?: string; niebezpieczne?: boolean };

/**
 * Potwierdzenie w oknie panelu zamiast `window.confirm` (plan domknięcia, Etap 3a): czytelne na telefonie, w marce,
 * z przyciskiem opisującym skutek. Użycie: `const { potwierdz, okno } = usePotwierdzenie();`,
 * `if (!(await potwierdz({ tresc }))) return;` i `{okno}` w JSX (wewnątrz innego okna, gdy pytamy z okna).
 */
export function usePotwierdzenie() {
  const [opcje, setOpcje] = useState<OpcjePotwierdzenia | null>(null);
  const rozwiaz = useRef<((tak: boolean) => void) | null>(null);
  const p = copy.zespol.potwierdzenie;

  const potwierdz = useCallback(
    (o: OpcjePotwierdzenia) =>
      new Promise<boolean>((resolve) => {
        rozwiaz.current?.(false);
        rozwiaz.current = resolve;
        setOpcje(o);
      }),
    [],
  );

  function zamknij(tak: boolean) {
    rozwiaz.current?.(tak);
    rozwiaz.current = null;
    setOpcje(null);
  }

  const okno = (
    <Dialog open={opcje !== null} onOpenChange={(otwarte) => !otwarte && zamknij(false)}>
      <DialogContent className="sm:max-w-md" data-okno-potwierdzenia>
        <DialogHeader>
          <DialogTitle className="font-naglowek text-lg">{opcje?.tytul ?? p.tytul}</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-foodie-czern">{opcje?.tresc}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="lg" onClick={() => zamknij(false)} data-anuluj-potwierdzenie>
            {p.anuluj}
          </Button>
          <Button type="button" variant={opcje?.niebezpieczne ? "destructive" : "default"} size="lg" onClick={() => zamknij(true)} data-potwierdz>
            {opcje?.przycisk ?? p.potwierdz}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { potwierdz, okno };
}
