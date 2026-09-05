"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { WynikMapowania } from "@/app/zespol/(panel)/klienci/[slug]/pakiety/[pakietId]/import/akcje";
import { KartaWeryfikacyjnaWidok } from "@/components/zespol/import/karta-weryfikacyjna";
import { Mapowanie } from "@/components/zespol/import/mapowanie";
import { PostepImportu } from "@/components/zespol/import/postep-importu";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { KartaWeryfikacyjna, Propozycja, StanImportu } from "@/lib/dto/import";
import type { WynikAkcji } from "@/lib/dto/wynik";
import type { Plan } from "@/lib/import/plan";

export type AkcjeImportu = {
  zapiszLink: (cel: { rodzaj: "content" } | { rodzaj: "reklamy"; kampaniaId: string }, url: string | null) => Promise<WynikAkcji>;
  przygotujMapowanie: (folderIds: string[]) => Promise<WynikMapowania>;
  rozpocznij: (dane: { plany: Plan[]; zignorowane: string[] }) => Promise<WynikAkcji>;
  stan: () => Promise<StanImportu>;
  wznow: (jobId: string) => Promise<WynikAkcji>;
};

function naPlan(p: Propozycja): Plan {
  if (p.rodzaj === "content") {
    return { rodzaj: "content", folderId: p.folderId, materialy: p.materialy.map((m) => ({ klucz: m.klucz, rodzaj: m.rodzaj, tytul: m.tytul.trim() || m.klucz, opis: m.rodzaj === "relacja" ? null : m.opis, pliki: m.pliki.map((f) => ({ id: f.id, nazwa: f.nazwa, mime: f.mime, bytes: f.bytes, assetId: null })), pominiety: m.pominiety, itemId: null })) };
  }
  return { rodzaj: "reklamy", folderId: p.folderId, kampaniaId: p.kampaniaId, grafiki: p.grafiki.map((g) => ({ id: g.id, nazwa: g.nazwa, mime: g.mime, bytes: g.bytes, assetId: null, pominiety: g.pominiety })), teksty: p.teksty.map((x) => x.trim()).filter(Boolean), naglowki: p.naglowki.map((x) => x.trim()).filter(Boolean), opis: p.opis, cta: p.cta, link: p.link, itemId: null, wariantyZapisane: false };
}

/**
 * Trzy kroki importu (SPEC rozdz. 12.3 pkt 2 i 4, rozdz. 13): weryfikacja folderów, obowiązkowe mapowanie,
 * kopiowanie w tle z paskiem postępu. Do mapowania przechodzą wyłącznie foldery w stanie „ok" bez błędu
 * limitu; przy ostrzeżeniach trzeba je świadomie potwierdzić (zapis w audycie po stronie serwera).
 */
