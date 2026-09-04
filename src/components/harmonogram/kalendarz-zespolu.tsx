"use client";

import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import type { WynikHarmonogramu } from "@/app/zespol/(panel)/klienci/[slug]/harmonogram/akcje";
import { EtykietaMaterialu, KLASA_STATUSU, SiatkaMiesiaca } from "@/components/harmonogram/wspolne";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/lib/copy";
import type { HarmonogramMiesiaca, MaterialWKalendarzu } from "@/lib/dto/harmonogram";
import { kluczMiesiaca, type DzienSiatki } from "@/lib/harmonogram/kalendarz";

export type Przesun = (dane: { pakietId: string; materialId: string; data: string | null; godzina: string | null; potwierdzono?: boolean }) => Promise<WynikHarmonogramu>;

const ID_NIEZAPLANOWANE = "niezaplanowane";

/** Upuszczamy tam, gdzie jest wskaźnik (kafelek bywa szerszy niż komórka dnia); klawiatura bez wskaźnika: przecięcie prostokątów. */
const kolizje: CollisionDetection = (args) => {
  const podWskaznikiem = pointerWithin(args);
  return podWskaznikiem.length > 0 ? podWskaznikiem : rectIntersection(args);
};
const POLE = "h-8 rounded-lg border border-szary-300 bg-white px-2 text-xs text-foodie-czern outline-none focus:border-foodie-fiolet";

function Kafelek({ m, przeciagany = false }: { m: MaterialWKalendarzu; przeciagany?: boolean }) {
  return (
    <span className={`block w-full rounded-md border px-1.5 py-1 text-left text-[11px] leading-4 ${KLASA_STATUSU[m.statusPakietu]} ${przeciagany ? "shadow-miekki" : ""}`}>
      <EtykietaMaterialu m={m} />
    </span>
  );
}

