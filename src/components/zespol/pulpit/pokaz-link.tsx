"use client";

import { useState } from "react";
import { LinkiDoWyslania } from "@/components/zespol/pulpit/linki-do-wyslania";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";

/** „Pokaż link" (pulpit i pasek pakietu, SPEC rozdz. 12.1, 12.4): ten sam mechanizm co w zakładce Dostęp, każde pokazanie w audycie. */
export function PokazLinkPulpit({ slug, nazwaKlienta, etykieta }: { slug: string; nazwaKlienta: string; etykieta?: string }) {
  const t = copy.zespol.pulpitPakiety;
  const [otwarty, setOtwarty] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOtwarty(true)} data-pokaz-link-pulpit>{etykieta ?? t.pokazLink}</Button>
      <Dialog open={otwarty} onOpenChange={setOtwarty}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{t.pokazLinkTytul}: {nazwaKlienta}</DialogTitle>
            <DialogDescription>{t.pokazLinkOpis}</DialogDescription>
          </DialogHeader>
          {otwarty ? <LinkiDoWyslania slug={slug} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