export function EkranImportu({ slug, pakietId, trybStartowy, karty, stan, akcje }: { slug: string; pakietId: string; trybStartowy: "weryfikacja" | "postep"; karty: KartaWeryfikacyjna[]; stan: StanImportu; kampanie: { id: string; nazwa: string }[]; akcje: AkcjeImportu }) {
  const router = useRouter();
  const t = copy.zespol.import;
  const [krok, setKrok] = useState<"weryfikacja" | "mapowanie" | "postep">(trybStartowy);
  const [zignorowane, setZignorowane] = useState<string[]>([]);
  const [pominiete, setPominiete] = useState<string[]>([]);
  const [propozycje, setPropozycje] = useState<Propozycja[]>([]);
  const [stanBiezacy, setStanBiezacy] = useState<StanImportu>(stan);
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, startTransition] = useTransition();
  const adres = `/zespol/klienci/${slug}/pakiety/${pakietId}/import`;

  const doImportu = karty.filter((k) => k.stan === "ok" && !k.blad && k.folderId && !pominiete.includes(k.folderId));
  const brakZgody = doImportu.filter((k) => k.ostrzezenia.length > 0 && !zignorowane.includes(k.folderId ?? ""));
  const mozeDalej = doImportu.length > 0 && brakZgody.length === 0;

  const odswiezStan = useCallback(() => akcje.stan(), [akcje]);

  function dalej() {
    setBlad(null);
    startTransition(async () => {
      const w = await akcje.przygotujMapowanie(doImportu.map((k) => k.folderId ?? ""));
      if (!w.ok) {
        setBlad(w.blad);
        return;
      }
      setPropozycje(w.propozycje);
      setKrok("mapowanie");
      window.scrollTo({ top: 0 });
    });
  }

  function importuj() {
    setBlad(null);
    startTransition(async () => {
      const plany = propozycje.map(naPlan).filter((p) => (p.rodzaj === "content" ? p.materialy.some((m) => !m.pominiety) : p.grafiki.some((g) => !g.pominiety) || p.teksty.length > 0 || p.naglowki.length > 0));
      const w = await akcje.rozpocznij({ plany, zignorowane: zignorowane.filter((z) => plany.some((p) => p.folderId === z)) });
      if (!w.ok) {
        setBlad(w.blad);
        return;
      }
      // Świeży stan z zadaniami, zanim strona przeładuje się w trybie postępu (bez tego pasek pokazałby „0 z 0").
      setStanBiezacy(await akcje.stan());
      setKrok("postep");
      router.replace(adres);
      router.refresh();
    });
  }

  if (krok === "postep") {
    return (
      <div data-ekran-importu data-krok="postep">
        <PostepImportu stan={stanBiezacy} slug={slug} pakietId={pakietId} adresNowego={`${adres}?nowy=1`} odswiez={odswiezStan} wznow={akcje.wznow} />
      </div>
    );
  }

  if (krok === "mapowanie") {
    return (
      <div data-ekran-importu data-krok="mapowanie">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-szary-600">{t.krokMapowanie}</p>
        <Mapowanie propozycje={propozycje} onChange={setPropozycje} onImportuj={importuj} onWstecz={() => setKrok("weryfikacja")} trwa={trwa} blad={blad} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-ekran-importu data-krok="weryfikacja">
      <p className="text-xs font-medium uppercase tracking-wide text-szary-600">{t.krokWeryfikacja}</p>
      {karty.length === 0 ? <p className="rounded-xl bg-white p-5 text-sm text-szary-600 shadow-miekki">{t.bezFolderow}</p> : null}
      {karty.map((k) => {
        const id = k.folderId ?? "";
        return (
          <KartaWeryfikacyjnaWidok
            key={`${k.rodzaj}-${k.kampaniaId ?? "content"}`}
            karta={k}
            zignorowane={zignorowane.includes(id)}
            onZignoruj={(v) => setZignorowane((s) => (v ? [...new Set([...s, id])] : s.filter((x) => x !== id)))}
            pominiety={pominiete.includes(id)}
            onPomin={(v) => setPominiete((s) => (v ? [...new Set([...s, id])] : s.filter((x) => x !== id)))}
            onZmienLink={async (url) => {
              const w = await akcje.zapiszLink(k.rodzaj === "content" ? { rodzaj: "content" } : { rodzaj: "reklamy", kampaniaId: k.kampaniaId ?? "" }, url);
              if (w.ok) router.refresh();
              return w;
            }}
          />
        );
      })}
      {blad ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony" data-blad-importu>{blad}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" disabled={trwa || !mozeDalej} onClick={dalej} data-dalej-mapowanie>{trwa ? t.przygotowujemy : t.dalej}</Button>
        {karty.length > 0 && doImportu.length === 0 ? <p className="text-sm text-bursztyn" data-dalej-brak>{t.dalejBrak}</p> : null}
        {brakZgody.length > 0 ? <p className="text-sm text-bursztyn" data-dalej-zgoda>{t.karta.ignorujWymagane}</p> : null}
      </div>
    </div>
  );
}
