"use client";

import { Camera, Globe, Mail, MapPin, QrCode, Search, ShoppingBag, Sparkles, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import type { UslugaDlaKlienta } from "@/lib/dto/klient";
import type { WynikAkcji } from "@/lib/dto/wynik";
import { formatujDate } from "@/lib/format";

const IKONY: Record<string, LucideIcon> = { camera: Camera, "qr-code": QrCode, globe: Globe, "shopping-bag": ShoppingBag, search: Search, mail: Mail, "map-pin": MapPin };
const MAKS = 1000;

/** Karta usługi (SPEC rozdz. 5.8): „Chcę wiedzieć więcej" -> modal z jednym polem -> potwierdzenie. W podglądzie zablokowane. */
export function KartaUslugi({ usluga, podglad, onZglos }: { usluga: UslugaDlaKlienta; podglad: boolean; onZglos: (tresc: string) => Promise<WynikAkcji> }) {
  const router = useRouter();
  const [otwarty, setOtwarty] = useState(false);
  const [tresc, setTresc] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [wyslano, setWyslano] = useState(false);
  const [trwa, startTransition] = useTransition();
  const u = copy.uslugi;
  const Ikona = IKONY[usluga.ikona ?? ""] ?? Sparkles;

  function zmienOtwarcie(open: boolean) {
    setOtwarty(open);
    if (!open) {
      setBlad(null);
      if (wyslano) {
        setWyslano(false);
        setTresc("");
        router.refresh();
      }
    }
  }

  function wyslij(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBlad(null);
    startTransition(async () => {
      const w = await onZglos(tresc);
      if (!w.ok) {
        setBlad(w.blad);
        return;
      }
      setWyslano(true);
    });
  }

  return (
    <article className="flex h-full flex-col rounded-xl bg-white p-5 shadow-miekki" data-usluga={usluga.slug}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-fiolet-050 text-fiolet-700">
          <Ikona className="size-5" aria-hidden />
        </span>
        <h2 className="font-naglowek text-lg text-foodie-czern">{usluga.nazwa}</h2>
      </div>
      <p className="mt-3 flex-1 text-sm leading-6 text-szary-600">{usluga.opis}</p>
      {usluga.zgloszonoO ? <p className="mt-3 text-xs font-medium text-zielony" data-juz-zgloszone>{u.juzZgloszone.replace("{data}", formatujDate(usluga.zgloszonoO))}</p> : null}
      <Button type="button" size="lg" className="mt-4 w-full sm:w-auto" disabled={podglad} title={podglad ? copy.podgladKlienta.niedostepne : undefined} onClick={() => setOtwarty(true)} data-chce-wiedziec-wiecej>
        {usluga.cta || u.cta}
      </Button>

      <Dialog open={otwarty} onOpenChange={zmienOtwarcie}>
        <DialogContent className="sm:max-w-md">
          {wyslano ? (
            <div data-potwierdzenie-uslugi>
              <DialogHeader>
                <DialogTitle className="font-naglowek text-lg">{u.potwierdzenie.tytul}</DialogTitle>
                <DialogDescription>{u.potwierdzenie.opis}</DialogDescription>
              </DialogHeader>
              <Button type="button" size="lg" className="mt-4" onClick={() => zmienOtwarcie(false)}>
                {u.potwierdzenie.zamknij}
              </Button>
            </div>
          ) : (
            <form onSubmit={wyslij} className="space-y-4" data-formularz-uslugi>
              <DialogHeader>
                <DialogTitle className="font-naglowek text-lg">{usluga.nazwa}</DialogTitle>
                <DialogDescription>{usluga.opis}</DialogDescription>
              </DialogHeader>
              <div>
                <label htmlFor={`usluga-${usluga.slug}`} className="block text-sm font-medium text-foodie-czern">
                  {u.dialog.pole}
                </label>
                <textarea
                  id={`usluga-${usluga.slug}`}
                  value={tresc}
                  onChange={(e) => setTresc(e.target.value.slice(0, MAKS))}
                  placeholder={u.dialog.podpowiedz}
                  rows={4}
                  maxLength={MAKS}
                  className="mt-1 w-full rounded-lg border border-szary-300 bg-white px-3 py-2 text-sm text-foodie-czern outline-none focus:border-foodie-fiolet focus:ring-2 focus:ring-foodie-fiolet/30"
                />
                <p className="mt-1 text-xs text-szary-600">{u.dialog.licznik.replace("{n}", String(tresc.length))}</p>
              </div>
              {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="lg" onClick={() => zmienOtwarcie(false)}>
                  {u.dialog.anuluj}
                </Button>
                <Button type="submit" size="lg" disabled={trwa || tresc.trim().length === 0} data-wyslij-zainteresowanie>
                  {trwa ? u.dialog.wysylanie : u.dialog.wyslij}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </article>
  );
}