/** Kafelek z uchwytem przeciągania i rozwijanym polem daty i godziny (dostępność, telefon, testy). */
function Material({ m, godziny, onUstaw, zajety }: { m: MaterialWKalendarzu; godziny: number[]; onUstaw: (data: string | null, godzina: string | null) => void; zajety: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: m.id, data: { pakietId: m.pakietId } });
  const [otwarty, setOtwarty] = useState(false);
  const [data, setData] = useState(m.data ?? "");
  const [godzina, setGodzina] = useState(m.godzina ?? `${String(godziny[0] ?? 12).padStart(2, "0")}:00`);
  const h = copy.zespol.harmonogram;
  return (
    <li ref={setNodeRef} data-material-kalendarza={m.id} data-data={m.data ?? ""} className={`rounded-md ${isDragging ? "opacity-40" : ""}`}>
      <div className="flex items-start gap-1">
        <button type="button" {...listeners} {...attributes} title={h.przeciagnij} aria-label={`${h.przeciagnij}: ${m.tytul}`} data-uchwyt className="mt-1 shrink-0 cursor-grab touch-none rounded px-1 text-szary-600 hover:bg-szary-100 active:cursor-grabbing">
          ⋮⋮
        </button>
        <button type="button" onClick={() => setOtwarty((o) => !o)} className="min-w-0 flex-1" aria-expanded={otwarty} data-otworz-date>
          <Kafelek m={m} />
        </button>
      </div>
      {otwarty ? (
        <form
          className="mt-1 flex flex-wrap items-center gap-1 rounded-md bg-white p-1.5 shadow-miekki"
          onSubmit={(e) => {
            e.preventDefault();
            if (!data) return;
            onUstaw(data, godzina);
            setOtwarty(false);
          }}
          data-formularz-daty
        >
          <input type="date" aria-label={h.data} value={data} onChange={(e) => setData(e.target.value)} className={POLE} data-pole-daty />
          <input type="time" aria-label={h.godzina} value={godzina} onChange={(e) => setGodzina(e.target.value)} list={`godziny-${m.id}`} className={POLE} data-pole-godziny />
          <datalist id={`godziny-${m.id}`}>
            {godziny.map((g) => (
              <option key={g} value={`${String(g).padStart(2, "0")}:00`} />
            ))}
          </datalist>
          <Button type="submit" size="sm" disabled={zajety || !data} data-ustaw-date>{h.ustaw}</Button>
          {m.data ? (
            <Button type="button" variant="ghost" size="sm" disabled={zajety} onClick={() => { onUstaw(null, null); setOtwarty(false); }} data-usun-date>{h.usunDate}</Button>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}

function Dzien({ dzien, dzieci, koniecOkresu }: { dzien: DzienSiatki; dzieci: ReactNode; koniecOkresu: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `dzien-${dzien.data}`, data: { data: dzien.data } });
  return (
    <div ref={setNodeRef} role="gridcell" data-dzien={dzien.data} className={`min-h-24 rounded-lg border p-1 ${dzien.wMiesiacu ? "bg-white" : "bg-szary-050 opacity-70"} ${isOver ? "border-foodie-fiolet ring-2 ring-foodie-fiolet/30" : "border-szary-100"} ${koniecOkresu ? "border-b-4 border-b-foodie-czern" : ""}`}>
      <div className={`text-right text-[11px] ${dzien.wMiesiacu ? "text-foodie-czern" : "text-szary-300"}`}>{dzien.dzien}</div>
      <ul className="mt-1 space-y-1">{dzieci}</ul>
    </div>
  );
}

function Niezaplanowane({ dzieci, pusto }: { dzieci: ReactNode; pusto: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: ID_NIEZAPLANOWANE });
  const h = copy.zespol.harmonogram;
  return (
    <aside ref={setNodeRef} data-niezaplanowane className={`rounded-xl border bg-white p-3 shadow-miekki ${isOver ? "border-foodie-fiolet ring-2 ring-foodie-fiolet/30" : "border-szary-100"}`}>
      <h3 className="font-naglowek text-base text-foodie-czern">{h.niezaplanowane}</h3>
      <p className="mt-1 text-xs text-szary-600">{h.niezaplanowaneOpis}</p>
      {pusto ? <p className="mt-3 rounded-lg bg-green-50 px-2 py-1.5 text-xs text-zielony">{h.wszystkoZaplanowane}</p> : <ul className="mt-3 space-y-1">{dzieci}</ul>}
      {isOver ? <p className="mt-2 text-xs text-foodie-fiolet">{h.upuscTutaj}</p> : null}
    </aside>
  );
}

/**
 * Kalendarz zespołu (SPEC rozdz. 8): przeciąganie materiałów między dniami i do panelu „Niezaplanowane" (dnd-kit),
 * do tego pole daty i godziny w każdym kafelku. Zmiana w wysłanym albo zaakceptowanym pakiecie wraca z prośbą
 * o potwierdzenie (ta sama tabela co przy podmianie, rozdz. 12.6).
 */
export function KalendarzZespolu({ harmonogram, przesun }: { harmonogram: HarmonogramMiesiaca; przesun: Przesun }) {
  const router = useRouter();
  const h = copy.zespol.harmonogram;
  /** Nadpisania po udanych zapisach: props z serwera zostają źródłem prawdy, a odświeżenie nie przerywa przeciągania (bez remountu). */
  const [nadpisania, setNadpisania] = useState<Record<string, Pick<MaterialWKalendarzu, "publikacjaO" | "data" | "godzina">>>({});
  const materialy = useMemo(() => harmonogram.materialy.map((m) => (nadpisania[m.id] ? { ...m, ...nadpisania[m.id] } : m)), [harmonogram.materialy, nadpisania]);
  const [aktywny, setAktywny] = useState<MaterialWKalendarzu | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [doPotwierdzenia, setDoPotwierdzenia] = useState<{ m: MaterialWKalendarzu; data: string | null; godzina: string | null } | null>(null);
  const [potwierdzono, setPotwierdzono] = useState(false);
  const [trwa, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const klucz = kluczMiesiaca(harmonogram.rok, harmonogram.miesiac);
  const wMiesiacu = useMemo(() => materialy.filter((m) => m.data?.startsWith(klucz)), [materialy, klucz]);
  const niezaplanowane = materialy.filter((m) => m.data === null);
  const pozaMiesiacem = materialy.filter((m) => m.data !== null && !m.data.startsWith(klucz));

  function zastosuj(m: MaterialWKalendarzu, data: string | null, godzina: string | null, potwierdzenie = false) {
    setBlad(null);
    startTransition(async () => {
      const w = await przesun({ pakietId: m.pakietId, materialId: m.id, data, godzina, potwierdzono: potwierdzenie });
      if (!w.ok) {
        if (w.wymagaPotwierdzenia) {
          setDoPotwierdzenia({ m, data, godzina });
          return;
        }
        setBlad(w.blad);
        return;
      }
      const nowy = w.publikacjaO ?? null;
      setNadpisania((s) => ({ ...s, [m.id]: { publikacjaO: nowy, data: nowy ? data : null, godzina: nowy ? (godzina ?? m.godzina ?? null) : null } }));
      setDoPotwierdzenia(null);
      setPotwierdzono(false);
      router.refresh();
    });
  }

  function naStart(e: DragStartEvent) {
    setAktywny(materialy.find((m) => m.id === e.active.id) ?? null);
  }

  function naKoniec(e: DragEndEvent) {
    const m = materialy.find((x) => x.id === e.active.id);
    setAktywny(null);
    if (!m || !e.over) return;
    const cel = String(e.over.id);
    if (cel === ID_NIEZAPLANOWANE) {
      if (m.data !== null) zastosuj(m, null, null);
      return;
    }
    const data = cel.startsWith("dzien-") ? cel.slice("dzien-".length) : null;
    if (data && data !== m.data) zastosuj(m, data, null);
  }

  const kafelek = (m: MaterialWKalendarzu) => <Material key={m.id} m={m} godziny={harmonogram.domyslneGodziny} zajety={trwa} onUstaw={(data, godzina) => zastosuj(m, data, godzina)} />;
  const koniec = new Set(harmonogram.pakiety.map((p) => p.koniecOkresu).filter((x): x is string => !!x));

  return (
    <DndContext sensors={sensors} collisionDetection={kolizje} onDragStart={naStart} onDragEnd={naKoniec} onDragCancel={() => setAktywny(null)}>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl bg-white p-3 shadow-miekki">
          <SiatkaMiesiaca rok={harmonogram.rok} miesiac={harmonogram.miesiac} komorka={(dzien) => <Dzien key={dzien.data} dzien={dzien} koniecOkresu={koniec.has(dzien.data)} dzieci={wMiesiacu.filter((m) => m.data === dzien.data).sort((a, b) => (a.godzina ?? "").localeCompare(b.godzina ?? "")).map(kafelek)} />} />
          {blad ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-czerwony">{blad}</p> : null}
          {trwa ? <p className="mt-2 text-xs text-szary-600">{h.zapisywanie}</p> : null}
        </div>
        <div className="space-y-4">
          <Niezaplanowane pusto={niezaplanowane.length === 0} dzieci={niezaplanowane.map(kafelek)} />
          {pozaMiesiacem.length > 0 ? (
            <section className="rounded-xl bg-white p-3 shadow-miekki" data-poza-miesiacem>
              <h3 className="font-naglowek text-base text-foodie-czern">{h.pozaMiesiacem}</h3>
              <ul className="mt-2 space-y-1">{pozaMiesiacem.map(kafelek)}</ul>
            </section>
          ) : null}
        </div>
      </div>
      <DragOverlay>{aktywny ? <div className="w-48"><Kafelek m={aktywny} przeciagany /></div> : null}</DragOverlay>

      <Dialog open={doPotwierdzenia !== null} onOpenChange={(o) => { if (!o) { setDoPotwierdzenia(null); setPotwierdzono(false); } }}>
        <DialogContent className="sm:max-w-md" data-dialog-potwierdzenia-daty>
          <DialogHeader>
            <DialogTitle className="font-naglowek text-lg">{copy.zespol.materialy.potwierdzenie.tytul}</DialogTitle>
            <DialogDescription>{copy.zespol.materialy.potwierdzenie.opis}</DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm text-foodie-czern">
            <input type="checkbox" checked={potwierdzono} onChange={(e) => setPotwierdzono(e.target.checked)} className="mt-0.5 size-4 accent-foodie-fiolet" data-potwierdzam />
            {copy.zespol.materialy.potwierdzenie.checkbox}
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => { setDoPotwierdzenia(null); setPotwierdzono(false); }}>{copy.zespol.materialy.edycja.anuluj}</Button>
            <Button type="button" size="lg" disabled={!potwierdzono || trwa} onClick={() => doPotwierdzenia && zastosuj(doPotwierdzenia.m, doPotwierdzenia.data, doPotwierdzenia.godzina, true)} data-potwierdz-date>
              {h.ustaw}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
